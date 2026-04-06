import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';

// Zona horaria de Bogotá, Colombia (UTC-5)
const TIMEZONE = 'America/Bogota';

// Helper: Obtiene la fecha/hora actual en Bogotá
const getBogotaDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
};

// Helper: Obtiene la fecha de hoy en formato YYYY-MM-DD (Bogotá)
const getTodayBogota = () => {
  const bogota = getBogotaDate();
  return bogota.getFullYear() + '-' +
    String(bogota.getMonth() + 1).padStart(2, '0') + '-' +
    String(bogota.getDate()).padStart(2, '0');
};

// Helper: Obtiene la fecha de ayer en formato YYYY-MM-DD (Bogotá)
const getYesterdayBogota = () => {
  const bogota = getBogotaDate();
  bogota.setDate(bogota.getDate() - 1);
  return bogota.getFullYear() + '-' +
    String(bogota.getMonth() + 1).padStart(2, '0') + '-' +
    String(bogota.getDate()).padStart(2, '0');
};

// Helper: Calcula la siguiente fecha límite para una tarea recurrente.
// Si la tarea tenía due_date, suma desde ahí; si no, desde hoy.
function calculateNextDueDate(currentDueDateStr, recurrence) {
  let baseDate;
  if (currentDueDateStr) {
    // Parsear YYYY-MM-DD evitando shifts de zona horaria
    const parts = String(currentDueDateStr).split('T')[0].split('-');
    baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    baseDate = getBogotaDate();
    baseDate.setHours(0, 0, 0, 0);
  }

  switch (recurrence) {
    case 'daily':
      baseDate.setDate(baseDate.getDate() + 1);
      break;
    case 'weekly':
      baseDate.setDate(baseDate.getDate() + 7);
      break;
    case 'monthly':
      baseDate.setMonth(baseDate.getMonth() + 1);
      break;
    default:
      return null;
  }

  return baseDate.getFullYear() + '-' +
    String(baseDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(baseDate.getDate()).padStart(2, '0');
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.toggle_complete !== undefined) {
      // Toggle completion status
      const task = await queryOne('SELECT * FROM AppChecklist_tasks WHERE id = $1', [id]);

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      // Convert to proper boolean - handle both SMALLINT (1/0) and BOOLEAN columns
      const currentCompleted = task.is_completed === true || task.is_completed === 1 || task.is_completed === '1';
      const newCompletedStatus = !currentCompleted;

      await query(
        `UPDATE AppChecklist_tasks
         SET is_completed = $1,
             completed_at = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newCompletedStatus ? 1 : 0, newCompletedStatus ? getBogotaDate() : null, id]
      );

      // Update streak if completing a task
      if (newCompletedStatus) {
        await updateStreak(task.assigned_to);

        // Notificar al que asignó la tarea (si es la pareja, no avisar al mismo)
        try {
          if (task.assigned_by && task.assigned_by !== task.assigned_to) {
            const completer = await queryOne(
              'SELECT name FROM AppChecklist_users WHERE id = $1',
              [task.assigned_to]
            );
            await sendPushToUser(task.assigned_by, {
              title: `🎉 ${completer?.name || 'Tu pareja'} completó una tarea`,
              body: task.title,
              tag: `task-done-${id}`,
            });
          }
        } catch (pushErr) {
          console.error('Error sending push for completion:', pushErr);
        }

        // Si la tarea es recurrente, generar la siguiente instancia
        if (task.recurrence) {
          const nextDueDate = calculateNextDueDate(task.due_date, task.recurrence);
          if (nextDueDate) {
            try {
              await query(
                `INSERT INTO AppChecklist_tasks
                 (title, description, assigned_to, assigned_by, due_date, priority,
                  category_id, project_id, recurrence, recurrence_days, is_shared)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [task.title, task.description, task.assigned_to, task.assigned_by,
                 nextDueDate, task.priority, task.category_id, task.project_id,
                 task.recurrence, task.recurrence_days, task.is_shared || false]
              );
            } catch (recurErr) {
              console.error('Error creating recurring task:', recurErr);
            }
          }
        }
      }

      return NextResponse.json({ success: true, completed: newCompletedStatus ? true : false });
    } else if (body.reaction !== undefined) {
      // Update reaction
      await query(
        `UPDATE AppChecklist_tasks SET reaction = $1, updated_at = NOW() WHERE id = $2`,
        [body.reaction || null, id]
      );

      // Notificar al usuario que completó la tarea de la reacción recibida
      try {
        if (body.reaction) {
          const task = await queryOne(
            'SELECT title, assigned_to, assigned_by FROM AppChecklist_tasks WHERE id = $1',
            [id]
          );
          if (task && task.assigned_to && task.assigned_to !== task.assigned_by) {
            const reactor = await queryOne(
              'SELECT name FROM AppChecklist_users WHERE id = $1',
              [task.assigned_by]
            );
            await sendPushToUser(task.assigned_to, {
              title: `${body.reaction} ${reactor?.name || 'Tu pareja'} reaccionó a tu tarea`,
              body: task.title,
              tag: `reaction-${id}`,
            });
          }
        }
      } catch (pushErr) {
        console.error('Error sending push for reaction:', pushErr);
      }

      return NextResponse.json({ success: true });
    } else {
      // Update task details — con optimistic locking si el cliente envía
      // expected_updated_at. Esto previene que un usuario sobrescriba los
      // cambios de su pareja en silencio.
      const {
        title, description, assigned_to, due_date, priority,
        category_id, project_id, recurrence, recurrence_days, is_shared,
        expected_updated_at,
      } = body;

      let updated;
      if (expected_updated_at) {
        updated = await query(
          `UPDATE AppChecklist_tasks
           SET title = $1, description = $2, assigned_to = $3, due_date = $4, priority = $5,
               category_id = $6, project_id = $7, recurrence = $8, recurrence_days = $9, is_shared = $10, updated_at = NOW()
           WHERE id = $11 AND updated_at = $12
           RETURNING id`,
          [title, description || null, assigned_to, due_date || null, priority,
           category_id || null, project_id || null, recurrence || null, recurrence_days || null, is_shared || false,
           id, expected_updated_at]
        );
      } else {
        updated = await query(
          `UPDATE AppChecklist_tasks
           SET title = $1, description = $2, assigned_to = $3, due_date = $4, priority = $5,
               category_id = $6, project_id = $7, recurrence = $8, recurrence_days = $9, is_shared = $10, updated_at = NOW()
           WHERE id = $11
           RETURNING id`,
          [title, description || null, assigned_to, due_date || null, priority,
           category_id || null, project_id || null, recurrence || null, recurrence_days || null, is_shared || false, id]
        );
      }

      // Si vino expected_updated_at y no se actualizó nada, hubo conflict.
      if (expected_updated_at && updated.length === 0) {
        const current = await queryOne(
          `SELECT t.*,
            u_to.name as assigned_to_name, u_to.avatar_emoji as assigned_to_avatar,
            u_by.name as assigned_by_name, u_by.avatar_emoji as assigned_by_avatar
           FROM AppChecklist_tasks t
           JOIN AppChecklist_users u_to ON t.assigned_to = u_to.id
           JOIN AppChecklist_users u_by ON t.assigned_by = u_by.id
           WHERE t.id = $1`,
          [id]
        );
        return NextResponse.json(
          { error: 'conflict', message: 'La tarea fue modificada por tu pareja', current },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

async function updateStreak(userId) {
  try {
    const today = getTodayBogota();
    const yesterdayStr = getYesterdayBogota();

    // Simple approach: first check if streak exists
    const existingStreak = await queryOne(
      'SELECT * FROM AppChecklist_streaks WHERE user_id = $1',
      [userId]
    );

    if (!existingStreak) {
      // Create new streak
      await query(
        'INSERT INTO AppChecklist_streaks (user_id, current_streak, best_streak, last_activity) VALUES ($1, 1, 1, $2)',
        [userId, today]
      );
    } else {
      // Extraer la fecha de last_activity de forma segura (sin problemas de zona horaria)
      const lastActivity = existingStreak.last_activity
        ? String(existingStreak.last_activity).split('T')[0]
        : null;

      if (lastActivity === today) {
        // Already updated today, do nothing
        return;
      }

      let newStreak = 1;
      if (lastActivity === yesterdayStr) {
        newStreak = existingStreak.current_streak + 1;
      }

      const newBest = Math.max(newStreak, existingStreak.best_streak);

      await query(
        'UPDATE AppChecklist_streaks SET current_streak = $1, best_streak = $2, last_activity = $3, updated_at = NOW() WHERE user_id = $4',
        [newStreak, newBest, today, userId]
      );
    }
  } catch (error) {
    console.error('Error updating streak:', error);
    // Don't rethrow - streak update failure shouldn't break task toggle
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    // Soft delete: marcar deleted_at en lugar de borrar realmente.
    // Esto permite "deshacer" desde el cliente durante un periodo corto.
    await query(
      'UPDATE AppChecklist_tasks SET deleted_at = NOW() WHERE id = $1',
      [id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

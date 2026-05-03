import { NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';
import { getBogotaDate, getTodayBogota, getYesterdayBogota } from '@/lib/timezone';
import {
  toggleTaskSchema,
  reactionTaskSchema,
  updateTaskSchema,
  validateBody,
} from '@/lib/validation/schemas';

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
      const validation = validateBody(toggleTaskSchema, body);
      if (validation.error) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const task = await queryOne('SELECT * FROM AppChecklist_tasks WHERE id = $1', [id]);

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      // is_completed es BOOLEAN puro (normalizado por la migración en db.js)
      const newCompletedStatus = !task.is_completed;

      // Envolvemos UPDATE + (opcional) INSERT recurrente + streak update
      // en una sola transacción. Si cualquier step falla, todo se revierte
      // para no dejar la tarea "completa pero sin siguiente instancia" o
      // con un streak desactualizado.
      //
      // Push notifications quedan FUERA de la transacción: son efectos
      // externos y no deben tumbar el commit principal si fallan.
      const today = getTodayBogota();
      const yesterdayStr = getYesterdayBogota();
      await withTransaction(async (tx) => {
        await tx.query(
          `UPDATE AppChecklist_tasks
           SET is_completed = $1,
               completed_at = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [newCompletedStatus, newCompletedStatus ? getBogotaDate() : null, id]
        );

        if (newCompletedStatus && task.recurrence) {
          const nextDueDate = calculateNextDueDate(task.due_date, task.recurrence);
          if (nextDueDate) {
            await tx.query(
              `INSERT INTO AppChecklist_tasks
               (title, description, assigned_to, assigned_by, due_date, priority,
                category_id, project_id, recurrence, recurrence_days, is_shared)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [task.title, task.description, task.assigned_to, task.assigned_by,
               nextDueDate, task.priority, task.category_id, task.project_id,
               task.recurrence, task.recurrence_days, task.is_shared || false]
            );
          }
        }

        // Streak update atómico dentro de la transacción.
        //
        // Antes era un read-then-write en updateStreak() que vivía fuera
        // del withTransaction: dos toggles concurrentes podían leer el
        // mismo last_activity y pisarse, dejando current_streak en 1
        // cuando debía ser 2. Ahora es un único INSERT ... ON CONFLICT
        // DO UPDATE con CASE SQL, que el motor garantiza atómico.
        //
        // - Si last_activity = today → no incrementamos (ya contó hoy)
        // - Si last_activity = yesterday → +1 (continuó la racha)
        // - Cualquier otra cosa → reset a 1 (rompió la racha)
        // - best_streak siempre es GREATEST(actual, nuevo)
        if (newCompletedStatus) {
          await tx.query(
            `INSERT INTO AppChecklist_streaks (user_id, current_streak, best_streak, last_activity)
             VALUES ($1, 1, 1, $2)
             ON CONFLICT (user_id) DO UPDATE SET
               current_streak = CASE
                 WHEN AppChecklist_streaks.last_activity = $2 THEN AppChecklist_streaks.current_streak
                 WHEN AppChecklist_streaks.last_activity = $3 THEN AppChecklist_streaks.current_streak + 1
                 ELSE 1
               END,
               best_streak = GREATEST(
                 AppChecklist_streaks.best_streak,
                 CASE
                   WHEN AppChecklist_streaks.last_activity = $2 THEN AppChecklist_streaks.current_streak
                   WHEN AppChecklist_streaks.last_activity = $3 THEN AppChecklist_streaks.current_streak + 1
                   ELSE 1
                 END
               ),
               last_activity = $2,
               updated_at = NOW()`,
            [task.assigned_to, today, yesterdayStr]
          );
        }
      });

      // Push notifications post-commit (no transaccionales).
      if (newCompletedStatus) {
        try {
          if (task.assigned_by && task.assigned_by !== task.assigned_to) {
            const completer = await queryOne(
              'SELECT name FROM AppChecklist_users WHERE id = $1',
              [task.assigned_to]
            );
            // No bloqueante: si el push falla, el toggle ya está commiteado.
            sendPushToUser(task.assigned_by, {
              title: `🎉 ${completer?.name || 'Tu pareja'} completó una tarea`,
              body: task.title,
              tag: `task-done-${id}`,
            }).catch((pushErr) =>
              console.error('Background push for completion failed:', pushErr)
            );
          }
        } catch (pushErr) {
          console.error('Error sending push for completion:', pushErr);
        }
      }

      return NextResponse.json({ success: true, completed: newCompletedStatus ? true : false });
    } else if (body.reaction !== undefined) {
      // Update reaction
      const validation = validateBody(reactionTaskSchema, body);
      if (validation.error) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      await query(
        `UPDATE AppChecklist_tasks SET reaction = $1, updated_at = NOW() WHERE id = $2`,
        [validation.data.reaction || null, id]
      );

      // Notificar al usuario que completó la tarea de la reacción recibida.
      // Push no bloqueante: el response al cliente no espera al servicio externo.
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
            sendPushToUser(task.assigned_to, {
              title: `${body.reaction} ${reactor?.name || 'Tu pareja'} reaccionó a tu tarea`,
              body: task.title,
              tag: `reaction-${id}`,
            }).catch((pushErr) =>
              console.error('Background push for reaction failed:', pushErr)
            );
          }
        }
      } catch (pushErr) {
        console.error('Error preparing push for reaction:', pushErr);
      }

      return NextResponse.json({ success: true });
    } else {
      // Update task details — con optimistic locking si el cliente envía
      // expected_updated_at. Esto previene que un usuario sobrescriba los
      // cambios de su pareja en silencio.
      const validation = validateBody(updateTaskSchema, body);
      if (validation.error) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const {
        title, description, assigned_to, due_date, priority,
        category_id, project_id, recurrence, recurrence_days, is_shared,
        expected_updated_at,
      } = validation.data;

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

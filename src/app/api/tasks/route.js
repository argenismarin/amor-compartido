import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';
import { createTaskSchema, validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';
import { logActivity } from '@/lib/activity';

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const filter = searchParams.get('filter');
    const categoryId = searchParams.get('categoryId');
    const projectId = searchParams.get('projectId');
    const excludeProjectTasks = searchParams.get('excludeProjectTasks') === 'true';

    let sql = `
      SELECT t.*,
        u_to.name as assigned_to_name, u_to.avatar_emoji as assigned_to_avatar,
        u_by.name as assigned_by_name, u_by.avatar_emoji as assigned_by_avatar,
        c.name as category_name, c.emoji as category_emoji, c.color as category_color,
        p.name as project_name, p.emoji as project_emoji, p.color as project_color,
        COALESCE(subs.subtasks, '[]'::json) as subtasks
      FROM AppChecklist_tasks t
      JOIN AppChecklist_users u_to ON t.assigned_to = u_to.id
      JOIN AppChecklist_users u_by ON t.assigned_by = u_by.id
      LEFT JOIN AppChecklist_categories c ON t.category_id = c.id
      LEFT JOIN AppChecklist_projects p ON t.project_id = p.id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', s.id,
            'title', s.title,
            'is_completed', s.is_completed,
            'sort_order', s.sort_order
          ) ORDER BY s.sort_order, s.id
        ) as subtasks
        FROM AppChecklist_subtasks s WHERE s.task_id = t.id
      ) subs ON true
    `;

    let params = [];
    let paramIndex = 1;
    let whereAdded = false;

    const addWhere = (condition) => {
      sql += whereAdded ? ' AND ' : ' WHERE ';
      sql += condition;
      whereAdded = true;
    };

    // Excluir tareas soft-deleted siempre
    addWhere('t.deleted_at IS NULL');

    if (userId && filter === 'myTasks') {
      // Include tasks assigned to user OR shared tasks
      addWhere(`(t.assigned_to = $${paramIndex} OR t.is_shared = true)`);
      params.push(userId);
      paramIndex++;
    } else if (userId && filter === 'assignedByOther') {
      // Tasks assigned to me by the other person, OR shared tasks created by the other person
      addWhere(`((t.assigned_to = $${paramIndex} AND t.assigned_by != $${paramIndex + 1}) OR (t.is_shared = true AND t.assigned_by != $${paramIndex + 2}))`);
      params.push(userId, userId, userId);
      paramIndex += 3;
    } else if (userId && filter === 'assignedToOther') {
      // Tasks I assigned to the other person (not shared ones, those are for both)
      addWhere(`t.assigned_by = $${paramIndex} AND t.assigned_to != $${paramIndex + 1} AND (t.is_shared = false OR t.is_shared IS NULL)`);
      params.push(userId, userId);
      paramIndex += 2;
    }

    if (categoryId) {
      addWhere(`t.category_id = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    }

    // Filter by project: 'null' for tasks without project, number for specific project
    if (projectId === 'null') {
      addWhere(`t.project_id IS NULL`);
    } else if (projectId) {
      addWhere(`t.project_id = $${paramIndex}`);
      params.push(projectId);
      paramIndex++;
    }

    // Exclude tasks that belong to a project (for main task lists)
    if (excludeProjectTasks) {
      addWhere(`t.project_id IS NULL`);
    }

    sql += ' ORDER BY t.is_completed ASC, t.priority DESC, t.created_at DESC';

    const tasks = await query(sql, params);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request) {
  // Rate limit: 30 tareas/min/IP. Suficiente para uso humano normal,
  // corta abuso burdo (scripts que crean cientos en segundos).
  const limited = enforceRateLimit(request, 'POST /api/tasks', 30, 60_000);
  if (limited) return limited;
  try {
    const body = await request.json();
    const { data, error } = validateBody(createTaskSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const {
      title, description, assigned_to, assigned_by, due_date, priority,
      category_id, project_id, recurrence, recurrence_days, is_shared,
    } = data;

    const result = await queryOne(
      `INSERT INTO AppChecklist_tasks (title, description, assigned_to, assigned_by, due_date, priority, category_id, project_id, recurrence, recurrence_days, is_shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [title, description || null, assigned_to, assigned_by, due_date || null, priority || 'medium',
       category_id || null, project_id || null, recurrence || null, recurrence_days || null, is_shared || false]
    );

    // Notificar a la pareja si se le asignó la tarea (no avisar al que la creó).
    // Tareas compartidas (is_shared) → notificar al "otro" (assigned_to ya es el creador en ese caso).
    //
    // sendPushToUser se ejecuta NO bloqueante: el response al cliente no
    // espera al servicio de push externo. Si falla, se loggea pero la
    // tarea ya está creada.
    try {
      if (is_shared && assigned_by) {
        // Tarea compartida: notificar al otro usuario
        const otherUser = await queryOne(
          'SELECT id FROM AppChecklist_users WHERE id != $1 LIMIT 1',
          [assigned_by]
        );
        if (otherUser) {
          sendPushToUser(otherUser.id, {
            title: '💕 Nueva tarea compartida',
            body: title,
            tag: `task-${result.id}`,
          }).catch((pushErr) =>
            console.error('Background push for shared task failed:', pushErr)
          );
        }
      } else if (assigned_to && assigned_by && assigned_to !== assigned_by) {
        // Tarea asignada a la pareja
        const assigner = await queryOne(
          'SELECT name FROM AppChecklist_users WHERE id = $1',
          [assigned_by]
        );
        sendPushToUser(assigned_to, {
          title: `💌 ${assigner?.name || 'Tu pareja'} te asignó una tarea`,
          body: title,
          tag: `task-${result.id}`,
        }).catch((pushErr) =>
          console.error('Background push for assigned task failed:', pushErr)
        );
      }
    } catch (pushErr) {
      // No bloquear la creación si el lookup de usuario falla
      console.error('Error preparing push for new task:', pushErr);
    }

    logActivity({
      actorId: assigned_by,
      action: 'task.create',
      targetType: 'task',
      targetId: result.id,
      meta: { title, assigned_to, is_shared, project_id },
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

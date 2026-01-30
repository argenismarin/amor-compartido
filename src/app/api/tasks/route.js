import { NextResponse } from 'next/server';
import { query, queryOne, initDatabase } from '@/lib/db';

export async function GET(request) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const filter = searchParams.get('filter');

    let sql = `
      SELECT t.*,
        u_to.name as assigned_to_name, u_to.avatar_emoji as assigned_to_avatar,
        u_by.name as assigned_by_name, u_by.avatar_emoji as assigned_by_avatar
      FROM AppChecklist_tasks t
      JOIN AppChecklist_users u_to ON t.assigned_to = u_to.id
      JOIN AppChecklist_users u_by ON t.assigned_by = u_by.id
    `;

    let params = [];
    let paramIndex = 1;

    if (userId && filter === 'myTasks') {
      sql += ` WHERE t.assigned_to = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (userId && filter === 'assignedByOther') {
      sql += ` WHERE t.assigned_to = $${paramIndex} AND t.assigned_by != $${paramIndex + 1}`;
      params.push(userId, userId);
      paramIndex += 2;
    } else if (userId && filter === 'assignedToOther') {
      sql += ` WHERE t.assigned_by = $${paramIndex} AND t.assigned_to != $${paramIndex + 1}`;
      params.push(userId, userId);
      paramIndex += 2;
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
  try {
    const { title, description, assigned_to, assigned_by, due_date, priority } = await request.json();

    const result = await queryOne(
      `INSERT INTO AppChecklist_tasks (title, description, assigned_to, assigned_by, due_date, priority)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, description || null, assigned_to, assigned_by, due_date || null, priority || 'medium']
    );

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

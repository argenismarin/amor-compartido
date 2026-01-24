import { NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';

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
    
    if (userId && filter === 'myTasks') {
      sql += ' WHERE t.assigned_to = ?';
      params.push(userId);
    } else if (userId && filter === 'assignedByOther') {
      sql += ' WHERE t.assigned_to = ? AND t.assigned_by != ?';
      params.push(userId, userId);
    } else if (userId && filter === 'assignedToOther') {
      sql += ' WHERE t.assigned_by = ? AND t.assigned_to != ?';
      params.push(userId, userId);
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
    
    const result = await query(
      `INSERT INTO AppChecklist_tasks (title, description, assigned_to, assigned_by, due_date, priority) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description || null, assigned_to, assigned_by, due_date || null, priority || 'medium']
    );
    
    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

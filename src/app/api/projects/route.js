import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let sql = `
      SELECT p.*,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.is_completed = true THEN 1 END) as completed_tasks
      FROM AppChecklist_projects p
      LEFT JOIN AppChecklist_tasks t ON t.project_id = p.id
    `;

    if (!includeArchived) {
      sql += ' WHERE p.is_archived = false';
    }

    sql += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const projects = await query(sql);
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const { name, description, emoji, color, due_date } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO AppChecklist_projects (name, description, emoji, color, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name.trim(), description || null, emoji || '📁', color || '#6366f1', due_date || null]
    );

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

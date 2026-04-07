import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';
import { createProjectSchema, validateBody } from '@/lib/validation/schemas';

// La tabla AppChecklist_projects y la columna project_id en tasks se crean
// en initDatabase() / ensureDatabase(). No hace falta una función extra acá.

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let sql = `
      SELECT p.*,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.is_completed THEN 1 END) as completed_tasks
      FROM AppChecklist_projects p
      LEFT JOIN AppChecklist_tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
    `;

    // Filter out archived projects
    if (!includeArchived) {
      // IS NOT TRUE incluye tanto FALSE como NULL (filas legacy)
      sql += ' WHERE p.is_archived IS NOT TRUE';
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
    const body = await request.json();
    const { data, error } = validateBody(createProjectSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const { name, description, emoji, color, due_date } = data;

    const result = await queryOne(
      `INSERT INTO AppChecklist_projects (name, description, emoji, color, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, description || null, emoji, color, due_date || null]
    );

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

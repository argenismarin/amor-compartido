import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';
import { createProjectSchema, validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';
import { logActivity } from '@/lib/activity';

// La tabla AppChecklist_projects y la columna project_id en tasks se crean
// en initDatabase() / ensureDatabase(). No hace falta una función extra acá.

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // total_tasks/completed_tasks vienen desnormalizadas en la tabla
    // (mantenidas por trigger trg_tasks_project_counters_iud, ver db.js).
    // Antes esto era LEFT JOIN + COUNT + GROUP BY que escalaba mal con
    // muchas tareas por proyecto.
    let sql = `SELECT * FROM AppChecklist_projects`;
    if (!includeArchived) {
      // IS NOT TRUE incluye tanto FALSE como NULL (filas legacy)
      sql += ' WHERE is_archived IS NOT TRUE';
    }
    sql += ' ORDER BY created_at DESC';

    const projects = await query(sql);
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request) {
  const limited = enforceRateLimit(request, 'POST /api/projects', 20, 60_000);
  if (limited) return limited;
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

    logActivity({
      action: 'project.create',
      targetType: 'project',
      targetId: result.id,
      meta: { name },
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

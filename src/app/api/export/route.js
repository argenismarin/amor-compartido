import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

// GET /api/export — dump JSON completo de datos del app.
//
// Devuelve tasks (con subtasks anidadas), projects (incl. archivados)
// y special_dates. NO incluye users, categorías, streaks, achievements
// ni push_subscriptions — esos son estado interno o tokens que se
// regeneran automáticamente.
//
// El cliente recibe Content-Disposition para descargar automáticamente
// como `amor-compartido-backup-YYYY-MM-DD.json`.
export async function GET() {
  try {
    await ensureDatabase();

    // Tasks con subtasks anidadas (mismo pattern que /api/tasks GET)
    // Incluimos las eliminadas SOFT para preservar el historial completo
    const tasks = await query(`
      SELECT
        t.id, t.title, t.description, t.assigned_to, t.assigned_by,
        t.is_completed, t.completed_at, t.due_date, t.priority,
        t.reaction, t.category_id, t.project_id, t.recurrence,
        t.recurrence_days, t.is_shared, t.created_at, t.updated_at,
        t.deleted_at,
        COALESCE(subs.subtasks, '[]'::json) as subtasks
      FROM AppChecklist_tasks t
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', s.id,
            'title', s.title,
            'is_completed', s.is_completed,
            'sort_order', s.sort_order,
            'created_at', s.created_at
          ) ORDER BY s.sort_order, s.id
        ) as subtasks
        FROM AppChecklist_subtasks s WHERE s.task_id = t.id
      ) subs ON true
      ORDER BY t.created_at DESC
    `);

    const projects = await query(`
      SELECT id, name, description, emoji, color, due_date,
             is_archived, created_at, updated_at
      FROM AppChecklist_projects
      ORDER BY created_at DESC
    `);

    const specialDates = await query(`
      SELECT type, date, user_id, label, created_at
      FROM AppChecklist_special_dates
      ORDER BY created_at
    `);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stats: {
        tasks: tasks.length,
        projects: projects.length,
        specialDates: specialDates.length,
      },
      tasks,
      projects,
      specialDates,
    };

    const today = new Date().toISOString().split('T')[0];
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="amor-compartido-backup-${today}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

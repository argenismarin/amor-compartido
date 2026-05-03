import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

// GET /api/stats — métricas para el dashboard de pareja.
//
// Devuelve:
//   {
//     byUser: [{ id, name, completed, created }],
//     byCategory: [{ id, name, emoji, color, completed }],
//     last30Days: [{ date, completed }],   // serie diaria para grafica
//     byPriority: [{ priority, completed }],
//     totals: { completed_all_time, completed_this_week, completed_today }
//   }
//
// Diseñado para que el frontend lo render como un dashboard sin
// queries adicionales — todo viene en una sola request.
export async function GET() {
  try {
    await ensureDatabase();

    // Por usuario: cuantas creadas y cuantas completadas (asignadas)
    const byUser = await query(`
      SELECT
        u.id, u.name, u.avatar_emoji,
        COUNT(t.id) FILTER (WHERE t.assigned_to = u.id AND t.is_completed) AS completed,
        COUNT(t.id) FILTER (WHERE t.assigned_by = u.id) AS created
      FROM AppChecklist_users u
      LEFT JOIN AppChecklist_tasks t ON t.deleted_at IS NULL
      GROUP BY u.id, u.name, u.avatar_emoji
      ORDER BY u.id
    `);

    // Por categoria
    const byCategory = await query(`
      SELECT
        c.id, c.name, c.emoji, c.color,
        COUNT(t.id) FILTER (WHERE t.is_completed AND t.deleted_at IS NULL) AS completed
      FROM AppChecklist_categories c
      LEFT JOIN AppChecklist_tasks t ON t.category_id = c.id
      GROUP BY c.id, c.name, c.emoji, c.color
      ORDER BY completed DESC, c.id
    `);

    // Ultimos 30 dias: tareas completadas por dia (en TZ Bogota).
    // Usamos generate_series + LEFT JOIN para garantizar que dias sin
    // tareas tambien aparecen como 0.
    const last30Days = await query(`
      WITH days AS (
        SELECT (CURRENT_DATE AT TIME ZONE 'America/Bogota')::date - i AS date
        FROM generate_series(0, 29) i
      )
      SELECT
        d.date,
        COUNT(t.id) AS completed
      FROM days d
      LEFT JOIN AppChecklist_tasks t
        ON t.is_completed
        AND t.deleted_at IS NULL
        AND (t.completed_at AT TIME ZONE 'America/Bogota')::date = d.date
      GROUP BY d.date
      ORDER BY d.date ASC
    `);

    // Por prioridad
    const byPriority = await query(`
      SELECT priority, COUNT(*) AS completed
      FROM AppChecklist_tasks
      WHERE is_completed AND deleted_at IS NULL
      GROUP BY priority
    `);

    // Totales agregados
    const totalsRow = await query(`
      SELECT
        COUNT(*) FILTER (WHERE is_completed) AS completed_all_time,
        COUNT(*) FILTER (
          WHERE is_completed
          AND completed_at >= date_trunc('week', CURRENT_DATE AT TIME ZONE 'America/Bogota')
        ) AS completed_this_week,
        COUNT(*) FILTER (
          WHERE is_completed
          AND (completed_at AT TIME ZONE 'America/Bogota')::date = (CURRENT_DATE AT TIME ZONE 'America/Bogota')::date
        ) AS completed_today
      FROM AppChecklist_tasks
      WHERE deleted_at IS NULL
    `);

    return NextResponse.json({
      byUser,
      byCategory,
      last30Days,
      byPriority,
      totals: totalsRow[0] || {},
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

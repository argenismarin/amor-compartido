import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

// Zona horaria de Bogotá, Colombia (UTC-5)
const TIMEZONE = 'America/Bogota';

// Helper: Obtiene la fecha/hora actual en Bogotá
const getBogotaDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
};

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let sql = `
      SELECT t.*,
        u_to.name as assigned_to_name, u_to.avatar_emoji as assigned_to_avatar,
        u_by.name as assigned_by_name, u_by.avatar_emoji as assigned_by_avatar,
        c.name as category_name, c.emoji as category_emoji
      FROM AppChecklist_tasks t
      JOIN AppChecklist_users u_to ON t.assigned_to = u_to.id
      JOIN AppChecklist_users u_by ON t.assigned_by = u_by.id
      LEFT JOIN AppChecklist_categories c ON t.category_id = c.id
      WHERE t.is_completed = true
    `;

    const params = [];
    let paramIndex = 1;

    if (userId) {
      sql += ` AND t.assigned_to = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    sql += ` ORDER BY t.completed_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const tasks = await query(sql, params);

    // Get stats
    let statsParams = [];
    let statsParamIndex = 1;
    let statsWhere = 'WHERE is_completed = true';

    if (userId) {
      statsWhere += ` AND assigned_to = $${statsParamIndex}`;
      statsParams.push(userId);
      statsParamIndex++;
    }

    // This week's completed tasks (usando hora de Bogotá)
    const weekStart = getBogotaDate();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekStats = await query(`
      SELECT COUNT(*) as week_count
      FROM AppChecklist_tasks
      ${statsWhere} AND completed_at >= $${statsParamIndex}
    `, [...statsParams, weekStart.toISOString()]);

    // Total completed
    const totalStats = await query(`
      SELECT COUNT(*) as total_count
      FROM AppChecklist_tasks
      ${statsWhere}
    `, statsParams);

    return NextResponse.json({
      tasks,
      stats: {
        thisWeek: parseInt(weekStats[0]?.week_count || 0),
        total: parseInt(totalStats[0]?.total_count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

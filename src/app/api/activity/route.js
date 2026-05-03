import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

// GET /api/activity — feed de actividad reciente.
//
// Query params:
//   - limit  (1-100, default 50)
//   - offset (>=0, default 0)
//   - actorId (opcional, filtrar por usuario)
//
// Devuelve array de { id, actor_id, actor_name, actor_avatar, action,
//   target_type, target_id, meta, created_at } ordenado DESC.
//
// El frontend puede renderizar esto como timeline ("Argenis completó X
// hace 2h") con strings localizados según action.
export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const actorId = searchParams.get('actorId');

    let sql = `
      SELECT a.id, a.actor_id, u.name AS actor_name, u.avatar_emoji AS actor_avatar,
             a.action, a.target_type, a.target_id, a.meta, a.created_at
      FROM AppChecklist_activity a
      LEFT JOIN AppChecklist_users u ON a.actor_id = u.id
    `;
    const params = [];
    let paramIndex = 1;
    if (actorId) {
      sql += ` WHERE a.actor_id = $${paramIndex}`;
      params.push(actorId);
      paramIndex++;
    }
    sql += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const activities = await query(sql, params);
    return NextResponse.json({ activities, limit, offset });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}

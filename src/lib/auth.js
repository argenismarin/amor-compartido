// Helpers de auth + spaces (M20).
//
// Modo legacy: la app sigue funcionando sin login. currentUserId viene
// de localStorage (cliente) o se asume del primer space para queries
// server-side cuando no hay header de auth.
//
// Modo auth (futuro): cuando NEXT_PUBLIC_AUTH_ENABLED=true, los
// endpoints van a esperar `Authorization: Bearer <token>` o cookie de
// session. Por ahora solo proveemos los helpers de space resolution.

import { query, queryOne } from '@/lib/db';

/**
 * Devuelve el space activo para un usuario. Si pertenece a varios
 * (futuro), por ahora elige el primero (el de membresia mas antigua).
 *
 * @param {number} userId
 * @returns {Promise<{ id: number, name: string, role: string } | null>}
 */
export async function getActiveSpaceForUser(userId) {
  if (!userId) return null;
  return queryOne(
    `SELECT s.id, s.name, m.role
     FROM AppChecklist_spaces s
     JOIN AppChecklist_space_members m ON m.space_id = s.id
     WHERE m.user_id = $1
     ORDER BY m.joined_at ASC
     LIMIT 1`,
    [userId]
  );
}

/**
 * Devuelve TODOS los spaces de un user (para el selector si pertenece
 * a varios).
 */
export async function getSpacesForUser(userId) {
  if (!userId) return [];
  return query(
    `SELECT s.id, s.name, m.role, m.joined_at
     FROM AppChecklist_spaces s
     JOIN AppChecklist_space_members m ON m.space_id = s.id
     WHERE m.user_id = $1
     ORDER BY m.joined_at ASC`,
    [userId]
  );
}

/**
 * Verifica si un user es miembro de un space. Para guards de queries.
 */
export async function isMemberOf(userId, spaceId) {
  if (!userId || !spaceId) return false;
  const row = await queryOne(
    `SELECT 1 FROM AppChecklist_space_members
     WHERE user_id = $1 AND space_id = $2 LIMIT 1`,
    [userId, spaceId]
  );
  return !!row;
}

/**
 * Resuelve el space para una request. Estrategia:
 *  1. Si viene `X-Space-Id` header y el user es miembro, usarlo.
 *  2. Si no, devolver el primer space del user.
 *  3. Si user no esta logueado (legacy), devolver el primer space del
 *     sistema (compatibilidad).
 *
 * Diseñado para que las API routes hagan:
 *   const space = await resolveSpace(request, userId);
 *   if (!space) return 401;
 *   await query('... WHERE space_id = $1', [space.id]);
 */
export async function resolveSpace(request, userId) {
  const headerSpaceId = parseInt(request.headers.get('x-space-id') || '0', 10);
  if (headerSpaceId && userId && (await isMemberOf(userId, headerSpaceId))) {
    return queryOne(
      `SELECT id, name FROM AppChecklist_spaces WHERE id = $1`,
      [headerSpaceId]
    );
  }
  if (userId) {
    return getActiveSpaceForUser(userId);
  }
  // Legacy fallback: primer space del sistema
  return queryOne(`SELECT id, name FROM AppChecklist_spaces ORDER BY id LIMIT 1`);
}

/**
 * Crear un nuevo space e invitar al creador como admin.
 */
export async function createSpace(name, createdBy) {
  const space = await queryOne(
    `INSERT INTO AppChecklist_spaces (name, created_by) VALUES ($1, $2) RETURNING id, name`,
    [name, createdBy]
  );
  if (space) {
    await query(
      `INSERT INTO AppChecklist_space_members (space_id, user_id, role) VALUES ($1, $2, 'admin')
       ON CONFLICT DO NOTHING`,
      [space.id, createdBy]
    );
  }
  return space;
}

/**
 * Invitar a un user a un space existente. El caller debe verificar
 * que actor es admin antes de invocar.
 */
export async function addMember(spaceId, userId, role = 'member') {
  return query(
    `INSERT INTO AppChecklist_space_members (space_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (space_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [spaceId, userId, role]
  );
}

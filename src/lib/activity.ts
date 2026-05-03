import { query } from '@/lib/db';

// logActivity — registra una accion en AppChecklist_activity.
//
// Fire-and-forget por defecto: errores de logging NO deben tumbar la
// operacion principal. Se loguean a console pero no se re-lanzan.
//
// Uso (dentro de un handler de API):
//   logActivity({
//     actorId: userId,
//     action: 'task.complete',
//     targetType: 'task',
//     targetId: taskId,
//     meta: { title: task.title },
//   });
//
// El caller NO necesita await — devolvemos la promise por si quiere,
// pero el patron normal es fire-and-forget.

export interface LogActivityInput {
  actorId?: number | null;
  action: string;
  targetType: string;
  targetId?: number | null;
  meta?: Record<string, unknown> | null;
}

export function logActivity({
  actorId = null,
  action,
  targetType,
  targetId = null,
  meta = null,
}: LogActivityInput): Promise<void> {
  return query(
    `INSERT INTO AppChecklist_activity (actor_id, action, target_type, target_id, meta)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, targetType, targetId, meta ? JSON.stringify(meta) : null]
  )
    .then(() => undefined)
    .catch((err: Error) => {
      // No re-lanzar: logging que falla no debe romper la operacion del usuario.
      console.error('[activity] log failed:', err.message, { action, targetType, targetId });
    });
}

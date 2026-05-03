import { NextResponse } from 'next/server';
import { withTransaction, ensureDatabase } from '@/lib/db';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';

// Schema local: el reorder tiene una forma propia que no encaja en
// los schemas reutilizables. Si en el futuro hay otros endpoints
// "batch reorder" se puede mover a schemas.js.
const reorderSubtasksSchema = z.object({
  task_id: z.number().int().positive(),
  // Array de pares { id, sort_order }. El cliente envia el orden
  // completo deseado, no solo los cambios — mas simple y menos prone
  // a inconsistencias.
  order: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sort_order: z.number().int().nonnegative(),
      })
    )
    .min(1)
    .max(100),
});

// PUT /api/subtasks/reorder
// body: { task_id, order: [{id, sort_order}, ...] }
//
// Actualiza sort_order de todas las subtareas indicadas en una sola
// transaccion. Permite drag-and-drop sin queries N+1.
export async function PUT(request) {
  const limited = enforceRateLimit(request, 'PUT /api/subtasks/reorder', 60, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const body = await request.json();
    const { data, error } = validateBody(reorderSubtasksSchema, body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const { task_id, order } = data;

    await withTransaction(async (tx) => {
      for (const { id, sort_order } of order) {
        await tx.query(
          `UPDATE AppChecklist_subtasks
           SET sort_order = $1, updated_at = NOW()
           WHERE id = $2 AND task_id = $3`,
          [sort_order, id, task_id]
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error reordering subtasks:', err);
    return NextResponse.json({ error: 'Failed to reorder subtasks' }, { status: 500 });
  }
}

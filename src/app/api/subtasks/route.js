import { NextResponse } from 'next/server';
import { queryOne, ensureDatabase } from '@/lib/db';
import { createSubtaskSchema, validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';

// POST /api/subtasks — crear subtarea
// body: { task_id, title }
export async function POST(request) {
  const limited = enforceRateLimit(request, 'POST /api/subtasks', 60, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const body = await request.json();
    const { data, error } = validateBody(createSubtaskSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const { task_id, title } = data;

    // sort_order calculado en el mismo INSERT (subquery atómico) para
    // evitar race condition: dos POSTs concurrentes al mismo task_id
    // antes obtenían el mismo MAX y colisionaban en sort_order.
    const result = await queryOne(
      `INSERT INTO AppChecklist_subtasks (task_id, title, sort_order)
       VALUES (
         $1, $2,
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM AppChecklist_subtasks WHERE task_id = $1)
       )
       RETURNING id, task_id, title, is_completed, sort_order`,
      [task_id, title]
    );

    return NextResponse.json({ success: true, subtask: result });
  } catch (error) {
    console.error('Error creating subtask:', error);
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 });
  }
}

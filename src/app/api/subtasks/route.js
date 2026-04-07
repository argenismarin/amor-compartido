import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';
import { createSubtaskSchema, validateBody } from '@/lib/validation/schemas';

// POST /api/subtasks — crear subtarea
// body: { task_id, title }
export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const { data, error } = validateBody(createSubtaskSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const { task_id, title } = data;

    // Calcular el siguiente sort_order
    const maxOrder = await queryOne(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM AppChecklist_subtasks WHERE task_id = $1',
      [task_id]
    );
    const nextOrder = (maxOrder?.max_order || 0) + 1;

    const result = await queryOne(
      `INSERT INTO AppChecklist_subtasks (task_id, title, sort_order)
       VALUES ($1, $2, $3) RETURNING id, task_id, title, is_completed, sort_order`,
      [task_id, title, nextOrder]
    );

    return NextResponse.json({ success: true, subtask: result });
  } catch (error) {
    console.error('Error creating subtask:', error);
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 });
  }
}

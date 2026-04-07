import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  toggleSubtaskSchema,
  updateSubtaskSchema,
  validateBody,
} from '@/lib/validation/schemas';

// PUT /api/subtasks/[id] — actualizar subtarea
// body: { toggle_complete: true } o { title: '...' }
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.toggle_complete !== undefined) {
      const validation = validateBody(toggleSubtaskSchema, body);
      if (validation.error) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      await query(
        `UPDATE AppChecklist_subtasks
         SET is_completed = NOT is_completed, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
      return NextResponse.json({ success: true });
    }

    if (body.title !== undefined) {
      const validation = validateBody(updateSubtaskSchema, body);
      if (validation.error) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      await query(
        'UPDATE AppChecklist_subtasks SET title = $1, updated_at = NOW() WHERE id = $2',
        [validation.data.title, id]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    console.error('Error updating subtask:', error);
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 });
  }
}

// DELETE /api/subtasks/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await query('DELETE FROM AppChecklist_subtasks WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    return NextResponse.json({ error: 'Failed to delete subtask' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.toggle_complete !== undefined) {
      // Toggle completion status
      await query(
        `UPDATE AppChecklist_tasks
         SET is_completed = NOT is_completed,
             completed_at = CASE WHEN is_completed THEN NULL ELSE NOW() END,
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    } else {
      // Update task details
      const { title, description, assigned_to, due_date, priority } = body;
      await query(
        `UPDATE AppChecklist_tasks
         SET title = $1, description = $2, assigned_to = $3, due_date = $4, priority = $5, updated_at = NOW()
         WHERE id = $6`,
        [title, description || null, assigned_to, due_date || null, priority, id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await query('DELETE FROM AppChecklist_tasks WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

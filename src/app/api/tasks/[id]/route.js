import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (body.toggle_complete !== undefined) {
      // Toggle completion status
      await query(
        `UPDATE AppChecklist_tasks 
         SET is_completed = NOT is_completed, 
             completed_at = IF(is_completed, NULL, NOW())
         WHERE id = ?`,
        [id]
      );
    } else {
      // Update task details
      const { title, description, assigned_to, due_date, priority } = body;
      await query(
        `UPDATE AppChecklist_tasks 
         SET title = ?, description = ?, assigned_to = ?, due_date = ?, priority = ?
         WHERE id = ?`,
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
    await query('DELETE FROM AppChecklist_tasks WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

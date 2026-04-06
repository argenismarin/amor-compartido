import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST /api/tasks/[id]/restore — restaura una tarea soft-deleted.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    await query(
      'UPDATE AppChecklist_tasks SET deleted_at = NULL WHERE id = $1',
      [id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring task:', error);
    return NextResponse.json({ error: 'Failed to restore task' }, { status: 500 });
  }
}

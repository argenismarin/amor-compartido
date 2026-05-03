import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rateLimit';
import { logActivity } from '@/lib/activity';

// DELETE /api/comments/[id] — borrar comentario.
// Borrado fisico (no soft) porque comentarios son menos valiosos que
// tareas y el usuario probablemente quiera que desaparezcan al borrar.
export async function DELETE(request, { params }) {
  const limited = enforceRateLimit(request, 'DELETE /api/comments/[id]', 60, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const { id } = await params;
    await query('DELETE FROM AppChecklist_comments WHERE id = $1', [id]);
    logActivity({
      action: 'comment.delete',
      targetType: 'comment',
      targetId: parseInt(id, 10),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting comment:', err);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}

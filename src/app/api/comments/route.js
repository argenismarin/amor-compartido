import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';
import { createCommentSchema, validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';
import { logActivity } from '@/lib/activity';

// GET /api/comments?taskId=N — comentarios de una tarea (orden cronológico)
export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }
    const comments = await query(
      `SELECT c.id, c.task_id, c.author_id, c.body, c.created_at,
              u.name AS author_name, u.avatar_emoji AS author_avatar
       FROM AppChecklist_comments c
       JOIN AppChecklist_users u ON c.author_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );
    return NextResponse.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/comments — crear nuevo comentario
export async function POST(request) {
  const limited = enforceRateLimit(request, 'POST /api/comments', 60, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const body = await request.json();
    const { data, error } = validateBody(createCommentSchema, body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const { task_id, author_id, body: commentBody } = data;

    const result = await queryOne(
      `INSERT INTO AppChecklist_comments (task_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, task_id, author_id, body, created_at`,
      [task_id, author_id, commentBody]
    );

    logActivity({
      actorId: author_id,
      action: 'comment.create',
      targetType: 'task',
      targetId: task_id,
      meta: { commentId: result.id },
    });

    return NextResponse.json({ success: true, comment: result });
  } catch (err) {
    console.error('Error creating comment:', err);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

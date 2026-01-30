import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.toggle_complete !== undefined) {
      // Toggle completion status
      const task = await queryOne('SELECT * FROM AppChecklist_tasks WHERE id = $1', [id]);
      const newCompletedStatus = !task.is_completed;

      await query(
        `UPDATE AppChecklist_tasks
         SET is_completed = $1,
             completed_at = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newCompletedStatus, newCompletedStatus ? new Date() : null, id]
      );

      // Update streak if completing a task
      if (newCompletedStatus) {
        await updateStreak(task.assigned_to);
      }

      return NextResponse.json({ success: true, completed: newCompletedStatus });
    } else if (body.reaction !== undefined) {
      // Update reaction
      await query(
        `UPDATE AppChecklist_tasks SET reaction = $1, updated_at = NOW() WHERE id = $2`,
        [body.reaction || null, id]
      );
      return NextResponse.json({ success: true });
    } else {
      // Update task details
      const { title, description, assigned_to, due_date, priority, category_id, recurrence, recurrence_days } = body;
      await query(
        `UPDATE AppChecklist_tasks
         SET title = $1, description = $2, assigned_to = $3, due_date = $4, priority = $5,
             category_id = $6, recurrence = $7, recurrence_days = $8, updated_at = NOW()
         WHERE id = $9`,
        [title, description || null, assigned_to, due_date || null, priority,
         category_id || null, recurrence || null, recurrence_days || null, id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

async function updateStreak(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const streak = await queryOne('SELECT * FROM AppChecklist_streaks WHERE user_id = $1', [userId]);

    if (!streak) {
      await query('INSERT INTO AppChecklist_streaks (user_id, current_streak, best_streak, last_activity) VALUES ($1, 1, 1, $2)', [userId, today]);
      return;
    }

    const lastActivity = streak.last_activity ? new Date(streak.last_activity).toISOString().split('T')[0] : null;

    if (lastActivity === today) {
      // Already updated today
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = 1;
    if (lastActivity === yesterdayStr) {
      // Continue streak
      newStreak = streak.current_streak + 1;
    }

    const newBest = Math.max(newStreak, streak.best_streak);

    await query(
      'UPDATE AppChecklist_streaks SET current_streak = $1, best_streak = $2, last_activity = $3, updated_at = NOW() WHERE user_id = $4',
      [newStreak, newBest, today, userId]
    );
  } catch (error) {
    console.error('Error updating streak:', error);
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

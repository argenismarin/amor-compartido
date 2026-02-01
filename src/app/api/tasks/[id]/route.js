import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    console.log('PUT /api/tasks/[id] - id:', id, 'body:', body);

    if (body.toggle_complete !== undefined) {
      // Toggle completion status
      console.log('Fetching task...');
      const task = await queryOne('SELECT * FROM AppChecklist_tasks WHERE id = $1', [id]);
      console.log('Task found:', task);

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      const newCompletedStatus = !task.is_completed;
      console.log('Updating to completed:', newCompletedStatus);

      await query(
        `UPDATE AppChecklist_tasks
         SET is_completed = $1,
             completed_at = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newCompletedStatus, newCompletedStatus ? new Date() : null, id]
      );
      console.log('Task updated successfully');

      // Update streak if completing a task
      if (newCompletedStatus) {
        console.log('Updating streak for user:', task.assigned_to);
        await updateStreak(task.assigned_to);
        console.log('Streak updated');
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
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log('updateStreak - userId:', userId, 'today:', today, 'yesterday:', yesterdayStr);

    // Simple approach: first check if streak exists
    const existingStreak = await queryOne(
      'SELECT * FROM AppChecklist_streaks WHERE user_id = $1',
      [userId]
    );

    if (!existingStreak) {
      // Create new streak
      console.log('Creating new streak for user:', userId);
      await query(
        'INSERT INTO AppChecklist_streaks (user_id, current_streak, best_streak, last_activity) VALUES ($1, 1, 1, $2)',
        [userId, today]
      );
    } else {
      const lastActivity = existingStreak.last_activity
        ? new Date(existingStreak.last_activity).toISOString().split('T')[0]
        : null;

      console.log('Existing streak - lastActivity:', lastActivity);

      if (lastActivity === today) {
        // Already updated today, do nothing
        console.log('Already updated today, skipping');
        return;
      }

      let newStreak = 1;
      if (lastActivity === yesterdayStr) {
        newStreak = existingStreak.current_streak + 1;
      }

      const newBest = Math.max(newStreak, existingStreak.best_streak);

      console.log('Updating streak - newStreak:', newStreak, 'newBest:', newBest);

      await query(
        'UPDATE AppChecklist_streaks SET current_streak = $1, best_streak = $2, last_activity = $3, updated_at = NOW() WHERE user_id = $4',
        [newStreak, newBest, today, userId]
      );
    }

    console.log('Streak update completed');
  } catch (error) {
    console.error('Error updating streak:', error);
    // Don't rethrow - streak update failure shouldn't break task toggle
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

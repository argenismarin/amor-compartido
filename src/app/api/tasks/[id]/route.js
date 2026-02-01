import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.toggle_complete !== undefined) {
      // Toggle completion status
      const task = await queryOne('SELECT * FROM AppChecklist_tasks WHERE id = $1', [id]);

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

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
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Single UPSERT query with CASE logic to handle all scenarios
    // COALESCE handles NULL last_activity by treating it as a new streak
    await query(`
      INSERT INTO AppChecklist_streaks (user_id, current_streak, best_streak, last_activity, updated_at)
      VALUES ($1, 1, 1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        current_streak = CASE
          WHEN COALESCE(AppChecklist_streaks.last_activity::date, '1900-01-01'::date) = $2::date THEN AppChecklist_streaks.current_streak
          WHEN COALESCE(AppChecklist_streaks.last_activity::date, '1900-01-01'::date) = $3::date THEN AppChecklist_streaks.current_streak + 1
          ELSE 1
        END,
        best_streak = GREATEST(
          AppChecklist_streaks.best_streak,
          CASE
            WHEN COALESCE(AppChecklist_streaks.last_activity::date, '1900-01-01'::date) = $2::date THEN AppChecklist_streaks.current_streak
            WHEN COALESCE(AppChecklist_streaks.last_activity::date, '1900-01-01'::date) = $3::date THEN AppChecklist_streaks.current_streak + 1
            ELSE 1
          END
        ),
        last_activity = $2,
        updated_at = NOW()
    `, [userId, today, yesterdayStr]);
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

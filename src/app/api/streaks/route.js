import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const streak = await queryOne(
      'SELECT * FROM AppChecklist_streaks WHERE user_id = $1',
      [userId]
    );

    if (!streak) {
      return NextResponse.json({
        current_streak: 0,
        best_streak: 0,
        last_activity: null
      });
    }

    // Check if streak should be reset (no activity yesterday)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const lastActivity = streak.last_activity
      ? new Date(streak.last_activity).toISOString().split('T')[0]
      : null;

    // If last activity was not today or yesterday, streak is broken
    if (lastActivity && lastActivity !== todayStr && lastActivity !== yesterdayStr) {
      await query(
        'UPDATE AppChecklist_streaks SET current_streak = 0, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );
      return NextResponse.json({
        current_streak: 0,
        best_streak: streak.best_streak,
        last_activity: streak.last_activity
      });
    }

    return NextResponse.json(streak);
  } catch (error) {
    console.error('Error fetching streak:', error);
    return NextResponse.json({ error: 'Failed to fetch streak' }, { status: 500 });
  }
}

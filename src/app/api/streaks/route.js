import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';
import { getTodayBogota, getYesterdayBogota } from '@/lib/timezone';

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
    const todayStr = getTodayBogota();
    const yesterdayStr = getYesterdayBogota();

    // Extraer la fecha de last_activity de forma segura (sin problemas de zona horaria)
    const lastActivity = streak.last_activity
      ? String(streak.last_activity).split('T')[0]
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

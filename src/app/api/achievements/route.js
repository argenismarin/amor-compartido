import { NextResponse } from 'next/server';
import { query, queryOne, initDatabase } from '@/lib/db';

export async function GET(request) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get all achievements with user's unlock status
    const achievements = await query(`
      SELECT a.*,
        ua.unlocked_at,
        CASE WHEN ua.id IS NOT NULL THEN true ELSE false END as unlocked
      FROM AppChecklist_achievements a
      LEFT JOIN AppChecklist_user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
      ORDER BY a.id
    `, [userId]);

    return NextResponse.json(achievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, checkOnly } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Check and unlock achievements
    const newAchievements = await checkAndUnlockAchievements(userId);

    return NextResponse.json({
      success: true,
      newAchievements
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    return NextResponse.json({ error: 'Failed to check achievements' }, { status: 500 });
  }
}

async function checkAndUnlockAchievements(userId) {
  const newAchievements = [];

  // Get user's stats
  const completedCount = await queryOne(
    'SELECT COUNT(*) as count FROM AppChecklist_tasks WHERE assigned_to = $1 AND is_completed = true',
    [userId]
  );

  const streak = await queryOne(
    'SELECT current_streak, best_streak FROM AppChecklist_streaks WHERE user_id = $1',
    [userId]
  );

  // Get already unlocked achievement IDs
  const unlockedIds = await query(
    'SELECT achievement_id FROM AppChecklist_user_achievements WHERE user_id = $1',
    [userId]
  );
  const unlockedSet = new Set(unlockedIds.map(u => u.achievement_id));

  // Get all achievements
  const achievements = await query('SELECT * FROM AppChecklist_achievements');

  for (const achievement of achievements) {
    if (unlockedSet.has(achievement.id)) continue;

    let shouldUnlock = false;

    switch (achievement.condition_type) {
      case 'tasks_completed':
        shouldUnlock = parseInt(completedCount?.count || 0) >= achievement.condition_value;
        break;
      case 'streak_days':
        shouldUnlock = (streak?.current_streak || 0) >= achievement.condition_value ||
                       (streak?.best_streak || 0) >= achievement.condition_value;
        break;
      case 'team_day':
        // Check if both users completed tasks today
        const today = new Date().toISOString().split('T')[0];
        const todayCompletions = await query(
          `SELECT DISTINCT assigned_to FROM AppChecklist_tasks
           WHERE is_completed = true AND DATE(completed_at) = $1`,
          [today]
        );
        shouldUnlock = todayCompletions.length >= 2;
        break;
      case 'early_bird':
        // Check if completed before 8am
        const earlyBird = await queryOne(
          `SELECT id FROM AppChecklist_tasks
           WHERE assigned_to = $1 AND is_completed = true
           AND EXTRACT(HOUR FROM completed_at) < 8
           LIMIT 1`,
          [userId]
        );
        shouldUnlock = !!earlyBird;
        break;
      case 'night_owl':
        // Check if completed after 10pm
        const nightOwl = await queryOne(
          `SELECT id FROM AppChecklist_tasks
           WHERE assigned_to = $1 AND is_completed = true
           AND EXTRACT(HOUR FROM completed_at) >= 22
           LIMIT 1`,
          [userId]
        );
        shouldUnlock = !!nightOwl;
        break;
    }

    if (shouldUnlock) {
      await query(
        'INSERT INTO AppChecklist_user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, achievement.id]
      );
      newAchievements.push(achievement);
    }
  }

  return newAchievements;
}

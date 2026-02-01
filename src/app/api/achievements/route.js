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
  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date();

  // Single optimized CTE query to get all user stats at once
  const statsResult = await queryOne(`
    WITH user_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE assigned_to = $1 AND is_completed = true) as tasks_completed,
        COUNT(*) FILTER (WHERE assigned_by = $1 AND reaction IS NOT NULL) as reactions_given,
        COUNT(DISTINCT category_id) FILTER (WHERE assigned_to = $1 AND category_id IS NOT NULL) as categories_used,
        COUNT(*) FILTER (WHERE assigned_to = $1 AND is_completed = true
          AND EXTRACT(MONTH FROM completed_at) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM completed_at) = EXTRACT(YEAR FROM CURRENT_DATE)) as monthly_tasks,
        COUNT(*) FILTER (WHERE assigned_to = $1 AND is_completed = true
          AND EXTRACT(DOW FROM completed_at) IN (0, 6)
          AND completed_at >= CURRENT_DATE - INTERVAL '7 days') as weekend_tasks,
        EXISTS (SELECT 1 FROM AppChecklist_tasks WHERE assigned_to = $1 AND is_completed = true
          AND EXTRACT(HOUR FROM completed_at) < 8) as early_bird,
        EXISTS (SELECT 1 FROM AppChecklist_tasks WHERE assigned_to = $1 AND is_completed = true
          AND EXTRACT(HOUR FROM completed_at) >= 22) as night_owl
      FROM AppChecklist_tasks
    ),
    streak_stats AS (
      SELECT COALESCE(current_streak, 0) as current_streak, COALESCE(best_streak, 0) as best_streak
      FROM AppChecklist_streaks WHERE user_id = $1
    ),
    team_day AS (
      SELECT COUNT(DISTINCT assigned_to) as users_completed_today
      FROM AppChecklist_tasks
      WHERE is_completed = true AND DATE(completed_at) = $2
    ),
    special_dates AS (
      SELECT date FROM AppChecklist_special_dates WHERE type = 'anniversary' LIMIT 1
    ),
    app_usage AS (
      SELECT first_use FROM AppChecklist_app_usage ORDER BY id LIMIT 1
    )
    SELECT
      us.tasks_completed, us.reactions_given, us.categories_used, us.monthly_tasks,
      us.weekend_tasks, us.early_bird, us.night_owl,
      COALESCE(ss.current_streak, 0) as current_streak,
      COALESCE(ss.best_streak, 0) as best_streak,
      COALESCE(td.users_completed_today, 0) as users_completed_today,
      sd.date as anniversary_date,
      au.first_use
    FROM user_stats us
    LEFT JOIN streak_stats ss ON true
    LEFT JOIN team_day td ON true
    LEFT JOIN special_dates sd ON true
    LEFT JOIN app_usage au ON true
  `, [userId, today]);

  // Get already unlocked achievement IDs and all achievements in one query
  const [unlockedIds, achievements] = await Promise.all([
    query('SELECT achievement_id FROM AppChecklist_user_achievements WHERE user_id = $1', [userId]),
    query('SELECT * FROM AppChecklist_achievements')
  ]);
  const unlockedSet = new Set(unlockedIds.map(u => u.achievement_id));

  // Calculate anniversary-based conditions
  let isMesiversario = false;
  let isAniversario = false;
  let appMonths = 0;

  if (statsResult?.anniversary_date) {
    const annivDate = new Date(statsResult.anniversary_date);
    if (annivDate.getDate() === todayDate.getDate()) {
      const monthsDiff = (todayDate.getFullYear() - annivDate.getFullYear()) * 12 +
                        (todayDate.getMonth() - annivDate.getMonth());
      isMesiversario = monthsDiff >= 1;
      isAniversario = annivDate.getMonth() === todayDate.getMonth() &&
                     todayDate.getFullYear() > annivDate.getFullYear();
    }
  }

  if (statsResult?.first_use) {
    const firstUse = new Date(statsResult.first_use);
    appMonths = (todayDate.getFullYear() - firstUse.getFullYear()) * 12 +
               (todayDate.getMonth() - firstUse.getMonth());
  }

  // Check achievements in memory (no additional queries)
  const achievementsToUnlock = [];
  for (const achievement of achievements) {
    if (unlockedSet.has(achievement.id)) continue;

    let shouldUnlock = false;

    switch (achievement.condition_type) {
      case 'tasks_completed':
        shouldUnlock = parseInt(statsResult?.tasks_completed || 0) >= achievement.condition_value;
        break;
      case 'streak_days':
        shouldUnlock = (statsResult?.current_streak || 0) >= achievement.condition_value ||
                       (statsResult?.best_streak || 0) >= achievement.condition_value;
        break;
      case 'team_day':
        shouldUnlock = (statsResult?.users_completed_today || 0) >= 2;
        break;
      case 'early_bird':
        shouldUnlock = statsResult?.early_bird === true;
        break;
      case 'night_owl':
        shouldUnlock = statsResult?.night_owl === true;
        break;
      case 'weekend_tasks':
        shouldUnlock = parseInt(statsResult?.weekend_tasks || 0) >= achievement.condition_value;
        break;
      case 'reactions_given':
        shouldUnlock = parseInt(statsResult?.reactions_given || 0) >= achievement.condition_value;
        break;
      case 'categories_used':
        shouldUnlock = parseInt(statsResult?.categories_used || 0) >= achievement.condition_value;
        break;
      case 'monthly_tasks':
        shouldUnlock = parseInt(statsResult?.monthly_tasks || 0) >= achievement.condition_value;
        break;
      case 'mesiversario':
        shouldUnlock = isMesiversario;
        break;
      case 'aniversario':
        shouldUnlock = isAniversario;
        break;
      case 'app_months':
        shouldUnlock = appMonths >= achievement.condition_value;
        break;
    }

    if (shouldUnlock) {
      achievementsToUnlock.push(achievement);
    }
  }

  // Batch insert all new achievements
  if (achievementsToUnlock.length > 0) {
    const values = achievementsToUnlock.map((_, i) => `($1, $${i + 2})`).join(', ');
    const params = [userId, ...achievementsToUnlock.map(a => a.id)];
    await query(
      `INSERT INTO AppChecklist_user_achievements (user_id, achievement_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      params
    );
  }

  return achievementsToUnlock;
}

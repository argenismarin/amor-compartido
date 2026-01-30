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
      case 'weekend_tasks':
        // Check tasks completed on weekends (Saturday=6, Sunday=0)
        const weekendTasks = await queryOne(
          `SELECT COUNT(*) as count FROM AppChecklist_tasks
           WHERE assigned_to = $1 AND is_completed = true
           AND EXTRACT(DOW FROM completed_at) IN (0, 6)
           AND completed_at >= CURRENT_DATE - INTERVAL '7 days'`,
          [userId]
        );
        shouldUnlock = parseInt(weekendTasks?.count || 0) >= achievement.condition_value;
        break;
      case 'reactions_given':
        // Count reactions given by this user (tasks they assigned that have reactions)
        const reactionsGiven = await queryOne(
          `SELECT COUNT(*) as count FROM AppChecklist_tasks
           WHERE assigned_by = $1 AND reaction IS NOT NULL`,
          [userId]
        );
        shouldUnlock = parseInt(reactionsGiven?.count || 0) >= achievement.condition_value;
        break;
      case 'categories_used':
        // Check how many different categories the user has used
        const categoriesUsed = await queryOne(
          `SELECT COUNT(DISTINCT category_id) as count FROM AppChecklist_tasks
           WHERE assigned_to = $1 AND category_id IS NOT NULL`,
          [userId]
        );
        shouldUnlock = parseInt(categoriesUsed?.count || 0) >= achievement.condition_value;
        break;
      case 'monthly_tasks':
        // Check tasks completed this month
        const monthlyTasks = await queryOne(
          `SELECT COUNT(*) as count FROM AppChecklist_tasks
           WHERE assigned_to = $1 AND is_completed = true
           AND EXTRACT(MONTH FROM completed_at) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(YEAR FROM completed_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
          [userId]
        );
        shouldUnlock = parseInt(monthlyTasks?.count || 0) >= achievement.condition_value;
        break;
      case 'mesiversario':
        // Check if today is a mesiversario (monthly anniversary)
        const anniversary = await queryOne(
          `SELECT date FROM AppChecklist_special_dates WHERE type = 'anniversary'`
        );
        if (anniversary?.date) {
          const annivDate = new Date(anniversary.date);
          const today2 = new Date();
          // If today's day matches anniversary day and at least 1 month has passed
          if (annivDate.getDate() === today2.getDate()) {
            const monthsDiff = (today2.getFullYear() - annivDate.getFullYear()) * 12 +
                              (today2.getMonth() - annivDate.getMonth());
            shouldUnlock = monthsDiff >= 1;
          }
        }
        break;
      case 'aniversario':
        // Check if today is the anniversary (same month and day, at least 1 year)
        const anniv = await queryOne(
          `SELECT date FROM AppChecklist_special_dates WHERE type = 'anniversary'`
        );
        if (anniv?.date) {
          const annivDate2 = new Date(anniv.date);
          const today3 = new Date();
          if (annivDate2.getDate() === today3.getDate() &&
              annivDate2.getMonth() === today3.getMonth() &&
              today3.getFullYear() > annivDate2.getFullYear()) {
            shouldUnlock = true;
          }
        }
        break;
      case 'app_months':
        // Check how many months the app has been used
        const appUsage = await queryOne(
          `SELECT first_use FROM AppChecklist_app_usage ORDER BY id LIMIT 1`
        );
        if (appUsage?.first_use) {
          const firstUse = new Date(appUsage.first_use);
          const today4 = new Date();
          const monthsUsed = (today4.getFullYear() - firstUse.getFullYear()) * 12 +
                            (today4.getMonth() - firstUse.getMonth());
          shouldUnlock = monthsUsed >= achievement.condition_value;
        }
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

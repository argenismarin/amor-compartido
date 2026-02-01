import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0];
}

// Singleton flag to ensure initDatabase runs only once per server instance
let isInitialized = false;

export async function ensureDatabase() {
  if (isInitialized) return;
  await initDatabase();
  isInitialized = true;
}

export async function initDatabase() {
  // Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      avatar_emoji VARCHAR(10) DEFAULT '❤️',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if users exist, if not create default users
  const users = await query('SELECT * FROM AppChecklist_users');
  if (users.length === 0) {
    await query(`INSERT INTO AppChecklist_users (name, avatar_emoji) VALUES ('Jenifer', '💕')`);
    await query(`INSERT INTO AppChecklist_users (name, avatar_emoji) VALUES ('Argenis', '🍷')`);
  } else {
    // Update existing users to correct names
    await query(`UPDATE AppChecklist_users SET name = 'Jenifer', avatar_emoji = '💕' WHERE id = 1`);
    await query(`UPDATE AppChecklist_users SET name = 'Argenis', avatar_emoji = '🍷' WHERE id = 2`);
  }

  // Create tasks table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      assigned_to INT NOT NULL REFERENCES AppChecklist_users(id),
      assigned_by INT NOT NULL REFERENCES AppChecklist_users(id),
      is_completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP NULL,
      due_date DATE NULL,
      priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      reaction VARCHAR(10) NULL,
      category_id INT NULL,
      recurrence VARCHAR(20) NULL CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'custom')),
      recurrence_days TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add reaction column if not exists (for existing databases)
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'reaction') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN reaction VARCHAR(10) NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'category_id') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN category_id INT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'recurrence') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN recurrence VARCHAR(20) NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'recurrence_days') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN recurrence_days TEXT NULL;
      END IF;
    END $$;
  `);

  // Create streaks table for gamification
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_streaks (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES AppChecklist_users(id) UNIQUE,
      current_streak INT DEFAULT 0,
      best_streak INT DEFAULT 0,
      last_activity DATE NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize streaks for users if not exist
  const existingStreaks = await query('SELECT user_id FROM AppChecklist_streaks');
  const streakUserIds = existingStreaks.map(s => s.user_id);
  for (const user of users.length > 0 ? users : await query('SELECT id FROM AppChecklist_users')) {
    if (!streakUserIds.includes(user.id)) {
      await query('INSERT INTO AppChecklist_streaks (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    }
  }

  // Create achievements table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_achievements (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      emoji VARCHAR(10) NOT NULL,
      condition_type VARCHAR(50) NOT NULL,
      condition_value INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create user achievements table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_user_achievements (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES AppChecklist_users(id),
      achievement_id INT NOT NULL REFERENCES AppChecklist_achievements(id),
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, achievement_id)
    )
  `);

  // Define all achievements
  const allAchievements = [
    ['Primera tarea', 'Completaste tu primera tarea', '🌟', 'tasks_completed', 1],
    ['Productivo', 'Completaste 10 tareas', '🏆', 'tasks_completed', 10],
    ['Imparable', 'Completaste 50 tareas', '💪', 'tasks_completed', 50],
    ['Centenario', 'Completaste 100 tareas', '💯', 'tasks_completed', 100],
    ['En racha', '7 días seguidos completando tareas', '🔥', 'streak_days', 7],
    ['Racha legendaria', '30 días seguidos', '⚡', 'streak_days', 30],
    ['Pareja en equipo', 'Ambos completaron tareas el mismo día', '💑', 'team_day', 1],
    ['Madrugador', 'Completaste una tarea antes de las 8am', '🌅', 'early_bird', 1],
    ['Noctámbulo', 'Completaste una tarea después de las 10pm', '🌙', 'night_owl', 1],
    ['Quinientos', '¡Medio millar de amor compartido!', '🌟💫', 'tasks_completed', 500],
    ['Super racha', '2 semanas seguidas sin fallar', '🔥🔥', 'streak_days', 14],
    ['Fin de semana productivo', '5 tareas en un fin de semana', '🎯', 'weekend_tasks', 5],
    ['Romántico', 'Diste 10 reacciones de amor', '💝', 'reactions_given', 10],
    ['Súper romántico', 'Diste 50 reacciones de amor', '💖✨', 'reactions_given', 50],
    ['Organizador', 'Usaste todas las categorías', '📋', 'categories_used', 5],
    ['Constante', '30 tareas completadas en un mes', '📅', 'monthly_tasks', 30],
    ['Mesiversario', 'Celebraron su primer mesiversario juntos', '💕', 'mesiversario', 1],
    ['Aniversario', '¡Feliz aniversario de amor!', '💍', 'aniversario', 1],
    ['Amor eterno', '12 meses usando la app juntos', '💞', 'app_months', 12]
  ];

  // Remove duplicate achievements (keep lowest id for each name)
  await query(`
    DELETE FROM AppChecklist_achievements a
    USING AppChecklist_achievements b
    WHERE a.name = b.name AND a.id > b.id
  `);

  // Get existing achievement names
  const existingAchievements = await query('SELECT name FROM AppChecklist_achievements');
  const existingNames = new Set(existingAchievements.map(a => a.name));

  // Insert missing achievements
  for (const [name, description, emoji, condition_type, condition_value] of allAchievements) {
    if (!existingNames.has(name)) {
      await query(
        'INSERT INTO AppChecklist_achievements (name, description, emoji, condition_type, condition_value) VALUES ($1, $2, $3, $4, $5)',
        [name, description, emoji, condition_type, condition_value]
      );
    }
  }

  // Create categories table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      emoji VARCHAR(10) NOT NULL,
      color VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default categories if not exist
  const existingCategories = await query('SELECT id FROM AppChecklist_categories');
  if (existingCategories.length === 0) {
    await query(`
      INSERT INTO AppChecklist_categories (name, emoji, color) VALUES
      ('Casa', '🏠', '#4CAF50'),
      ('Compras', '🛒', '#2196F3'),
      ('Salud', '💪', '#E91E63'),
      ('Juntos', '💑', '#9C27B0'),
      ('Trabajo', '💼', '#FF9800'),
      ('Otros', '📌', '#607D8B')
    `);
  }

  // Create special dates table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_special_dates (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      date DATE NOT NULL,
      user_id INT NULL REFERENCES AppChecklist_users(id),
      label VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, user_id)
    )
  `);

  // Create push subscriptions table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES AppChecklist_users(id),
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create app usage tracking table for "app_months" achievement
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_app_usage (
      id SERIAL PRIMARY KEY,
      first_use DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize app usage if not exists
  const existingUsage = await query('SELECT id FROM AppChecklist_app_usage');
  if (existingUsage.length === 0) {
    await query('INSERT INTO AppChecklist_app_usage (first_use) VALUES (CURRENT_DATE)');
  }

  // Create indexes for optimized queries
  await query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON AppChecklist_tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON AppChecklist_tasks(assigned_by);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_user ON AppChecklist_tasks(is_completed, assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON AppChecklist_tasks(completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_streaks_user ON AppChecklist_streaks(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_achievements ON AppChecklist_user_achievements(user_id);
  `);
}

export default pool;

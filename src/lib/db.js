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

// Ejecuta un callback dentro de una transacción.
// El callback recibe un cliente dedicado con métodos query(sql, params) y
// queryOne(sql, params) que operan sobre la transacción.
// Si el callback throws, se hace ROLLBACK automáticamente. Si termina OK,
// COMMIT. El cliente se libera al pool en ambos casos.
//
// Uso:
//   const result = await withTransaction(async (tx) => {
//     const user = await tx.queryOne('INSERT ... RETURNING *', [...]);
//     await tx.query('INSERT INTO ...', [user.id, ...]);
//     return user;
//   });
export async function withTransaction(callback) {
  const client = await pool.connect();
  const tx = {
    query: async (sql, params = []) => {
      const result = await client.query(sql, params);
      return result.rows;
    },
    queryOne: async (sql, params = []) => {
      const result = await client.query(sql, params);
      return result.rows[0];
    },
  };

  try {
    await client.query('BEGIN');
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Singleton flag to ensure initDatabase runs only once per server instance
let isInitialized = false;
// Si initDatabase falla, guardamos el error acá para:
//   1. Loggearlo de forma ruidosa en cada request posterior (no queremos
//      que un init roto quede silencioso como pasó con la migración C5)
//   2. Exponerlo en /api/health si se decide agregar ese endpoint
let initError = null;

export function getInitError() {
  return initError;
}

export async function ensureDatabase() {
  if (isInitialized) {
    // Si la inicialización falló, cada request siguiente re-loggea el
    // error con contexto. Costoso en logs pero imposible de ignorar —
    // preferible a un silencio que deja la app sirviendo 500s opacos.
    if (initError) {
      console.error(
        '[db] ⚠️  Operando con initDatabase FALLIDA. Queries que dependan ' +
          'de migraciones pueden fallar. Error original:',
        initError
      );
    }
    return;
  }
  try {
    await initDatabase();
    initError = null;
  } catch (err) {
    initError = err;
    // Loggear stack completo (no solo message) para ver EXACTAMENTE
    // qué statement falló dentro de initDatabase.
    console.error(
      '[db] initDatabase FAILED — app continuará pero queries pueden ' +
        'fallar. Stacktrace completo:',
      err && err.stack ? err.stack : err
    );
  }
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

  // Create projects table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      emoji VARCHAR(10) DEFAULT '📁',
      color VARCHAR(20) DEFAULT '#6366f1',
      due_date DATE NULL,
      is_archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      project_id INT NULL,
      recurrence VARCHAR(20) NULL CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'custom')),
      recurrence_days TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns if not exist (for existing databases)
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
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'project_id') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN project_id INT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'is_shared') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'deleted_at') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN deleted_at TIMESTAMP NULL;
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

  // Create subtasks table (checklist dentro de cada tarea)
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_subtasks (
      id SERIAL PRIMARY KEY,
      task_id INT NOT NULL REFERENCES AppChecklist_tasks(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  // C5: Normalizar is_completed y is_archived a BOOLEAN puro.
  // Heredado de la migración MySQL→Postgres: algunas instalaciones tenían
  // estas columnas como SMALLINT (0/1). Convertir a BOOLEAN si es necesario.
  //
  // Esta migración corre AL FINAL para garantizar que las tablas existen.
  // Wrap en try/catch porque el código de runtime es compatible con ambos
  // tipos (boolean y smallint), así que un fallo de migración no rompe nada.
  try {
    await query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'appchecklist_tasks'
            AND column_name = 'is_completed'
            AND data_type IN ('smallint', 'integer')
        ) THEN
          -- PostgreSQL no tiene cast directo smallint→boolean, pero sí
          -- smallint→int y int→boolean. Encadenamos los dos.
          ALTER TABLE AppChecklist_tasks
            ALTER COLUMN is_completed DROP DEFAULT,
            ALTER COLUMN is_completed TYPE BOOLEAN USING (is_completed::int::boolean),
            ALTER COLUMN is_completed SET DEFAULT FALSE;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'appchecklist_projects'
            AND column_name = 'is_archived'
            AND data_type IN ('smallint', 'integer')
        ) THEN
          ALTER TABLE AppChecklist_projects
            ALTER COLUMN is_archived DROP DEFAULT,
            ALTER COLUMN is_archived TYPE BOOLEAN USING (is_archived::int::boolean),
            ALTER COLUMN is_archived SET DEFAULT FALSE;
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('[db] C5 boolean migration failed (non-fatal):', err.message);
  }

  // C4: Foreign keys explícitas para category_id y project_id en tasks.
  // CRÍTICO: este bloque referencia AppChecklist_categories y
  // AppChecklist_projects, así que tiene que correr DESPUÉS de que esas
  // tablas existan (de ahí su posición al final de initDatabase).
  try {
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'appchecklist_tasks_category_id_fkey'
            AND table_name = 'appchecklist_tasks'
        ) THEN
          UPDATE AppChecklist_tasks
          SET category_id = NULL
          WHERE category_id IS NOT NULL
            AND category_id NOT IN (SELECT id FROM AppChecklist_categories);

          ALTER TABLE AppChecklist_tasks
            ADD CONSTRAINT appchecklist_tasks_category_id_fkey
            FOREIGN KEY (category_id)
            REFERENCES AppChecklist_categories(id)
            ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'appchecklist_tasks_project_id_fkey'
            AND table_name = 'appchecklist_tasks'
        ) THEN
          UPDATE AppChecklist_tasks
          SET project_id = NULL
          WHERE project_id IS NOT NULL
            AND project_id NOT IN (SELECT id FROM AppChecklist_projects);

          ALTER TABLE AppChecklist_tasks
            ADD CONSTRAINT appchecklist_tasks_project_id_fkey
            FOREIGN KEY (project_id)
            REFERENCES AppChecklist_projects(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('[db] C4 FK migration failed (non-fatal):', err.message);
  }

  // Create indexes for optimized queries
  await query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON AppChecklist_tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON AppChecklist_tasks(assigned_by);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_user ON AppChecklist_tasks(is_completed, assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON AppChecklist_tasks(completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON AppChecklist_tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_not_deleted ON AppChecklist_tasks(deleted_at) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_subtasks_task ON AppChecklist_subtasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_streaks_user ON AppChecklist_streaks(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_achievements ON AppChecklist_user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_archived ON AppChecklist_projects(is_archived);
  `);

  // C6: Denormalizar total_tasks/completed_tasks en projects.
  //
  // Antes: cada GET /api/projects hacia LEFT JOIN tasks + COUNT + GROUP BY,
  // O(N*M) donde N=projects y M=tasks. Para 100 proyectos con 1k tareas
  // cada uno, eso son 100k filas que el motor agrega cada request.
  //
  // Ahora: columnas total_tasks/completed_tasks viven en projects, mantenidas
  // por triggers que se disparan en INSERT/UPDATE/DELETE de tasks. La query
  // de listado pasa de O(N*M) a O(N).
  //
  // Wrap en try/catch porque si los triggers fallan, los endpoints viejos
  // que usan COUNT(*) siguen funcionando (solo pierden la optimizacion).
  try {
    await query(`
      DO $$
      BEGIN
        -- Agregar columnas si no existen
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appchecklist_projects' AND column_name = 'total_tasks') THEN
          ALTER TABLE AppChecklist_projects ADD COLUMN total_tasks INT NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appchecklist_projects' AND column_name = 'completed_tasks') THEN
          ALTER TABLE AppChecklist_projects ADD COLUMN completed_tasks INT NOT NULL DEFAULT 0;
        END IF;
      END $$;
    `);

    // Backfill inicial — solo si los contadores estan en 0 todavia
    // (idempotente: si ya hay valores, este UPDATE no cambia nada).
    await query(`
      UPDATE AppChecklist_projects p
      SET total_tasks = sub.total, completed_tasks = sub.done
      FROM (
        SELECT
          project_id,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE is_completed) AS done
        FROM AppChecklist_tasks
        WHERE project_id IS NOT NULL AND deleted_at IS NULL
        GROUP BY project_id
      ) sub
      WHERE p.id = sub.project_id
        AND (p.total_tasks <> sub.total OR p.completed_tasks <> sub.done);
    `);

    // Trigger function: recalcula contadores cuando cambia una tarea.
    // Maneja los 4 casos: INSERT, UPDATE (incluyendo cambios de project_id,
    // is_completed, deleted_at), DELETE.
    await query(`
      CREATE OR REPLACE FUNCTION appchecklist_update_project_counters()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Para UPDATE/DELETE: ajustar el proyecto VIEJO (si tenia uno)
        IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
          IF OLD.project_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
            UPDATE AppChecklist_projects
            SET total_tasks = GREATEST(total_tasks - 1, 0),
                completed_tasks = GREATEST(completed_tasks - (CASE WHEN OLD.is_completed THEN 1 ELSE 0 END), 0)
            WHERE id = OLD.project_id;
          END IF;
        END IF;

        -- Para INSERT/UPDATE: ajustar el proyecto NUEVO (si tiene uno y no esta soft-deleted)
        IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
          IF NEW.project_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
            UPDATE AppChecklist_projects
            SET total_tasks = total_tasks + 1,
                completed_tasks = completed_tasks + (CASE WHEN NEW.is_completed THEN 1 ELSE 0 END)
            WHERE id = NEW.project_id;
          END IF;
        END IF;

        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Drop+recreate triggers para que sean idempotentes en hot reload
    await query(`
      DROP TRIGGER IF EXISTS trg_tasks_project_counters_iud ON AppChecklist_tasks;
      CREATE TRIGGER trg_tasks_project_counters_iud
        AFTER INSERT OR UPDATE OR DELETE ON AppChecklist_tasks
        FOR EACH ROW EXECUTE FUNCTION appchecklist_update_project_counters();
    `);
  } catch (err) {
    console.error('[db] C6 project counters migration failed (non-fatal):', err.message);
  }
}

export default pool;

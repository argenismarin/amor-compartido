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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export default pool;

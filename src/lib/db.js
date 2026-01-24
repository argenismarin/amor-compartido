import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

export async function initDatabase() {
  // Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
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
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      assigned_to INT NOT NULL,
      assigned_by INT NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP NULL,
      due_date DATE NULL,
      priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES AppChecklist_users(id),
      FOREIGN KEY (assigned_by) REFERENCES AppChecklist_users(id)
    )
  `);
}

export default pool;

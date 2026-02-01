import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';

// Ensure projects table exists
async function ensureProjectsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS AppChecklist_projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      emoji VARCHAR(10) DEFAULT '📁',
      color VARCHAR(20) DEFAULT '#6366f1',
      due_date DATE NULL,
      is_archived SMALLINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Also ensure project_id column exists in tasks
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'appchecklist_tasks' AND column_name = 'project_id') THEN
        ALTER TABLE AppChecklist_tasks ADD COLUMN project_id INT NULL;
      END IF;
    END $$;
  `);
}

export async function GET(request) {
  try {
    await ensureDatabase();
    await ensureProjectsTable();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let sql = `
      SELECT p.*,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.is_completed = true THEN 1 END) as completed_tasks
      FROM AppChecklist_projects p
      LEFT JOIN AppChecklist_tasks t ON t.project_id = p.id
    `;

    // Filter out archived projects (is_archived can be SMALLINT or BOOLEAN depending on DB)
    if (!includeArchived) {
      sql += ' WHERE COALESCE(p.is_archived, 0)::int = 0';
    }

    sql += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const projects = await query(sql);
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects', details: error.message, version: 'v5-coalesce' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    await ensureProjectsTable();
    const { name, description, emoji, color, due_date } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO AppChecklist_projects (name, description, emoji, color, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name.trim(), description || null, emoji || '📁', color || '#6366f1', due_date || null]
    );

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

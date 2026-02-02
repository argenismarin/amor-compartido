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
}

export async function GET(request, { params }) {
  try {
    await ensureDatabase();
    await ensureProjectsTable();
    const { id } = await params;

    const project = await queryOne(
      `SELECT p.*,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.is_completed = 1 THEN 1 END) as completed_tasks
       FROM AppChecklist_projects p
       LEFT JOIN AppChecklist_tasks t ON t.project_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureDatabase();
    await ensureProjectsTable();
    const { id } = await params;
    const { name, description, emoji, color, due_date, is_archived } = await request.json();

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (emoji !== undefined) {
      updates.push(`emoji = $${paramIndex}`);
      values.push(emoji);
      paramIndex++;
    }

    if (color !== undefined) {
      updates.push(`color = $${paramIndex}`);
      values.push(color);
      paramIndex++;
    }

    if (due_date !== undefined) {
      updates.push(`due_date = $${paramIndex}`);
      values.push(due_date || null);
      paramIndex++;
    }

    if (is_archived !== undefined) {
      updates.push(`is_archived = $${paramIndex}`);
      values.push(!!is_archived);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await query(
      `UPDATE AppChecklist_projects SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureDatabase();
    await ensureProjectsTable();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      // Permanent delete - remove tasks first, then project
      await query('DELETE FROM AppChecklist_tasks WHERE project_id = $1', [id]);
      await query('DELETE FROM AppChecklist_projects WHERE id = $1', [id]);
    } else {
      // Soft delete - archive the project
      await query(
        'UPDATE AppChecklist_projects SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

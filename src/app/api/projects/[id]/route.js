import { NextResponse } from 'next/server';
import { query, queryOne, withTransaction, ensureDatabase } from '@/lib/db';
import { updateProjectSchema, validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';
import { logActivity } from '@/lib/activity';

// La tabla AppChecklist_projects se crea en initDatabase() / ensureDatabase().
// No hace falta una función extra acá.

export async function GET(request, { params }) {
  try {
    await ensureDatabase();
    const { id } = await params;

    // Contadores desnormalizados (trigger los mantiene).
    const project = await queryOne(
      `SELECT * FROM AppChecklist_projects WHERE id = $1`,
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
  const limited = enforceRateLimit(request, 'PUT /api/projects/[id]', 60, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const { id } = await params;
    const body = await request.json();
    const { data, error } = validateBody(updateProjectSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const {
      name, description, emoji, color, due_date, is_archived,
      expected_updated_at,
    } = data;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
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

    // El último parámetro es siempre el id del proyecto. Si hay
    // optimistic locking, agregamos expected_updated_at al WHERE y
    // RETURNING id para detectar el conflict con filas afectadas.
    values.push(id);
    const idParam = paramIndex;
    paramIndex++;

    let sql = `UPDATE AppChecklist_projects SET ${updates.join(', ')} WHERE id = $${idParam}`;
    if (expected_updated_at) {
      sql += ` AND updated_at = $${paramIndex}`;
      values.push(expected_updated_at);
      paramIndex++;
    }
    sql += ' RETURNING id';

    const updated = await query(sql, values);

    // Si vino expected_updated_at y no se actualizó nada, hubo conflict.
    // Devolvemos el estado actual del proyecto para que el cliente pueda
    // refrescar y mostrar un toast explicativo (mismo patrón que tasks).
    if (expected_updated_at && updated.length === 0) {
      const current = await queryOne(
        `SELECT * FROM AppChecklist_projects WHERE id = $1`,
        [id]
      );
      return NextResponse.json(
        { error: 'conflict', message: 'El proyecto fue modificado por tu pareja', current },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const limited = enforceRateLimit(request, 'DELETE /api/projects/[id]', 30, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      // Snapshot del nombre antes de borrar para el activity log
      const proj = await queryOne(
        'SELECT name FROM AppChecklist_projects WHERE id = $1',
        [id]
      );
      // Permanent delete - tasks + project en una sola transacción.
      // Sin esto, si el primer DELETE pasa y el segundo falla, las tareas
      // quedan huérfanas (project_id apuntando a un proyecto inexistente)
      // o el proyecto queda sin sus tareas. Ambos son estados rotos.
      await withTransaction(async (tx) => {
        await tx.query('DELETE FROM AppChecklist_tasks WHERE project_id = $1', [id]);
        await tx.query('DELETE FROM AppChecklist_projects WHERE id = $1', [id]);
      });
      logActivity({
        action: 'project.delete',
        targetType: 'project',
        targetId: parseInt(id, 10),
        meta: { name: proj?.name, permanent: true },
      });
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

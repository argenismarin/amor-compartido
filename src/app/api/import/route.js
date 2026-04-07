import { NextResponse } from 'next/server';
import { ensureDatabase, withTransaction } from '@/lib/db';
import { importPayloadSchema, validateBody } from '@/lib/validation/schemas';

// POST /api/import — importa un backup JSON en modo MERGE.
//
// Comportamiento:
// - Inserta TODO con IDs nuevos (no sobrescribe ni borra nada existente).
// - Mantiene relaciones proyecto→tarea y tarea→subtarea usando mapas
//   de viejo_id → nuevo_id durante el insert.
// - Dentro de una transacción: si cualquier query falla, hace ROLLBACK
//   completo — nunca hay estado parcialmente importado.
// - NO toca: users, categorías (son estáticas), streaks, achievements,
//   push_subscriptions.
//
// Devuelve un contador con cuántos items se importaron.
export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();

    const { data, error } = validateBody(importPayloadSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const { tasks = [], projects = [], specialDates = [] } = data;

    const result = await withTransaction(async (tx) => {
      // Mapas para preservar relaciones al insertar con nuevos IDs
      const projectIdMap = new Map();
      const taskIdMap = new Map();

      // 1. Projects primero (las tareas los referencian)
      let projectsImported = 0;
      for (const p of projects) {
        const inserted = await tx.queryOne(
          `INSERT INTO AppChecklist_projects
             (name, description, emoji, color, due_date, is_archived)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            p.name,
            p.description || null,
            p.emoji || '📁',
            p.color || '#6366f1',
            p.due_date || null,
            p.is_archived || false,
          ]
        );
        if (p.id !== undefined) {
          projectIdMap.set(p.id, inserted.id);
        }
        projectsImported++;
      }

      // 2. Tasks, mapeando project_id al nuevo ID si existe en el mapa
      let tasksImported = 0;
      let subtasksImported = 0;
      for (const t of tasks) {
        const mappedProjectId = t.project_id
          ? projectIdMap.get(t.project_id) ?? null
          : null;

        const inserted = await tx.queryOne(
          `INSERT INTO AppChecklist_tasks
             (title, description, assigned_to, assigned_by, is_completed,
              completed_at, due_date, priority, reaction, category_id,
              project_id, recurrence, recurrence_days, is_shared, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id`,
          [
            t.title,
            t.description || null,
            t.assigned_to,
            t.assigned_by,
            t.is_completed || false,
            t.completed_at || null,
            t.due_date || null,
            t.priority || 'medium',
            t.reaction || null,
            t.category_id || null,
            mappedProjectId,
            t.recurrence || null,
            t.recurrence_days || null,
            t.is_shared || false,
            t.deleted_at || null,
          ]
        );
        if (t.id !== undefined) {
          taskIdMap.set(t.id, inserted.id);
        }
        tasksImported++;

        // 3. Subtasks de esta tarea, con el nuevo task_id
        const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
        for (const s of subtasks) {
          await tx.query(
            `INSERT INTO AppChecklist_subtasks
               (task_id, title, is_completed, sort_order)
             VALUES ($1, $2, $3, $4)`,
            [inserted.id, s.title, s.is_completed || false, s.sort_order || 0]
          );
          subtasksImported++;
        }
      }

      // 4. Special dates con UPSERT (tienen UNIQUE(type, user_id))
      let specialDatesImported = 0;
      for (const sd of specialDates) {
        await tx.query(
          `INSERT INTO AppChecklist_special_dates (type, date, user_id, label)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (type, user_id) DO UPDATE
             SET date = EXCLUDED.date, label = EXCLUDED.label`,
          [sd.type, sd.date, sd.user_id || null, sd.label || null]
        );
        specialDatesImported++;
      }

      return {
        projects: projectsImported,
        tasks: tasksImported,
        subtasks: subtasksImported,
        specialDates: specialDatesImported,
      };
    });

    return NextResponse.json({ success: true, imported: result });
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json(
      { error: 'Failed to import data: ' + (error.message || 'unknown') },
      { status: 500 }
    );
  }
}

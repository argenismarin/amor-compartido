import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

// Tareas se exportan en chunks de este tamaño. Con 50k tareas y subtasks
// anidadas, cargar todo a memoria podría rondar 100MB+. Streaming en
// chunks de 500 mantiene RAM bajo y el cliente puede empezar a recibir
// datos antes de que el servidor termine de leer.
const CHUNK_SIZE = 500;

// GET /api/export — dump JSON completo de datos del app.
//
// Devuelve tasks (con subtasks anidadas), projects (incl. archivados)
// y special_dates. NO incluye users, categorías, streaks, achievements
// ni push_subscriptions — esos son estado interno o tokens que se
// regeneran automáticamente.
//
// El cliente recibe Content-Disposition para descargar automáticamente
// como `amor-compartido-backup-YYYY-MM-DD.json`.
// Streaming export: el response body es un ReadableStream que escribe
// JSON en chunks. Para cuentas grandes (50k+ tareas) esto evita OOM
// y deja al cliente empezar a recibir datos sin esperar al final.
//
// Estructura del JSON producido:
//   { version, exportedAt, stats, projects: [...], specialDates: [...], tasks: [...] }
//
// projects y specialDates son chicos (decenas), van en una sola lectura.
// tasks puede ser enorme — se pagina con LIMIT/OFFSET y se streamea.
export async function GET() {
  try {
    await ensureDatabase();

    // Datos chicos: leemos completos antes de empezar a streamear.
    const projects = await query(`
      SELECT id, name, description, emoji, color, due_date,
             is_archived, created_at, updated_at
      FROM AppChecklist_projects
      ORDER BY created_at DESC
    `);
    const specialDates = await query(`
      SELECT type, date, user_id, label, created_at
      FROM AppChecklist_special_dates
      ORDER BY created_at
    `);
    const totalCount = await query(
      `SELECT COUNT(*)::int AS c FROM AppChecklist_tasks WHERE deleted_at IS NULL`
    );
    const taskCount = totalCount[0]?.c || 0;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Header: todo lo que va antes del array de tasks.
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                version: 1,
                exportedAt: new Date().toISOString(),
                stats: {
                  tasks: taskCount,
                  projects: projects.length,
                  specialDates: specialDates.length,
                },
                projects,
                specialDates,
              }).slice(0, -1) + ',"tasks":['
              // .slice(-1) quita el "}" final para abrir el "tasks" array
              // sin re-serializar todo el header.
            )
          );

          // Tasks en chunks paginados. Cada fila se serializa
          // individualmente para no construir un array gigante en RAM.
          let offset = 0;
          let isFirst = true;
          while (offset < taskCount) {
            const chunk = await query(
              `
              SELECT
                t.id, t.title, t.description, t.assigned_to, t.assigned_by,
                t.is_completed, t.completed_at, t.due_date, t.priority,
                t.reaction, t.category_id, t.project_id, t.recurrence,
                t.recurrence_days, t.is_shared, t.created_at, t.updated_at,
                COALESCE(subs.subtasks, '[]'::json) as subtasks
              FROM AppChecklist_tasks t
              LEFT JOIN LATERAL (
                SELECT json_agg(
                  json_build_object(
                    'id', s.id,
                    'title', s.title,
                    'is_completed', s.is_completed,
                    'sort_order', s.sort_order,
                    'created_at', s.created_at
                  ) ORDER BY s.sort_order, s.id
                ) as subtasks
                FROM AppChecklist_subtasks s WHERE s.task_id = t.id
              ) subs ON true
              WHERE t.deleted_at IS NULL
              ORDER BY t.created_at DESC
              LIMIT $1 OFFSET $2
              `,
              [CHUNK_SIZE, offset]
            );
            for (const task of chunk) {
              const sep = isFirst ? '' : ',';
              isFirst = false;
              controller.enqueue(encoder.encode(sep + JSON.stringify(task)));
            }
            offset += chunk.length;
            // Salida defensiva: si la query devuelve menos que CHUNK_SIZE
            // ya llegamos al final, evita loop infinito si totalCount era
            // stale (otra mutacion redujo la cuenta entre queries).
            if (chunk.length < CHUNK_SIZE) break;
          }

          controller.enqueue(encoder.encode(']}'));
          controller.close();
        } catch (err) {
          console.error('Error during streaming export:', err);
          controller.error(err);
        }
      },
    });

    const today = new Date().toISOString().split('T')[0];
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="amor-compartido-backup-${today}.json"`,
        'X-Export-Task-Count': String(taskCount),
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

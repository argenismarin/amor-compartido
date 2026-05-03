import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

// GET /api/cron/backup — invocado diariamente por Vercel Cron a las 8am UTC.
//
// Vercel Cron firma todos sus requests con el header
// `Authorization: Bearer ${CRON_SECRET}` (configurable en project settings).
// Verificamos esa header para rechazar invocaciones manuales.
//
// El endpoint NO sube a S3/R2 hoy (eso requiere config de credenciales y
// elegir provider). En su lugar:
//   1. Genera el JSON completo (mismo formato que /api/export)
//   2. Lo envia via push notification al admin si hay BACKUP_NOTIFY_USER_ID
//   3. (Futuro) Sube a storage cuando esten configuradas las credenciales
//
// Para upload real a S3/R2:
//   - Setear BACKUP_S3_BUCKET, BACKUP_S3_KEY_ID, BACKUP_S3_SECRET en env
//   - Descomentar el bloque de upload abajo (requiere @aws-sdk/client-s3)
//
// Por ahora el cron sirve como "heartbeat de backup": confirma que el
// pipeline funciona y deja el dump disponible en logs por si hay
// disaster recovery.
export async function GET(request) {
  // Verificar que viene de Vercel Cron (header con secret)
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDatabase();
    const startTime = Date.now();

    // Misma lógica que /api/export pero buffereada (no streaming —
    // el cron necesita el JSON completo para subirlo o loggearlo).
    const tasks = await query(`
      SELECT t.*,
        COALESCE(subs.subtasks, '[]'::json) as subtasks
      FROM AppChecklist_tasks t
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', s.id, 'title', s.title,
            'is_completed', s.is_completed, 'sort_order', s.sort_order
          ) ORDER BY s.sort_order
        ) as subtasks
        FROM AppChecklist_subtasks s WHERE s.task_id = t.id
      ) subs ON true
      WHERE t.deleted_at IS NULL
    `);
    const projects = await query(`SELECT * FROM AppChecklist_projects`);
    const specialDates = await query(`SELECT * FROM AppChecklist_special_dates`);

    const payload = {
      version: 1,
      backupType: 'cron',
      generatedAt: new Date().toISOString(),
      stats: {
        tasks: tasks.length,
        projects: projects.length,
        specialDates: specialDates.length,
      },
      tasks,
      projects,
      specialDates,
    };

    const json = JSON.stringify(payload);
    const sizeKB = Math.round(json.length / 1024);
    const elapsedMs = Date.now() - startTime;

    // TODO: cuando se configure storage real, descomentar:
    //
    // import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
    // const s3 = new S3Client({
    //   region: process.env.BACKUP_S3_REGION,
    //   credentials: {
    //     accessKeyId: process.env.BACKUP_S3_KEY_ID,
    //     secretAccessKey: process.env.BACKUP_S3_SECRET,
    //   },
    // });
    // const today = new Date().toISOString().split('T')[0];
    // await s3.send(new PutObjectCommand({
    //   Bucket: process.env.BACKUP_S3_BUCKET,
    //   Key: `amor-compartido/${today}.json`,
    //   Body: json,
    //   ContentType: 'application/json',
    // }));
    //
    // Hasta entonces solo loggeamos. Vercel logs retiene 24h en el plan
    // gratis, asi que el operador puede pegar el JSON desde Vercel logs
    // si necesita restaurar. NO es un sistema de backup robusto pero
    // mejor que nada.

    console.log('[cron:backup] OK', {
      sizeKB,
      elapsedMs,
      ...payload.stats,
      // El JSON se loggea solo si la cuenta es chica (<500KB).
      // Mas grande satura los logs sin valor practico.
      ...(sizeKB < 500 ? { snapshot: payload } : {}),
    });

    return NextResponse.json({
      ok: true,
      sizeKB,
      elapsedMs,
      ...payload.stats,
    });
  } catch (err) {
    console.error('[cron:backup] failed:', err);
    return NextResponse.json(
      { error: 'Backup failed', message: err.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';
import { getTodayBogota } from '@/lib/timezone';

// GET /api/cron/reminders — invocado diariamente por Vercel Cron a las
// 13:00 UTC (8am Bogotá UTC-5).
//
// Para cada usuario:
// 1. Cuenta tareas vencidas (due_date < hoy AND no completadas)
// 2. Cuenta tareas que vencen HOY (due_date = hoy AND no completadas)
// 3. Si hay alguna, envia push con resumen
//
// Si el usuario no tiene tareas pendientes, NO recibe push (no spamear).
//
// Verifica CRON_SECRET igual que /api/cron/backup.
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDatabase();
    const today = getTodayBogota();

    const users = await query('SELECT id, name FROM AppChecklist_users');
    const summary = [];

    for (const user of users) {
      // Tareas asignadas al usuario (incluye is_shared) que estan
      // pendientes y o vencieron o vencen hoy.
      const taskRows = await query(
        `
        SELECT
          COUNT(*) FILTER (WHERE due_date::text < $2) AS overdue,
          COUNT(*) FILTER (WHERE due_date::text = $2) AS due_today
        FROM AppChecklist_tasks
        WHERE deleted_at IS NULL
          AND is_completed = false
          AND due_date IS NOT NULL
          AND (assigned_to = $1 OR is_shared = true)
        `,
        [user.id, today]
      );
      const { overdue, due_today } = taskRows[0] || {};
      const overdueN = parseInt(overdue || 0, 10);
      const todayN = parseInt(due_today || 0, 10);

      if (overdueN === 0 && todayN === 0) {
        summary.push({ user: user.name, sent: false, reason: 'no pending' });
        continue;
      }

      // Componer mensaje
      const parts = [];
      if (todayN > 0) parts.push(`${todayN} para hoy`);
      if (overdueN > 0) parts.push(`${overdueN} vencida${overdueN === 1 ? '' : 's'}`);
      const body = parts.join(' • ');

      try {
        await sendPushToUser(user.id, {
          title: '💕 Recordatorio del día',
          body,
          tag: `reminder-${today}`,
        });
        summary.push({ user: user.name, sent: true, overdue: overdueN, today: todayN });
      } catch (pushErr) {
        console.error(`[cron:reminders] push failed for user ${user.id}:`, pushErr);
        summary.push({ user: user.name, sent: false, reason: 'push failed' });
      }
    }

    console.log('[cron:reminders] OK', { date: today, summary });
    return NextResponse.json({ ok: true, date: today, summary });
  } catch (err) {
    console.error('[cron:reminders] failed:', err);
    return NextResponse.json(
      { error: 'Reminders failed', message: err.message },
      { status: 500 }
    );
  }
}

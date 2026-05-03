import { NextResponse } from 'next/server';
import { ensureDatabase, getInitError, query } from '@/lib/db';

// GET /api/health — liveness/readiness probe.
//
// Responde con:
// - 200 + { status: 'ok', db: 'ok', initError: null }       cuando todo OK
// - 503 + { status: 'degraded', db: 'init_failed', initError } cuando initDatabase fallo
// - 503 + { status: 'degraded', db: 'query_failed', error }     cuando un SELECT trivial falla
//
// Uso: monitoreo externo (UptimeRobot, BetterStack, Vercel checks) puede
// pollearlo cada N segundos para alertar si la app esta degradada. Vercel
// rewrites podria mapearlo a / si quieres healthcheck en el root.
export async function GET() {
  await ensureDatabase();
  const initErr = getInitError();
  if (initErr) {
    return NextResponse.json(
      {
        status: 'degraded',
        db: 'init_failed',
        initError: initErr.message || String(initErr),
      },
      { status: 503 }
    );
  }
  try {
    // SELECT trivial para confirmar que el pool responde (no es solo
    // que initDatabase haya pasado en el pasado).
    await query('SELECT 1 AS ok');
    return NextResponse.json({ status: 'ok', db: 'ok', initError: null });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'degraded',
        db: 'query_failed',
        error: err?.message || String(err),
      },
      { status: 503 }
    );
  }
}

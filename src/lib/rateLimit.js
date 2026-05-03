// Rate limiter in-memory para endpoints mutadores.
//
// Limitaciones intencionales:
// - In-memory: el contador se resetea entre cold starts de serverless.
//   En Vercel cada instancia tiene su propio Map, asi que un atacante
//   distribuido podria rebasar el limite por instancia. Para casos
//   estrictos usar Upstash/Redis. Para el uso real de la app (2 personas)
//   esto es mas que suficiente y NO requiere infra extra.
// - Por (IP + key): un usuario detras de NAT comparte limite con otros.
//   En la app real cada pareja usa una conexion casera distinta, OK.
// - Sliding-ish: usa ventanas fijas. Mas simple que sliding window y
//   suficiente para cortar abuso burdo.
//
// Headers que setea en la respuesta cuando bloquea:
//   X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After

const buckets = new Map();

// Limpia entradas expiradas cada minuto para que el Map no crezca para
// siempre. Setlnterval no impide que el proceso termine en serverless.
if (typeof globalThis.setInterval === 'function') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000).unref?.();
}

/**
 * Verifica si un cliente puede hacer la request.
 *
 * @param {object} opts
 * @param {string} opts.key — identificador (ej: `${ip}:${endpoint}`)
 * @param {number} opts.limit — max requests permitidos en la ventana
 * @param {number} opts.windowMs — duracion de la ventana en ms
 * @returns {{ allowed: boolean, limit: number, remaining: number, resetAt: number, retryAfterMs: number }}
 */
export function checkRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: bucket.count <= limit,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterMs: bucket.resetAt - now,
  };
}

/**
 * Extrae IP del cliente desde headers de Next/Vercel/proxies comunes.
 * Fallback a 'unknown' si nada coincide (ej: tests, dev sin proxy).
 */
export function getClientIp(request) {
  const h = request.headers;
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    h.get('x-vercel-forwarded-for') ||
    'unknown'
  );
}

/**
 * Helper de respuesta 429 estandar con headers.
 */
export function rateLimitResponse(check) {
  const { limit, remaining, resetAt, retryAfterMs } = check;
  return new Response(
    JSON.stringify({ error: 'Too many requests, intenta en unos segundos' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      },
    }
  );
}

/**
 * Wrapper one-liner: aplica rate limit por IP+endpoint y retorna la
 * Response de 429 si rebaso, o null si todo OK (continuar el handler).
 *
 * Uso en API route:
 *   const limit = enforceRateLimit(request, 'POST /api/tasks', 30, 60_000);
 *   if (limit) return limit;
 */
export function enforceRateLimit(request, endpoint, limit = 30, windowMs = 60_000) {
  const ip = getClientIp(request);
  const check = checkRateLimit({ key: `${ip}:${endpoint}`, limit, windowMs });
  if (!check.allowed) return rateLimitResponse(check);
  return null;
}

import { NextResponse } from 'next/server';

// Middleware global de Next.
//
// Hoy hace UNA cosa: bloquear requests cross-origin a endpoints
// mutadores. Esto es proteccion CSRF basica sin necesidad de tokens
// (los SameSite=Lax por defecto de cookies modernas + esta verificacion
// son suficientes para una PWA personal).
//
// Estrategia:
// - GET/HEAD/OPTIONS pasan siempre (no mutan estado)
// - POST/PUT/DELETE solo se aceptan si Origin (o Referer si no hay
//   Origin) coincide con el host de la request. Esto bloquea que un
//   sitio externo embeba <form action="https://amor-compartido/...">
//   o haga fetch hacia nuestras APIs.
// - Same-origin (Origin === host) sigue como antes.
// - En dev sin Origin (curl, tests) tambien dejamos pasar, sino la
//   suite e2e y curl debug se rompen.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(request) {
  if (!MUTATING_METHODS.has(request.method)) {
    return NextResponse.next();
  }
  // Solo aplicar a /api/* — paginas no son mutadoras.
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // Sin Origin ni Referer: requests no-browser (curl, scripts del
  // mismo server, healthchecks). Permitir — el rate limiter cubre
  // abuso desde estos canales.
  if (!origin && !referer) {
    return NextResponse.next();
  }

  // Comparar host del origin/referer con el host de la request.
  let sourceHost = null;
  try {
    sourceHost = new URL(origin || referer).host;
  } catch {
    // URL malformada → bloquear, es sospechoso.
    return new NextResponse(JSON.stringify({ error: 'Invalid origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (sourceHost !== host) {
    return new NextResponse(
      JSON.stringify({ error: 'Cross-origin request blocked' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return NextResponse.next();
}

// Solo correr middleware en /api/*. /_next, /static, /icon-*.png, /sw.js,
// /manifest.json no necesitan middleware.
export const config = {
  matcher: ['/api/:path*'],
};

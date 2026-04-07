// Next.js instrumentation hook — se ejecuta una vez al iniciar el servidor.
// Acá inicializamos Sentry para los runtimes de Node y Edge.
//
// Doc: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captura errores que ocurren durante el procesamiento de requests
// (server actions, API routes, server components). Sin esto los errores
// del server-side no llegarían a Sentry.
export async function onRequestError(err, request, context) {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureRequestError(err, request, context);
  }
}

// Sentry — configuración del runtime Edge (middleware, etc.).
//
// Se carga desde instrumentation.js cuando NEXT_RUNTIME === 'edge'.
// Actualmente la app NO usa edge runtime, pero dejamos la config por
// si en el futuro algún endpoint o middleware lo usa.

import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: process.env.NODE_ENV,
  });
}

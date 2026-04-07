// Sentry — configuración del runtime Node.js (API routes).
//
// Se carga desde instrumentation.js cuando NEXT_RUNTIME === 'nodejs'.
// Solo inicializa si SENTRY_DSN está configurado.

import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Trace 10% de las requests en producción, 100% en dev
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    // Tag environment
    environment: process.env.NODE_ENV,

    // No incluir headers/IPs por privacidad (es app de pareja)
    sendDefaultPii: false,
  });
}

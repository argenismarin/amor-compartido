// Sentry — configuración del runtime Node.js (API routes).
//
// Se carga desde instrumentation.js cuando NEXT_RUNTIME === 'nodejs'.
// Solo inicializa si SENTRY_DSN está configurado.

import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Trace 10% de las requests en producción, 100% en dev.
    // Cubre auto-instrumentation de Next routes, fetch, y db calls (pg
    // tiene integration nativa en @sentry/nextjs).
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    // Profiling: 100% de las traces que se sampleen tendrán profile.
    // Es relativo a tracesSampleRate, así que en prod efectivamente
    // muestreamos 10% * 100% = 10% de las requests.
    profilesSampleRate: 1.0,

    // Tag environment
    environment: process.env.NODE_ENV,

    // No incluir headers/IPs por privacidad (es app de pareja)
    sendDefaultPii: false,

    // Filtrar errores ruidosos que no queremos en el dashboard
    ignoreErrors: [
      // Bot health checks que retornan 404 esperado
      'NotFoundError',
      // Cancelaciones de fetch del cliente (tab cerrada mid-request)
      'AbortError',
    ],

    // Hooks de tagging: cada request recibe tags útiles para filtrar
    beforeSendTransaction(event) {
      // Marcar transactions de endpoints lentos para investigar
      const duration = (event.timestamp || 0) - (event.start_timestamp || 0);
      if (duration > 1) {
        event.tags = { ...event.tags, slow: 'true' };
      }
      return event;
    },
  });
}

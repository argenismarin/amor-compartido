// Sentry — configuración del cliente (browser).
//
// Este archivo se carga automáticamente por Next + @sentry/nextjs.
// Solo inicializa si NEXT_PUBLIC_SENTRY_DSN está configurado, así que
// es no-op en dev local y CI sin DSN. Cuando configurás el DSN en
// Vercel, el cliente empieza a reportar errores automáticamente.

import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Trace 10% de las requests en producción, 100% en dev.
    // Para una app de 2 usuarios esto está sobradísimo.
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    // Sin replays de sesión por ahora (privacidad + cuota gratis).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Tag environment para filtrar dev vs prod en el dashboard
    environment: process.env.NODE_ENV,

    // No reportar errores conocidos del browser que ya cubrimos
    ignoreErrors: [
      // ResizeObserver loop limit (warning de Chrome, no es bug real)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  });
}

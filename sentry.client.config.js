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

    // Web Vitals + browser perf (LCP, FID, CLS, TTFB, INP).
    // Estas métricas ya se trackean automáticamente por @sentry/nextjs
    // browser SDK cuando tracesSampleRate > 0; las exponemos en el
    // dashboard de Performance > Web Vitals.
    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Captura clicks/navigation/fetch automáticamente como breadcrumbs
    // para tener contexto cuando un error ocurre. Default ya hace esto;
    // mantenemos defaults.

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
      // Cancelaciones de fetch (tab cerrada mid-request)
      'AbortError',
      // Errores de extensiones de Chrome inyectados en window
      'chrome-extension://',
    ],
  });
}

import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable static optimization for better performance
  poweredByHeader: false,
};

// Wrap con Sentry. Si SENTRY_DSN no está configurado, los runtime configs
// (sentry.client/server/edge.config.js) son no-op, así que el wrap solo
// sirve para registrar el plugin de webpack/turbopack que prepara el
// runtime — no rompe nada en builds sin Sentry.
//
// Source maps upload deshabilitado (silent + sin authToken) para que el
// build de Vercel funcione sin requerir credenciales adicionales. Cuando
// quieras subir source maps, agregá SENTRY_AUTH_TOKEN como env var.
export default withSentryConfig(nextConfig, {
  // Org y project son placeholders — solo importan para upload de source
  // maps, que está deshabilitado por ahora. Cuando creés tu org en Sentry,
  // podés sobreescribirlos con SENTRY_ORG y SENTRY_PROJECT env vars.
  org: process.env.SENTRY_ORG || 'placeholder-org',
  project: process.env.SENTRY_PROJECT || 'placeholder-project',

  // Solo logguear en build, no romper si las creds faltan
  silent: !process.env.CI,

  // No subir source maps en este momento (requiere SENTRY_AUTH_TOKEN).
  // Cuando lo configures, esto lo activará automáticamente.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Ocultar source maps del cliente para no exponer código original
  // a usuarios finales. Sentry los usa internamente si están subidos.
  hideSourceMaps: true,

  // No instrumentar los logs del cliente
  disableLogger: true,
});

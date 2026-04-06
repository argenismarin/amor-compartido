// @ts-check
import { defineConfig, devices } from '@playwright/test';

// Playwright config para tests E2E.
//
// Los tests usan page.route() para mockear las llamadas a /api/*, así que
// no necesitan una BD real. El dev server de Next se inicia automáticamente
// con webServer (con un DATABASE_URL fake si no está seteado).
//
// Correr local: npm run test:e2e
// Correr con UI: npm run test:e2e:ui

export default defineConfig({
  testDir: './tests/e2e',

  // Tiempo máximo por test
  timeout: 30 * 1000,

  // Fail fast en CI, retry una vez localmente para flakes
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // CRITICAL: bloquea el Service Worker durante los tests.
    // Sin esto, sw.js intercepta los fetches a /api/* y los pasa al server
    // real (que falla con ECONNREFUSED a Postgres). Con block, todos los
    // fetches van por el main frame donde page.route() los puede interceptar.
    serviceWorkers: 'block',
  },

  // Solo Chromium en viewport mobile (la app es mobile-first).
  // Si querés más cobertura, añadí más proyectos acá.
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],

  // Inicia el dev server automáticamente antes de los tests.
  // En CI, el server arranca limpio. Localmente reusa el server existente
  // si ya está corriendo en localhost:3000.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // Las API routes se mockean desde el cliente con page.route(),
      // pero Next igual carga el módulo db.js. Le damos un DATABASE_URL
      // dummy para que no crashee al importar pg.Pool.
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
    },
  },
});

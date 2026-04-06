// Smoke test: la app carga y los elementos clave están visibles.
// Si esto falla, algo muy básico está roto (build, hidratación, mocks, etc.)

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

test.describe('Smoke', () => {
  test('la app carga con header, user toggle y tabs', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    // Header con el título
    await expect(page.getByText('Amor Compartido')).toBeVisible();

    // Toggle de usuarios — el regex /Argenis/i también matchearía el tab
    // "Para Argenis", así que filtramos por la clase .user-btn
    const userButtons = page.locator('.user-btn');
    await expect(userButtons.filter({ hasText: 'Jenifer' })).toBeVisible();
    await expect(userButtons.filter({ hasText: 'Argenis' })).toBeVisible();

    // Los 3 tabs
    await expect(page.getByRole('button', { name: /Mis Tareas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Para/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Proyectos/i })).toBeVisible();

    // FAB visible
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible();

    // Estado vacío (no hay tareas todavía)
    await expect(page.getByText(/No hay tareas/i)).toBeVisible();
  });

  test('cambiar de usuario actualiza el tema', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    // Empieza con jenifer (default)
    const root = page.locator('[data-user]').first();
    await expect(root).toHaveAttribute('data-user', 'jenifer');

    const userButtons = page.locator('.user-btn');

    // Click en Argenis (filtrado por .user-btn para no matchear el tab)
    await userButtons.filter({ hasText: 'Argenis' }).click();
    await expect(root).toHaveAttribute('data-user', 'argenis');

    // Volver a Jenifer
    await userButtons.filter({ hasText: 'Jenifer' }).click();
    await expect(root).toHaveAttribute('data-user', 'jenifer');
  });
});

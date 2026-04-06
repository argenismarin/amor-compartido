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

    // Toggle de usuarios (Jenifer y Argenis)
    await expect(page.getByRole('button', { name: /Jenifer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Argenis/i })).toBeVisible();

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

    // Click en Argenis
    await page.getByRole('button', { name: /Argenis/i }).click();
    await expect(root).toHaveAttribute('data-user', 'argenis');

    // Volver a Jenifer
    await page.getByRole('button', { name: /Jenifer/i }).click();
    await expect(root).toHaveAttribute('data-user', 'jenifer');
  });
});

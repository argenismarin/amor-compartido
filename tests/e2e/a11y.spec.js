// Tests E2E de accesibilidad: focus trap, autofocus, Escape para cerrar.
// Estos tests cubren D3 (que extrajimos en el sprint de a11y).

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

test.describe('Accesibilidad de modales', () => {
  test('autofocus: el modal de nueva tarea enfoca el input título', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Nueva tarea' }).click();

    // El input "Título" debe tener el foco al abrir
    const titleInput = page.getByPlaceholder('¿Qué necesitas hacer?');
    await expect(titleInput).toBeFocused();
  });

  test('Escape cierra el modal', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Nueva tarea' }).click();
    await expect(page.getByRole('heading', { name: /Nueva tarea/i })).toBeVisible();

    // Escape debe cerrar el modal
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /Nueva tarea/i })).not.toBeVisible();
  });

  test('focus trap: Tab no escapa del modal', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Nueva tarea' }).click();

    // Tab varias veces — el foco debe permanecer dentro del modal.
    // Verificamos que el activeElement siempre esté dentro del [role="dialog"]
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const insideDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        return dialog ? dialog.contains(document.activeElement) : false;
      });
      expect(insideDialog).toBe(true);
    }
  });

  test('atributos aria correctos en el modal', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Nueva tarea' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

test.describe('Toast escapable (D4)', () => {
  test('botón X cierra el toast', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push({
      id: 1, title: 'Tarea de prueba', description: null,
      assigned_to: 1, assigned_by: 1, is_completed: false, completed_at: null,
      priority: 'medium', created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), subtasks: [],
    });
    state.nextTaskId = 2;

    await page.goto('/');
    await expect(page.getByText('Tarea de prueba')).toBeVisible();

    // Eliminar para que aparezca el toast
    await page.getByRole('button', { name: /Eliminar tarea: Tarea de prueba/i }).click();
    await expect(page.getByText('Tarea eliminada')).toBeVisible();

    // Click en el botón X del toast
    await page.getByRole('button', { name: 'Cerrar notificación' }).click();
    await expect(page.getByText('Tarea eliminada')).not.toBeVisible();
  });
});

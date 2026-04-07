// Tests E2E del ordenamiento de tareas (B2)
// y persistencia en localStorage.

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

function makeTask(id, title, overrides = {}) {
  return {
    id,
    title,
    description: null,
    assigned_to: 1,
    assigned_by: 1,
    is_completed: false,
    completed_at: null,
    priority: 'medium',
    created_at: new Date(2025, 0, id).toISOString(),
    updated_at: new Date().toISOString(),
    subtasks: [],
    ...overrides,
  };
}

test.describe('Ordenamiento de tareas', () => {
  test('alfabético: A-Z', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push(
      makeTask(1, 'Zapatos'),
      makeTask(2, 'Bicicleta'),
      makeTask(3, 'Manzanas')
    );
    state.nextTaskId = 4;

    await page.goto('/');
    await expect(page.getByText('Zapatos')).toBeVisible();

    // Cambiar a orden alfabético
    await page.getByLabel('Ordenar tareas').selectOption('alphabetical');

    // Las tareas deberían estar en orden A-Z
    const titles = await page.locator('.task-title').allTextContents();
    expect(titles).toEqual(['Bicicleta', 'Manzanas', 'Zapatos']);
  });

  test('persistencia: el orden elegido se mantiene al recargar', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push(makeTask(1, 'Test'));
    state.nextTaskId = 2;

    await page.goto('/');
    await page.getByLabel('Ordenar tareas').selectOption('priority');

    // Reload (los mocks de page.route persisten via setupApiMocks de nuevo)
    await setupApiMocks(page, { tasks: state.tasks });
    await page.reload();

    // El select debería seguir en "priority"
    await expect(page.getByLabel('Ordenar tareas')).toHaveValue('priority');
  });
});

// Tests E2E de subtareas (B3): añadir, completar, eliminar
// + verificar el contador X/Y en el meta de la tarea.

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

function makeTask(state, overrides = {}) {
  return {
    id: 1,
    title: 'Tarea con pasos',
    description: null,
    assigned_to: 1,
    assigned_by: 1,
    is_completed: false,
    completed_at: null,
    priority: 'medium',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subtasks: [],
    ...overrides,
  };
}

test.describe('Subtareas', () => {
  test('añadir primera subtarea desde "+ Pasos"', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push(makeTask(state));
    state.nextTaskId = 2;

    await page.goto('/');
    await expect(page.getByText('Tarea con pasos')).toBeVisible();

    // Click en "+ Pasos" (visible cuando no hay subtareas)
    await page.getByRole('button', { name: 'Agregar pasos' }).click();

    // Aparece el input de subtarea
    const input = page.getByPlaceholder('Agregar paso...');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused(); // autofocus

    await input.fill('Paso uno');
    await page.getByRole('button', { name: 'Agregar subtarea' }).click();

    // La subtarea aparece en la lista
    await expect(page.getByText('Paso uno')).toBeVisible();

    // El state se actualizó
    await expect.poll(() => state.tasks[0].subtasks.length).toBe(1);
    expect(state.tasks[0].subtasks[0].title).toBe('Paso uno');
  });

  test('completar subtarea actualiza el contador X/Y', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push(
      makeTask(state, {
        subtasks: [
          { id: 1, title: 'Paso A', is_completed: false, sort_order: 1 },
          { id: 2, title: 'Paso B', is_completed: false, sort_order: 2 },
        ],
      })
    );
    state.nextTaskId = 2;
    state.nextSubtaskId = 3;

    await page.goto('/');
    await expect(page.getByText('Tarea con pasos')).toBeVisible();

    // El contador inicial debería ser "0/2"
    const counter = page.getByRole('button', { name: /0 de 2 subtareas completadas/i });
    await expect(counter).toBeVisible();

    // Expandir las subtareas
    await counter.click();
    await expect(page.getByText('Paso A')).toBeVisible();

    // Marcar Paso A como completado
    await page.getByRole('checkbox', { name: /Marcar "Paso A"/i }).click();

    // Contador pasa a "1/2"
    await expect.poll(() => state.tasks[0].subtasks[0].is_completed).toBe(true);
    await expect(page.getByRole('button', { name: /1 de 2 subtareas completadas/i })).toBeVisible();
  });

  test('eliminar subtarea la quita de la lista', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push(
      makeTask(state, {
        subtasks: [
          { id: 1, title: 'Borrame', is_completed: false, sort_order: 1 },
          { id: 2, title: 'Quédate', is_completed: false, sort_order: 2 },
        ],
      })
    );
    state.nextTaskId = 2;
    state.nextSubtaskId = 3;

    await page.goto('/');

    // Expandir subtareas
    await page.getByRole('button', { name: /0 de 2 subtareas completadas/i }).click();
    await expect(page.getByText('Borrame')).toBeVisible();

    // Click en "x" de la primera subtarea
    await page.getByRole('button', { name: 'Eliminar subtarea "Borrame"' }).click();

    // Borrame desaparece, Quédate sigue
    await expect(page.getByText('Borrame')).not.toBeVisible();
    await expect(page.getByText('Quédate')).toBeVisible();
    await expect.poll(() => state.tasks[0].subtasks.length).toBe(1);
  });
});

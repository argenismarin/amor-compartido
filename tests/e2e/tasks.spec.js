// Tests E2E de los flujos principales de tareas:
// crear (modal y quick add), completar, eliminar+deshacer, búsqueda.

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

test.describe('Tareas — flujo principal', () => {
  test('crear tarea desde el modal', async ({ page }) => {
    const state = await setupApiMocks(page);
    await page.goto('/');

    // Abrir modal con el FAB
    await page.getByRole('button', { name: 'Nueva tarea' }).click();

    // El modal debe aparecer con el título correcto
    await expect(page.getByRole('heading', { name: /Nueva tarea/i })).toBeVisible();

    // Llenar el título
    await page.getByPlaceholder('¿Qué necesitas hacer?').fill('Sacar la basura');

    // Submit
    await page.getByRole('button', { name: /Crear tarea/i }).click();

    // El modal cierra y la tarea aparece en la lista
    await expect(page.getByText('Sacar la basura')).toBeVisible();
    expect(state.tasks.length).toBe(1);
    expect(state.tasks[0].title).toBe('Sacar la basura');
  });

  test('quick add crea tarea sin abrir modal', async ({ page }) => {
    const state = await setupApiMocks(page);
    await page.goto('/');

    // El input de quick add está visible
    const quickInput = page.getByPlaceholder('Agregar tarea rápida...');
    await expect(quickInput).toBeVisible();

    // Escribir y enviar con Enter
    await quickInput.fill('Comprar pan');
    await quickInput.press('Enter');

    // La tarea aparece en la lista
    await expect(page.getByText('Comprar pan')).toBeVisible();
    expect(state.tasks.length).toBe(1);
  });

  test('marcar tarea como completada', async ({ page }) => {
    const state = await setupApiMocks(page);
    // Pre-cargar una tarea
    state.tasks.push({
      id: 1,
      title: 'Estudiar',
      description: null,
      assigned_to: 1,
      assigned_by: 1,
      is_completed: false,
      completed_at: null,
      priority: 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subtasks: [],
    });
    state.nextTaskId = 2;

    await page.goto('/');

    // La tarea está visible y no completada
    await expect(page.getByText('Estudiar')).toBeVisible();

    // Click en el checkbox de la tarea
    await page.getByRole('checkbox', { name: /Marcar "Estudiar" como completada/i }).click();

    // El estado se actualiza
    await expect.poll(() => state.tasks[0].is_completed).toBe(true);
  });

  test('eliminar tarea muestra toast con deshacer', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push({
      id: 1,
      title: 'Tarea de prueba',
      description: null,
      assigned_to: 1,
      assigned_by: 1,
      is_completed: false,
      completed_at: null,
      priority: 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subtasks: [],
    });
    state.nextTaskId = 2;

    await page.goto('/');
    await expect(page.getByText('Tarea de prueba')).toBeVisible();

    // Click en eliminar
    await page.getByRole('button', { name: /Eliminar tarea: Tarea de prueba/i }).click();

    // Toast con botón "Deshacer" aparece
    await expect(page.getByText('Tarea eliminada')).toBeVisible();
    await expect(page.getByRole('button', { name: /Deshacer/i })).toBeVisible();

    // La tarea está soft-deleted en el state
    await expect.poll(() => state.tasks[0].deleted_at).not.toBeNull();

    // Click en deshacer
    await page.getByRole('button', { name: /Deshacer/i }).click();

    // La tarea vuelve
    await expect(page.getByText('Tarea de prueba')).toBeVisible();
    await expect.poll(() => state.tasks[0].deleted_at).toBeNull();
  });

  test('búsqueda filtra tareas por título', async ({ page }) => {
    const state = await setupApiMocks(page);
    state.tasks.push(
      {
        id: 1, title: 'Comprar pan', description: null,
        assigned_to: 1, assigned_by: 1, is_completed: false, completed_at: null,
        priority: 'medium', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), subtasks: [],
      },
      {
        id: 2, title: 'Estudiar inglés', description: null,
        assigned_to: 1, assigned_by: 1, is_completed: false, completed_at: null,
        priority: 'medium', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), subtasks: [],
      },
      {
        id: 3, title: 'Llamar al doctor', description: null,
        assigned_to: 1, assigned_by: 1, is_completed: false, completed_at: null,
        priority: 'medium', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), subtasks: [],
      },
    );
    state.nextTaskId = 4;

    await page.goto('/');

    // Las 3 tareas visibles inicialmente
    await expect(page.getByText('Comprar pan')).toBeVisible();
    await expect(page.getByText('Estudiar inglés')).toBeVisible();
    await expect(page.getByText('Llamar al doctor')).toBeVisible();

    // Buscar "estud"
    await page.getByPlaceholder('Buscar tareas...').fill('estud');

    // Solo "Estudiar inglés" debe quedar visible
    await expect(page.getByText('Estudiar inglés')).toBeVisible();
    await expect(page.getByText('Comprar pan')).not.toBeVisible();
    await expect(page.getByText('Llamar al doctor')).not.toBeVisible();

    // Limpiar la búsqueda
    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();

    // Las 3 vuelven
    await expect(page.getByText('Comprar pan')).toBeVisible();
    await expect(page.getByText('Estudiar inglés')).toBeVisible();
    await expect(page.getByText('Llamar al doctor')).toBeVisible();
  });
});

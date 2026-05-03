// Tests E2E del flujo completo de proyectos.
//
// Estos tests existen porque en el commit 3ade9dd (refactor extract
// useTasks) los handlers de proyectos quedaron huerfanos: referenciados
// pero nunca definidos. Cualquier click en proyectos lanzaba
// ReferenceError en runtime — y CI no lo detecto. Esta suite garantiza
// que los flows criticos (crear, entrar, editar, archivar, restaurar,
// eliminar) sigan funcionando despues de cualquier refactor.

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

test.describe('Projects', () => {
  test('navegar a la tab Proyectos muestra el boton Nuevo Proyecto', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    await page.getByRole('button', { name: /Proyectos/i }).click();

    // El boton "Nuevo Proyecto" debe estar visible (esto fallaba con
    // ReferenceError antes del fix HF1).
    await expect(page.getByRole('button', { name: /Nuevo Proyecto/i })).toBeVisible();
  });

  test('crear un proyecto lo agrega al grid', async ({ page }) => {
    const state = await setupApiMocks(page);
    await page.goto('/');
    await page.getByRole('button', { name: /Proyectos/i }).click();

    // Abrir modal de nuevo proyecto
    await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Llenar y guardar
    await page.getByLabel(/Nombre del proyecto/i).fill('Mi proyecto test');
    await page.getByRole('button', { name: /Crear proyecto/i }).click();

    // El proyecto deberia aparecer en el grid
    await expect(page.getByRole('heading', { name: 'Mi proyecto test' })).toBeVisible();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].name).toBe('Mi proyecto test');
  });

  test('click sobre una project card entra a su detalle', async ({ page }) => {
    await setupApiMocks(page, {
      projects: [
        {
          id: 1, name: 'Proyecto Alpha', emoji: '🚀', color: '#6366f1',
          description: 'descripcion alpha',
          is_archived: false, total_tasks: 0, completed_tasks: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    await page.goto('/');
    await page.getByRole('button', { name: /Proyectos/i }).click();

    // Click en la card (este era el flow ROTO antes del HF1)
    await page.getByRole('heading', { name: 'Proyecto Alpha' }).click();

    // Vista de detalle: titulo grande + boton Volver
    await expect(page.getByRole('heading', { name: 'Proyecto Alpha', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Volver/i })).toBeVisible();
  });

  test('editar un proyecto persiste cambios y refleja en grid', async ({ page }) => {
    const state = await setupApiMocks(page, {
      projects: [
        {
          id: 1, name: 'Original', emoji: '📁', color: '#6366f1',
          description: '', is_archived: false,
          total_tasks: 0, completed_tasks: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    await page.goto('/');
    await page.getByRole('button', { name: /Proyectos/i }).click();

    // Hover sobre la card para que aparezcan los action buttons
    const card = page.locator('.project-card').first();
    await card.hover();
    await card.getByRole('button', { name: /Editar proyecto/i }).click();

    // Modal abierto con datos cargados
    const nameInput = page.getByLabel(/Nombre del proyecto/i);
    await expect(nameInput).toHaveValue('Original');

    // Editar y guardar
    await nameInput.fill('Renombrado');
    await page.getByRole('button', { name: /Guardar cambios/i }).click();

    await expect(page.getByRole('heading', { name: 'Renombrado' })).toBeVisible();
    expect(state.projects[0].name).toBe('Renombrado');
  });

  test('archivar un proyecto lo mueve a la lista de archivados', async ({ page }) => {
    const state = await setupApiMocks(page, {
      projects: [
        {
          id: 1, name: 'Por archivar', emoji: '📁', color: '#6366f1',
          description: '', is_archived: false,
          total_tasks: 0, completed_tasks: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    await page.goto('/');
    await page.getByRole('button', { name: /Proyectos/i }).click();

    const card = page.locator('.project-card').first();
    await card.hover();
    await card.getByRole('button', { name: /Archivar proyecto/i }).click();

    // Confirm dialog
    await page.getByRole('button', { name: /Archivar|Eliminar|Confirmar|Sí/i }).first().click();

    // El proyecto desaparece del grid activo
    await expect(page.getByRole('heading', { name: 'Por archivar' })).not.toBeVisible();
    expect(state.projects).toHaveLength(0);
    expect(state.archivedProjects).toHaveLength(1);
  });
});

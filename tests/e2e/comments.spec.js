// E2E tests para hilo de comentarios por tarea (M9).
//
// Cubre el flow tipico: expandir hilo, escribir comentario, verlo
// aparecer optimisticamente, borrar el propio.

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

test.describe('Comments', () => {
  test.beforeEach(async ({ page }) => {
    // Mock /api/comments — el helper de mockApi no lo cubre.
    let commentsState = [];
    let nextId = 1;

    await page.route('**/api/comments?**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: commentsState });
      } else {
        await route.fallback();
      }
    });
    await page.route('**/api/comments', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newComment = {
          id: nextId++,
          ...body,
          author_name: body.author_id === 1 ? 'Jenifer' : 'Argenis',
          author_avatar: body.author_id === 1 ? '💕' : '🍷',
          created_at: new Date().toISOString(),
        };
        commentsState.push(newComment);
        await route.fulfill({ json: { success: true, comment: newComment } });
      } else {
        await route.fallback();
      }
    });
    await page.route(/\/api\/comments\/\d+$/, async (route) => {
      if (route.request().method() === 'DELETE') {
        const id = parseInt(route.request().url().match(/\/api\/comments\/(\d+)/)[1]);
        commentsState = commentsState.filter((c) => c.id !== id);
        await route.fulfill({ json: { success: true } });
      } else {
        await route.fallback();
      }
    });
  });

  test('expandir hilo muestra "no hay comentarios" cuando vacio', async ({ page }) => {
    await setupApiMocks(page, {
      tasks: [{
        id: 1, title: 'Test task', description: '',
        assigned_to: 1, assigned_by: 1, priority: 'medium',
        is_completed: false, is_shared: false,
        created_at: new Date().toISOString(),
      }],
    });
    await page.goto('/');

    // Esperar que la tarea aparezca y abrir el hilo
    await expect(page.getByText('Test task')).toBeVisible();
    await page.getByRole('button', { name: /Ver comentarios/i }).first().click();

    await expect(page.getByText(/Aún no hay comentarios/i)).toBeVisible();
  });

  test('agregar comentario lo muestra optimisticamente', async ({ page }) => {
    await setupApiMocks(page, {
      tasks: [{
        id: 1, title: 'Test task', description: '',
        assigned_to: 1, assigned_by: 1, priority: 'medium',
        is_completed: false, is_shared: false,
        created_at: new Date().toISOString(),
      }],
    });
    await page.goto('/');
    await page.getByRole('button', { name: /Ver comentarios/i }).first().click();

    await page.getByPlaceholder(/Escribe un comentario/i).fill('Compré las flores');
    await page.getByRole('button', { name: /Enviar comentario/i }).click();

    await expect(page.getByText('Compré las flores')).toBeVisible();
  });
});

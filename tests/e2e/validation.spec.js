// Tests E2E de validación con zod (C7).
//
// Estos tests NO usan setupApiMocks porque queremos verificar el
// comportamiento REAL del server: zod corre antes de tocar la BD, así
// que devuelve 400 con un mensaje útil incluso sin BD configurada.
//
// Si zod no estuviera, las requests con body malformado pasarían por
// validate y crashearían más adelante con 500 de SQL.

import { test, expect } from '@playwright/test';

// Helper: ejecuta un fetch desde el browser context (donde está el page.route())
// y devuelve { status, body }. Como NO llamamos setupApiMocks acá, las requests
// pasan al server Next real.
async function fetchApi(page, url, options = {}) {
  return await page.evaluate(async ({ url, options }) => {
    const res = await fetch(url, options);
    let body;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  }, { url, options });
}

test.describe('Validación zod en endpoints', () => {
  test.beforeEach(async ({ page }) => {
    // Necesitamos cargar alguna página para tener un browser context.
    // No nos importa el contenido — solo queremos ejecutar fetch desde
    // el origen correcto (http://localhost:3000).
    await page.goto('/');
  });

  test('POST /api/tasks sin title devuelve 400', async ({ page }) => {
    const { status, body } = await fetchApi(page, '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // sin title
        assigned_to: 1,
        assigned_by: 2,
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain('title');
  });

  test('POST /api/tasks con due_date vacío NO rechaza por due_date', async ({ page }) => {
    // Regresión: el <input type="date"> del cliente envía '' cuando el
    // usuario no elige fecha. El schema debe tratarlo como null, no
    // rechazarlo con 400. Si hay una BD disponible el status será 200;
    // en CI sin BD será 500 por el INSERT. Lo único que NO debe pasar
    // es un 400 mencionando due_date (eso sería la regresión).
    const { status, body } = await fetchApi(page, '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Tarea sin fecha',
        assigned_to: 1,
        assigned_by: 2,
        due_date: '',
      }),
    });

    if (status === 400) {
      expect(body.error).not.toContain('due_date');
    }
  });

  test('POST /api/tasks con priority inválida devuelve 400', async ({ page }) => {
    const { status, body } = await fetchApi(page, '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test',
        assigned_to: 1,
        assigned_by: 2,
        priority: 'super-urgente', // no es low/medium/high
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain('priority');
  });

  test('POST /api/projects sin name devuelve 400', async ({ page }) => {
    const { status, body } = await fetchApi(page, '/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(status).toBe(400);
    expect(body.error).toContain('name');
  });

  test('POST /api/subtasks sin task_id devuelve 400', async ({ page }) => {
    const { status, body } = await fetchApi(page, '/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Comprar pan',
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain('task_id');
  });

  test('POST /api/subtasks con title vacío devuelve 400', async ({ page }) => {
    const { status, body } = await fetchApi(page, '/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: 1,
        title: '   ',
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain('title');
  });

  test('POST /api/subscribe sin userId devuelve 400', async ({ page }) => {
    const { status, body } = await fetchApi(page, '/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: { endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } },
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toContain('userId');
  });
});

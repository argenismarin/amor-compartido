// E2E tests para theme picker (M18) e i18n (M30).

import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mockApi.js';

test.describe('Theme + Language', () => {
  test('elegir tema oscuro setea data-theme="dark" en <html>', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    // Abrir Settings
    await page.getByRole('button', { name: /Configuracion/i }).click();

    // Click en boton Oscuro
    const darkBtn = page.getByRole('radio', { name: /Oscuro/i });
    await darkBtn.click();

    // <html> debe tener data-theme="dark"
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Persiste en localStorage
    const saved = await page.evaluate(() => localStorage.getItem('theme-preference'));
    expect(saved).toBe('dark');
  });

  test('cambiar idioma a English actualiza el lang attr', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    await page.getByRole('button', { name: /Configuracion/i }).click();
    await page.getByRole('radio', { name: /English/i }).click();

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');

    const saved = await page.evaluate(() => localStorage.getItem('lang-preference'));
    expect(saved).toBe('en');
  });
});

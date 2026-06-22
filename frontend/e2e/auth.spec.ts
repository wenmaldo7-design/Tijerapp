import { test, expect } from '@playwright/test';
import { FIXTURES } from './helpers';

test.describe('Auth', () => {
  test('un usuario nuevo puede registrarse y queda logueado como CLIENT', async ({ page }) => {
    const email = `nuevo.${Date.now()}@tijerapp.com`;

    await page.goto('/auth/register');
    await page.fill('#name', 'Usuario Nuevo');
    await page.fill('#email', email);
    await page.fill('#password', 'nuevo1234');
    await page.click('button[type=submit]');

    await page.waitForURL('**/dashboard');
    await expect(page.locator('.navbar__email')).toHaveText(email);
    await expect(page.locator('.navbar__user .badge--client')).toHaveText('CLIENT');
    // El nav de cliente no debe tener accesos de staff/admin
    await expect(page.locator('a[href="/staff"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
  });

  test('login con credenciales válidas entra al dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', FIXTURES.client.email);
    await page.fill('#password', FIXTURES.client.password);
    await page.click('button[type=submit]');

    await page.waitForURL('**/dashboard');
    await expect(page.locator('.dashboard__greeting')).toContainText('Cliente E2E');
  });

  test('login con contraseña incorrecta muestra error y no navega', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', FIXTURES.client.email);
    await page.fill('#password', 'contraseña-incorrecta');
    await page.click('button[type=submit]');

    await expect(page.locator('.alert--error')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

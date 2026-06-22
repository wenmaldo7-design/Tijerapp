import { test, expect } from '@playwright/test';
import { FIXTURES, login } from './helpers';

test.describe('Admin · Servicios', () => {
  test('crear, editar, desactivar y reactivar un servicio', async ({ page }) => {
    const name = `Servicio E2E ${Date.now()}`;

    await login(page, FIXTURES.admin.email, FIXTURES.admin.password);
    await page.click('a[href="/admin"]');
    await page.waitForURL('**/admin');
    // La pestaña "Servicios" es la que está activa por default.

    // Crear
    await page.click('button:has-text("Nuevo servicio")');
    await page.fill('#svcName', name);
    await page.fill('#svcDescription', 'Creado por test e2e');
    await page.fill('#svcDuration', '25');
    await page.fill('#svcPrice', '777');
    await page.click('.admin-panel__form-actions button:has-text("Guardar")');

    const row = page.locator('.admin-panel__row', { hasText: name });
    await expect(row).toBeVisible();
    await expect(row).toContainText('25 min');
    await expect(row).toContainText('$777');

    // Editar
    await row.locator('button:has-text("Editar")').click();
    await page.fill('#svcPrice', '888');
    await page.click('.admin-panel__form-actions button:has-text("Guardar")');
    await expect(row).toContainText('$888');
    await expect(row).not.toHaveClass(/admin-panel__row--inactive/);

    // Desactivar
    page.once('dialog', (d) => d.accept());
    await row.locator('button:has-text("Desactivar")').click();
    await expect(row).toHaveClass(/admin-panel__row--inactive/);
    await expect(row.locator('.badge--client')).toHaveText('Inactivo');

    // Reactivar
    page.once('dialog', (d) => d.accept());
    await row.locator('button:has-text("Reactivar")').click();
    await expect(row).not.toHaveClass(/admin-panel__row--inactive/);
  });
});

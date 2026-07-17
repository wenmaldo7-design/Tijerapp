import { test, expect } from '@playwright/test';
import { FIXTURES, login, logout, fillLoginForm } from './helpers';

test.describe('Admin · Peluqueros', () => {
  test('alta, email duplicado, edición, des/reactivación y login de la cuenta nueva', async ({ page }) => {
    const email = `lucia.${Date.now()}@tijerapp.com`;
    const password = 'lucia1234';

    await login(page, FIXTURES.admin.email, FIXTURES.admin.password);
    await page.click('a[href="/admin"]');
    await page.waitForURL('**/admin');
    await page.click('button:has-text("Peluqueros")');

    // Alta
    await page.click('button:has-text("Nuevo peluquero")');
    await page.fill('#stfName', 'Lucía Test');
    await page.fill('#stfEmail', email);
    await page.fill('#stfPassword', password);
    await page.fill('#stfPhone', '+54 11 5555-1234');
    await page.fill('#stfSpecialties', 'color, alisado');
    await page.fill('#stfBio', 'Colorista de prueba e2e');
    await page.click('.admin-panel__form-actions button:has-text("Guardar")');

    const row = page.locator('.admin-panel__row', { hasText: 'Lucía Test' });
    await expect(row).toBeVisible();
    await expect(row).toContainText(email);

    // Email duplicado -> 409 traducido
    await page.click('button:has-text("Nuevo peluquero")');
    await page.fill('#stfName', 'Otra Persona');
    await page.fill('#stfEmail', email);
    await page.fill('#stfPassword', 'otra12345');
    await page.click('.admin-panel__form-actions button:has-text("Guardar")');
    await expect(page.locator('.alert--error')).toHaveText(
      'Ya existe un usuario registrado con ese email.',
    );
    await page.click('.admin-panel__form-actions button:has-text("Cancelar")');

    // Editar (especialidades/bio)
    await row.locator('button:has-text("Editar")').click();
    await page.fill('#stfSpecialties', 'color, alisado, keratina');
    await page.click('.admin-panel__form-actions button:has-text("Guardar")');
    await expect(row).toContainText('keratina');

    // Desactivar -> el login de esa cuenta debe quedar bloqueado
    page.once('dialog', (d) => d.accept());
    await row.locator('button:has-text("Desactivar")').click();
    await expect(row).toHaveClass(/admin-panel__row--inactive/);

    await logout(page);
    await fillLoginForm(page, email, password);
    await page.click('button[type=submit]');
    await expect(page.locator('.alert--error')).toHaveText(
      'Tu cuenta está desactivada. Contactá al administrador.',
    );

    // Reactivar desde admin
    await login(page, FIXTURES.admin.email, FIXTURES.admin.password);
    await page.click('a[href="/admin"]');
    await page.waitForURL('**/admin');
    await page.click('button:has-text("Peluqueros")');
    page.once('dialog', (d) => d.accept());
    await row.locator('button:has-text("Reactivar")').click();
    await expect(row).not.toHaveClass(/admin-panel__row--inactive/);

    // La cuenta nueva ya puede loguear y ve su propio panel de staff
    await logout(page);
    await login(page, email, password);
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);

    await page.click('a[href="/staff"]');
    await page.waitForURL('**/staff');
    await expect(page.locator('.staff-panel__header')).toContainText('Lucía Test');
  });
});

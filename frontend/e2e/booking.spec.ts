import { test, expect } from '@playwright/test';
import { FIXTURES, login, dateOffset } from './helpers';

test.describe('Reserva de turno (cliente)', () => {
  test('un cliente reserva un turno y lo ve en Mis Turnos', async ({ page }) => {
    await login(page, FIXTURES.client.email, FIXTURES.client.password);

    await page.click('a[href="/book"]');
    await page.waitForURL('**/book');

    // Paso 1: servicio
    await expect(page.locator('.book__option-card').first()).toBeVisible();
    const serviceName = await page.locator('.book__option-name').first().innerText();
    await page.locator('.book__option-card').first().click();

    // Paso 2: peluquero (un solo fixture: "Staff E2E")
    await page.waitForSelector('.book__option-card');
    const staffName = await page.locator('.book__option-name').first().innerText();
    await page.locator('.book__option-card').first().click();

    // Paso 3: fecha — mañana, para no depender de la hora en que corre la suite
    const tomorrow = dateOffset(1);
    await page.fill('#appt-date', tomorrow);

    // Paso 4: horario — el primero disponible
    await page.waitForSelector('.book__slot', { timeout: 15_000 });
    await page.locator('.book__slot').first().click();

    // Paso 5: confirmar
    await expect(page.locator('.book__summary')).toContainText(serviceName);
    await expect(page.locator('.book__summary')).toContainText(staffName);
    await page.click('button:has-text("Confirmar reserva")');

    await page.waitForURL('**/appointments');
    const card = page.locator('.my-appts__card').first();
    await expect(card).toContainText(serviceName);
    await expect(card).toContainText(staffName);
    await expect(card.locator('.badge--pending')).toHaveText('Pendiente');
  });
});

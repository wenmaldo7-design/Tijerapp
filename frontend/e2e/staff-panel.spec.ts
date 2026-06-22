import { test, expect } from '@playwright/test';
import { API_URL, FIXTURES, apiLogin, login, dateOffset } from './helpers';

test.describe('Panel de staff', () => {
  test('el staff confirma y completa un turno desde su agenda', async ({ page, request }) => {
    // Arrange: el cliente reserva un turno vía API (no es lo que se está probando acá).
    const clientToken = await apiLogin(request, FIXTURES.client.email, FIXTURES.client.password);
    const authHeaders = { Authorization: `Bearer ${clientToken}` };

    const [servicesRes, staffRes] = await Promise.all([
      request.get(`${API_URL}/services`),
      request.get(`${API_URL}/staff`, { headers: authHeaders }),
    ]);
    const [service] = await servicesRes.json();
    const [staff] = await staffRes.json();

    const date = dateOffset(1);
    const slotsRes = await request.get(
      `${API_URL}/appointments/slots?staffProfileId=${staff.id}&serviceId=${service.id}&date=${date}`,
      { headers: authHeaders },
    );
    const [slot] = await slotsRes.json();
    expect(slot, 'debería haber al menos un horario libre para mañana').toBeTruthy();

    // Nota única para poder ubicar esta tarjeta sin ambigüedad — puede haber otros
    // turnos del mismo servicio creados por otros specs de la suite.
    const marker = `e2e-staff-panel-${Date.now()}`;
    const createRes = await request.post(`${API_URL}/appointments`, {
      headers: authHeaders,
      data: {
        staffProfileId: staff.id,
        serviceId: service.id,
        startTime: slot.startTime,
        notes: marker,
      },
    });
    expect(createRes.ok()).toBeTruthy();

    // Act + Assert: el staff ve el turno PENDING y lo va llevando a través de su ciclo de vida.
    await login(page, FIXTURES.staff.email, FIXTURES.staff.password);
    await page.click('a[href="/staff"]');
    await page.waitForURL('**/staff');

    const card = page.locator('.staff-panel__appt-card', { hasText: marker });
    await expect(card).toBeVisible();
    await expect(card.locator('.badge--pending')).toBeVisible();

    await card.locator('button:has-text("Confirmar")').click();
    await expect(card.locator('.badge--confirmed')).toBeVisible();

    await card.locator('button:has-text("Completar")').click();
    await expect(card.locator('.badge--completed')).toBeVisible();
  });
});

import { APIRequestContext, Page, expect } from '@playwright/test';

export const API_URL = 'http://localhost:3002';

// Credenciales fijas creadas por backend/src/e2e-seed.ts (corrido en global-setup).
export const FIXTURES = {
  admin: { email: 'admin@tijerapp.com', password: 'admin123' },
  staff: { email: 'staff@tijerapp.com', password: 'staff123' },
  client: { email: 'client@tijerapp.com', password: 'client123' },
};

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
}

export async function logout(page: Page): Promise<void> {
  await page.click('button:has-text("Salir")');
  await page.waitForURL('**/auth/login');
}

/**
 * Tipea email/password en el form de login reintentando la carga completa.
 * Tras un logout client-side, /auth/login se monta vía loadComponent (lazy);
 * waitForURL resuelve apenas cambia la URL, antes de que el FormGroup del
 * componente termine de bindearse — un fill() inmediato puede perderse.
 */
export async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  await expect(async () => {
    await page.fill('#email', email);
    await page.fill('#password', password);
    expect(await page.inputValue('#email')).toBe(email);
    expect(await page.inputValue('#password')).toBe(password);
  }).toPass({ timeout: 5_000 });
}

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

/** YYYY-MM-DD de "hoy + days", en hora local (igual criterio que usa el front). */
export function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Usado solo por la suite de Playwright (ver playwright.config.ts). Apunta al
// backend de test (.env.test del backend, puerto 3002 / DB tijerapp_test).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3002',
};

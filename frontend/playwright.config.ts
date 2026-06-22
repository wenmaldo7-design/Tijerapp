import { defineConfig, devices } from '@playwright/test';

// Suite E2E contra el backend y la DB de test reales (no contra mocks).
// Levanta ambos servers automáticamente; ver e2e/global-setup.ts para los
// fixtures (admin/staff/cliente fijos, ver backend/src/e2e-seed.ts).
export default defineConfig({
  testDir: './e2e',
  // Los tests comparten fixtures fijos contra una DB real — correrlos en
  // paralelo generaría carreras (ej. dos tests desactivando el mismo perfil).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:4203',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start:test',
      cwd: '../backend',
      url: 'http://localhost:3002/services',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npx ng serve --configuration=e2e --port 4203 --allowed-hosts true',
      url: 'http://localhost:4203',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});

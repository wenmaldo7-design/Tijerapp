import { execSync } from 'child_process';

const BACKEND_URL = 'http://localhost:3002/services';

async function waitForBackend(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // todavía no levantó — reintentar
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El backend de test no respondió en ${url} tras ${timeoutMs}ms`);
}

// Corre antes de toda la suite: espera a que el backend de test esté arriba
// y resetea la DB a un estado conocido (ver backend/src/e2e-seed.ts).
export default async function globalSetup(): Promise<void> {
  await waitForBackend(BACKEND_URL);
  execSync('npm run seed:e2e', { cwd: '../backend', stdio: 'inherit' });
}

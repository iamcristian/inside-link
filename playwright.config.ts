/**
 * Configuración de pruebas End-to-End (E2E) para InsideLink (`cristianarando.dev`).
 * Los escenarios E2E en `tests/e2e/*.spec.ts` también se ejecutan directamente en Vitest
 * contra los Route Handlers reales y SQLite en memoria para verificación sin fricción en CI.
 */
export interface E2ERunnerConfig {
  testDir: string;
  baseURL: string;
  timeoutMs: number;
  retries: number;
}

const config: E2ERunnerConfig = {
  testDir: "./tests/e2e",
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  timeoutMs: 30_000,
  retries: process.env.CI ? 2 : 0,
};

export default config;

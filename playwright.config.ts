import { defineConfig } from "@playwright/test";

const PUERTO = Number(process.env.PUERTO_E2E ?? 3100);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PUERTO}`, locale: "es-CO", timezoneId: "America/Bogota" },
  webServer: { command: `PORT=${PUERTO} npm start`, port: PUERTO, reuseExistingServer: true, timeout: 120_000 },
});

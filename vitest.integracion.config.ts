import { defineConfig } from "vitest/config";
import path from "node:path";

const URL_PRUEBAS = process.env.DATABASE_URL_TEST ?? "postgresql://costeo:costeo@localhost:5433/costeo_test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.integracion.test.ts"],
    globalSetup: ["src/lib/servicios/__tests__/preparar-bd.ts"],
    env: { DATABASE_URL: URL_PRUEBAS, DIRECT_URL: URL_PRUEBAS },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});

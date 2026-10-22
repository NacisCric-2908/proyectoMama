import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integracion.test.ts", "node_modules"],
    coverage: {
      provider: "v8",
      include: ["src/lib/costeo/**"],
      exclude: ["src/lib/costeo/__tests__/**", "src/lib/costeo/index.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});

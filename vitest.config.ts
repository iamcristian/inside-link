import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

if (fs.existsSync(".env")) {
  process.loadEnvFile?.(".env");
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/e2e/**/*.spec.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

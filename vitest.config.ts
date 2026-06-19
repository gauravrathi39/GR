import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    env: { NODE_ENV: "test" },
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});

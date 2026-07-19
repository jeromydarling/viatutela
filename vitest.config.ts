import { defineConfig } from "vitest/config";

// Standalone vitest config: keeps the Cloudflare vite plugin (from
// vite.config.ts) out of the test runner — these are pure-function tests.
export default defineConfig({
  test: {
    include: ["workers/lib/__tests__/**/*.test.ts"],
  },
});

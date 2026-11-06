import { defineConfig } from "vitest/config";
import { NO_RETRY_SETUP, TIMEOUTS } from "../../vitest.shared.mts";

// Unit tests for the main process's pure helpers. `main.ts` itself needs the
// Electron runtime and is verified by running the app (see README.md).
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    setupFiles: [NO_RETRY_SETUP],
    ...TIMEOUTS,
  },
});

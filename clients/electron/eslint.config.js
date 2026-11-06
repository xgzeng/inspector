import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// The Electron main process is plain Node TypeScript (no React/browser code —
// the renderer is the web client's own build), so this mirrors
// clients/launcher's flat config.
export default defineConfig([
  globalIgnores(["build", "coverage", ".stage", "release"]),
  {
    files: ["**/*.{ts,mts}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    // Type-aware pass for `no-floating-promises` (#1959); both tsconfig
    // projects are listed because `src` and `__tests__` live in different ones.
    files: ["**/*.{ts,mts}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);

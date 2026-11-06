#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runWeb } from "../server/run-web.js";

export { runWeb };
// In-process, exit-free entry for a GUI host (clients/electron).
export { startEmbeddedWeb } from "../server/start-embedded-web.js";
export type {
  EmbeddedWebHandle,
  EmbeddedWebOptions,
} from "../server/start-embedded-web.js";

const __filename = fileURLToPath(import.meta.url);
const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(__filename);

if (isMain) {
  runWeb(process.argv)
    .then((code) => process.exit(code ?? 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

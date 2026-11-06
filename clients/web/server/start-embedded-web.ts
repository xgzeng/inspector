/**
 * Programmatic, exit-free entry to the production web stack for an in-process
 * host — today the Electron desktop client (`clients/electron`).
 *
 * `runWeb` is the launcher's entry and behaves like a CLI: it parses argv,
 * calls `process.exit` on any bad input or failed start, opens the system
 * browser, and installs SIGINT/SIGTERM handlers. None of that is acceptable
 * inside a GUI host, which owns its own process lifecycle and window. This
 * entry runs the same pieces (`buildWebServerConfig` → `ensureWebBuild` →
 * `startHonoServer`) with the default writable catalog, and hands back the
 * URL to load plus a `close()` the host calls on quit.
 *
 * The port is the caller's to choose: `buildWebServerConfig` refuses a dynamic
 * `CLIENT_PORT` because the origin allow-list and the sandbox CSP are derived
 * from it, so the host picks a free port first. That leaves the small
 * probe-then-bind window #2602 describes; a host that loses it gets the
 * server's EADDRINUSE exit, the same as the CLI.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWebServerConfig } from "./web-server-config.js";
import { ensureWebBuild } from "./ensure-web-build.js";
import { startHonoServer } from "./server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface EmbeddedWebOptions {
  /** UI listener port (1–65535). The host picks a free one. */
  port: number;
  /**
   * Directory holding the built SPA. Defaults to `clients/web/dist`, located
   * relative to this module the same way `runWeb` does (the bundled
   * `build/index.js` and the `server/` source both sit one level below it).
   */
  staticRoot?: string;
  /** Seam for tests: replaces the on-demand `dist/` build check. */
  ensureBuild?: (webRoot: string, distRoot: string) => void;
}

export interface EmbeddedWebHandle {
  /** The banner URL — load this in the host's window. */
  url: string;
  /** Stops the API (and the stdio servers it spawned), sandbox, app origin and UI listeners. */
  close(): Promise<void>;
}

export async function startEmbeddedWeb(
  options: EmbeddedWebOptions,
): Promise<EmbeddedWebHandle> {
  // buildWebServerConfig reads its inputs from env and derives the origin
  // allow-list from the port, so these must be in place BEFORE the build —
  // patching `config.port` afterwards would leave a stale allow-list.
  process.env.CLIENT_PORT = String(options.port);
  // Dynamic sandbox / app-origin ports, unless the user pinned them, so the
  // desktop app can run beside a CLI-launched inspector on the defaults.
  process.env.MCP_SANDBOX_PORT ??= "0";
  process.env.MCP_APP_ORIGIN_PORT ??= "0";
  // The host shows the UI in its own window; never launch a browser.
  process.env.MCP_AUTO_OPEN_ENABLED = "false";

  const config = buildWebServerConfig();
  const webRoot = join(__dirname, "..");
  const distRoot = options.staticRoot ?? join(webRoot, "dist");
  config.staticRoot = distRoot;
  (options.ensureBuild ?? ensureWebBuild)(webRoot, distRoot);

  let resolveUrl!: (url: string) => void;
  const listening = new Promise<string>((resolve) => {
    resolveUrl = resolve;
  });
  const handle = await startHonoServer(config, { onListening: resolveUrl });
  const url = await listening;
  return { url, close: () => handle.close() };
}

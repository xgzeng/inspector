/**
 * Electron main process for the MCP Inspector desktop app.
 *
 * The desktop app is a thin shell over the production web stack: it starts
 * `startEmbeddedWeb` (clients/web) in THIS process — UI + API on a free
 * loopback port, sandbox proxy and app-origin listeners on dynamic ports — and
 * loads the advertised URL in a locked-down `BrowserWindow`. There is no IPC
 * and no preload: the renderer is exactly the web UI, authenticating with the
 * token the server injects into `index.html`, so everything the browser build
 * does (and every security property it has) carries over unchanged.
 *
 * The web runner is loaded with a runtime `import()` of
 * `../../web/build/index.js` rather than bundled: that relative layout is the
 * same in a dev checkout and in the packaged app (which is the npm tarball plus
 * this build, see scripts/stage-app.mjs), and it keeps the root-owned runtime
 * dependencies resolving from the root manifest as the dependency-placement
 * rules require.
 */

import { app, BrowserWindow, Menu, dialog, shell } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findFreePort } from "./free-port.js";
import { fixPathFromLoginShell } from "./shell-path.js";
import { buildMenuTemplate } from "./menu.js";

interface EmbeddedWebHandle {
  url: string;
  close(): Promise<void>;
}
interface WebModule {
  startEmbeddedWeb(options: { port: number }): Promise<EmbeddedWebHandle>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ENTRY = join(__dirname, "..", "..", "web", "build", "index.js");
const APP_NAME = "MCP Inspector";

/**
 * The Inspector version from the root manifest — three levels up in both a
 * checkout and the packaged app. `app.getVersion()` is wrong in dev: this
 * client's own manifest carries no version, so Electron reports its own.
 */
function inspectorVersion(): string {
  try {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "..", "package.json"), "utf8"),
    ) as { version?: string };
    return manifest.version ?? app.getVersion();
  } catch {
    return app.getVersion();
  }
}

let server: EmbeddedWebHandle | undefined;
let mainWindow: BrowserWindow | undefined;

function createWindow(url: string): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = undefined;
  });
  mainWindow = win;
  void win.loadURL(url);
}

async function startServer(): Promise<EmbeddedWebHandle> {
  if (!existsSync(WEB_ENTRY)) {
    throw new Error(
      `The web client is not built (missing ${WEB_ENTRY}).\nRun \`npm run build\` at the repository root, then start the app again.`,
    );
  }
  const web = (await import(pathToFileURL(WEB_ENTRY).href)) as WebModule;
  const port = await findFreePort("127.0.0.1");
  return web.startEmbeddedWeb({ port });
}

async function main(): Promise<void> {
  app.setName(APP_NAME);
  // Must precede any spawn: stdio MCP servers inherit this PATH.
  await fixPathFromLoginShell();
  await app.whenReady();

  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: inspectorVersion(),
    website: "https://github.com/modelcontextprotocol/inspector",
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate({
        appName: APP_NAME,
        isMac: process.platform === "darwin",
        openExternal: (url) => void shell.openExternal(url),
      }),
    ),
  );

  server = await startServer();
  console.log(`[electron] Server running at: ${server.url}`);
  createWindow(server.url);

  // macOS convention: the app (and its server) outlive the last window; the
  // Dock icon reopens one.
  app.on("activate", () => {
    if (!mainWindow && server) createWindow(server.url);
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Close the server (and the stdio servers it spawned) before exiting. The
// first `before-quit` is deferred until shutdown finishes; `app.exit` then
// leaves without re-entering this handler.
let quitting = false;
app.on("before-quit", (event) => {
  if (quitting || !server) return;
  quitting = true;
  event.preventDefault();
  const closing = server;
  server = undefined;
  closing
    .close()
    .catch((err: unknown) => console.error("Error during shutdown:", err))
    .finally(() => app.exit(0));
});

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(err);
  dialog.showErrorBox(`${APP_NAME} failed to start`, message);
  app.exit(1);
});

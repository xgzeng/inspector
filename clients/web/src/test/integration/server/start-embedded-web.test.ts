/**
 * `startEmbeddedWeb` — the exit-free entry the Electron client runs the prod
 * web stack through. Pins what an in-process host relies on:
 *
 *  - it resolves with the banner URL only once the UI listener is bound (via
 *    `startHonoServer`'s `onListening`), on the port the host chose;
 *  - the port reaches the env BEFORE the config is built, so the origin
 *    allow-list matches the advertised origin (an `/api` call from it is
 *    accepted rather than refused as cross-origin);
 *  - sandbox and app-origin listeners come up on dynamic ports, never opening
 *    a browser;
 *  - `close()` takes every listener down.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const openMock = vi.hoisted(() => vi.fn());
vi.mock("open", () => ({ default: openMock }));

const { startEmbeddedWeb } =
  await import("../../../../server/start-embedded-web.js");
type Handle = Awaited<ReturnType<typeof startEmbeddedWeb>>;

const ENV_KEYS = [
  "CLIENT_PORT",
  "MCP_SANDBOX_PORT",
  "MCP_APP_ORIGIN_PORT",
  "MCP_AUTO_OPEN_ENABLED",
  "MCP_STORAGE_DIR",
] as const;

const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
let handle: Handle | undefined;
let tmp: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (tmp) await rm(tmp, { recursive: true, force: true });
  tmp = undefined;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  openMock.mockReset();
  vi.restoreAllMocks();
});

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

describe("startEmbeddedWeb", () => {
  it("serves on the chosen port and resolves with the banner URL", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    tmp = await mkdtemp(join(tmpdir(), "inspector-embedded-"));
    const staticRoot = join(tmp, "dist");
    await mkdir(staticRoot);
    await writeFile(
      join(staticRoot, "index.html"),
      "<!doctype html><html><head></head><body><div id=root></div></body></html>",
      "utf-8",
    );
    process.env.MCP_STORAGE_DIR = join(tmp, "storage");
    delete process.env.MCP_SANDBOX_PORT;
    delete process.env.MCP_APP_ORIGIN_PORT;
    const ensureBuild = vi.fn();
    const port = await freePort();

    handle = await startEmbeddedWeb({ port, staticRoot, ensureBuild });

    expect(ensureBuild).toHaveBeenCalledWith(expect.any(String), staticRoot);
    const url = new URL(handle.url);
    expect(url.hostname).toBe("127.0.0.1");
    expect(Number(url.port)).toBe(port);
    expect(process.env.MCP_SANDBOX_PORT).toBe("0");
    expect(process.env.MCP_APP_ORIGIN_PORT).toBe("0");
    expect(openMock).not.toHaveBeenCalled();

    // The page is up and carries the injected token.
    const page = await fetch(`${url.origin}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    const token = url.searchParams.get("MCP_INSPECTOR_API_TOKEN");
    expect(token).toBeTruthy();
    expect(html).toContain(token!);

    // The allow-list was derived from the chosen port: a same-origin API
    // call is accepted, not refused as cross-origin.
    const config = await fetch(`${url.origin}/api/config`, {
      headers: { origin: url.origin, "x-mcp-remote-auth": `Bearer ${token}` },
    });
    expect(config.status).toBe(200);

    await handle.close();
    handle = undefined;
    await expect(fetch(`${url.origin}/`)).rejects.toThrow();
  });

  it("keeps user-pinned sandbox / app-origin ports", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    tmp = await mkdtemp(join(tmpdir(), "inspector-embedded-"));
    await writeFile(join(tmp, "index.html"), "<html></html>", "utf-8");
    process.env.MCP_STORAGE_DIR = join(tmp, "storage");
    const sandboxPort = await freePort();
    process.env.MCP_SANDBOX_PORT = String(sandboxPort);
    process.env.MCP_APP_ORIGIN_PORT = "0";

    handle = await startEmbeddedWeb({
      port: await freePort(),
      staticRoot: tmp,
      ensureBuild: () => {},
    });

    expect(process.env.MCP_SANDBOX_PORT).toBe(String(sandboxPort));
    const res = await fetch(`http://127.0.0.1:${sandboxPort}/sandbox`);
    expect(res.status).toBe(200);
  });
});

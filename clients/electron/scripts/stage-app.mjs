#!/usr/bin/env node
/**
 * Assemble the directory electron-builder packages (`.stage/app`).
 *
 * The packaged app is deliberately the published npm tarball plus this
 * client's `build/`, so the desktop app runs the exact file layout `npx
 * @modelcontextprotocol/inspector` users run — `clients/web/build`, `dist/`,
 * `static/sandbox_proxy.html`, and the root `package.json` the version reader
 * walks up to — instead of a second, hand-maintained layout that could drift.
 *
 * Steps:
 *  1. `npm pack` at the repo root (its `prepack` runs the full build).
 *  2. Extract the tarball into `.stage/app`.
 *  3. Copy the root `package-lock.json` in and `npm ci --omit=dev
 *     --ignore-scripts`, so runtime dependencies are the LOCKED versions (not a
 *     fresh range resolution) and the root `postinstall` client cascade is
 *     skipped. `@napi-rs/keyring` ships prebuilt optional platform packages,
 *     so no install script is needed.
 *  4. Copy `clients/electron/build` into the stage and point the staged
 *     manifest's `main` at it; drop `bin`/`scripts`/`files`, which only mean
 *     something to npm.
 */

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(clientDir, "..", "..");
const stageRoot = join(clientDir, ".stage");
const appDir = join(stageRoot, "app");

function run(cmd, args, cwd) {
  console.log(`[stage-app] ${cmd} ${args.join(" ")}  (in ${cwd})`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
  }
  return result.stdout;
}

if (!existsSync(join(clientDir, "build", "main.js"))) {
  throw new Error(
    "clients/electron/build/main.js is missing — run `npm run build` first.",
  );
}

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });

// 1. Pack (prepack = `npm run build` at the root).
const packOut = run(
  "npm",
  ["pack", "--json", "--pack-destination", stageRoot],
  repoRoot,
);
const [{ filename }] = JSON.parse(packOut.slice(packOut.indexOf("[")));
const tarball = join(stageRoot, filename);

// 2. Extract (npm tarballs root everything under `package/`).
run("tar", ["-xzf", tarball, "-C", appDir, "--strip-components=1"], stageRoot);
rmSync(tarball);

// 3. Locked runtime dependencies only.
cpSync(join(repoRoot, "package-lock.json"), join(appDir, "package-lock.json"));
run(
  "npm",
  ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
  appDir,
);

// 4. The Electron main process + manifest patch.
cpSync(join(clientDir, "build"), join(appDir, "clients", "electron", "build"), {
  recursive: true,
});
const manifestPath = join(appDir, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.main = "clients/electron/build/main.js";
manifest.productName = "MCP Inspector";
delete manifest.bin;
delete manifest.scripts;
delete manifest.files;
delete manifest.devDependencies;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[stage-app] staged ${appDir}`);

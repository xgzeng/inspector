# MCP Inspector — Desktop (Electron)

A native desktop wrapper around the Inspector's web UI. The Electron main
process runs the **production web stack in-process** (`startEmbeddedWeb` from
`clients/web`) — UI + API on a free loopback port, the MCP Apps sandbox proxy
and app-origin listeners on dynamic ports — and shows it in a locked-down
`BrowserWindow` (`contextIsolation`, `sandbox`, no `nodeIntegration`, no
preload). There is no IPC: the renderer is exactly the browser build.

## Run in development

```sh
npm install              # repo root — the install cascade covers this client
npm run electron:dev     # builds the web client, then this one, then launches
```

The first launch downloads the Electron binary (~100 MB, cached afterwards).
`npm run dev` inside this directory skips the web build and expects
`clients/web/build` to exist.

## Package an installer (macOS, unsigned)

```sh
npm run electron:dist    # repo root
# → clients/electron/release/MCP Inspector-<version>-<arch>.dmg
```

`scripts/stage-app.mjs` assembles `.stage/app` from the root `npm pack` tarball
(so the app runs the published layout), installs the locked runtime
dependencies, and adds this client's `build/`; `electron-builder.config.cjs`
packages it. The app is unsigned: open it the first time with right-click →
**Open**. Set `identity`/`CSC_LINK` in the config to sign.

## Things to know

- **Shared state with the CLI/browser Inspector.** The desktop app uses the
  same default catalog and secret store, so servers you add in one appear in
  the other.
- **PATH.** An app launched from Finder gets launchd's minimal `PATH`, so the
  main process reads your login shell's `PATH` at startup (3 s timeout,
  fail-soft) before any stdio server is spawned. If `npx`/`uvx` servers still
  fail to start, check that your shell profile exports `PATH` in an
  interactive login shell.
- **Ports.** Only the UI port is chosen at startup (free loopback port); the
  sandbox and app-origin ports are dynamic unless `MCP_SANDBOX_PORT` /
  `MCP_APP_ORIGIN_PORT` are set, so the desktop app runs side by side with
  `mcp-inspector --web`.
- **macOS lifecycle.** Closing the last window keeps the app (and its server)
  running; the Dock icon reopens a window. Quitting stops the server and every
  stdio server it spawned.

## Layout

| Path                         | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `src/main.ts`                | App lifecycle, server start, window, quit/shutdown       |
| `src/menu.ts`                | Native menu template (pure, unit-tested)                 |
| `src/shell-path.ts`          | Login-shell `PATH` recovery (pure helpers, unit-tested)  |
| `src/free-port.ts`           | Free loopback port probe                                 |
| `scripts/stage-app.mjs`      | Builds the staged app directory for packaging            |
| `electron-builder.config.cjs`| Packaging config (unsigned dmg)                          |

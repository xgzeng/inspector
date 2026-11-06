/**
 * electron-builder configuration for the MCP Inspector desktop app.
 *
 * Packages the staged directory `scripts/stage-app.mjs` produces (the npm
 * tarball + locked runtime deps + this client's build) rather than this
 * client's own folder, so the shipped layout is the published one. Unsigned
 * macOS dmg by default (`identity: null`); set `CSC_LINK`/`identity` to sign.
 */

const electronVersion = require("./node_modules/electron/package.json").version;

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: "io.modelcontextprotocol.inspector",
  productName: "MCP Inspector",
  // The staged manifest carries no `electron` dependency to infer this from.
  electronVersion,
  directories: {
    app: ".stage/app",
    output: "release",
  },
  // The desktop app is the web UI only; the CLI/TUI/mcpdo bundles ship in the
  // tarball but are never loaded here.
  files: [
    "**/*",
    "!clients/cli/build/**",
    "!clients/tui/build/**",
    "!clients/mcpdo/build/**",
    "!skills/**",
  ],
  asar: true,
  // Native addons cannot load from inside an asar; the SPA and the sandbox
  // proxy page are served straight from disk by the Hono static handler.
  asarUnpack: ["**/*.node", "clients/web/dist/**", "clients/web/static/**"],
  // The prebuilt `@napi-rs/keyring` binary is N-API, so no rebuild against
  // Electron's headers is needed.
  npmRebuild: false,
  mac: {
    target: ["dmg"],
    category: "public.app-category.developer-tools",
    identity: null,
  },
};

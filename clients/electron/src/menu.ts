/**
 * The native application menu, as a pure template builder.
 *
 * Kept free of any `electron` runtime import (types only) so it can be unit
 * tested under plain Node; `main.ts` passes the result to
 * `Menu.buildFromTemplate`. The Edit menu is not decoration: on macOS,
 * copy/paste/undo shortcuts inside web inputs only work when an Edit menu
 * with those roles exists.
 */

import type { MenuItemConstructorOptions } from "electron";

export const DOCS_URL =
  "https://github.com/modelcontextprotocol/inspector#readme";
export const ISSUES_URL =
  "https://github.com/modelcontextprotocol/inspector/issues";

export interface MenuOptions {
  appName: string;
  isMac: boolean;
  /** Opens a URL in the system browser (`shell.openExternal`). */
  openExternal: (url: string) => void;
}

export function buildMenuTemplate(
  options: MenuOptions,
): MenuItemConstructorOptions[] {
  const { appName, isMac, openExternal } = options;
  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: appName,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push(
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: isMac
        ? [
            { role: "minimize" },
            { role: "zoom" },
            { type: "separator" },
            { role: "front" },
          ]
        : [{ role: "minimize" }, { role: "close" }],
    },
    {
      role: "help",
      submenu: [
        { label: "Documentation", click: () => openExternal(DOCS_URL) },
        { label: "Report an Issue", click: () => openExternal(ISSUES_URL) },
        ...(isMac
          ? []
          : [
              { type: "separator" } as MenuItemConstructorOptions,
              { role: "about" } as MenuItemConstructorOptions,
            ]),
      ],
    },
  );

  return template;
}

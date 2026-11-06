import { describe, it, expect, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";
import { buildMenuTemplate, DOCS_URL, ISSUES_URL } from "../src/menu.js";

function labels(template: MenuItemConstructorOptions[]): string[] {
  return template.map((item) => item.label ?? item.role ?? "");
}

function roles(item: MenuItemConstructorOptions | undefined): string[] {
  const submenu = (item?.submenu ?? []) as MenuItemConstructorOptions[];
  return submenu.map((i) => i.role ?? i.label ?? i.type ?? "");
}

describe("buildMenuTemplate", () => {
  it("adds the app menu first on macOS", () => {
    const t = buildMenuTemplate({
      appName: "MCP Inspector",
      isMac: true,
      openExternal: () => {},
    });
    expect(labels(t)).toEqual([
      "MCP Inspector",
      "File",
      "Edit",
      "View",
      "Window",
      "help",
    ]);
    expect(roles(t[0])).toContain("about");
    expect(roles(t[0])).toContain("quit");
  });

  it("omits the app menu elsewhere and puts About under Help", () => {
    const t = buildMenuTemplate({
      appName: "MCP Inspector",
      isMac: false,
      openExternal: () => {},
    });
    expect(labels(t)).toEqual(["File", "Edit", "View", "Window", "help"]);
    expect(roles(t[0])).toEqual(["quit"]);
    expect(roles(t[4])).toContain("about");
  });

  it("includes edit roles and the dev tools / reload items", () => {
    const t = buildMenuTemplate({
      appName: "X",
      isMac: true,
      openExternal: () => {},
    });
    const edit = t.find((i) => i.label === "Edit");
    const view = t.find((i) => i.label === "View");
    expect(roles(edit)).toEqual(
      expect.arrayContaining(["copy", "paste", "undo", "selectAll"]),
    );
    expect(roles(view)).toEqual(
      expect.arrayContaining(["reload", "forceReload", "toggleDevTools"]),
    );
  });

  it("opens the docs and issue links externally", () => {
    const openExternal = vi.fn();
    const t = buildMenuTemplate({ appName: "X", isMac: true, openExternal });
    const help = t.find((i) => i.role === "help");
    const items = help?.submenu as MenuItemConstructorOptions[];
    for (const item of items) {
      (item.click as (() => void) | undefined)?.();
    }
    expect(openExternal).toHaveBeenCalledWith(DOCS_URL);
    expect(openExternal).toHaveBeenCalledWith(ISSUES_URL);
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  fixPathFromLoginShell,
  mergePath,
  parseShellPath,
} from "../src/shell-path.js";

const wrap = (p: string) =>
  `__MCP_INSPECTOR_PATH_START__${p}__MCP_INSPECTOR_PATH_END__`;

describe("parseShellPath", () => {
  it("extracts the PATH between markers, ignoring profile noise", () => {
    expect(parseShellPath(`Welcome!\nnvm ready\n${wrap("/a:/b")}`)).toBe(
      "/a:/b",
    );
  });

  it("returns undefined when markers are missing or the value is empty", () => {
    expect(parseShellPath("no markers")).toBeUndefined();
    expect(parseShellPath("__MCP_INSPECTOR_PATH_START__/a")).toBeUndefined();
    expect(parseShellPath(wrap("  "))).toBeUndefined();
  });
});

describe("mergePath", () => {
  it("puts shell entries first and drops duplicates and empties", () => {
    expect(mergePath("/opt/homebrew/bin:/usr/bin", "/usr/bin::/bin")).toBe(
      "/opt/homebrew/bin:/usr/bin:/bin",
    );
  });

  it("handles missing inputs", () => {
    expect(mergePath(undefined, "/usr/bin")).toBe("/usr/bin");
    expect(mergePath(undefined, undefined)).toBe("");
  });
});

describe("fixPathFromLoginShell", () => {
  it("merges the login-shell PATH into env", async () => {
    const env: NodeJS.ProcessEnv = { PATH: "/usr/bin:/bin", SHELL: "/bin/zsh" };
    const run = vi.fn(async () => wrap("/opt/homebrew/bin:/usr/bin"));
    await expect(
      fixPathFromLoginShell({ platform: "darwin", env, run }),
    ).resolves.toBe(true);
    expect(env.PATH).toBe("/opt/homebrew/bin:/usr/bin:/bin");
    expect(run).toHaveBeenCalledWith(
      "/bin/zsh",
      ["-ilc", expect.stringContaining("$PATH")],
      3000,
    );
  });

  it("is a no-op on Windows", async () => {
    const run = vi.fn();
    await expect(
      fixPathFromLoginShell({ platform: "win32", env: {}, run }),
    ).resolves.toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("never throws when the shell fails or prints nothing usable", async () => {
    const env: NodeJS.ProcessEnv = { PATH: "/usr/bin" };
    await expect(
      fixPathFromLoginShell({
        platform: "linux",
        env,
        run: async () => {
          throw new Error("timeout");
        },
      }),
    ).resolves.toBe(false);
    await expect(
      fixPathFromLoginShell({ platform: "linux", env, run: async () => "" }),
    ).resolves.toBe(false);
    expect(env.PATH).toBe("/usr/bin");
  });

  it("reports no change when PATH is already complete", async () => {
    const env: NodeJS.ProcessEnv = { PATH: "/usr/bin" };
    await expect(
      fixPathFromLoginShell({
        platform: "darwin",
        env,
        run: async () => wrap("/usr/bin"),
      }),
    ).resolves.toBe(false);
  });
});

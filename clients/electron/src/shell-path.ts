/**
 * Recover the user's login-shell `PATH` for a GUI-launched app.
 *
 * A macOS app started from Finder/Dock inherits launchd's minimal environment
 * (`PATH=/usr/bin:/bin:/usr/sbin:/sbin`), not the one a terminal session
 * builds from the shell's profile. Every stdio MCP server the Inspector spawns
 * — `npx`, `uvx`, `node`, `docker`, a Homebrew binary — would then fail with
 * ENOENT even though it works from `mcp-inspector` in a terminal. So at startup
 * the shell asks the user's login shell for its `PATH` and merges it in front of
 * the inherited one.
 *
 * Bounded by a timeout and fail-soft: a slow or broken profile must delay
 * startup by at most a few seconds and never prevent it. Skipped on Windows,
 * where GUI apps already receive the user's full environment.
 */

import { execFile } from "node:child_process";

/** Markers so profile noise printed on stdout (motd, nvm banners) is ignored. */
const START = "__MCP_INSPECTOR_PATH_START__";
const END = "__MCP_INSPECTOR_PATH_END__";

/** Extract the PATH printed between the markers, or undefined if absent/empty. */
export function parseShellPath(stdout: string): string | undefined {
  const start = stdout.lastIndexOf(START);
  if (start === -1) return undefined;
  const end = stdout.indexOf(END, start + START.length);
  if (end === -1) return undefined;
  const value = stdout.slice(start + START.length, end).trim();
  return value || undefined;
}

/**
 * Merge two PATH strings: the login-shell entries first (they are what the
 * user's terminal resolves against), then any inherited entries not already
 * present. Empty segments and duplicates are dropped; order is otherwise kept.
 */
export function mergePath(
  shellPath: string | undefined,
  currentPath: string | undefined,
  delimiter = ":",
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of [shellPath, currentPath]) {
    for (const entry of (source ?? "").split(delimiter)) {
      if (entry && !seen.has(entry)) {
        seen.add(entry);
        out.push(entry);
      }
    }
  }
  return out.join(delimiter);
}

export interface FixPathOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Seam for tests: run the shell and resolve with its stdout. */
  run?: (shell: string, args: string[], timeoutMs: number) => Promise<string>;
}

function runShell(
  shell: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      shell,
      args,
      { timeout: timeoutMs, encoding: "utf8", env: process.env },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

/**
 * Update `env.PATH` from the login shell. Returns true when PATH was changed.
 * Never throws.
 */
export async function fixPathFromLoginShell(
  options: FixPathOptions = {},
): Promise<boolean> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  if (platform === "win32") return false;
  const shell = env.SHELL || "/bin/zsh";
  const run = options.run ?? runShell;
  try {
    const stdout = await run(
      shell,
      ["-ilc", `printf '%s' "${START}$PATH${END}"`],
      options.timeoutMs ?? 3000,
    );
    const shellPath = parseShellPath(stdout);
    if (!shellPath) return false;
    const merged = mergePath(shellPath, env.PATH);
    if (merged === env.PATH) return false;
    env.PATH = merged;
    return true;
  } catch {
    return false;
  }
}

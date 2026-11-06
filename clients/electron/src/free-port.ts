/**
 * Pick a free TCP port on a host by binding `:0` and releasing it.
 *
 * The web server cannot bind `:0` itself — `buildWebServerConfig` derives the
 * origin allow-list and sandbox CSP from a fixed `CLIENT_PORT` — so the desktop
 * shell probes one immediately before starting it. That leaves the small
 * probe-then-bind window #2602 describes; it is acceptable here because the
 * shell binds within the same tick of startup on a loopback address.
 */

import { createServer } from "node:net";

export function findFreePort(host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error(`Could not determine a free port on ${host}`));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

import { describe, it, expect } from "vitest";
import { createServer } from "node:net";
import { findFreePort } from "../src/free-port.js";

describe("findFreePort", () => {
  it("returns a port that can be bound immediately", async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
    await new Promise<void>((resolve, reject) => {
      const srv = createServer();
      srv.once("error", reject);
      srv.listen(port, "127.0.0.1", () => srv.close(() => resolve()));
    });
  });

  it("rejects when the host cannot be bound", async () => {
    await expect(findFreePort("203.0.113.1")).rejects.toThrow();
  });
});

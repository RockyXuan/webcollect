import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { attachNextUpgradeHandler } from "@/lib/server-upgrade";

describe("custom Next server upgrade handling", () => {
  it("forwards WebSocket upgrades to the Next handler", async () => {
    const server = createServer();
    const handler = vi.fn(async () => undefined);
    const request = { url: "/_next/webpack-hmr" } as IncomingMessage;
    const socket = { destroy: vi.fn() } as unknown as Duplex;
    const head = Buffer.from("hmr");

    attachNextUpgradeHandler(server, handler);
    server.emit("upgrade", request, socket, head);

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
    });
    expect(handler).toHaveBeenCalledWith(request, socket, head);
  });

  it("allows both loopback hostnames used by isolated browser checks", () => {
    expect(nextConfig.allowedDevOrigins).toEqual(
      expect.arrayContaining(["localhost", "127.0.0.1"])
    );
  });
});

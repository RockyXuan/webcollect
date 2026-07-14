import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";

export type NextUpgradeHandler = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
) => Promise<void>;

export function attachNextUpgradeHandler(
  server: Server,
  upgradeHandler: NextUpgradeHandler
): void {
  server.on("upgrade", (request, socket, head) => {
    void upgradeHandler(request, socket, head).catch((error: unknown) => {
      console.error("Error occurred handling WebSocket upgrade", request.url, error);
      socket.destroy();
    });
  });
}

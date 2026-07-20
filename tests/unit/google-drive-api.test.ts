import { describe, expect, it, vi } from "vitest";
import { GoogleDriveApi } from "@/lib/google-drive-api";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Google Drive REST client", () => {
  it("retries one 401 after invalidating the cached token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ files: [] }));
    const invalidateToken = vi.fn().mockResolvedValue(undefined);
    const api = new GoogleDriveApi({
      fetchImpl,
      getToken: vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new"),
      invalidateToken,
    });

    await expect(api.listAppDataFiles()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(invalidateToken).toHaveBeenCalledWith("old");
  });

  it("refuses to overwrite ambiguous duplicate names", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      files: [
        { id: "one", name: "workspace.json", modifiedTime: "2026-01-01T00:00:00Z" },
        { id: "two", name: "workspace.json", modifiedTime: "2026-01-02T00:00:00Z" },
      ],
    }));
    const api = new GoogleDriveApi({
      fetchImpl,
      getToken: vi.fn().mockResolvedValue("token"),
      invalidateToken: vi.fn(),
    });

    await expect(api.upsertJsonFile("workspace.json", {}, { ok: true })).rejects.toThrow(/多个同名/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});


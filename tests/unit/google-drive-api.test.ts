import { describe, expect, it, vi } from "vitest";
import { GoogleDriveApi } from "@/lib/google-drive-api";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Google Drive REST client", () => {
  it("keeps the native fetch receiver when no test implementation is supplied", async () => {
    const receiverSensitiveFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(jsonResponse({ files: [] }));
    });
    vi.stubGlobal("fetch", receiverSensitiveFetch);
    try {
      const api = new GoogleDriveApi({
        getToken: vi.fn().mockResolvedValue("token"),
        invalidateToken: vi.fn(),
      });

      await expect(api.listAppDataFiles()).resolves.toEqual([]);
      expect(receiverSensitiveFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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

  it("retries transient read failures but never retries an interrupted upload", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "busy" }, 503))
      .mockResolvedValueOnce(jsonResponse({ files: [] }));
    const api = new GoogleDriveApi({
      fetchImpl,
      getToken: vi.fn().mockResolvedValue("token"),
      invalidateToken: vi.fn(),
    });

    await expect(api.listAppDataFiles()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const uploadFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: "interrupted" }, 503));
    const uploadApi = new GoogleDriveApi({
      fetchImpl: uploadFetch,
      getToken: vi.fn().mockResolvedValue("token"),
      invalidateToken: vi.fn(),
    });
    await expect(uploadApi.upsertJsonFile("workspace.json", {}, { ok: true })).rejects.toThrow(/503/);
    expect(uploadFetch).toHaveBeenCalledTimes(2);
  });

  it("stops a stale conditional update before uploading", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      files: [{ id: "one", name: "workspace.json", modifiedTime: "2026-01-01T00:00:00Z", version: "12" }],
    }));
    const api = new GoogleDriveApi({
      fetchImpl,
      getToken: vi.fn().mockResolvedValue("token"),
      invalidateToken: vi.fn(),
    });

    await expect(api.upsertJsonFile(
      "workspace.json",
      {},
      { ok: true },
      { expectedVersion: "11" },
    )).rejects.toThrow(/另一窗口更新/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts a timed out request without changing remote state", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    }));
    const api = new GoogleDriveApi({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getToken: vi.fn().mockResolvedValue("token"),
      invalidateToken: vi.fn(),
      timeoutMs: 5,
    });

    await expect(api.listAppDataFiles()).rejects.toThrow(/请求超时/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

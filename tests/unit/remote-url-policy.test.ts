import { describe, expect, it, vi } from "vitest";
import {
  assertSafeRemoteUrl,
  isPublicIpAddress,
} from "../../shared/remote-url-policy.js";
import {
  fetchRemoteText,
  safeRemoteFetch,
} from "@/lib/safe-remote-fetch";

describe("remote URL policy", () => {
  it.each([
    "http://localhost/admin",
    "http://sub.localhost/admin",
    "http://127.0.0.1/admin",
    "http://127.1/admin",
    "http://2130706433/admin",
    "http://0x7f000001/admin",
    "http://10.0.0.1/admin",
    "http://172.16.0.1/admin",
    "http://192.168.1.1/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/admin",
    "http://[fc00::1]/admin",
    "http://[fe80::1]/admin",
    "http://[::ffff:127.0.0.1]/admin",
    "http://[::127.0.0.1]/admin",
    "http://[64:ff9b::127.0.0.1]/admin",
    "http://[2002:7f00:1::]/admin",
    "http://printer.local/admin",
    "https://user:password@example.com/",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "data:text/plain,hello",
  ])("rejects non-public target %s", (url) => {
    expect(() => assertSafeRemoteUrl(url)).toThrow();
  });

  it.each([
    "https://example.com/article",
    "http://93.184.216.34/",
    "https://[2606:4700:4700::1111]/",
  ])("allows public HTTP(S) target %s", (url) => {
    expect(assertSafeRemoteUrl(url).toString()).toBe(new URL(url).toString());
  });

  it("classifies private and public IP addresses deterministically", () => {
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
  });
});

describe("safe remote fetch", () => {
  it("rejects a public hostname that resolves to a private address", async () => {
    const fetchImpl = vi.fn();

    await expect(safeRemoteFetch("https://public.example.com/", {
      fetchImpl,
      resolveHost: async () => ["10.0.0.8"],
    })).rejects.toThrow(/公网|public/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects mixed public and private DNS answers", async () => {
    const fetchImpl = vi.fn();

    await expect(safeRemoteFetch("https://public.example.com/", {
      fetchImpl,
      resolveHost: async () => ["93.184.216.34", "192.168.1.9"],
    })).rejects.toThrow(/公网|public/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("revalidates every redirect before making the next request", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    }));

    await expect(safeRemoteFetch("https://public.example.com/start", {
      fetchImpl,
      resolveHost: async () => ["93.184.216.34"],
    })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("preserves a legitimate public redirect", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example/final" },
      }))
      .mockResolvedValueOnce(new Response("ok", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));

    const result = await fetchRemoteText("https://public.example.com/start", {
      fetchImpl,
      resolveHost: async () => ["93.184.216.34"],
      allowedContentTypes: ["text/html"],
      maxBytes: 64,
    });

    expect(result.text).toBe("ok");
    expect(result.url).toBe("https://cdn.example/final");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects an oversized response even without content-length", async () => {
    const fetchImpl = vi.fn(async () => new Response("x".repeat(65), {
      status: 200,
      headers: { "content-type": "text/html" },
    }));

    await expect(fetchRemoteText("https://public.example.com/large", {
      fetchImpl,
      resolveHost: async () => ["93.184.216.34"],
      allowedContentTypes: ["text/html"],
      maxBytes: 64,
    })).rejects.toThrow(/大小|large|size|byte/i);
  });

  it("rejects unexpected response types", async () => {
    const fetchImpl = vi.fn(async () => new Response("binary", {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    }));

    await expect(fetchRemoteText("https://public.example.com/file", {
      fetchImpl,
      resolveHost: async () => ["93.184.216.34"],
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
      maxBytes: 64,
    })).rejects.toThrow(/content type/i);
  });
});

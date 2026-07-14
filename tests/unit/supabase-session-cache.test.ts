import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetBrowserSupabaseForTest,
  clearBrowserSupabaseSessionCache,
  getBrowserSupabaseClient,
  setSupabaseConfig,
} from "@/lib/supabase-browser";

beforeEach(() => {
  localStorage.clear();
  __resetBrowserSupabaseForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Supabase local session cleanup", () => {
  it("removes only the configured project's auth session keys", () => {
    setSupabaseConfig({
      url: "https://webcollect-ref.supabase.co",
      anonKey: "test-key",
    });
    localStorage.setItem("sb-webcollect-ref-auth-token", "token");
    localStorage.setItem("sb-webcollect-ref-auth-token-code-verifier", "verifier");
    localStorage.setItem("sb-webcollect-ref-auth-token.0", "chunk");
    localStorage.setItem("sb-other-ref-auth-token", "other-token");
    localStorage.setItem("webcollect_setting", "keep-me");

    clearBrowserSupabaseSessionCache();

    expect(localStorage.getItem("sb-webcollect-ref-auth-token")).toBeNull();
    expect(localStorage.getItem("sb-webcollect-ref-auth-token-code-verifier")).toBeNull();
    expect(localStorage.getItem("sb-webcollect-ref-auth-token.0")).toBeNull();
    expect(localStorage.getItem("sb-other-ref-auth-token")).toBe("other-token");
    expect(localStorage.getItem("webcollect_setting")).toBe("keep-me");
  });

  it("keeps one GoTrue client when an unauthenticated session cache is cleared", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setSupabaseConfig({
      url: "https://webcollect-ref.supabase.co",
      anonKey: "test-key",
    });
    const firstClient = getBrowserSupabaseClient();

    clearBrowserSupabaseSessionCache();

    expect(getBrowserSupabaseClient()).toBe(firstClient);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("Multiple GoTrueClient instances"));
  });

  it("does not replace the client when extension settings save the same configuration", () => {
    const config = {
      url: "https://webcollect-settings-ref.supabase.co",
      anonKey: "test-key",
    };
    setSupabaseConfig(config);
    const firstClient = getBrowserSupabaseClient();

    setSupabaseConfig(config);

    expect(getBrowserSupabaseClient()).toBe(firstClient);
  });

  it("stops and replaces the client only when the configured project really changes", () => {
    setSupabaseConfig({
      url: "https://webcollect-old-ref.supabase.co",
      anonKey: "old-key",
    });
    const firstClient = getBrowserSupabaseClient();
    const stopAutoRefresh = vi.spyOn(firstClient.auth, "stopAutoRefresh").mockResolvedValue();

    setSupabaseConfig({
      url: "https://webcollect-new-ref.supabase.co",
      anonKey: "new-key",
    });

    expect(stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(getBrowserSupabaseClient()).not.toBe(firstClient);
  });
});

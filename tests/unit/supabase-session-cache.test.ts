import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetBrowserSupabaseForTest,
  clearBrowserSupabaseSessionCache,
  setSupabaseConfig,
} from "@/lib/supabase-browser";

beforeEach(() => {
  localStorage.clear();
  __resetBrowserSupabaseForTest();
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
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extension: false,
  getUser: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
  upsert: vi.fn(async () => ({ error: null })),
  clearSupabaseCache: vi.fn(),
}));

vi.mock("@/lib/supabase-browser", () => ({
  initBrowserSupabase: vi.fn(async () => true),
  getBrowserSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: mocks.getUser,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
      startAutoRefresh: mocks.startAutoRefresh,
      stopAutoRefresh: mocks.stopAutoRefresh,
    },
    from: vi.fn(() => ({ upsert: mocks.upsert })),
  })),
  clearBrowserSupabaseSessionCache: mocks.clearSupabaseCache,
}));

vi.mock("@/lib/platform", () => ({
  isChromeExtension: () => mocks.extension,
}));

vi.mock("@/lib/cloud-snapshots", () => ({
  saveCloudWorkspaceSnapshot: vi.fn(),
}));

vi.mock("@/lib/sync", () => ({
  pushLocalSnapshotToCloud: vi.fn(),
  syncData: vi.fn(),
}));

vi.mock("@/lib/store", () => ({
  useAppStore: { getState: () => ({ loadData: vi.fn() }) },
}));

vi.mock("@/lib/db", () => ({
  getLastSeenCloudSnapshotUpdatedAt: vi.fn(async () => 0),
  getLocalSnapshotSyncedAt: vi.fn(async () => 0),
  getLocalSnapshotUpdatedAt: vi.fn(async () => 0),
  getLastSeenCloudWorkspaceVersion: vi.fn(async () => 0),
  saveLastSeenCloudWorkspaceVersion: vi.fn(),
}));

vi.mock("@/lib/local-snapshots", () => ({
  createLocalDataSnapshot: vi.fn(),
}));

import { useAuthStore } from "@/lib/auth-store";

const cachedUser = {
  id: "cached-user",
  email: "cached@example.com",
  displayName: "Cached",
  avatarUrl: "",
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  localStorage.setItem("webcollect_sync_mode", "manual");
  localStorage.setItem("webcollect_sync_mode_version", "2");
  mocks.extension = false;
  mocks.getUser.mockReset();
  mocks.signInWithOAuth.mockReset();
  mocks.signOut.mockReset();
  mocks.startAutoRefresh.mockClear();
  mocks.stopAutoRefresh.mockClear();
  mocks.upsert.mockClear();
  mocks.clearSupabaseCache.mockClear();
  useAuthStore.setState({
    user: null,
    isLoading: true,
    isLoggedIn: false,
    syncStatus: "idle",
    syncMode: "manual",
    localSavedAt: null,
    lastSyncAt: null,
    error: null,
  });
});

describe("validated auth session", () => {
  it("does not trust a cached display identity without a verified Supabase user", async () => {
    localStorage.setItem("webcollect_auth_session", JSON.stringify(cachedUser));
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing" },
    });

    await useAuthStore.getState().initialize();

    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem("webcollect_auth_session")).toBeNull();
  });

  it("uses the remotely verified user as the login authority", async () => {
    localStorage.setItem("webcollect_auth_session", JSON.stringify(cachedUser));
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "verified-user",
          email: "verified@example.com",
          user_metadata: { full_name: "Verified", avatar_url: "https://example.com/avatar.png" },
        },
      },
      error: null,
    });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe("verified-user");
    expect(JSON.parse(localStorage.getItem("webcollect_auth_session") || "{}").id).toBe("verified-user");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("removes a consumed OAuth code without dropping unrelated query parameters", async () => {
    window.history.replaceState({}, "", "/?code=one-time-code&view=collection");
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "verified-user",
          email: "verified@example.com",
          user_metadata: { full_name: "Verified" },
        },
      },
      error: null,
    });

    await useAuthStore.getState().initialize();

    expect(window.location.search).toBe("?view=collection");
  });

  it("signs out the remote Supabase session without disabling browser-managed refresh", async () => {
    mocks.extension = true;
    mocks.signOut.mockResolvedValue({ error: null });
    localStorage.setItem("webcollect_auth_session", JSON.stringify(cachedUser));
    useAuthStore.setState({ user: cachedUser, isLoggedIn: true, isLoading: false });

    await useAuthStore.getState().logout();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearSupabaseCache).toHaveBeenCalledTimes(1);
    expect(mocks.stopAutoRefresh).not.toHaveBeenCalled();
    expect(localStorage.getItem("webcollect_auth_session")).toBeNull();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it("keeps Supabase browser visibility management when starting Google login", async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.test" }, error: null });

    await useAuthStore.getState().loginWithGoogle();

    expect(mocks.startAutoRefresh).not.toHaveBeenCalled();
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }));
  });

  it("clears local auth state even when remote sign-out fails", async () => {
    mocks.extension = true;
    mocks.signOut.mockRejectedValue(new Error("network unavailable"));
    localStorage.setItem("webcollect_auth_session", JSON.stringify(cachedUser));
    useAuthStore.setState({ user: cachedUser, isLoggedIn: true, isLoading: false });

    await useAuthStore.getState().logout();

    expect(mocks.clearSupabaseCache).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("webcollect_auth_session")).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().error).toMatch(/本地会话已清除/);
  });
});

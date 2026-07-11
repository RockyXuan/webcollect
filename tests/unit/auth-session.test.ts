import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extension: false,
  getUser: vi.fn(),
  signOut: vi.fn(),
  stopAutoRefresh: vi.fn(),
  upsert: vi.fn(async () => ({ error: null })),
  clearSupabaseCache: vi.fn(),
}));

vi.mock("@/lib/supabase-browser", () => ({
  initBrowserSupabase: vi.fn(async () => true),
  getBrowserSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
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
  localStorage.setItem("webcollect_sync_mode", "manual");
  localStorage.setItem("webcollect_sync_mode_version", "2");
  mocks.extension = false;
  mocks.getUser.mockReset();
  mocks.signOut.mockReset();
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

  it("signs out the remote Supabase session in the extension too", async () => {
    mocks.extension = true;
    mocks.signOut.mockResolvedValue({ error: null });
    localStorage.setItem("webcollect_auth_session", JSON.stringify(cachedUser));
    useAuthStore.setState({ user: cachedUser, isLoggedIn: true, isLoading: false });

    await useAuthStore.getState().logout();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.clearSupabaseCache).toHaveBeenCalledTimes(1);
    expect(mocks.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("webcollect_auth_session")).toBeNull();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
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

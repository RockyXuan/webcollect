import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extension: false,
  identity: null as null | {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string;
  },
  connection: {
    version: 1 as const,
    enabled: false,
    connectedAt: 0,
    lastSyncAt: 0,
    migrationVerifiedAt: 0,
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  getIdentity: vi.fn(),
  sync: vi.fn(),
  saveSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  loadData: vi.fn(),
}));

vi.mock("@/lib/google-drive-sync", () => ({
  googleDriveSyncProvider: {
    id: "google-drive",
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    getIdentity: mocks.getIdentity,
    sync: mocks.sync,
    saveSnapshot: mocks.saveSnapshot,
    listSnapshots: mocks.listSnapshots,
  },
}));

vi.mock("@/lib/google-drive-auth", () => ({
  getDriveConnectionRecord: vi.fn(async () => mocks.connection),
}));

vi.mock("@/lib/platform", () => ({
  isChromeExtension: () => mocks.extension,
}));

vi.mock("@/lib/store", () => ({
  useAppStore: { getState: () => ({ loadData: mocks.loadData }) },
}));

vi.mock("@/lib/db", () => ({
  CURRENT_SYNC_METADATA_VERSION: 2,
  getLocalSnapshotSyncedAt: vi.fn(async () => 0),
  getLocalSnapshotUpdatedAt: vi.fn(async () => 0),
}));

vi.mock("@/lib/local-snapshots", () => ({
  createLocalDataSnapshot: vi.fn(),
}));

vi.mock("@/lib/portable-backup", () => ({
  isPortableBackupRestoreInProgress: vi.fn(() => false),
}));

import { useAuthStore } from "@/lib/auth-store";

const driveUser = {
  id: "drive-permission-id",
  email: "rocky@example.com",
  displayName: "Rocky",
  avatarUrl: "https://example.com/avatar.png",
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("webcollect_sync_mode", "manual");
  localStorage.setItem("webcollect_sync_mode_version", "2");
  mocks.extension = false;
  mocks.identity = null;
  mocks.connection = {
    version: 1,
    enabled: false,
    connectedAt: 0,
    lastSyncAt: 0,
    migrationVerifiedAt: 0,
  };
  mocks.connect.mockReset();
  mocks.disconnect.mockReset();
  mocks.getIdentity.mockReset().mockImplementation(async () => mocks.identity);
  mocks.sync.mockReset().mockResolvedValue({ syncedAt: 123, remoteFilesRead: 1, changedLocal: false });
  mocks.saveSnapshot.mockReset();
  mocks.listSnapshots.mockReset();
  mocks.loadData.mockReset();
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

describe("Google Drive connection state", () => {
  it("keeps the Web build local-only without asking for Drive identity", async () => {
    await useAuthStore.getState().initialize();

    expect(mocks.getIdentity).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("keeps an unconnected extension fully usable as a local workspace", async () => {
    mocks.extension = true;

    await useAuthStore.getState().initialize();

    expect(mocks.getIdentity).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("keeps retired session keys untouched while using an already connected Drive account", async () => {
    mocks.extension = true;
    mocks.identity = driveUser;
    mocks.connection.enabled = true;
    localStorage.setItem("webcollect_auth_session", JSON.stringify({ id: "legacy" }));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(localStorage.getItem("webcollect_auth_session")).not.toBeNull();
  });

  it("connects Drive only after the user action and syncs when no migration is needed", async () => {
    mocks.extension = true;
    mocks.connect.mockResolvedValue(driveUser);

    await useAuthStore.getState().loginWithGoogle();

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toEqual(driveUser);
    expect(useAuthStore.getState().lastSyncAt).toBe(123);
  });

  it("does not let a retired local session key block a new Drive connection", async () => {
    mocks.extension = true;
    mocks.connect.mockResolvedValue(driveUser);
    localStorage.setItem("webcollect_auth_session", JSON.stringify({ id: "legacy" }));

    await useAuthStore.getState().loginWithGoogle();

    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("webcollect_auth_session")).not.toBeNull();
  });

  it("disconnects synchronization without clearing the legacy session or workspace", async () => {
    mocks.extension = true;
    localStorage.setItem("webcollect_auth_session", JSON.stringify({ id: "legacy" }));
    useAuthStore.setState({ user: driveUser, isLoggedIn: true, isLoading: false });

    await useAuthStore.getState().logout();

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("webcollect_auth_session")).not.toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it("stops local sync state even when clearing the Chrome token cache fails", async () => {
    mocks.extension = true;
    mocks.disconnect.mockRejectedValue(new Error("token cache unavailable"));
    useAuthStore.setState({ user: driveUser, isLoggedIn: true, isLoading: false });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().error).toMatch(/已停止本机同步/);
  });
});

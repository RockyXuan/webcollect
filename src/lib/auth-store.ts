/**
 * Google Drive connection and local-first synchronization state.
 *
 * V1.4 keeps every write local first. Google Drive is optional and is only
 * contacted after the user explicitly connects the Chrome extension.
 */

import { create } from "zustand";
import { googleDriveSyncProvider } from "@/lib/google-drive-sync";
import { getDriveConnectionRecord } from "@/lib/google-drive-auth";
import { isChromeExtension } from "@/lib/platform";
import { useAppStore } from "@/lib/store";
import { useTabPackStore } from "@/lib/tab-pack-store";
import {
  CURRENT_SYNC_METADATA_VERSION,
  getLocalSnapshotSyncedAt,
  getLocalSnapshotUpdatedAt,
} from "@/lib/db";
import { createLocalDataSnapshot, type LocalSnapshotEntry } from "@/lib/local-snapshots";
import { isPortableBackupRestoreInProgress } from "@/lib/portable-backup";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
}

export type SyncStatus = "idle" | "queued" | "syncing" | "success" | "error";
export type SyncMode = "manual" | "auto";
export type StartupSyncAction = "sync" | "push" | "none";

export interface ManualSyncOptions {
  reloadView?: boolean;
  throwOnError?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  syncStatus: SyncStatus;
  syncMode: SyncMode;
  localSavedAt: number | null;
  lastSyncAt: number | null;
  error: string | null;
  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  manualSync: (options?: ManualSyncOptions) => Promise<void>;
  setSyncMode: (mode: SyncMode) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncAt: (timestamp: number) => void;
  clearError: () => void;
}

const SYNC_MODE_KEY = "webcollect_sync_mode";
const SYNC_MODE_VERSION_KEY = "webcollect_sync_mode_version";
const LOCAL_UPDATED_SIGNAL_KEY = "webcollect_local_snapshot_updated_at";
export const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const AUTO_SYNC_MAX_DELAY_MS = 5 * 60 * 1000;
export const CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS = 30 * 60 * 1000;

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;
let autoSyncRunning = false;
let autoSyncPending = false;
let autoSyncListenerAttached = false;
let backgroundSyncRunning = false;
let cloudRestoreRunning = false;
let localSafetySnapshotTimer: ReturnType<typeof setTimeout> | null = null;
let lastCloudSafetySnapshotUploadedAt = 0;
let lastCloudSafetySnapshotHash = "";

function getErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.length > 220 ? `${message.slice(0, 220)}...` : message;
}

export function decideStartupSyncAction(
  localSnapshotUpdatedAt: number,
  localSnapshotSyncedAt: number,
  cloudSnapshotUpdatedAt: number,
  lastSeenCloudSnapshotUpdatedAt: number,
  syncMetadataVersion = CURRENT_SYNC_METADATA_VERSION,
): StartupSyncAction {
  if (syncMetadataVersion < CURRENT_SYNC_METADATA_VERSION) return "sync";
  if (cloudSnapshotUpdatedAt > lastSeenCloudSnapshotUpdatedAt) return "sync";
  if (localSnapshotUpdatedAt > localSnapshotSyncedAt) return "push";
  return "none";
}

export function buildSafetySnapshotHash(snapshot: LocalSnapshotEntry): string {
  const text = JSON.stringify({
    counts: snapshot.counts,
    sectionNames: snapshot.sectionNames,
    sampleCategoryNames: snapshot.sampleCategoryNames,
    sampleCardTitles: snapshot.sampleCardTitles,
    data: snapshot.data,
  });
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

export function shouldUploadCloudSafetySnapshot(
  now: number,
  snapshotHash: string,
  lastUploadedAt: number,
  lastSnapshotHash: string,
): boolean {
  if (!snapshotHash || snapshotHash === lastSnapshotHash) return false;
  return !(lastUploadedAt > 0 && now - lastUploadedAt < CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS);
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

async function maybeUploadCloudSafetySnapshot(snapshot: LocalSnapshotEntry): Promise<void> {
  const snapshotHash = buildSafetySnapshotHash(snapshot);
  const now = Date.now();
  if (!shouldUploadCloudSafetySnapshot(
    now,
    snapshotHash,
    lastCloudSafetySnapshotUploadedAt,
    lastCloudSafetySnapshotHash,
  )) return;

  await googleDriveSyncProvider.saveSnapshot({
    snapshot,
    kind: "system",
    source: "auto-local-change",
    dayKey: localDayKey(snapshot.createdAt),
    cloudUpdatedAt: now,
  });
  lastCloudSafetySnapshotUploadedAt = now;
  lastCloudSafetySnapshotHash = snapshotHash;
}

function loadSyncMode(): SyncMode {
  try {
    const version = localStorage.getItem(SYNC_MODE_VERSION_KEY);
    const storedMode = localStorage.getItem(SYNC_MODE_KEY);
    if (!version && storedMode === "manual") {
      localStorage.setItem(SYNC_MODE_KEY, "auto");
      localStorage.setItem(SYNC_MODE_VERSION_KEY, "2");
      return "auto";
    }
    return storedMode === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

function stopAutoSyncInterval(): void {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (localSafetySnapshotTimer) clearTimeout(localSafetySnapshotTimer);
  autoSyncInterval = null;
  autoSyncTimer = null;
  localSafetySnapshotTimer = null;
}

function ensureAutoSyncInterval(): void {
  if (typeof window === "undefined" || autoSyncInterval) return;
  const state = useAuthStore.getState();
  if (!state.user || state.syncMode !== "auto") return;
  autoSyncInterval = setInterval(() => void runAutoSyncPush(), AUTO_SYNC_INTERVAL_MS);
}

function scheduleAutoSync(): void {
  const state = useAuthStore.getState();
  if (!state.user || state.syncMode !== "auto") return;
  if (isPortableBackupRestoreInProgress()) return;
  useAuthStore.setState((current) => ({
    syncStatus: current.syncStatus === "syncing" ? "syncing" : "queued",
  }));
  ensureAutoSyncInterval();
  if (typeof window === "undefined" || autoSyncTimer) return;
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    void runAutoSyncPush();
  }, AUTO_SYNC_MAX_DELAY_MS);
}

function scheduleLocalSafetySnapshot(): void {
  if (typeof window === "undefined" || localSafetySnapshotTimer) return;
  localSafetySnapshotTimer = setTimeout(() => {
    localSafetySnapshotTimer = null;
    void (async () => {
      const snapshot = await createLocalDataSnapshot("auto-local-change", "本地修改自动版本");
      const state = useAuthStore.getState();
      if (snapshot && state.user) {
        await maybeUploadCloudSafetySnapshot(snapshot);
      }
    })().catch((error) => {
      console.warn("[Drive] Failed to save safety version:", error);
    });
  }, 10_000);
}

function ensureAutoSyncListener(): void {
  if (autoSyncListenerAttached || typeof window === "undefined") return;
  const registerChange = (timestamp: number) => {
    if (cloudRestoreRunning || isPortableBackupRestoreInProgress()) return;
    useAuthStore.setState((state) => ({
      localSavedAt: Math.max(state.localSavedAt || 0, timestamp),
      syncStatus: state.user && state.syncMode === "auto"
        ? "queued"
        : state.syncStatus,
    }));
    scheduleLocalSafetySnapshot();
    scheduleAutoSync();
  };
  window.addEventListener("webcollect:local-change", (event) => {
    const timestamp = event instanceof CustomEvent && typeof event.detail?.timestamp === "number"
      ? event.detail.timestamp
      : Date.now();
    registerChange(timestamp);
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== LOCAL_UPDATED_SIGNAL_KEY || !event.newValue) return;
    const timestamp = Number(event.newValue);
    if (Number.isFinite(timestamp)) registerChange(timestamp);
  });
  autoSyncListenerAttached = true;
}

async function runAutoSyncPush(): Promise<void> {
  const state = useAuthStore.getState();
  if (!state.user || state.syncMode !== "auto") return;
  if (isPortableBackupRestoreInProgress()) return;
  const [localUpdatedAt, localSyncedAt] = await Promise.all([
    getLocalSnapshotUpdatedAt(),
    getLocalSnapshotSyncedAt(),
  ]);
  if (localUpdatedAt <= localSyncedAt) {
    useAuthStore.setState((current) => ({
      syncStatus: current.syncStatus === "queued" ? "success" : current.syncStatus,
      lastSyncAt: current.lastSyncAt || localSyncedAt || null,
    }));
    return;
  }
  if (backgroundSyncRunning || autoSyncRunning) {
    autoSyncPending = true;
    return;
  }

  autoSyncRunning = true;
  useAuthStore.setState({ syncStatus: "syncing", error: null });
  try {
    const result = await googleDriveSyncProvider.sync();
    if (result.changedLocal) {
      await Promise.all([
        useAppStore.getState().loadData({ showLoading: false, preserveOnCollapse: true }),
        useTabPackStore.getState().loadData(),
      ]);
    }
    useAuthStore.setState({ syncStatus: "success", lastSyncAt: result.syncedAt, error: null });
  } catch (error) {
    useAuthStore.setState({ syncStatus: "error", error: getErrorMessage(error, "Google Drive 同步失败") });
  } finally {
    autoSyncRunning = false;
    if (autoSyncPending) {
      autoSyncPending = false;
      scheduleAutoSync();
    }
  }
}

export async function triggerSync(_userId?: string): Promise<void> {
  void _userId;
  const state = useAuthStore.getState();
  if (!state.user || backgroundSyncRunning) return;
  if (isPortableBackupRestoreInProgress()) return;
  backgroundSyncRunning = true;
  cloudRestoreRunning = true;
  useAuthStore.setState({ syncStatus: "syncing", localSavedAt: null, error: null });
  try {
    const result = await googleDriveSyncProvider.sync();
    if (result.changedLocal) {
      await Promise.all([
        useAppStore.getState().loadData({ showLoading: false, preserveOnCollapse: true }),
        useTabPackStore.getState().loadData(),
      ]);
    }
    useAuthStore.setState({ syncStatus: "success", lastSyncAt: result.syncedAt, error: null });
    ensureAutoSyncInterval();
  } catch (error) {
    useAuthStore.setState({ syncStatus: "error", error: getErrorMessage(error, "Google Drive 同步失败") });
  } finally {
    cloudRestoreRunning = false;
    backgroundSyncRunning = false;
  }
}

function scheduleStartupSync(): void {
  const run = () => void triggerSync();
  if (typeof window === "undefined") {
    setTimeout(run, 0);
    return;
  }
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  };
  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(run, { timeout: 2_000 });
  } else {
    window.setTimeout(run, 0);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,
  syncStatus: "idle",
  syncMode: "auto",
  localSavedAt: null,
  lastSyncAt: null,
  error: null,

  initialize: async () => {
    stopAutoSyncInterval();
    ensureAutoSyncListener();
    const syncMode = loadSyncMode();
    set({
      user: null,
      isLoading: true,
      isLoggedIn: false,
      syncStatus: "idle",
      syncMode,
      error: null,
    });
    if (!isChromeExtension()) {
      set({ isLoading: false });
      return;
    }

    try {
      const [identity, connection] = await Promise.all([
        googleDriveSyncProvider.getIdentity(),
        getDriveConnectionRecord(),
      ]);
      if (!identity) {
        set({ isLoading: false, lastSyncAt: connection.lastSyncAt || null });
        return;
      }
      set({
        user: identity,
        isLoggedIn: true,
        isLoading: false,
        lastSyncAt: connection.lastSyncAt || null,
        syncStatus: connection.lastSyncAt ? "success" : "idle",
      });
      if (syncMode === "auto") scheduleStartupSync();
    } catch (error) {
      set({
        isLoading: false,
        error: `暂时无法检查 Google Drive，本地数据仍可正常使用：${getErrorMessage(error, "连接检查失败")}`,
      });
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!isChromeExtension()) {
        throw new Error("Google Drive 连接当前仅支持 Chrome 扩展版；网页版继续使用本机数据。");
      }
      const identity = await googleDriveSyncProvider.connect();
      set({
        user: identity,
        isLoggedIn: true,
        isLoading: false,
        syncStatus: "queued",
        error: null,
      });
      await triggerSync();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error, "Google Drive 连接失败") });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    stopAutoSyncInterval();
    try {
      await googleDriveSyncProvider.disconnect();
      set({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        syncStatus: "idle",
        localSavedAt: null,
        lastSyncAt: null,
        error: null,
      });
    } catch (error) {
      set({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        syncStatus: "idle",
        error: `已停止本机同步，但 Google 授权缓存清理未确认：${getErrorMessage(error, "断开失败")}`,
      });
    }
  },

  manualSync: async (options) => {
    const state = useAuthStore.getState();
    if (!state.user) return;
    set({ syncStatus: "syncing", error: null });
    try {
      const result = await googleDriveSyncProvider.sync();
      if (options?.reloadView !== false || result.changedLocal) {
        await Promise.all([
          useAppStore.getState().loadData({ showLoading: false, preserveOnCollapse: true }),
          useTabPackStore.getState().loadData(),
        ]);
      }
      set({ syncStatus: "success", lastSyncAt: result.syncedAt, localSavedAt: null, error: null });
      ensureAutoSyncInterval();
    } catch (error) {
      set({ syncStatus: "error", error: getErrorMessage(error, "Google Drive 同步失败") });
      if (options?.throwOnError) throw error;
    }
  },

  setSyncMode: (mode) => {
    try {
      localStorage.setItem(SYNC_MODE_KEY, mode);
      localStorage.setItem(SYNC_MODE_VERSION_KEY, "2");
    } catch {
      // Sync mode remains usable for the current session.
    }
    set({ syncMode: mode });
    const state = useAuthStore.getState();
    if (mode === "auto" && state.user) scheduleAutoSync();
    else stopAutoSyncInterval();
  },

  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt, syncStatus: "success" }),
  clearError: () => set({ error: null }),
}));

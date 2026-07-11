/**
 * Auth Store - Google OAuth login and session management
 * 
 * Supports two platforms:
 * 1. Web (Next.js): Uses Supabase Auth SDK with browser redirect
 * 2. Chrome Extension: Uses chrome.identity.launchWebAuthFlow
 * 
 * After login:
 * - Creates/updates user record in Supabase `users` table
 * - Triggers data sync between local and cloud storage
 */

import { create } from "zustand";
import {
  clearBrowserSupabaseSessionCache,
  getBrowserSupabaseClient,
  initBrowserSupabase,
} from "@/lib/supabase-browser";
import { isChromeExtension } from "@/lib/platform";
import { saveCloudWorkspaceSnapshot } from "@/lib/cloud-snapshots";
import { pushLocalSnapshotToCloud, syncData } from "@/lib/sync";
import { useAppStore } from "@/lib/store";
import {
  getLastSeenCloudSnapshotUpdatedAt,
  getLocalSnapshotSyncedAt,
  getLocalSnapshotUpdatedAt,
  getLastSeenCloudWorkspaceVersion,
  saveLastSeenCloudWorkspaceVersion,
} from "@/lib/db";
import { createLocalDataSnapshot, type LocalSnapshotEntry } from "@/lib/local-snapshots";

// Types

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

  // Actions
  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  manualSync: (options?: ManualSyncOptions) => Promise<void>;
  setSyncMode: (mode: SyncMode) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncAt: (timestamp: number) => void;
  clearError: () => void;
}

// Helper: upsert user record

async function upsertUser(user: AuthUser): Promise<void> {
  const client = getBrowserSupabaseClient();
  const { error } = await client
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email,
        display_name: user.displayName || null,
        avatar_url: user.avatarUrl || null,
      },
      { onConflict: "id" }
    );
  if (error) {
    console.error("Failed to upsert user:", error.message);
  }
}

// Helper: restore session from localStorage

const SESSION_KEY = "webcollect_auth_session";
const SYNC_MODE_KEY = "webcollect_sync_mode";
const SYNC_MODE_VERSION_KEY = "webcollect_sync_mode_version";
export const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const AUTO_SYNC_MAX_DELAY_MS = 5 * 60 * 1000;
export const CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS = 30 * 60 * 1000;
const LOCAL_UPDATED_SIGNAL_KEY = "webcollect_local_snapshot_updated_at";

function summarizeAuthError(message: string): string {
  if (/<html[\s>]|<!doctype html/i.test(message)) {
    const code = message.match(/error code\s*(\d+)/i)?.[1] || message.match(/\b5\d{2}\b/)?.[0];
    return code
      ? `Supabase \u6682\u65f6\u8fd4\u56de ${code} \u670d\u52a1\u7aef\u9519\u8bef\u3002\u672c\u5730\u6570\u636e\u5df2\u4fdd\u7559\uff0c\u7a0d\u540e\u4f1a\u81ea\u52a8\u91cd\u8bd5\u3002`
      : "Supabase \u6682\u65f6\u8fd4\u56de\u670d\u52a1\u7aef\u9519\u8bef\u9875\u9762\u3002\u672c\u5730\u6570\u636e\u5df2\u4fdd\u7559\uff0c\u7a0d\u540e\u4f1a\u81ea\u52a8\u91cd\u8bd5\u3002";
  }
  return message.length > 220 ? `${message.slice(0, 220)}...` : message;
}
function getErrorMessage(err: unknown, fallback: string): string {
  return summarizeAuthError(err instanceof Error ? err.message : fallback);
}

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

function normalizeNumberPreference(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

export function decideStartupSyncAction(
  localSnapshotUpdatedAt: number,
  localSnapshotSyncedAt: number,
  cloudSnapshotUpdatedAt: number,
  lastSeenCloudSnapshotUpdatedAt: number
): StartupSyncAction {
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
  lastSnapshotHash: string
): boolean {
  if (!snapshotHash) return false;
  if (snapshotHash === lastSnapshotHash) return false;
  if (lastUploadedAt > 0 && now - lastUploadedAt < CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS) return false;
  return true;
}

async function readCloudSnapshotUpdatedAt(userId: string): Promise<number> {
  const client = getBrowserSupabaseClient();
  const { data, error } = await client
    .from("user_preferences")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "localSnapshotUpdatedAt")
    .limit(1);

  if (error) {
    throw new Error(`Failed to read cloud freshness marker: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return normalizeNumberPreference((rows[0] as { value?: unknown } | undefined)?.value);
}

interface CloudWorkspaceVersionResult {
  version: number;
  legacyFallback: boolean;
}

function isMissingWorkspaceVersionTable(message: string): boolean {
  return /workspace_versions/i.test(message)
    && (/schema cache/i.test(message) || /does not exist/i.test(message));
}

async function readCloudWorkspaceVersion(userId: string): Promise<CloudWorkspaceVersionResult> {
  const client = getBrowserSupabaseClient();
  const { data, error } = await client
    .from("workspace_versions")
    .select("version")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    if (isMissingWorkspaceVersionTable(error.message)) {
      return { version: await readCloudSnapshotUpdatedAt(userId), legacyFallback: true };
    }
    throw new Error(`Failed to read cloud workspace version: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return {
    version: normalizeNumberPreference((rows[0] as { version?: unknown } | undefined)?.version),
    legacyFallback: false,
  };
}

async function maybeUploadCloudSafetySnapshot(userId: string, snapshot: LocalSnapshotEntry): Promise<void> {
  const snapshotHash = buildSafetySnapshotHash(snapshot);
  const now = Date.now();
  if (!shouldUploadCloudSafetySnapshot(
    now,
    snapshotHash,
    lastCloudSafetySnapshotUploadedAt,
    lastCloudSafetySnapshotHash
  )) {
    return;
  }

  await saveCloudWorkspaceSnapshot(userId, snapshot, {
    kind: "system",
    source: "auto-local-change",
  });
  lastCloudSafetySnapshotUploadedAt = now;
  lastCloudSafetySnapshotHash = snapshotHash;
}

function saveSession(user: AuthUser): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // localStorage might be unavailable
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// Helper: map Supabase user to AuthUser

function mapSupabaseUser(supabaseUser: Record<string, unknown>): AuthUser {
  const meta = (supabaseUser.user_metadata || {}) as Record<string, unknown>;
  return {
    id: supabaseUser.id as string,
    email: (supabaseUser.email as string) || "",
    displayName: (meta.full_name as string) || (meta.name as string) || "",
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || "",
  };
}

function isMissingAuthSessionError(message: string): boolean {
  return /auth session missing|session.*missing|invalid.*jwt|jwt.*expired/i.test(message);
}

// Helper: trigger background sync

export async function triggerSync(userId: string): Promise<void> {
  const store = useAuthStore;
  if (backgroundSyncRunning) return;
  backgroundSyncRunning = true;
  cloudRestoreRunning = true;
  store.setState({ syncStatus: "syncing", localSavedAt: null });

  try {
    const [
      localSnapshotUpdatedAt,
      localSnapshotSyncedAt,
      lastSeenCloudSnapshotUpdatedAt,
      lastSeenCloudWorkspaceVersion,
      cloudWorkspaceVersion,
    ] = await Promise.all([
      getLocalSnapshotUpdatedAt(),
      getLocalSnapshotSyncedAt(),
      getLastSeenCloudSnapshotUpdatedAt(),
      getLastSeenCloudWorkspaceVersion(),
      readCloudWorkspaceVersion(userId),
    ]);
    const cloudFreshness = cloudWorkspaceVersion.version;
    const lastSeenCloudFreshness = cloudWorkspaceVersion.legacyFallback
      ? lastSeenCloudSnapshotUpdatedAt
      : lastSeenCloudWorkspaceVersion ?? -1;
    const action = decideStartupSyncAction(
      localSnapshotUpdatedAt,
      localSnapshotSyncedAt,
      cloudFreshness,
      lastSeenCloudFreshness
    );

    if (action === "sync") {
      await syncData(userId);
      await useAppStore.getState().loadData({ showLoading: false, preserveOnCollapse: true });
    } else if (action === "push") {
      await pushLocalSnapshotToCloud(userId);
    }

    if (!cloudWorkspaceVersion.legacyFallback) {
      const observedVersion = action === "none"
        ? cloudWorkspaceVersion.version
        : (await readCloudWorkspaceVersion(userId)).version;
      await saveLastSeenCloudWorkspaceVersion(observedVersion);
    }

    store.setState({ syncStatus: "success", lastSyncAt: Date.now(), error: null });
    ensureAutoSyncInterval();
  } catch (err) {
    console.error("[Auth] Sync failed:", err);
    const message = getErrorMessage(err, "Sync failed");
    store.setState({ syncStatus: "error", error: message });
  } finally {
    cloudRestoreRunning = false;
    backgroundSyncRunning = false;
    if (autoSyncPending) {
      autoSyncPending = false;
      scheduleAutoSync();
    }
  }
}

function scheduleStartupSync(userId: string): void {
  const run = () => {
    void triggerSync(userId);
  };

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

function ensureAutoSyncListener(): void {
  if (autoSyncListenerAttached || typeof window === "undefined") return;
  window.addEventListener("webcollect:local-change", (event) => {
    if (cloudRestoreRunning) return;
    const timestamp = event instanceof CustomEvent && typeof event.detail?.timestamp === "number"
      ? event.detail.timestamp
      : Date.now();
    useAuthStore.setState((state) => ({
      localSavedAt: timestamp,
      syncStatus: state.user && state.syncMode === "auto" ? "queued" : state.syncStatus,
    }));
    scheduleLocalSafetySnapshot();
    scheduleAutoSync();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== LOCAL_UPDATED_SIGNAL_KEY || !event.newValue) return;
    const timestamp = Number(event.newValue);
    if (!Number.isFinite(timestamp)) return;
    useAuthStore.setState((state) => ({
      localSavedAt: Math.max(state.localSavedAt || 0, timestamp),
      syncStatus: state.user && state.syncMode === "auto" ? "queued" : state.syncStatus,
    }));
    scheduleLocalSafetySnapshot();
    scheduleAutoSync();
  });
  autoSyncListenerAttached = true;
}

function scheduleAutoSync(): void {
  const state = useAuthStore.getState();
  if (!state.user || state.syncMode !== "auto") return;
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
      const user = useAuthStore.getState().user;
      if (snapshot && user) {
        await maybeUploadCloudSafetySnapshot(user.id, snapshot);
      }
    })().catch((error) => {
      console.warn("[Auth] Failed to save local/cloud safety snapshot:", error);
    });
  }, 10_000);
}

async function runAutoSyncPush(): Promise<void> {
  const state = useAuthStore.getState();
  if (!state.user || state.syncMode !== "auto") return;
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
  if (backgroundSyncRunning) {
    autoSyncPending = true;
    return;
  }
  if (autoSyncRunning) {
    autoSyncPending = true;
    return;
  }

  autoSyncRunning = true;
  useAuthStore.setState({ syncStatus: "syncing", error: null });
  try {
    await pushLocalSnapshotToCloud(state.user.id);
    useAuthStore.setState({ syncStatus: "success", lastSyncAt: Date.now(), error: null });
  } catch (err) {
    console.error("[Auth] Auto sync failed:", err);
    const message = getErrorMessage(err, "Sync failed");
    useAuthStore.setState({ syncStatus: "error", error: message });
  } finally {
    autoSyncRunning = false;
    if (autoSyncPending) {
      autoSyncPending = false;
      scheduleAutoSync();
    }
  }
}

function ensureAutoSyncInterval(): void {
  if (typeof window === "undefined") return;
  const state = useAuthStore.getState();
  if (!state.user || state.syncMode !== "auto") return;
  if (autoSyncInterval) return;
  autoSyncInterval = setInterval(() => {
    void runAutoSyncPush();
  }, AUTO_SYNC_INTERVAL_MS);
}

function stopAutoSyncInterval(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
  if (localSafetySnapshotTimer) {
    clearTimeout(localSafetySnapshotTimer);
    localSafetySnapshotTimer = null;
  }
}

function isAutoSyncEnabled(): boolean {
  try {
    return loadSyncMode() === "auto";
  } catch {
    return true;
  }
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

// Store

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
    set({ isLoading: true, user: null, isLoggedIn: false, error: null });
    stopAutoSyncInterval();
    ensureAutoSyncListener();
    const syncMode = loadSyncMode();
    set({ syncMode });

    // Initialize Supabase browser client (fetches config from API)
    const configured = await initBrowserSupabase();
    if (!configured) {
      // Supabase is not configured, so auth features remain disabled.
      set({ isLoading: false });
      return;
    }

    try {
      const client = getBrowserSupabaseClient();
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) {
        clearSession();
        const message = error?.message || "Auth session missing";
        if (isMissingAuthSessionError(message)) {
          clearBrowserSupabaseSessionCache();
          set({ isLoading: false, error: null });
        } else {
          set({
            isLoading: false,
            error: `暂时无法验证登录状态，本地数据仍可正常使用：${summarizeAuthError(message)}`,
          });
        }
        return;
      }

      const user = mapSupabaseUser(data.user as unknown as Record<string, unknown>);
      saveSession(user);
      await upsertUser(user);
      set({ user, isLoggedIn: true, isLoading: false, error: null });
      if (isAutoSyncEnabled()) {
        scheduleStartupSync(user.id);
      }
      return;
    } catch (error) {
      clearSession();
      set({
        isLoading: false,
        error: `暂时无法验证登录状态，本地数据仍可正常使用：${getErrorMessage(error, "登录状态验证失败")}`,
      });
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });

    try {
      const configured = await initBrowserSupabase();
      if (!configured) {
        throw new Error("Supabase is not configured for this app. Open login settings and fill Supabase URL + anon key.");
      }

      if (isChromeExtension()) {
        await loginWithGoogleExtension();
      } else {
        await loginWithGoogleWeb();
      }
    } catch (err) {
      const message = getErrorMessage(err, "登录失败");
      set({ error: message, isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    stopAutoSyncInterval();
    let logoutError: string | null = null;
    let stopRemoteRefresh: (() => void) | null = null;

    try {
      const client = getBrowserSupabaseClient();
      stopRemoteRefresh = () => client.auth.stopAutoRefresh();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) {
        logoutError = summarizeAuthError(error.message);
      }
    } catch (error) {
      logoutError = getErrorMessage(error, "远端退出失败");
    } finally {
      stopRemoteRefresh?.();
      clearBrowserSupabaseSessionCache();
      clearSession();
      set({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        syncStatus: "idle",
        localSavedAt: null,
        lastSyncAt: null,
        error: logoutError
          ? `远端退出未确认，但本地会话已清除：${logoutError}`
          : null,
      });
    }
  },

  manualSync: async (options) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ syncStatus: "syncing", error: null });
    try {
      await syncData(user.id);
      if (options?.reloadView !== false) {
        await useAppStore.getState().loadData({ showLoading: false, preserveOnCollapse: true });
      }
      set({ syncStatus: "success", lastSyncAt: Date.now(), localSavedAt: null, error: null });
      ensureAutoSyncInterval();
    } catch (err) {
      console.error("[Auth] Manual sync failed:", err);
      const message = getErrorMessage(err, "Sync failed");
      set({ syncStatus: "error", error: message });
      if (options?.throwOnError) throw err;
    }
  },

  setSyncMode: (mode) => {
    try {
      localStorage.setItem(SYNC_MODE_KEY, mode);
      localStorage.setItem(SYNC_MODE_VERSION_KEY, "2");
    } catch {
      // ignore
    }
    set({ syncMode: mode });
    const user = useAuthStore.getState().user;
    if (mode === "auto" && user) {
      scheduleAutoSync();
    } else {
      stopAutoSyncInterval();
    }
  },

  setSyncStatus: (status: SyncStatus) => {
    set({ syncStatus: status });
  },

  setLastSyncAt: (timestamp: number) => {
    set({ lastSyncAt: timestamp, syncStatus: "success" });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Web version: Supabase Auth OAuth

async function loginWithGoogleWeb(): Promise<void> {
  const client = getBrowserSupabaseClient();

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window !== "undefined" ? window.location.origin : "",
    },
  });

  if (error) {
    throw new Error(`Google 登录失败: ${error.message}`);
  }

  // After redirect back, Supabase will have the session.
  // The initialize() function will pick it up on page reload.
}

// Extension version: chrome.identity.launchWebAuthFlow

async function loginWithGoogleExtension(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.identity) {
    throw new Error("Chrome Identity API is unavailable. Check the identity permission.");
  }

  const client = getBrowserSupabaseClient();
  const redirectTo = chrome.identity.getRedirectURL("auth");
  const { data: oauthData, error: oauthError } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError) {
    throw new Error(`Google login failed: ${oauthError.message}`);
  }
  if (!oauthData.url) {
    throw new Error("Google OAuth did not return a login URL.");
  }

  const finalUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({
      url: oauthData.url,
      interactive: true,
    }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!responseUrl) {
        reject(new Error("Google OAuth did not return to the extension."));
        return;
      }
      resolve(responseUrl);
    });
  });

  const code = new URL(finalUrl).searchParams.get("code");
  if (!code) {
    const callbackUrl = new URL(finalUrl);
    const error = callbackUrl.searchParams.get("error") || callbackUrl.hash.match(/error=([^&]+)/)?.[1];
    const errorDescription =
      callbackUrl.searchParams.get("error_description")
      || callbackUrl.hash.match(/error_description=([^&]+)/)?.[1];
    if (error || errorDescription) {
      throw new Error(
        `Google OAuth callback error: ${decodeURIComponent(errorDescription || error || "unknown")}`
      );
    }
    throw new Error("Google OAuth callback is missing the code parameter. Check Supabase Redirect URLs and PKCE settings.");
  }

  const { data: sessionData, error: sessionError } = await client.auth.exchangeCodeForSession(code);
  if (sessionError) {
    throw new Error(`Google OAuth session exchange failed: ${sessionError.message}`);
  }
  if (!sessionData.user) {
    throw new Error("Google OAuth did not return a user.");
  }

  const user = mapSupabaseUser(sessionData.user as unknown as Record<string, unknown>);
  await upsertUser(user);
  saveSession(user);
  useAuthStore.setState({ user, isLoggedIn: true, isLoading: false });
  if (isAutoSyncEnabled()) {
    await triggerSync(user.id);
  }
}

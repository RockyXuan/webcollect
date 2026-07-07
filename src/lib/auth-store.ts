/**
 * Auth Store 鈥?Google OAuth login & session management
 * 
 * Supports two platforms:
 * 1. Web (Next.js): Uses Supabase Auth SDK with browser redirect
 * 2. Chrome Extension: Uses chrome.identity.launchWebAuthFlow
 * 
 * After login:
 * - Creates/updates user record in Supabase `users` table
 * - Triggers data sync (local 鈫?cloud)
 */

import { create } from "zustand";
import { getBrowserSupabaseClient, initBrowserSupabase } from "@/lib/supabase-browser";
import { isChromeExtension } from "@/lib/platform";
import { saveCloudWorkspaceSnapshot } from "@/lib/cloud-snapshots";
import { pushLocalSnapshotToCloud, syncData } from "@/lib/sync";
import { useAppStore } from "@/lib/store";
import { getLocalSnapshotSyncedAt, getLocalSnapshotUpdatedAt } from "@/lib/db";
import { createLocalDataSnapshot } from "@/lib/local-snapshots";

// 鈹€鈹€ Types 鈹€鈹€

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
}

export type SyncStatus = "idle" | "queued" | "syncing" | "success" | "error";
export type SyncMode = "manual" | "auto";
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

// 鈹€鈹€ Helper: upsert user record 鈹€鈹€

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

// 鈹€鈹€ Helper: restore session from localStorage 鈹€鈹€

const SESSION_KEY = "webcollect_auth_session";
const SYNC_MODE_KEY = "webcollect_sync_mode";
const SYNC_MODE_VERSION_KEY = "webcollect_sync_mode_version";
const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000;
const AUTO_SYNC_MAX_DELAY_MS = 5 * 60 * 1000;
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

function saveSession(user: AuthUser): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // localStorage might be unavailable
  }
}

function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// 鈹€鈹€ Helper: map Supabase user to AuthUser 鈹€鈹€

function mapSupabaseUser(supabaseUser: Record<string, unknown>): AuthUser {
  const meta = (supabaseUser.user_metadata || {}) as Record<string, unknown>;
  return {
    id: supabaseUser.id as string,
    email: (supabaseUser.email as string) || "",
    displayName: (meta.full_name as string) || (meta.name as string) || "",
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || "",
  };
}

// 鈹€鈹€ Helper: trigger background sync 鈹€鈹€

async function triggerSync(userId: string): Promise<void> {
  const store = useAuthStore;
  if (backgroundSyncRunning) return;
  backgroundSyncRunning = true;
  cloudRestoreRunning = true;
  store.setState({ syncStatus: "syncing", localSavedAt: null });

  try {
    await syncData(userId);
    await useAppStore.getState().loadData({ showLoading: false, preserveOnCollapse: true });
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
        await saveCloudWorkspaceSnapshot(user.id, snapshot, {
          kind: "system",
          source: "auto-local-change",
        });
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

// 鈹€鈹€ Store 鈹€鈹€

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
    set({ isLoading: true });
    ensureAutoSyncListener();
    const syncMode = loadSyncMode();
    set({ syncMode });

    // Initialize Supabase browser client (fetches config from API)
    const configured = await initBrowserSupabase();
    if (!configured) {
      // Supabase not configured 鈥?auth features disabled
      set({ isLoading: false });
      return;
    }

    // Try to restore session from localStorage first
    const cached = loadSession();
    if (cached) {
      set({ user: cached, isLoggedIn: true, isLoading: false });
      if (isAutoSyncEnabled()) {
        void triggerSync(cached.id);
      }
      return;
    }

    // For Web version, try to get session from Supabase
    if (!isChromeExtension()) {
      try {
        const client = getBrowserSupabaseClient();
        const { data } = await client.auth.getSession();
        if (data.session?.user) {
          const user = mapSupabaseUser(data.session.user as unknown as Record<string, unknown>);
          saveSession(user);
          await upsertUser(user);
          set({ user, isLoggedIn: true, isLoading: false });
          if (isAutoSyncEnabled()) {
            void triggerSync(user.id);
          }
          return;
        }
      } catch {
        // Session restore failed, user is not logged in
      }
    }

    set({ isLoading: false });
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
      const message = getErrorMessage(err, "鐧诲綍澶辫触");
      set({ error: message, isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      // Sign out from Supabase (Web only, extension doesn't maintain Supabase session)
      if (!isChromeExtension()) {
        try {
          const client = getBrowserSupabaseClient();
          await client.auth.signOut();
        } catch {
          // ignore
        }
      }
    } finally {
      clearSession();
      stopAutoSyncInterval();
      set({ user: null, isLoggedIn: false, isLoading: false, syncStatus: "idle", localSavedAt: null, lastSyncAt: null });
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

// 鈹€鈹€ Web version: Supabase Auth OAuth 鈹€鈹€

async function loginWithGoogleWeb(): Promise<void> {
  const client = getBrowserSupabaseClient();

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window !== "undefined" ? window.location.origin : "",
    },
  });

  if (error) {
    throw new Error(`Google 鐧诲綍澶辫触: ${error.message}`);
  }

  // After redirect back, Supabase will have the session.
  // The initialize() function will pick it up on page reload.
}

// 鈹€鈹€ Extension version: chrome.identity.launchWebAuthFlow 鈹€鈹€

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

/**
 * Auth Store — Google OAuth login & session management
 * 
 * Supports two platforms:
 * 1. Web (Next.js): Uses Supabase Auth SDK with browser redirect
 * 2. Chrome Extension: Uses chrome.identity.launchWebAuthFlow
 * 
 * After login:
 * - Creates/updates user record in Supabase `users` table
 * - Triggers data sync (local ↔ cloud)
 */

import { create } from "zustand";
import { getBrowserSupabaseClient, initBrowserSupabase } from "@/lib/supabase-browser";
import { isChromeExtension } from "@/lib/platform";
import { syncData } from "@/lib/sync";
import { useAppStore } from "@/lib/store";

// ── Types ──

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
}

export type SyncStatus = "idle" | "syncing" | "success" | "error";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncAt: (timestamp: number) => void;
  clearError: () => void;
}

// ── Helper: upsert user record ──

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

// ── Helper: restore session from localStorage ──

const SESSION_KEY = "webcollect_auth_session";

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

// ── Helper: map Supabase user to AuthUser ──

function mapSupabaseUser(supabaseUser: Record<string, unknown>): AuthUser {
  const meta = (supabaseUser.user_metadata || {}) as Record<string, unknown>;
  return {
    id: supabaseUser.id as string,
    email: (supabaseUser.email as string) || "",
    displayName: (meta.full_name as string) || (meta.name as string) || "",
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || "",
  };
}

// ── Helper: trigger background sync ──

function triggerSync(userId: string): void {
  const store = useAuthStore;
  store.setState({ syncStatus: "syncing" });

  syncData(userId)
    .then(async () => {
      // Reload local data after sync
      await useAppStore.getState().loadData();
      store.setState({ syncStatus: "success", lastSyncAt: Date.now() });
    })
    .catch((err) => {
      console.error("[Auth] Sync failed:", err);
      store.setState({ syncStatus: "error" });
    });
}

// ── Store ──

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,
  syncStatus: "idle",
  lastSyncAt: null,
  error: null,

  initialize: async () => {
    set({ isLoading: true });

    // Initialize Supabase browser client (fetches config from API)
    const configured = await initBrowserSupabase();
    if (!configured) {
      // Supabase not configured — auth features disabled
      set({ isLoading: false });
      return;
    }

    // Try to restore session from localStorage first
    const cached = loadSession();
    if (cached) {
      set({ user: cached, isLoggedIn: true, isLoading: false });
      // Trigger background sync after session restore
      triggerSync(cached.id);
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
          // Trigger background sync after session restore
          triggerSync(user.id);
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
      if (isChromeExtension()) {
        await loginWithGoogleExtension();
      } else {
        await loginWithGoogleWeb();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败";
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
      set({ user: null, isLoggedIn: false, isLoading: false, syncStatus: "idle", lastSyncAt: null });
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

// ── Web version: Supabase Auth OAuth ──

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

// ── Extension version: chrome.identity.launchWebAuthFlow ──

async function loginWithGoogleExtension(): Promise<void> {
  // This uses the chrome.identity API to get a Google OAuth token,
  // then exchanges it for a Supabase session.
  //
  // Prerequisites:
  // 1. manifest.json must have "identity" permission
  // 2. Google Cloud Console: OAuth client ID with redirect URI
  //    chrome-extension://<EXTENSION_ID>/*
  //
  // For the initial personal version, we'll use a simpler approach:
  // Use chrome.identity.getAuthToken to get a Google access token,
  // then sign in to Supabase with that token.

  if (!chrome?.identity) {
    throw new Error("Chrome Identity API 不可用，请确保扩展有 identity 权限");
  }

  // Get Google auth token
  const token = await new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!result || !result.token) {
        reject(new Error("未获取到 Google 授权令牌"));
        return;
      }
      resolve(result.token);
    });
  });

  // Get user info from Google
  const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!googleRes.ok) {
    throw new Error("获取 Google 用户信息失败");
  }

  const googleUser = await googleRes.json() as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };

  // Sign in to Supabase using the Google ID token
  // Re-use the same access token for signInWithIdToken
  const client = getBrowserSupabaseClient();
  const { data, error } = await client.auth.signInWithIdToken({
    provider: "google",
    token: token,
  });

  if (error) {
    // Fallback: create a user record manually using Google user info
    // This works if we can't get Supabase to verify the Google token
    const user: AuthUser = {
      id: googleUser.sub,
      email: googleUser.email,
      displayName: googleUser.name || "",
      avatarUrl: googleUser.picture || "",
    };
    await upsertUser(user);
    saveSession(user);
    useAuthStore.setState({ user, isLoggedIn: true, isLoading: false });
    // Trigger sync after login
    triggerSync(user.id);
    return;
  }

  if (data.user) {
    const user = mapSupabaseUser(data.user as unknown as Record<string, unknown>);
    await upsertUser(user);
    saveSession(user);
    useAuthStore.setState({ user, isLoggedIn: true, isLoading: false });
    // Trigger sync after login
    triggerSync(user.id);
  }
}

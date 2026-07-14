/**
 * Supabase Browser Client — lightweight client for browser/extension usage
 * 
 * This client is safe to import from client components in Next.js and Chrome
 * extensions. It uses only the public anon key plus the signed-in user's token.
 * 
 * Configuration is fetched from /api/supabase-config at runtime (Web)
 * or from the extension's public configuration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_PUBLIC_SUPABASE_CONFIG,
  type PublicSupabaseConfig,
} from '@/lib/supabase-public-config';

type SupabaseConfig = PublicSupabaseConfig;

export const EXTENSION_STORAGE_KEYS = {
  url: "webcollect_supabase_url",
  anonKey: "webcollect_supabase_anon_key",
} as const;

export const DEFAULT_EXTENSION_CONFIG: SupabaseConfig = DEFAULT_PUBLIC_SUPABASE_CONFIG;

let _config: SupabaseConfig | null = null;
let _client: SupabaseClient | null = null;
let _testClient: SupabaseClient | null = null;

function isExtensionRuntime(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function getBuildTimeEnv(key: string): string {
  try {
    const env = (import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }).env;
    return env?.[key] || "";
  } catch {
    return "";
  }
}

async function loadExtensionConfig(): Promise<SupabaseConfig | null> {
  if (!isExtensionRuntime() || !chrome.storage?.local) return null;

  const stored = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(
      [EXTENSION_STORAGE_KEYS.url, EXTENSION_STORAGE_KEYS.anonKey],
      (result) => resolve(result)
    );
  });

  const storedUrl = String(stored[EXTENSION_STORAGE_KEYS.url] || "");
  const storedAnonKey = String(stored[EXTENSION_STORAGE_KEYS.anonKey] || "");
  const envUrl = getBuildTimeEnv("VITE_WEBCOLLECT_SUPABASE_URL") || getBuildTimeEnv("VITE_SUPABASE_URL");
  const envAnonKey =
    getBuildTimeEnv("VITE_WEBCOLLECT_SUPABASE_ANON_KEY")
    || getBuildTimeEnv("VITE_SUPABASE_ANON_KEY");

  const url = String(
    storedUrl
      || envUrl
      || ""
  );
  const anonKey = String(
    storedAnonKey
      || envAnonKey
      || ""
  );

  if (!url || !anonKey) return DEFAULT_EXTENSION_CONFIG;
  if (url === DEFAULT_EXTENSION_CONFIG.url && anonKey !== DEFAULT_EXTENSION_CONFIG.anonKey && !envAnonKey) {
    await chrome.storage.local.set({
      [EXTENSION_STORAGE_KEYS.url]: DEFAULT_EXTENSION_CONFIG.url,
      [EXTENSION_STORAGE_KEYS.anonKey]: DEFAULT_EXTENSION_CONFIG.anonKey,
    });
    return DEFAULT_EXTENSION_CONFIG;
  }
  return { url, anonKey };
}

/**
 * Load Supabase config from the server API route (Web version)
 * or from environment (Extension version — handled differently).
 */
async function loadConfig(): Promise<SupabaseConfig> {
  if (_config) return _config;

  const extensionConfig = await loadExtensionConfig();
  if (extensionConfig) {
    _config = extensionConfig;
    return _config;
  }

  try {
    const res = await fetch('/api/supabase-config');
    if (res.ok) {
      const data = await res.json() as SupabaseConfig;
      if (data.url && data.anonKey) {
        _config = data;
        return _config;
      }
    }
  } catch {
    // Fetch might fail in extension or during SSR
  }

  // Return empty config — auth features will be disabled
  return { url: '', anonKey: '' };
}

/**
 * Set config directly (used by extension or after initial fetch)
 */
export function setSupabaseConfig(config: SupabaseConfig): void {
  const changed = _config?.url !== config.url || _config?.anonKey !== config.anonKey;
  _config = config;
  if (changed && _client) {
    _client.auth.stopAutoRefresh();
    _client = null;
  }
}

/**
 * Initialize the browser client by loading config first.
 * Must be called before getBrowserSupabaseClient().
 */
export async function initBrowserSupabase(): Promise<boolean> {
  if (_testClient) return true;
  const config = await loadConfig();
  return !!(config.url && config.anonKey);
}

/**
 * Get a Supabase client for browser-side usage.
 * Uses anon key (safe for client-side) with optional user token for RLS.
 */
export function getBrowserSupabaseClient(token?: string): SupabaseClient {
  if (!token && _testClient) return _testClient;
  if (!token && _client) return _client;

  const url = _config?.url || '';
  const anonKey = _config?.anonKey || '';

  if (!url || !anonKey) {
    console.warn('[Supabase Browser] Not configured yet. Call initBrowserSupabase() first.');
  }

  const globalOptions: Record<string, unknown> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  const client = createClient(url, anonKey, {
    global: globalOptions,
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  if (!token) {
    _client = client;
  }

  return client;
}

function getSupabaseAuthStorageKey(): string | null {
  try {
    const projectRef = new URL(_config?.url || "").hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

export function clearBrowserSupabaseSessionCache(): void {
  const storageKey = getSupabaseAuthStorageKey();
  if (storageKey && typeof localStorage !== "undefined") {
    try {
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((key): key is string => Boolean(key));
      for (const key of keys) {
        if (
          key === storageKey
          || key === `${storageKey}-code-verifier`
          || key.startsWith(`${storageKey}.`)
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Local cleanup is best-effort in restricted browser contexts.
    }
  }
}

export function __setBrowserSupabaseClientForTest(client: SupabaseClient): void {
  _client?.auth.stopAutoRefresh();
  _testClient = client;
  _config = { url: "https://webcollect.test", anonKey: "test-anon-key" };
  _client = null;
}

export function __resetBrowserSupabaseForTest(): void {
  _client?.auth.stopAutoRefresh();
  _testClient = null;
  _config = null;
  _client = null;
}

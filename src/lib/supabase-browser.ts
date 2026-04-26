/**
 * Supabase Browser Client — lightweight client for browser/extension usage
 * 
 * Unlike the full supabase-client.ts (which uses Node.js modules like
 * child_process, require('dotenv')), this client is safe to import from
 * client components in Next.js and Chrome extensions.
 * 
 * Configuration is fetched from /api/supabase-config at runtime (Web)
 * or from environment variables (Extension).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let _config: SupabaseConfig | null = null;
let _client: SupabaseClient | null = null;

/**
 * Load Supabase config from the server API route (Web version)
 * or from environment (Extension version — handled differently).
 */
async function loadConfig(): Promise<SupabaseConfig> {
  if (_config) return _config;

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
  _config = config;
  // Reset client so it's recreated with new config
  _client = null;
}

/**
 * Initialize the browser client by loading config first.
 * Must be called before getBrowserSupabaseClient().
 */
export async function initBrowserSupabase(): Promise<boolean> {
  const config = await loadConfig();
  return !!(config.url && config.anonKey);
}

/**
 * Get a Supabase client for browser-side usage.
 * Uses anon key (safe for client-side) with optional user token for RLS.
 */
export function getBrowserSupabaseClient(token?: string): SupabaseClient {
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
    },
  });

  if (!token) {
    _client = client;
  }

  return client;
}

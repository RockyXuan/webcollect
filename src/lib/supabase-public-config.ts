export interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Public browser credentials for WebCollect's RLS-protected Supabase project.
 * This is the same non-secret configuration shipped in the Chrome extension.
 */
export const DEFAULT_PUBLIC_SUPABASE_CONFIG: PublicSupabaseConfig = {
  url: "https://qxlkigwadvgkoeqdojxx.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bGtpZ3dhZHZna29lcWRvanh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTc3MTgsImV4cCI6MjA5MjkzMzcxOH0.wY1et2-efStTxRXnepWs7PWjTyii1_ZX0glUGrC_VpM",
};

export function resolvePublicSupabaseConfig(
  configuredUrl = "",
  configuredAnonKey = ""
): PublicSupabaseConfig {
  const url = configuredUrl.trim();
  const anonKey = configuredAnonKey.trim();
  if (url && anonKey) return { url, anonKey };
  return DEFAULT_PUBLIC_SUPABASE_CONFIG;
}

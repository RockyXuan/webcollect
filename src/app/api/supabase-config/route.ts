/**
 * API route that provides Supabase configuration to the browser client.
 * The anon key is safe to expose: Supabase designs it for browser clients
 * protected by Row Level Security. Secrets must never be returned here.
 */

import { NextResponse } from "next/server";
import { resolvePublicSupabaseConfig } from "@/lib/supabase-public-config";

export async function GET() {
  const { url, anonKey } = resolvePublicSupabaseConfig(
    process.env.COZE_SUPABASE_URL,
    process.env.COZE_SUPABASE_ANON_KEY
  );

  return NextResponse.json(
    { url, anonKey },
    { headers: { "Cache-Control": "no-store" } }
  );
}

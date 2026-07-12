/**
 * API route that provides Supabase configuration to the browser client.
 * The anon key is safe to expose: Supabase designs it for browser clients
 * protected by Row Level Security. Secrets must never be returned here.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.COZE_SUPABASE_URL || "";
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { url, anonKey },
    { headers: { "Cache-Control": "no-store" } }
  );
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "supabase-runtime-retired" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

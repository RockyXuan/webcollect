import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect url
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const { getSupabaseClient } = await import("@/storage/database/supabase-client");
    const client = getSupabaseClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

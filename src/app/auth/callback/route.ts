import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect url
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const client = getSupabaseClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

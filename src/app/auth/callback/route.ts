import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const target = new URL(safeNext, origin);

  if (code) {
    target.searchParams.set("code", code);
    return NextResponse.redirect(target);
  }

  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (error) {
    target.searchParams.set("auth_error", error);
  }
  if (errorDescription) {
    target.searchParams.set("auth_error_description", errorDescription);
  }

  return NextResponse.redirect(target);
}

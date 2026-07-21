import { NextResponse } from "next/server";

export async function POST(_request?: Request) {
  void _request;
  return NextResponse.json(
    { error: "web-google-drive-auth-unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

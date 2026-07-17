import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { extractKnowledgeText } from "../../../../../shared/metadata-extractor.js";
import { RemoteUrlPolicyError } from "../../../../../shared/remote-url-policy.js";
import { fetchRemoteText } from "@/lib/safe-remote-fetch";
import { resolvePublicSupabaseConfig } from "@/lib/supabase-public-config";

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
}

async function isAuthenticated(request: Request): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  const { url, anonKey } = resolvePublicSupabaseConfig(
    process.env.COZE_SUPABASE_URL,
    process.env.COZE_SUPABASE_ANON_KEY,
  );
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user?.id);
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "authentication-required" }, { status: 401 });
  }

  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url-required" }, { status: 400 });
    }

    const { response, text: html, url: resolvedUrl } = await fetchRemoteText(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0",
        Accept: "text/html,application/xhtml+xml;q=0.9",
      },
      timeoutMs: 8_000,
      maxRedirects: 4,
      maxBytes: 1_500_000,
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
    });

    if (!response.ok) {
      return NextResponse.json({ error: `upstream-${response.status}` }, { status: 502 });
    }

    return NextResponse.json(
      { resolvedUrl, ...extractKnowledgeText(html, { maxChars: 6000 }) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RemoteUrlPolicyError) {
      return NextResponse.json({ error: "remote-url-rejected" }, { status: 400 });
    }
    return NextResponse.json({ error: "knowledge-fetch-failed" }, { status: 502 });
  }
}

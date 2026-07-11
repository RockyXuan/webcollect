import { NextResponse } from "next/server";
import { extractMetadataFromHtml } from "../../../../shared/metadata-extractor.js";
import { RemoteUrlPolicyError } from "../../../../shared/remote-url-policy.js";
import { fetchRemoteText } from "@/lib/safe-remote-fetch";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const { response: res, text: html, url: resolvedUrl } = await fetchRemoteText(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0",
        Accept: "text/html,application/xhtml+xml;q=0.9",
      },
      timeoutMs: 8_000,
      maxRedirects: 4,
      maxBytes: 1_500_000,
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${res.status}` },
        { status: 502 }
      );
    }

    const metadata = extractMetadataFromHtml(html, resolvedUrl);

    // Extract domain for favicon APIs
    let domain = "";
    try {
      domain = new URL(resolvedUrl).hostname;
    } catch {
      domain = "";
    }

    // Favicon API fallbacks (no CORS for img tags)
    const faviconApis = domain
      ? [
          `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        ]
      : [];

    return NextResponse.json({
      ...metadata,
      domain,
      faviconApis,
    });
  } catch (err) {
    if (err instanceof RemoteUrlPolicyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

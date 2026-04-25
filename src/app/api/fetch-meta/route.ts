import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const getMeta = (name: string) =>
      $(`meta[name="${name}"]`).attr("content") ||
      $(`meta[property="${name}"]`).attr("content") ||
      "";

    const title =
      $("title").text() || getMeta("og:title") || getMeta("twitter:title");
    const description =
      getMeta("description") || getMeta("og:description") || getMeta("twitter:description");
    let image = getMeta("og:image") || getMeta("twitter:image");

    // Resolve relative image URLs
    if (image && !image.startsWith("http")) {
      try {
        const base = new URL(url);
        image = new URL(image, base).toString();
      } catch {
        image = "";
      }
    }

    // Extract domain for favicon APIs
    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = "";
    }

    // Fallback favicon from HTML
    let favicon = "";
    const faviconRel =
      $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href");
    if (faviconRel) {
      try {
        const base = new URL(url);
        favicon = new URL(faviconRel, base).toString();
      } catch {
        favicon = "";
      }
    }

    // Favicon API fallbacks (no CORS for img tags)
    const faviconApis = domain
      ? [
          `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        ]
      : [];

    return NextResponse.json({
      title: title.trim() || "未命名网页",
      description: description.trim() || "",
      image,
      favicon,
      domain,
      faviconApis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const rawTitle =
      getMeta("og:title") || getMeta("twitter:title") || $("title").text();
    const title = compactTitleForCapture(rawTitle, url);
    const description =
      getMeta("description") ||
      getMeta("og:description") ||
      getMeta("twitter:description") ||
      extractDescriptionFromTitle(rawTitle, url) ||
      extractReadableDescription($, rawTitle, url);
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

function normalizeMetadataText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "") || parsed.pathname || url;
  } catch {
    return url;
  }
}

function formatDomainTitle(value: string): string {
  const trimmed = normalizeMetadataText(value);
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed) && trimmed === trimmed.toLowerCase()) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

function titlePartMatchesSite(part: string, url: string): boolean {
  const normalizedPart = normalizeMetadataText(part).toLowerCase().replace(/^www\./, "");
  const host = titleFromUrl(url).toLowerCase();
  if (!normalizedPart || !host) return false;
  if (normalizedPart === host) return true;
  return normalizedPart === host.split(".")[0];
}

function compactTitleForCapture(title: string, url: string): string {
  const normalizedTitle = normalizeMetadataText(title);
  const fallback = formatDomainTitle(titleFromUrl(url));
  if (!normalizedTitle) return fallback;
  const delimiterMatch = normalizedTitle.match(/^(.{1,48}?)(?:\s+[—–-]\s+|\s+\|\s+|:\s+)(.{2,})$/);
  if (delimiterMatch && titlePartMatchesSite(delimiterMatch[1], url)) {
    return formatDomainTitle(delimiterMatch[1]);
  }
  const sentence = normalizedTitle
    .split(/[。！？!?]/)
    .map((part) => part.trim())
    .find(Boolean) || normalizedTitle;
  return sentence.length > 48 ? `${sentence.slice(0, 48)}...` : sentence;
}

function extractDescriptionFromTitle(title: string, url: string): string {
  const normalizedTitle = normalizeMetadataText(title);
  const delimiterMatch = normalizedTitle.match(/^(.{1,48}?)(?:\s+[—–-]\s+|\s+\|\s+|:\s+)(.{2,180})$/);
  if (!delimiterMatch || !titlePartMatchesSite(delimiterMatch[1], url)) return "";
  return normalizeMetadataText(delimiterMatch[2]);
}

function extractReadableDescription($: cheerio.CheerioAPI, title: string, url: string): string {
  const fromTitle = extractDescriptionFromTitle(title, url);
  if (fromTitle) return fromTitle;
  $("script, style, svg, noscript, nav, header, footer").remove();
  const lines = $("main, article, body")
    .text()
    .split(/\n+/)
    .map((line) => normalizeMetadataText(line))
    .filter((line) => line.length >= 4)
    .filter((line) => !/^(features|showcase|platforms|docs|faq|english|简体中文|繁體中文)$/i.test(line));
  for (let index = 0; index < lines.length - 1; index += 1) {
    const joined = normalizeMetadataText(`${lines[index]} ${lines[index + 1]}`);
    if (/^AI writes it\.?\s+docu\.md does the rest\.?$/i.test(joined)) return joined;
  }
  const compactTitle = compactTitleForCapture(title, url).toLowerCase();
  return lines.find((line) => {
    const lower = line.toLowerCase();
    return lower !== compactTitle && line.length >= 24 && line.length <= 180;
  }) || "";
}

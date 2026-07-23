import { NextResponse } from "next/server";
import { extractMetadataFromHtml } from "../../../../shared/metadata-extractor.js";
import {
  buildGitHubReadmeCandidateUrls,
  extractGitHubReadmeSummary,
  parseGitHubRepositoryUrl,
} from "../../../../shared/github-repository.js";
import { RemoteUrlPolicyError } from "../../../../shared/remote-url-policy.js";
import { fetchRemoteText } from "@/lib/safe-remote-fetch";

async function fetchGitHubReadmeDescription(url: string): Promise<string> {
  const repository = parseGitHubRepositoryUrl(url);
  if (!repository) return "";
  const deadline = Date.now() + 6_000;
  for (const candidate of buildGitHubReadmeCandidateUrls(repository)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const result = await fetchRemoteText(candidate, {
        headers: {
          Accept: "text/plain,text/markdown,text/x-rst,text/asciidoc;q=0.9",
        },
        timeoutMs: Math.min(2_500, remaining),
        maxRedirects: 2,
        maxBytes: 262_144,
        allowedContentTypes: ["text/plain", "text/markdown", "text/x-rst", "text/asciidoc"],
      });
      if (!result.response.ok) continue;
      const summary = extractGitHubReadmeSummary(result.text, { maxLength: 280 });
      if (summary) return summary;
    } catch {
      // Continue through common README names before using page metadata.
    }
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let resolvedUrl = url;
    let metadata = { title: "", description: "", image: "", favicon: "" };
    let pageFetchError: unknown = null;
    try {
      const result = await fetchRemoteText(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0",
          Accept: "text/html,application/xhtml+xml;q=0.9",
        },
        timeoutMs: 8_000,
        maxRedirects: 4,
        maxBytes: 1_500_000,
        allowedContentTypes: ["text/html", "application/xhtml+xml"],
      });
      resolvedUrl = result.url;
      if (result.response.ok) {
        metadata = extractMetadataFromHtml(result.text, resolvedUrl);
      } else {
        pageFetchError = new Error(`Failed to fetch: ${result.response.status}`);
      }
    } catch (error) {
      if (error instanceof RemoteUrlPolicyError) throw error;
      pageFetchError = error;
    }

    const repository = parseGitHubRepositoryUrl(resolvedUrl) || parseGitHubRepositoryUrl(url);
    if (!repository && pageFetchError) throw pageFetchError;
    const readmeDescription = repository
      ? await fetchGitHubReadmeDescription(url)
      : "";

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
      title: repository?.repository || metadata.title,
      description: readmeDescription || metadata.description,
      descriptionSource: readmeDescription ? "github-readme" : "page",
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

const GITHUB_HOST = "github.com";
const README_FILENAMES = [
  "README.md",
  "readme.md",
  "README.rst",
  "README.adoc",
  "README.txt",
];
const RESERVED_ROOT_PATHS = new Set([
  "about",
  "apps",
  "collections",
  "contact",
  "customer-stories",
  "enterprise",
  "events",
  "explore",
  "features",
  "issues",
  "login",
  "marketplace",
  "new",
  "notifications",
  "orgs",
  "pricing",
  "readme",
  "search",
  "security",
  "settings",
  "signup",
  "site",
  "sponsors",
  "topics",
  "trending",
]);

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeInlineText(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWord(value, maxLength) {
  const normalized = normalizeInlineText(value);
  if (normalized.length <= maxLength) return normalized;
  let shortened = normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd();
  const lastSpace = shortened.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.55) shortened = shortened.slice(0, lastSpace);
  return `${shortened}...`;
}

function decodeCommonEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'");
}

function cleanMarkdownInline(value) {
  return normalizeInlineText(decodeCommonEntities(
    String(value || "")
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\((?:[^()]|\([^)]*\))*\)/g, "$1")
      .replace(/<https?:\/\/[^>]+>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[`*_~]/g, "")
      .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
  ));
}

function isReadmeNoiseLine(value) {
  const line = String(value || "").trim();
  if (!line) return true;
  if (/^#{1,6}\s/.test(line)) return true;
  if (/^[=\-_*~^#\s]{3,}$/.test(line)) return true;
  if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) return true;
  if (/^\s*\|.*\|\s*$/.test(line) || /^\s*:?-{3,}:?\s*(?:\|.*)?$/.test(line)) return true;
  if (/^\s*>/.test(line)) return true;
  if (/^\s*(?:\[!\[|!\[|<img|<picture|<source|<svg|<a\s)/i.test(line)) return true;
  if (/^\s*\.\.\s+(?:image|figure|contents|toctree)::/i.test(line)) return true;
  if (/(?:shields\.io|badge|build status|coverage|license)\b/i.test(line) && /https?:\/\//i.test(line)) return true;
  return false;
}

function isUsefulReadmeParagraph(value) {
  const text = normalizeInlineText(value);
  if (!text) return false;
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const latinWords = text.match(/[A-Za-z]{2,}/g) || [];
  if (cjkCount < 8 && (text.length < 24 || latinWords.length < 4)) return false;
  if (/^(?:table of contents|contents|installation|getting started|quick start|usage|documentation|contributing|license)$/i.test(text)) {
    return false;
  }
  if (/^(?:npm|pnpm|yarn|bun|pip|cargo|docker)\s+(?:install|add|run|start)\b/i.test(text)) return false;
  const urlCount = (text.match(/https?:\/\//gi) || []).length;
  if (urlCount > 1 || (urlCount === 1 && text.length < 80)) return false;
  return true;
}

/**
 * Identify a public GitHub repository URL without confusing GitHub product
 * routes or owner profile pages for repositories.
 */
export function parseGitHubRepositoryUrl(input) {
  try {
    const parsed = new URL(String(input || ""));
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname !== GITHUB_HOST) return null;
    const segments = parsed.pathname.split("/").filter(Boolean).map(decodePathSegment);
    if (segments.length < 2) return null;
    const owner = segments[0].trim();
    const repository = segments[1].trim().replace(/\.git$/i, "");
    if (!owner || !repository || RESERVED_ROOT_PATHS.has(owner.toLowerCase())) return null;
    return {
      owner,
      repository,
      canonicalUrl: `https://${GITHUB_HOST}/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
    };
  } catch {
    return null;
  }
}

export function githubRepositoryTitleFromUrl(input) {
  return parseGitHubRepositoryUrl(input)?.repository || "";
}

export function buildGitHubReadmeCandidateUrls(input) {
  const repository = typeof input === "string" ? parseGitHubRepositoryUrl(input) : input;
  if (!repository?.owner || !repository?.repository) return [];
  const owner = encodeURIComponent(repository.owner);
  const name = encodeURIComponent(repository.repository);
  return README_FILENAMES.map(
    (filename) => `https://raw.githubusercontent.com/${owner}/${name}/HEAD/${filename}`
  );
}

/**
 * Extract the first meaningful prose paragraph from a public README while
 * ignoring badges, headings, tables, code, navigation lists, and image blocks.
 */
export function extractGitHubReadmeSummary(markdown, options = {}) {
  const requestedMaxLength = Number(options.maxLength);
  const maxLength = Number.isFinite(requestedMaxLength)
    ? Math.min(600, Math.max(80, Math.floor(requestedMaxLength)))
    : 280;
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const paragraphs = [];
  let paragraph = [];
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";

  const flush = () => {
    const cleaned = cleanMarkdownInline(paragraph.join(" "));
    paragraph = [];
    if (isUsefulReadmeParagraph(cleaned)) paragraphs.push(cleaned);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();
    if (inFrontmatter) {
      if (index > 0 && (trimmed === "---" || trimmed === "...")) inFrontmatter = false;
      continue;
    }
    if (/^(```|~~~)/.test(trimmed)) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!trimmed) {
      flush();
      if (paragraphs.length > 0) break;
      continue;
    }
    if (isReadmeNoiseLine(trimmed)) {
      flush();
      if (paragraphs.length > 0) break;
      continue;
    }
    paragraph.push(trimmed);
    if (paragraph.join(" ").length > maxLength * 2) {
      flush();
      if (paragraphs.length > 0) break;
    }
  }
  flush();
  return truncateAtWord(paragraphs[0] || "", maxLength);
}

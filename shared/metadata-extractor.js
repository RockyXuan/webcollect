import { DomUtils, parseDocument } from "htmlparser2";

const MAX_TITLE_LENGTH = 70;
const MAX_DESCRIPTION_LENGTH = 280;
const DEFAULT_KNOWLEDGE_MAX_CHARS = 6000;
const BLOCKED_TAGS = new Set([
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "script",
  "style",
  "noscript",
  "svg",
  "template",
  "iframe",
  "button",
  "input",
  "select",
  "textarea",
]);
const KNOWLEDGE_TAGS = new Set(["h1", "h2", "h3", "p", "li", "blockquote", "dt", "dd"]);
const NOISE_ATTRIBUTE_PATTERN = /(?:^|[-_\s])(nav|menu|footer|header|sidebar|breadcrumb|cookie|consent|modal|login|signup|social|share)(?:$|[-_\s])/i;
const CONTENT_TYPE_PRIORITY = {
  NewsArticle: 100,
  TechArticle: 100,
  Article: 98,
  Product: 96,
  SoftwareApplication: 96,
  WebApplication: 96,
  HowTo: 92,
  FAQPage: 88,
  WebPage: 75,
  WebSite: 55,
  Organization: 30,
  Person: 20,
};

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWord(value, maxLength) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  let shortened = normalized.slice(0, maxLength - 3).trimEnd();
  const lastSpace = shortened.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.55) shortened = shortened.slice(0, lastSpace);
  return `${shortened}...`;
}

function normalizedHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function fallbackTitleFromUrl(url) {
  const hostname = normalizedHostname(url);
  if (!hostname) return "未命名网页";
  return hostname.charAt(0).toUpperCase() + hostname.slice(1);
}

function repositoryTitleFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./i, "").toLowerCase() !== "github.com") return "";
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return "";
    return decodeURIComponent(segments[1]).replace(/\.git$/i, "");
  } catch {
    return "";
  }
}

function titlePartMatchesSite(part, url) {
  const normalized = normalizeText(part).toLowerCase().replace(/^www\./, "");
  const hostname = normalizedHostname(url);
  if (!normalized || !hostname) return false;
  return normalized === hostname || normalized === hostname.split(".")[0];
}

function compactTitle(value, url) {
  const repository = repositoryTitleFromUrl(url);
  if (repository) return truncateAtWord(repository, MAX_TITLE_LENGTH);

  const title = normalizeText(value);
  if (!title) return fallbackTitleFromUrl(url);
  const delimiter = title.match(/^(.{1,80}?)(?:\s+[—–-]\s+|\s+\|\s+|:\s+)(.{2,})$/);
  if (delimiter && titlePartMatchesSite(delimiter[1], url)) {
    const siteTitle = normalizeText(delimiter[1]);
    return siteTitle === siteTitle.toLowerCase()
      ? siteTitle.charAt(0).toUpperCase() + siteTitle.slice(1)
      : siteTitle;
  }
  if (delimiter && titlePartMatchesSite(delimiter[2], url)) {
    return truncateAtWord(delimiter[1], MAX_TITLE_LENGTH);
  }
  return truncateAtWord(title, MAX_TITLE_LENGTH);
}

function descriptionFromTitle(value, url) {
  const title = normalizeText(value);
  const delimiter = title.match(/^(.{1,80}?)(?:\s+[—–-]\s+|\s+\|\s+|:\s+)(.{2,280})$/);
  if (!delimiter || !titlePartMatchesSite(delimiter[1], url)) return "";
  return normalizeText(delimiter[2]);
}

function isElement(node) {
  return Boolean(node && typeof node === "object" && "name" in node && "attribs" in node);
}

function collectElements(nodes, output = []) {
  for (const node of nodes || []) {
    if (isElement(node)) output.push(node);
    if (node && typeof node === "object" && "children" in node && Array.isArray(node.children)) {
      collectElements(node.children, output);
    }
  }
  return output;
}

function attribute(node, name) {
  return normalizeText(node?.attribs?.[name] || "");
}

function elementText(node) {
  return normalizeText(DomUtils.textContent(node));
}

function findMeta(elements, key) {
  const normalizedKey = key.toLowerCase();
  for (const element of elements) {
    if (element.name !== "meta") continue;
    const marker = (attribute(element, "property") || attribute(element, "name") || attribute(element, "itemprop")).toLowerCase();
    if (marker === normalizedKey) return attribute(element, "content");
  }
  return "";
}

function firstElementText(elements, tagName) {
  const element = elements.find((item) => item.name === tagName);
  return element ? elementText(element) : "";
}

function flattenJsonLd(value, output) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonLd(item, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  output.push(value);
  if (Array.isArray(value["@graph"])) flattenJsonLd(value["@graph"], output);
}

function jsonLdObjects(elements) {
  const objects = [];
  for (const element of elements) {
    if (element.name !== "script" || attribute(element, "type").toLowerCase() !== "application/ld+json") continue;
    try {
      flattenJsonLd(JSON.parse(DomUtils.textContent(element)), objects);
    } catch {
      // Malformed structured data should fall back to ordinary page metadata.
    }
  }
  return objects;
}

function parsePageHtml(html) {
  const document = parseDocument(String(html || ""), {
    decodeEntities: true,
    lowerCaseAttributeNames: true,
    lowerCaseTags: true,
  });
  const elements = collectElements(document.children);
  return { elements, structured: jsonLdObjects(elements) };
}

function jsonLdTypePriority(value) {
  const types = Array.isArray(value?.["@type"]) ? value["@type"] : [value?.["@type"]];
  return types.reduce((highest, type) => Math.max(highest, CONTENT_TYPE_PRIORITY[type] || 0), 0);
}

function jsonLdText(value, keys) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && normalizeText(candidate)) return normalizeText(candidate);
  }
  return "";
}

function hasBlockedAncestor(element) {
  let current = element;
  while (current) {
    if (isElement(current)) {
      if (BLOCKED_TAGS.has(current.name)) return true;
      if ("hidden" in (current.attribs || {}) || attribute(current, "aria-hidden").toLowerCase() === "true") return true;
      const marker = `${attribute(current, "id")} ${attribute(current, "class")} ${attribute(current, "role")}`;
      if (NOISE_ATTRIBUTE_PATTERN.test(marker)) return true;
    }
    current = current.parent;
  }
  return false;
}

function hasContentAncestor(element) {
  let current = element?.parent;
  while (current) {
    if (isElement(current) && (current.name === "main" || current.name === "article")) return true;
    current = current.parent;
  }
  return false;
}

function bodyDescriptionCandidates(elements) {
  const candidates = [];
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (!new Set(["h1", "h2", "p", "div", "section"]).has(element.name)) continue;
    if (hasBlockedAncestor(element)) continue;
    const text = elementText(element);
    if (text.length < 4 || text.length > 500) continue;
    if ((element.name === "div" || element.name === "section") && element.children?.some(isElement)) continue;
    const marker = `${attribute(element, "id")} ${attribute(element, "class")}`;
    let score = element.name === "p" ? 105 : element.name === "h2" ? 90 : element.name === "h1" ? 70 : 55;
    if (hasContentAncestor(element)) score += 35;
    if (/(hero|lead|lede|subtitle|tagline|description|summary|intro)/i.test(marker)) score += 45;
    if (text.length >= 24 && text.length <= 220) score += 25;
    score -= index / 1000;
    candidates.push({ text, score, index, source: "body" });
  }

  const ordered = [...candidates].sort((left, right) => left.index - right.index);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const first = ordered[index];
    const second = ordered[index + 1];
    if (second.index - first.index > 4) continue;
    if (first.text.length > 90 || second.text.length > 140) continue;
    const combined = normalizeText(`${first.text} ${second.text}`);
    if (combined.length >= 20 && combined.length <= 240) {
      candidates.push({
        text: combined,
        score: Math.max(first.score, second.score) + 18,
        index: first.index,
        source: "body-combined",
      });
    }
  }
  return candidates;
}

function isDescriptionNoise(value, title) {
  const text = normalizeText(value);
  if (!text || text.length < 12) return true;
  if (text.toLowerCase() === normalizeText(title).toLowerCase()) return true;
  if (/^(home|features|pricing|docs|documentation|menu|sign in|log in|register|subscribe|read more)$/i.test(text)) return true;
  if (/^(copyright|©)|all rights reserved|privacy policy|cookie (?:policy|settings)|terms of (?:use|service)/i.test(text)) return true;
  if (/X\s*\/\s*Twitter.*(?:social|社交平台|查看动态|trending topics|posts)/i.test(text)) return true;
  if (/^GitHub is where (?:people|the world)/i.test(text)) return true;
  return false;
}

function removeRepeatedTitlePrefix(value, title) {
  const text = normalizeText(value);
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) return text;
  if (text.toLowerCase().startsWith(`${normalizedTitle.toLowerCase()} `)) {
    return normalizeText(text.slice(normalizedTitle.length));
  }
  return text;
}

function resolveAssetUrl(value, baseUrl) {
  if (!value) return "";
  try {
    const resolved = new URL(value, baseUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.toString() : "";
  } catch {
    return "";
  }
}

function jsonLdImage(objects) {
  for (const object of [...objects].sort((left, right) => jsonLdTypePriority(right) - jsonLdTypePriority(left))) {
    const image = object?.image;
    if (typeof image === "string") return image;
    if (Array.isArray(image) && typeof image[0] === "string") return image[0];
    if (image && typeof image === "object" && typeof image.url === "string") return image.url;
  }
  return "";
}

function faviconHref(elements) {
  const candidates = [];
  for (const [index, element] of elements.entries()) {
    if (element.name !== "link") continue;
    const rel = attribute(element, "rel").toLowerCase().split(/\s+/);
    if (rel.includes("icon") || rel.includes("shortcut") || rel.includes("apple-touch-icon")) {
      const href = attribute(element, "href");
      if (!href) continue;
      const sizes = attribute(element, "sizes");
      const largestSize = sizes.split(/\s+/).reduce((largest, size) => {
        const match = size.match(/^(\d+)x(\d+)$/i);
        return match ? Math.max(largest, Number(match[1]), Number(match[2])) : largest;
      }, 0);
      let score = Math.min(largestSize, 512);
      if (rel.includes("icon")) score += 120;
      if (rel.includes("apple-touch-icon")) score += 90;
      if (/\.svg(?:$|[?#])/i.test(href) || attribute(element, "type") === "image/svg+xml") score += 60;
      if (/\.ico(?:$|[?#])/i.test(href)) score += 20;
      candidates.push({ href, score, index });
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  return candidates[0]?.href || "";
}

function extractMetadataFromParsedPage(elements, structured, url) {
  const titleCandidates = [];
  for (const object of structured) {
    const text = jsonLdText(object, ["headline", "name"]);
    if (text) titleCandidates.push({ text, score: 200 + jsonLdTypePriority(object), source: "json-ld" });
  }
  const ogTitle = findMeta(elements, "og:title");
  const twitterTitle = findMeta(elements, "twitter:title");
  const htmlTitle = firstElementText(elements, "title");
  const h1Title = firstElementText(elements, "h1");
  if (ogTitle) titleCandidates.push({ text: ogTitle, score: 190, source: "open-graph" });
  if (twitterTitle) titleCandidates.push({ text: twitterTitle, score: 180, source: "twitter-card" });
  if (htmlTitle) titleCandidates.push({ text: htmlTitle, score: 170, source: "title" });
  if (h1Title) titleCandidates.push({ text: h1Title, score: 160, source: "h1" });
  titleCandidates.sort((left, right) => right.score - left.score);
  const selectedTitle = titleCandidates[0];
  const rawTitle = selectedTitle?.text || "";
  const title = selectedTitle?.source === "h1"
    && rawTitle.length <= 32
    && /[.!?。！？]$/.test(rawTitle)
    ? fallbackTitleFromUrl(url)
    : compactTitle(rawTitle, url);

  const descriptionCandidates = [];
  for (const object of structured) {
    const text = jsonLdText(object, ["description", "abstract"]);
    if (text) descriptionCandidates.push({ text, score: 200 + jsonLdTypePriority(object), source: "json-ld" });
  }
  const ogDescription = findMeta(elements, "og:description");
  const twitterDescription = findMeta(elements, "twitter:description");
  const metaDescription = findMeta(elements, "description");
  if (ogDescription) descriptionCandidates.push({ text: ogDescription, score: 190, source: "open-graph" });
  if (twitterDescription) descriptionCandidates.push({ text: twitterDescription, score: 180, source: "twitter-card" });
  if (metaDescription) descriptionCandidates.push({ text: metaDescription, score: 170, source: "meta" });
  const titleDescription = descriptionFromTitle(rawTitle, url);
  if (titleDescription) descriptionCandidates.push({ text: titleDescription, score: 165, source: "title" });
  descriptionCandidates.push(...bodyDescriptionCandidates(elements));
  descriptionCandidates.sort((left, right) => right.score - left.score);
  let description = "";
  for (const candidate of descriptionCandidates) {
    const sanitized = candidate.source === "body-combined"
      ? removeRepeatedTitlePrefix(candidate.text, title)
      : normalizeText(candidate.text);
    if (!isDescriptionNoise(sanitized, title)) {
      description = truncateAtWord(sanitized, MAX_DESCRIPTION_LENGTH);
      break;
    }
  }

  const image = resolveAssetUrl(
    jsonLdImage(structured) || findMeta(elements, "og:image") || findMeta(elements, "twitter:image"),
    url
  );
  const favicon = resolveAssetUrl(faviconHref(elements), url);

  return { title, description, image, favicon };
}

export function extractMetadataFromHtml(html, url) {
  const { elements, structured } = parsePageHtml(html);
  return extractMetadataFromParsedPage(elements, structured, url);
}

function normalizeKnowledgeKey(value) {
  return normalizeText(value).toLocaleLowerCase("und");
}

function collectKnowledgeSegments(elements, structured) {
  const segments = [];
  const normalizedSegments = [];

  const append = (value) => {
    const text = normalizeText(value);
    if (text.length < 4) return;
    const normalized = normalizeKnowledgeKey(text);
    if (!normalized) return;
    if (normalizedSegments.some((existing) => (
      existing === normalized
      || (normalized.length >= 24 && existing.length > normalized.length && existing.includes(normalized))
    ))) return;
    segments.push(text);
    normalizedSegments.push(normalized);
  };

  for (const object of [...structured].sort((left, right) => jsonLdTypePriority(right) - jsonLdTypePriority(left))) {
    for (const key of ["articleBody", "text", "description", "abstract"]) {
      const value = object?.[key];
      if (typeof value === "string") append(value);
    }
  }

  const contentElements = elements.filter((element) => KNOWLEDGE_TAGS.has(element.name) && !hasBlockedAncestor(element));
  const preferredElements = contentElements.filter((element) => hasContentAncestor(element));
  for (const element of preferredElements.length > 0 ? preferredElements : contentElements) {
    append(elementText(element));
  }

  return segments;
}

function truncateKnowledgeSegment(value, maxChars) {
  const characters = Array.from(normalizeText(value));
  if (characters.length <= maxChars) return characters.join("");
  const candidate = characters.slice(0, maxChars).join("").trimEnd();
  const lastSpace = candidate.lastIndexOf(" ");
  return lastSpace > maxChars * 0.55 ? candidate.slice(0, lastSpace) : candidate;
}

function buildKnowledgeResult(segments, maxChars) {
  let text = "";
  let segmentCount = 0;
  let truncated = false;

  for (const segment of segments) {
    const separator = text ? "\n" : "";
    if (Array.from(`${text}${separator}${segment}`).length <= maxChars) {
      text = `${text}${separator}${segment}`;
      segmentCount += 1;
      continue;
    }

    truncated = true;
    if (!text) {
      text = truncateKnowledgeSegment(segment, maxChars);
      segmentCount = text ? 1 : 0;
    }
    break;
  }

  return { text, truncated, segmentCount };
}

function extractKnowledgeFromParsedPage(elements, structured, options = {}) {
  const requestedMaxChars = Number(options.maxChars);
  const maxChars = Number.isFinite(requestedMaxChars)
    ? Math.min(12_000, Math.max(256, Math.floor(requestedMaxChars)))
    : DEFAULT_KNOWLEDGE_MAX_CHARS;
  return buildKnowledgeResult(collectKnowledgeSegments(elements, structured), maxChars);
}

export function extractKnowledgeText(html, options = {}) {
  const { elements, structured } = parsePageHtml(html);
  return extractKnowledgeFromParsedPage(elements, structured, options);
}

export function extractPageContentFromHtml(html, url, options = {}) {
  const { elements, structured } = parsePageHtml(html);
  return {
    metadata: extractMetadataFromParsedPage(elements, structured, url),
    knowledge: extractKnowledgeFromParsedPage(elements, structured, options),
  };
}

import localforage from "localforage";

export const SITE_ICON_CACHE_DB = "WebCollectIcons";
export const SITE_ICON_CACHE_STORE = "site_icons";
export const SITE_ICON_CACHE_MAX_BYTES = 8 * 1024 * 1024;
export const SITE_ICON_CACHE_ITEM_MAX_BYTES = 256 * 1024;

interface SiteIconCacheEntry {
  key: string;
  pageOrigin: string;
  sourceUrl: string;
  dataUrl: string;
  bytes: number;
  createdAt: number;
  accessedAt: number;
}

const siteIconCache = localforage.createInstance({
  name: SITE_ICON_CACHE_DB,
  storeName: SITE_ICON_CACHE_STORE,
});

const pendingCacheWrites = new Map<string, Promise<void>>();
let cacheWriteQueue: Promise<void> = Promise.resolve();
const MAX_PENDING_CACHE_WRITES = 64;

function cacheKey(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin.toLocaleLowerCase();
  } catch {
    return "";
  }
}

function dataUrlBytes(value: string): number {
  const comma = value.indexOf(",");
  if (comma < 0) return 0;
  const payload = value.slice(comma + 1);
  return value.slice(0, comma).includes(";base64")
    ? Math.floor(payload.length * 0.75)
    : new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
}

function isValidEntry(value: unknown): value is SiteIconCacheEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Partial<SiteIconCacheEntry>;
  return typeof raw.key === "string"
    && typeof raw.pageOrigin === "string"
    && typeof raw.sourceUrl === "string"
    && typeof raw.dataUrl === "string"
    && raw.dataUrl.startsWith("data:image/")
    && typeof raw.bytes === "number"
    && raw.bytes > 0
    && raw.bytes <= SITE_ICON_CACHE_ITEM_MAX_BYTES
    && typeof raw.accessedAt === "number";
}

export async function getCachedSiteIcon(pageUrl: string): Promise<string> {
  const key = cacheKey(pageUrl);
  if (!key) return "";
  try {
    const entry = await siteIconCache.getItem<unknown>(key);
    if (!isValidEntry(entry)) return "";
    void siteIconCache.setItem(key, { ...entry, accessedAt: Date.now() });
    return entry.dataUrl;
  } catch {
    return "";
  }
}

async function enforceCacheLimit(): Promise<void> {
  const entries: SiteIconCacheEntry[] = [];
  await siteIconCache.iterate((value) => {
    if (isValidEntry(value)) entries.push(value);
  });
  let total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total <= SITE_ICON_CACHE_MAX_BYTES) return;
  entries.sort((left, right) => left.accessedAt - right.accessedAt || left.createdAt - right.createdAt);
  for (const entry of entries) {
    if (total <= SITE_ICON_CACHE_MAX_BYTES) break;
    await siteIconCache.removeItem(entry.key);
    total -= entry.bytes;
  }
}

export async function cacheSiteIconDataUrl(
  pageUrl: string,
  sourceUrl: string,
  dataUrl: string,
): Promise<boolean> {
  const key = cacheKey(pageUrl);
  const bytes = dataUrlBytes(dataUrl);
  if (!key || !dataUrl.startsWith("data:image/") || bytes <= 0 || bytes > SITE_ICON_CACHE_ITEM_MAX_BYTES) {
    return false;
  }
  const now = Date.now();
  try {
    await siteIconCache.setItem(key, {
      key,
      pageOrigin: key,
      sourceUrl,
      dataUrl,
      bytes,
      createdAt: now,
      accessedAt: now,
    } satisfies SiteIconCacheEntry);
    await enforceCacheLimit();
    return true;
  } catch {
    return false;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("无法读取站点图标。"));
    reader.readAsDataURL(blob);
  });
}

/** Best-effort derived cache. Failures never affect collection rendering. */
export async function cacheLoadedSiteIcon(pageUrl: string, sourceUrl: string): Promise<void> {
  const pageKey = cacheKey(pageUrl);
  let parsedSource: URL;
  try {
    parsedSource = new URL(sourceUrl);
  } catch {
    return;
  }
  if (!pageKey || (parsedSource.protocol !== "http:" && parsedSource.protocol !== "https:")) return;
  const operationKey = `${pageKey}\u0000${parsedSource.href}`;
  const existing = pendingCacheWrites.get(operationKey);
  if (existing) return existing;
  if (pendingCacheWrites.size >= MAX_PENDING_CACHE_WRITES) return;

  const operation = cacheWriteQueue.then(async () => {
    try {
      const response = await fetch(parsedSource.href, {
        credentials: "omit",
        cache: "force-cache",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(6000),
      });
      const contentType = response.headers.get("content-type") || "";
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (!response.ok || !contentType.toLocaleLowerCase().startsWith("image/")) return;
      if (contentLength > SITE_ICON_CACHE_ITEM_MAX_BYTES) return;
      const blob = await response.blob();
      if (blob.size <= 0 || blob.size > SITE_ICON_CACHE_ITEM_MAX_BYTES || !blob.type.startsWith("image/")) return;
      await cacheSiteIconDataUrl(pageUrl, parsedSource.href, await blobToDataUrl(blob));
    } catch {
      // Cross-origin and offline failures intentionally leave the letter fallback.
    }
  });
  pendingCacheWrites.set(operationKey, operation);
  cacheWriteQueue = operation.finally(() => pendingCacheWrites.delete(operationKey));
  return operation;
}

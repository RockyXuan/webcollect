import { ZOOM_CURATED_WALLPAPERS } from "./zoom-curated-wallpapers";
import { WALLPAPER_CATEGORIES, type WallpaperCategory, type WallpaperItem, type WallpaperPrefs } from "./wallpaper-types";

export const WALLPAPER_REMOTE_LIMIT = 24;
export const WALLPAPER_CURATED_MIN = 6;
export const WALLPAPER_LIBRARY_LIMIT = WALLPAPER_REMOTE_LIMIT + WALLPAPER_CURATED_MIN;
export const WALLPAPER_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const ZOOM_WALLPAPER_MIN_WIDTH = 3000;
export const ZOOM_WALLPAPER_MIN_HEIGHT = 1600;
export const ZOOM_WALLPAPER_MIN_RATIO = 1.45;
export const ZOOM_WALLPAPER_MAX_RATIO = 2.4;

export const DEFAULT_WALLPAPER_PREFS: WallpaperPrefs = {
  defaultMode: "wallpaper",
  rotationInterval: "open",
  enabledCategories: [...WALLPAPER_CATEGORIES],
  autoUpdate: true,
  paused: false,
  showZoomHints: true,
  currentWallpaperId: null,
  lastRemoteRefreshAt: 0,
  updatedAt: 0,
};

export function isPackagedWallpaper(item: WallpaperItem): boolean {
  return item.imageUrl.startsWith("/assets/wallpapers/")
    && item.thumbnailUrl.startsWith("/assets/wallpapers/");
}

export const FALLBACK_WALLPAPERS: WallpaperItem[] = ZOOM_CURATED_WALLPAPERS.filter(isPackagedWallpaper);

const CATEGORY_SEARCH_TERMS: Record<WallpaperCategory, string[]> = {
  landscape: [
    'incategory:"Commons featured widescreen desktop backgrounds" landscape',
    'incategory:"Winners of Wiki Loves Earth" landscape panorama',
  ],
  aerial: [
    "NASA Earth Observatory satellite earth",
    "aerial glacier coastline featured",
  ],
  landmark: [
    "Wiki Loves Monuments featured panorama",
    'incategory:"Commons featured widescreen desktop backgrounds" landmark',
  ],
  space: [
    "NASA Webb featured nebula panorama",
    "ESA Hubble featured galaxy nebula",
  ],
  animals: [
    "Wiki Loves Earth featured wildlife national park",
    "featured wildlife Serengeti national park",
  ],
  ocean: [
    "featured coastline ocean dawn panorama",
    "NASA Earth Observatory ocean island",
  ],
  weather: [
    "USGS volcano lava public domain high resolution",
    "NOAA storm satellite public domain high resolution",
  ],
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeUrl(url: string): string {
  return url.replace(/^http:\/\//, "https://");
}

function isStaticImageUrl(url: string): boolean {
  return /\.(avif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

function isOriginalSizedImageUrl(url: string): boolean {
  if (/\/thumb\/|preview|thumbnail/i.test(url)) return false;
  const widthMatch = url.match(/[?&]width=(\d+)/i);
  if (widthMatch && Number(widthMatch[1]) < ZOOM_WALLPAPER_MIN_WIDTH) return false;
  return true;
}

function hasUsableLicense(item: WallpaperItem): boolean {
  const license = item.license.trim().toLowerCase();
  return license.includes("public domain")
    || license.includes("creative commons")
    || license.includes("nasa")
    || license.includes("usgs")
    || license.includes("noaa");
}

export function isZoomWallpaperCandidate(item: WallpaperItem): boolean {
  if (!item.id || !item.title || !item.author) return false;
  if (!item.imageUrl || !item.thumbnailUrl || !item.sourceUrl) return false;
  if (!isStaticImageUrl(item.imageUrl) && !item.imageUrl.includes("Special:FilePath")) return false;
  if (!isOriginalSizedImageUrl(item.imageUrl)) return false;
  if (!hasUsableLicense(item)) return false;
  if (!item.quality || !item.sourceCollection || !item.quoteId) return false;
  if (item.width < ZOOM_WALLPAPER_MIN_WIDTH || item.height < ZOOM_WALLPAPER_MIN_HEIGHT) return false;
  const aspectRatio = item.width / item.height;
  return aspectRatio >= ZOOM_WALLPAPER_MIN_RATIO && aspectRatio <= ZOOM_WALLPAPER_MAX_RATIO;
}

export function scoreZoomWallpaper(item: WallpaperItem): number {
  const qualityScore = {
    award: 500,
    featured: 420,
    curated: 320,
    remote: 0,
  }[item.quality] ?? 0;
  const collection = item.sourceCollection.toLowerCase();
  const collectionScore = [
    collection.includes("wiki loves earth") ? 90 : 0,
    collection.includes("wiki loves monuments") ? 80 : 0,
    collection.includes("picture of the year") || collection.includes("poty") ? 70 : 0,
    collection.includes("featured") ? 60 : 0,
    collection.includes("nasa") || collection.includes("esa") || collection.includes("usgs") || collection.includes("noaa") ? 45 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const aspectRatio = item.width / item.height;
  const aspectScore = Math.max(0, 80 - Math.abs(aspectRatio - 16 / 9) * 80);
  const megapixels = Math.min(90, (item.width * item.height) / 1_000_000);
  const recencyScore = Math.min(30, item.fetchedAt > 0 ? item.fetchedAt / 1_000_000_000_000 : 0);
  return qualityScore + collectionScore + aspectScore + megapixels + recencyScore;
}

export function filterZoomWallpapers(items: WallpaperItem[]): WallpaperItem[] {
  const seenIds = new Set<string>();
  return items
    .filter((item) => {
      if (seenIds.has(item.id)) return false;
      if (!isZoomWallpaperCandidate(item)) return false;
      seenIds.add(item.id);
      return true;
    })
    .sort((a, b) => scoreZoomWallpaper(b) - scoreZoomWallpaper(a));
}

export function filterUsableWallpapers(items: WallpaperItem[]): WallpaperItem[] {
  return filterZoomWallpapers(items);
}

export function mergeWallpaperLibrary(existing: WallpaperItem[], incoming: WallpaperItem[]): WallpaperItem[] {
  const byId = new Map<string, WallpaperItem>();
  for (const item of [...existing, ...incoming]) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => b.fetchedAt - a.fetchedAt);
}

export function pruneWallpaperLibrary(items: WallpaperItem[], limit = WALLPAPER_LIBRARY_LIMIT): WallpaperItem[] {
  const fallbackIds = new Set(FALLBACK_WALLPAPERS.map((item) => item.id));
  const sorted = filterZoomWallpapers(items).sort((a, b) => {
    const fetchedDelta = b.fetchedAt - a.fetchedAt;
    return fetchedDelta || scoreZoomWallpaper(b) - scoreZoomWallpaper(a);
  });
  const storedFallbacks = sorted.filter((item) => fallbackIds.has(item.id));
  const fallbacks = FALLBACK_WALLPAPERS.map((fallback) =>
    storedFallbacks.find((item) => item.id === fallback.id) || fallback
  );
  const remote = sorted.filter((item) => !fallbackIds.has(item.id));
  const curatedCount = Math.min(WALLPAPER_CURATED_MIN, fallbacks.length, limit);
  const remoteCount = Math.min(WALLPAPER_REMOTE_LIMIT, Math.max(0, limit - curatedCount));
  return [
    ...fallbacks.slice(0, curatedCount),
    ...remote.slice(0, remoteCount),
  ].slice(0, limit);
}

export function getNextWallpaper(items: WallpaperItem[], currentId: string | null): WallpaperItem | null {
  const packagedItems = items.filter(isPackagedWallpaper);
  const displayItems = packagedItems.length > 0 ? packagedItems : items;
  if (displayItems.length === 0) return null;
  const currentIndex = currentId ? displayItems.findIndex((item) => item.id === currentId) : -1;
  return displayItems[(currentIndex + 1) % displayItems.length] || displayItems[0] || null;
}

export function getRandomWallpaper(
  items: WallpaperItem[],
  currentId: string | null,
  random: () => number = Math.random
): WallpaperItem | null {
  const packagedItems = items.filter(isPackagedWallpaper);
  const displayItems = packagedItems.length > 0 ? packagedItems : items;
  if (displayItems.length === 0) return null;

  const candidates = displayItems.filter((item) => item.id !== currentId);
  const pool = candidates.length > 0 ? candidates : displayItems;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * pool.length));
  return pool[index] || pool[0] || null;
}

export function getRotationMs(interval: WallpaperPrefs["rotationInterval"]): number | null {
  if (interval === "5m") return 5 * 60 * 1000;
  if (interval === "15m") return 15 * 60 * 1000;
  if (interval === "1h") return 60 * 60 * 1000;
  return null;
}

export function shouldRefreshWallpapers(prefs: WallpaperPrefs, now = Date.now()): boolean {
  return prefs.autoUpdate && now - prefs.lastRemoteRefreshAt >= WALLPAPER_REFRESH_INTERVAL_MS;
}

export async function fetchRemoteWallpapers(
  categories: WallpaperCategory[],
  now = Date.now(),
  fetchImpl: FetchLike = fetch
): Promise<WallpaperItem[]> {
  const enabled = categories.length > 0 ? categories : DEFAULT_WALLPAPER_PREFS.enabledCategories;
  const [nasa, wikimedia] = await Promise.allSettled([
    fetchNasaWallpapers(enabled, now, fetchImpl),
    fetchWikimediaWallpapers(enabled, now, fetchImpl),
  ]);

  return filterUsableWallpapers([
    ...(nasa.status === "fulfilled" ? nasa.value : []),
    ...(wikimedia.status === "fulfilled" ? wikimedia.value : []),
  ]);
}

async function fetchNasaWallpapers(
  categories: WallpaperCategory[],
  now: number,
  fetchImpl: FetchLike
): Promise<WallpaperItem[]> {
  const terms = categories.flatMap((category) => CATEGORY_SEARCH_TERMS[category]).slice(0, 3);
  const results = await Promise.allSettled(
    terms.map(async (term) => {
      const url = `https://images-api.nasa.gov/search?media_type=image&page_size=6&q=${encodeURIComponent(term)}`;
      const response = await fetchImpl(url);
      if (!response.ok) return [];
      const data = await response.json() as unknown;
      const collection = isRecord(data) ? data.collection : null;
      const items = isRecord(collection) && Array.isArray(collection.items) ? collection.items : [];
      return items.flatMap((rawItem): WallpaperItem[] => mapNasaItem(rawItem, now));
    })
  );
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

function mapNasaItem(rawItem: unknown, now: number): WallpaperItem[] {
  if (!isRecord(rawItem)) return [];
  const links = Array.isArray(rawItem.links) ? rawItem.links : [];
  const data = Array.isArray(rawItem.data) && isRecord(rawItem.data[0]) ? rawItem.data[0] : null;
  const firstImage = links.find((link) => isRecord(link) && asString(link.href));
  if (!isRecord(firstImage) || !data) return [];
  const imageUrl = normalizeUrl(asString(firstImage.href));
  if (!imageUrl || !isOriginalSizedImageUrl(imageUrl) || !isStaticImageUrl(imageUrl)) return [];
  const title = asString(data.title) || "NASA image";
  const id = `nasa-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64)}`;
  return [{
    id,
    title,
    author: "NASA Image and Video Library",
    source: "nasa",
    sourceUrl: asString(rawItem.href) || "https://images.nasa.gov/",
    imageUrl,
    thumbnailUrl: imageUrl,
    license: "NASA media guidelines",
    width: 3840,
    height: 2160,
    category: inferCategory(title),
    quality: "remote",
    sourceCollection: "NASA Image and Video Library",
    quoteId: "quiet-horizon",
    fetchedAt: now,
  }];
}

async function fetchWikimediaWallpapers(
  categories: WallpaperCategory[],
  now: number,
  fetchImpl: FetchLike
): Promise<WallpaperItem[]> {
  const term = categories.flatMap((category) => CATEGORY_SEARCH_TERMS[category]).slice(0, 4).join(" OR ");
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "12",
    gsrsearch: term || "featured picture landscape",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1920",
    format: "json",
    origin: "*",
  });
  const response = await fetchImpl(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
  if (!response.ok) return [];
  const data = await response.json() as unknown;
  const query = isRecord(data) ? data.query : null;
  const pages = isRecord(query) && isRecord(query.pages) ? Object.values(query.pages) : [];
  return pages.flatMap((page): WallpaperItem[] => mapWikimediaPage(page, now));
}

function mapWikimediaPage(page: unknown, now: number): WallpaperItem[] {
  if (!isRecord(page)) return [];
  const imageInfo = Array.isArray(page.imageinfo) && isRecord(page.imageinfo[0]) ? page.imageinfo[0] : null;
  if (!imageInfo) return [];
  const metadata = isRecord(imageInfo.extmetadata) ? imageInfo.extmetadata : {};
  const licenseShort = isRecord(metadata.LicenseShortName) ? asString(metadata.LicenseShortName.value) : "";
  const artist = isRecord(metadata.Artist) ? stripHtml(asString(metadata.Artist.value)) : "Wikimedia Commons";
  const title = asString(page.title).replace(/^File:/, "") || "Wikimedia image";
  const imageUrl = normalizeUrl(asString(imageInfo.url));
  const thumbUrl = normalizeUrl(asString(imageInfo.thumburl) || imageUrl);
  if (!imageUrl) return [];
  return [{
    id: `wikimedia-${asString(page.pageid) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64)}`,
    title,
    author: artist || "Wikimedia Commons",
    source: "wikimedia",
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(`File:${title}`).replace(/%2F/g, "/")}`,
    imageUrl,
    thumbnailUrl: thumbUrl,
    license: licenseShort ? `Creative Commons / ${licenseShort}` : "Creative Commons / Wikimedia Commons",
    width: asNumber(imageInfo.width),
    height: asNumber(imageInfo.height),
    category: inferCategory(title),
    quality: inferQuality(imageInfo),
    sourceCollection: inferSourceCollection(imageInfo),
    quoteId: "quiet-horizon",
    fetchedAt: now,
  }];
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function inferCategory(value: string): WallpaperCategory {
  const text = value.toLowerCase();
  if (/(galaxy|nebula|space|nasa|milky)/.test(text)) return "space";
  if (/(aerial|satellite|glacier|drone|earth)/.test(text)) return "aerial";
  if (/(monument|church|temple|palace|bridge|city|market|castle|tower)/.test(text)) return "landmark";
  if (/(ocean|sea|coast|lake|river|bay|fjord|island)/.test(text)) return "ocean";
  if (/(storm|cloud|volcano|lava|weather|lightning)/.test(text)) return "weather";
  if (/(animal|bird|deer|gazelle|eagle|ibex|lion|wolf|wildlife|serengeti)/.test(text)) return "animals";
  return "landscape";
}

function inferQuality(imageInfo: Record<string, unknown>): WallpaperItem["quality"] {
  const metadata = isRecord(imageInfo.extmetadata) ? imageInfo.extmetadata : {};
  const categories = isRecord(metadata.Categories) ? asString(metadata.Categories.value).toLowerCase() : "";
  const assessments = isRecord(metadata.Assessments) ? asString(metadata.Assessments.value).toLowerCase() : "";
  if (categories.includes("winner") || categories.includes("wiki loves earth") || categories.includes("wiki loves monuments")) return "award";
  if (assessments.includes("featured") || categories.includes("featured")) return "featured";
  return "remote";
}

function inferSourceCollection(imageInfo: Record<string, unknown>): string {
  const metadata = isRecord(imageInfo.extmetadata) ? imageInfo.extmetadata : {};
  const categories = isRecord(metadata.Categories) ? asString(metadata.Categories.value) : "";
  if (/Wiki Loves Earth/i.test(categories)) return "Wiki Loves Earth / Wikimedia Commons";
  if (/Wiki Loves Monuments/i.test(categories)) return "Wiki Loves Monuments / Wikimedia Commons";
  if (/NASA/i.test(categories)) return "NASA / Wikimedia Commons";
  if (/Hubble|ESA/i.test(categories)) return "ESA/Hubble / Wikimedia Commons";
  if (/USGS/i.test(categories)) return "USGS / Wikimedia Commons";
  if (/NOAA/i.test(categories)) return "NOAA / Wikimedia Commons";
  if (/Featured/i.test(categories)) return "Wikimedia Featured Pictures";
  return "Wikimedia Commons";
}

export async function cacheWallpaperImages(items: WallpaperItem[]): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open("webcollect-wallpapers-v1");
    await Promise.allSettled(
      items.slice(0, 2).map(async (item) => {
        const response = await fetch(item.imageUrl, { mode: "no-cors", cache: "force-cache" });
        if (response.ok || response.type === "opaque") {
          await cache.put(item.imageUrl, response);
        }
      })
    );
  } catch {
    // Browser cache is best-effort; wallpaper display must never depend on it.
  }
}

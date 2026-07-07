import { ZOOM_CURATED_WALLPAPERS } from "./zoom-curated-wallpapers";
import {
  type WallpaperCategory,
  type WallpaperItem,
  type WallpaperPrefs,
  type WallpaperSource,
  type WallpaperThemeMode,
} from "./wallpaper-types";

export const WALLPAPER_REMOTE_LIMIT = 24;
export const WALLPAPER_CURATED_MIN = 18;
export const WALLPAPER_LIBRARY_LIMIT = WALLPAPER_REMOTE_LIMIT + WALLPAPER_CURATED_MIN;
export const WALLPAPER_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const WALLPAPER_BACKGROUND_CHECK_MS = 30 * 60 * 1000;
export const WALLPAPER_CACHE_LIMIT = 8;
export const WALLPAPER_CACHE_NAME = "webcollect-wallpapers-v2";
export const WALLPAPER_LEGACY_CACHE_NAMES = ["webcollect-wallpapers-v1"];
export const WIKIMEDIA_DISPLAY_WIDTH = 2560;
export const ZOOM_WALLPAPER_MIN_WIDTH = 3000;
export const ZOOM_WALLPAPER_MIN_HEIGHT = 1600;
export const ZOOM_WALLPAPER_MIN_RATIO = 1.45;
export const ZOOM_WALLPAPER_MAX_RATIO = 2.4;
export const DEFAULT_WALLPAPER_ENABLED_CATEGORIES: WallpaperCategory[] = [
  "landscape",
  "landmark",
  "animals",
  "ocean",
];
export const SCIENCE_WALLPAPER_SOURCES: WallpaperSource[] = ["nasa", "esa", "usgs", "noaa"];

export const DEFAULT_WALLPAPER_PREFS: WallpaperPrefs = {
  defaultMode: "wallpaper",
  themeMode: "auto",
  rotationInterval: "15m",
  enabledCategories: [...DEFAULT_WALLPAPER_ENABLED_CATEGORIES],
  autoUpdate: true,
  paused: false,
  showZoomHints: true,
  currentWallpaperId: null,
  currentQuoteId: null,
  recentQuoteIds: [],
  recentAssetIds: [],
  recentMediaIds: [],
  lastRemoteRefreshAt: 0,
  updatedAt: 0,
};

export const FALLBACK_WALLPAPERS: WallpaperItem[] = ZOOM_CURATED_WALLPAPERS;

const CATEGORY_SEARCH_TERMS: Record<WallpaperCategory, string[]> = {
  landscape: [
    'incategory:"Commons featured widescreen desktop backgrounds" landscape',
    'incategory:"Winners of Wiki Loves Earth" landscape panorama',
  ],
  aerial: [
    "aerial coastline featured panorama",
    "aerial glacier coastline featured -satellite",
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
    "featured island coast panorama",
  ],
  weather: [
    "featured storm clouds landscape panorama",
    "featured lightning landscape high resolution",
  ],
};

const TECHNICAL_WALLPAPER_TERMS = [
  "satellite",
  "heatmap",
  "thermal",
  "diagram",
  "instrument",
  "radar",
  "chart",
  "graph",
  "schematic",
  "mission",
  "launch",
  "observatory",
  "earth observatory",
  "visible earth",
  "weather map",
  "blue marble",
];

const AUTO_MIX_CATEGORIES = new Set<WallpaperCategory>(DEFAULT_WALLPAPER_ENABLED_CATEGORIES);
const NATURE_CATEGORIES = new Set<WallpaperCategory>(["landscape", "animals", "ocean"]);
const CINEMA_CATEGORIES = new Set<WallpaperCategory>(["landscape", "landmark", "ocean"]);
const TV_CATEGORIES = new Set<WallpaperCategory>(["landscape", "landmark", "ocean"]);
const PETS_CATEGORIES = new Set<WallpaperCategory>(["animals"]);
const ART_CATEGORIES = new Set<WallpaperCategory>(["landscape", "landmark", "ocean"]);

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

export function getDisplayUrl(item: WallpaperItem, targetWidth = WIKIMEDIA_DISPLAY_WIDTH): string {
  if (item.imageUrl.startsWith("/assets/wallpapers/")) return item.imageUrl;
  try {
    const url = new URL(item.imageUrl);
    if (
      url.hostname === "upload.wikimedia.org"
      && url.pathname.includes("/wikipedia/commons/")
      && !url.pathname.includes("/thumb/")
    ) {
      const segments = url.pathname.split("/");
      const fileName = segments[segments.length - 1];
      if (!fileName) return item.imageUrl;
      const prefix = segments.slice(0, 3).join("/");
      const rest = segments.slice(3).join("/");
      url.pathname = `${prefix}/thumb/${rest}/${targetWidth}px-${fileName}`;
      return url.toString();
    }
  } catch {
    return item.imageUrl;
  }
  return item.imageUrl;
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

function getWallpaperSearchText(item: WallpaperItem): string {
  return [
    item.title,
    item.author,
    item.source,
    item.sourceCollection,
    item.license,
    item.sourceUrl,
    ...(item.tags || []),
  ].join(" ").toLowerCase();
}

export function isScienceWallpaperSource(item: WallpaperItem): boolean {
  const text = getWallpaperSearchText(item);
  return SCIENCE_WALLPAPER_SOURCES.includes(item.source)
    || /\b(nasa|esa|usgs|noaa|hubble|webb|earth observatory|visible earth)\b/i.test(text);
}

export function isTechnicalWallpaper(item: WallpaperItem): boolean {
  const text = getWallpaperSearchText(item);
  return TECHNICAL_WALLPAPER_TERMS.some((term) => text.includes(term));
}

export function isAutoMixWallpaper(item: WallpaperItem): boolean {
  return AUTO_MIX_CATEGORIES.has(item.category)
    && !isScienceWallpaperSource(item)
    && !isTechnicalWallpaper(item);
}

export function isZoomWallpaperCandidate(item: WallpaperItem): boolean {
  if (!item.id || !item.title || !item.author) return false;
  if (!item.imageUrl || !item.thumbnailUrl || !item.sourceUrl) return false;
  if (!isStaticImageUrl(item.imageUrl) && !item.imageUrl.includes("Special:FilePath")) return false;
  if (!isOriginalSizedImageUrl(item.imageUrl)) return false;
  if (!hasUsableLicense(item)) return false;
  if (!item.quality || !item.sourceCollection || !item.quoteId) return false;
  if (isTechnicalWallpaper(item)) return false;
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
  ].reduce((sum, value) => sum + value, 0);
  const aspectRatio = item.width / item.height;
  const aspectScore = Math.max(0, 80 - Math.abs(aspectRatio - 16 / 9) * 80);
  const megapixels = Math.min(90, (item.width * item.height) / 1_000_000);
  const recencyScore = Math.min(30, item.fetchedAt > 0 ? item.fetchedAt / 1_000_000_000_000 : 0);
  const sciencePenalty = isScienceWallpaperSource(item) ? 140 : 0;
  const technicalPenalty = isTechnicalWallpaper(item) ? 300 : 0;
  return qualityScore + collectionScore + aspectScore + megapixels + recencyScore - sciencePenalty - technicalPenalty;
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

function getThemeCategorySet(themeMode: WallpaperThemeMode): Set<WallpaperCategory> {
  if (themeMode === "nature") return NATURE_CATEGORIES;
  if (themeMode === "cinema") return CINEMA_CATEGORIES;
  if (themeMode === "tv") return TV_CATEGORIES;
  if (themeMode === "pets") return PETS_CATEGORIES;
  if (themeMode === "art") return ART_CATEGORIES;
  if (themeMode === "space") return new Set<WallpaperCategory>(["space"]);
  return AUTO_MIX_CATEGORIES;
}

function isNonScienceThemeWallpaper(item: WallpaperItem): boolean {
  return !isScienceWallpaperSource(item) && !isTechnicalWallpaper(item);
}

function isExplicitThemeWallpaper(item: WallpaperItem, themeMode: WallpaperThemeMode): boolean {
  return item.modes?.includes(themeMode) === true;
}

export function filterWallpapersForTheme(
  items: WallpaperItem[],
  themeMode: WallpaperThemeMode = "auto"
): WallpaperItem[] {
  const candidates = filterZoomWallpapers(items);
  if (themeMode === "space") {
    const explicitSpace = candidates.filter((item) => isExplicitThemeWallpaper(item, "space"));
    if (explicitSpace.length > 0) return explicitSpace;
    return candidates.filter((item) => item.category === "space");
  }
  const explicitTheme = candidates.filter((item) =>
    isExplicitThemeWallpaper(item, themeMode)
    && isNonScienceThemeWallpaper(item)
  );
  if (explicitTheme.length > 0) {
    return explicitTheme;
  }
  const categories = getThemeCategorySet(themeMode);
  const filtered = candidates.filter((item) =>
    categories.has(item.category)
    && isNonScienceThemeWallpaper(item)
  );
  if (filtered.length > 0) return filtered;
  return candidates.filter(isAutoMixWallpaper);
}

export function getWallpaperFetchCategories(prefs: WallpaperPrefs): WallpaperCategory[] {
  if (prefs.themeMode === "space") return ["space"];
  const categories = prefs.enabledCategories.length > 0
    ? prefs.enabledCategories
    : DEFAULT_WALLPAPER_ENABLED_CATEGORIES;
  const allowed = getThemeCategorySet(prefs.themeMode);
  const filtered = categories.filter((category) => allowed.has(category));
  return filtered.length > 0 ? filtered : [...DEFAULT_WALLPAPER_ENABLED_CATEGORIES];
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
  const preferredFallbacks = [
    ...fallbacks.filter(isPackagedWallpaper),
    ...fallbacks.filter((item) => !isPackagedWallpaper(item)),
  ];
  const curatedCount = Math.min(WALLPAPER_CURATED_MIN, preferredFallbacks.length, limit);
  const remoteCount = Math.min(WALLPAPER_REMOTE_LIMIT, Math.max(0, limit - curatedCount));
  return [
    ...remote.slice(0, remoteCount),
    ...preferredFallbacks.slice(0, curatedCount),
  ].slice(0, limit);
}

export function getNextWallpaper(items: WallpaperItem[], currentId: string | null): WallpaperItem | null {
  if (items.length === 0) return null;
  const currentIndex = currentId ? items.findIndex((item) => item.id === currentId) : -1;
  return items[(currentIndex + 1) % items.length] || items[0] || null;
}

export function getRandomWallpaper(items: WallpaperItem[], currentId: string | null): WallpaperItem | null {
  if (items.length === 0) return null;
  const candidates = items.filter((item) => item.id !== currentId);
  const pool = candidates.length > 0 ? candidates : items;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

export function pickWallpaperAvoidingRecent(
  items: WallpaperItem[],
  currentId: string | null,
  recentIds: string[] = []
): WallpaperItem | null {
  if (items.length === 0) return null;
  const recent = new Set(recentIds);
  const currentIndex = currentId ? items.findIndex((item) => item.id === currentId) : -1;
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = currentIndex >= 0 ? (currentIndex + offset) % items.length : offset - 1;
    const candidate = items[index];
    if (!candidate || candidate.id === currentId || recent.has(candidate.id)) continue;
    return candidate;
  }
  return getNextWallpaper(items, currentId);
}

export function pickWallpaperAfterRefresh(
  items: WallpaperItem[],
  currentId: string | null,
  incoming: WallpaperItem[],
  recentIds: string[] = []
): WallpaperItem | null {
  const incomingIds = new Set(incoming.map((item) => item.id));
  const freshPool = items.filter((item) => incomingIds.has(item.id));
  return pickWallpaperAvoidingRecent(freshPool.length > 0 ? freshPool : items, currentId, recentIds);
}

export function getWallpaperCacheBatch(
  items: WallpaperItem[],
  currentId: string | null,
  limit = WALLPAPER_CACHE_LIMIT
): WallpaperItem[] {
  if (items.length === 0 || limit <= 0) return [];
  const current = currentId ? items.find((item) => item.id === currentId) : null;
  const ordered = current
    ? [current, ...items.filter((item) => item.id !== current.id)]
    : items;
  const seen = new Set<string>();
  return ordered.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, limit);
}

export function isPackagedWallpaper(item: WallpaperItem): boolean {
  return item.imageUrl.startsWith("/assets/wallpapers/");
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
  const includeNasa = enabled.includes("space");
  const [nasa, wikimedia] = await Promise.allSettled([
    includeNasa ? fetchNasaWallpapers(enabled, now, fetchImpl) : Promise.resolve([]),
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
  const terms = categories
    .filter((category) => category === "space")
    .flatMap((category) => CATEGORY_SEARCH_TERMS[category])
    .slice(0, 3);
  if (terms.length === 0) return [];
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
  const width = asNumber(firstImage.width) || asNumber(data.width);
  const height = asNumber(firstImage.height) || asNumber(data.height);
  if (width < ZOOM_WALLPAPER_MIN_WIDTH || height < ZOOM_WALLPAPER_MIN_HEIGHT) return [];
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
    width,
    height,
    category: inferCategory(title),
    quality: "remote",
    sourceCollection: "NASA Image and Video Library",
    quoteId: inferQuoteId(title, "NASA Image and Video Library"),
    fetchedAt: now,
    provider: "nasa",
    attribution: "NASA Image and Video Library",
  }];
}

async function fetchWikimediaWallpapers(
  categories: WallpaperCategory[],
  now: number,
  fetchImpl: FetchLike
): Promise<WallpaperItem[]> {
  const enabled = categories.length > 0 ? categories : DEFAULT_WALLPAPER_ENABLED_CATEGORIES;
  const results = await Promise.allSettled(
    enabled.map((category) => fetchWikimediaCategoryWallpapers(category, now, fetchImpl))
  );
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

async function fetchWikimediaCategoryWallpapers(
  category: WallpaperCategory,
  now: number,
  fetchImpl: FetchLike
): Promise<WallpaperItem[]> {
  const term = (CATEGORY_SEARCH_TERMS[category] || []).join(" OR ") || `${category} featured picture`;
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "30",
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
  const sourceCollection = inferSourceCollection(imageInfo);
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
    sourceCollection,
    quoteId: inferQuoteId(title, sourceCollection),
    fetchedAt: now,
    provider: "wikimedia",
    attribution: `${artist || "Wikimedia Commons"} / ${licenseShort || "Wikimedia Commons"}`,
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

export function inferQuoteId(value: string, sourceCollection = ""): string {
  const titleText = value.toLowerCase();
  const collectionText = sourceCollection.toLowerCase();
  if (/(ocean|sea|coast|lake|river|bay|fjord|island|fisherman|reflection)/.test(titleText)) return "water-still";
  if (/(animal|bird|deer|gazelle|eagle|ibex|lion|wolf|jackal|wildlife|serengeti|flamingo|turaco|roller)/.test(titleText)) return "patient-life";
  if (/(city|market|church|temple|palace|bridge|tower|munich|taipei|monument)/.test(titleText)) return "city-dawn";
  if (/(volcano|lava|fire|kilauea|storm|lightning)/.test(titleText) || /(usgs|noaa)/.test(collectionText)) return "earth-fire";
  if (/(satellite|earth|aerial|glacier|blue marble|greenland)/.test(titleText)) return "single-earth";
  if (/(galaxy|nebula|space|milky|hubble|webb|cosmic|carina)/.test(titleText) || /(nasa|esa|hubble)/.test(collectionText)) return "cosmic-patience";
  if (/(mountain|stone|cliff|gorge|geopark|valley|piana|tarn|lofoten|forest)/.test(titleText)) return "mountain-rain";
  return "quiet-horizon";
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
    await Promise.allSettled(WALLPAPER_LEGACY_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)));
    const cache = await caches.open(WALLPAPER_CACHE_NAME);
    await Promise.allSettled(
      items.slice(0, WALLPAPER_CACHE_LIMIT).map(async (item) => {
        const displayUrl = getDisplayUrl(item);
        const response = await fetch(displayUrl, { mode: "no-cors" });
        if (response.ok || response.type === "opaque") {
          await cache.put(displayUrl, response);
        }
      })
    );
  } catch {
    // Browser cache is best-effort; wallpaper display must never depend on it.
  }
}

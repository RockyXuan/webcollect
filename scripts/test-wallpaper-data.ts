import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DEFAULT_WALLPAPER_PREFS,
  DEFAULT_WALLPAPER_ENABLED_CATEGORIES,
  FALLBACK_WALLPAPERS,
  filterZoomWallpapers,
  filterUsableWallpapers,
  filterWallpapersForTheme,
  getDisplayUrl,
  getWallpaperCacheBatch,
  getNextWallpaper,
  inferQuoteId,
  isAutoMixWallpaper,
  isPackagedWallpaper,
  isScienceWallpaperSource,
  isZoomWallpaperCandidate,
  mergeWallpaperLibrary,
  pickWallpaperAvoidingRecent,
  pickWallpaperAfterRefresh,
  pruneWallpaperLibrary,
  scoreZoomWallpaper,
  WALLPAPER_CURATED_MIN,
  WALLPAPER_CACHE_NAME,
  WALLPAPER_CACHE_LIMIT,
  WALLPAPER_LEGACY_CACHE_NAMES,
  WALLPAPER_REFRESH_INTERVAL_MS,
  WIKIMEDIA_DISPLAY_WIDTH,
} from "../src/lib/wallpaper-sources";
import { ZOOM_CURATED_WALLPAPERS } from "../src/lib/zoom-curated-wallpapers";
import { WALLPAPER_QUOTES, getWallpaperQuoteCounts } from "../src/lib/wallpaper-quotes";
import type { WallpaperItem } from "../src/lib/wallpaper-types";

assert.equal(DEFAULT_WALLPAPER_PREFS.defaultMode, "wallpaper");
assert.equal(DEFAULT_WALLPAPER_PREFS.themeMode, "auto");
assert.equal(DEFAULT_WALLPAPER_PREFS.autoUpdate, true);
assert.equal(DEFAULT_WALLPAPER_PREFS.rotationInterval, "15m");
assert.equal(DEFAULT_WALLPAPER_PREFS.currentQuoteId, null);
assert.deepEqual(DEFAULT_WALLPAPER_PREFS.recentQuoteIds, []);
assert.deepEqual(DEFAULT_WALLPAPER_PREFS.recentAssetIds, []);
assert.deepEqual(DEFAULT_WALLPAPER_PREFS.recentMediaIds, []);
assert.equal(WALLPAPER_CURATED_MIN, 18);
assert.equal(WALLPAPER_CACHE_LIMIT, 8);
assert.equal(WALLPAPER_CACHE_NAME, "webcollect-wallpapers-v2");
assert.ok(WALLPAPER_LEGACY_CACHE_NAMES.includes("webcollect-wallpapers-v1"));
assert.equal(WALLPAPER_REFRESH_INTERVAL_MS, 6 * 60 * 60 * 1000);
assert.equal(WIKIMEDIA_DISPLAY_WIDTH, 2560);
assert.deepEqual(DEFAULT_WALLPAPER_ENABLED_CATEGORIES, [
  "landscape",
  "landmark",
  "animals",
  "ocean",
]);
assert.deepEqual(DEFAULT_WALLPAPER_PREFS.enabledCategories, DEFAULT_WALLPAPER_ENABLED_CATEGORIES);

assert.ok(FALLBACK_WALLPAPERS.length >= 30, "fallback library should include at least thirty curated wallpapers");
assert.equal(FALLBACK_WALLPAPERS, ZOOM_CURATED_WALLPAPERS, "fallback library should use the curated Zoom registry");
assert.ok(
  FALLBACK_WALLPAPERS.filter((item) => item.imageUrl.startsWith("/assets/wallpapers/")).length >= 8,
  "packaged wallpaper fallback should include at least eight local images"
);
assert.ok(
  FALLBACK_WALLPAPERS.filter((item) => item.modes?.length).length >= 30,
  "curated wallpapers should carry explicit mode metadata for stable theme selection"
);
const packagedWallpaperHashes = FALLBACK_WALLPAPERS
  .filter((item) => item.imageUrl.startsWith("/assets/wallpapers/"))
  .map((item) => createHash("sha256")
    .update(readFileSync(`public${item.imageUrl}`))
    .digest("hex"));
assert.equal(
  new Set(packagedWallpaperHashes).size,
  packagedWallpaperHashes.length,
  "packaged wallpaper fallback files should not be duplicated under different metadata"
);
assert.ok(
  FALLBACK_WALLPAPERS.every((item) => {
    const aspectRatio = item.width / item.height;
    return item.license
      && item.sourceUrl
      && item.imageUrl
      && item.thumbnailUrl
      && item.width >= 3000
      && item.height >= 1600
      && aspectRatio >= 1.45
      && aspectRatio <= 2.4
      && item.quality
      && item.sourceCollection
      && item.quoteId
      && !/\/thumb\/|preview|width=960|thumbnail/i.test(item.imageUrl);
  }),
  "fallback wallpapers should be ultrahigh-resolution original images with attribution and no thumbnail URLs"
);

const sourceCollections = new Set(FALLBACK_WALLPAPERS.map((item) => item.sourceCollection));
assert.ok(
  sourceCollections.size >= 3,
  "curated Zoom registry should cover at least three award, featured, or official source collections"
);

const quoteIds = new Set(WALLPAPER_QUOTES.map((quote) => quote.id));
const quoteCounts = getWallpaperQuoteCounts();
assert.ok(WALLPAPER_QUOTES.length >= 400, "quote library should not regress to a tiny hardcoded list");
assert.ok(quoteCounts.general >= 150, "general quote library should have enough variety");
assert.ok(quoteCounts.pet >= 80, "pet quote library should have enough variety");
assert.ok(quoteCounts.movie >= 80, "cinema quote library should have enough variety");
assert.ok(quoteCounts.tv >= 60, "TV quote library should have enough variety");
assert.ok(FALLBACK_WALLPAPERS.every((item) => quoteIds.has(item.quoteId)), "all wallpapers should reference a known bilingual quote");
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "auto").length >= 8,
  "Auto Mix should always have a healthy local fallback pool"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "auto").filter(isPackagedWallpaper).length >= 8,
  "Auto Mix should ship at least eight packaged non-science wallpapers for offline refresh"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "auto").every(isAutoMixWallpaper),
  "Auto Mix should only use aesthetic non-science wallpapers"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "auto").every((item) => !isScienceWallpaperSource(item)),
  "Auto Mix must not include NASA, ESA, USGS, or NOAA sources"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "space").some((item) => item.source === "nasa" || /nasa|esa/i.test(item.sourceCollection)),
  "Space mode should keep curated NASA/ESA imagery available"
);
for (const mode of ["cinema", "tv", "pets", "art"] as const) {
  assert.ok(
    filterWallpapersForTheme(FALLBACK_WALLPAPERS, mode).every((item) => item.modes?.includes(mode)),
    `${mode} mode should be driven by explicit curated asset mode metadata`
  );
}
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "cinema").length >= 12,
  "Cinema mode should have a stable curated asset pool"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "tv").length >= 12,
  "TV mode should have a stable curated asset pool"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "pets").every((item) => item.category === "animals"),
  "Pets mode should only draw from animal-tagged fallback wallpapers until dedicated pet providers are enabled"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "pets").length > 0,
  "Pets mode should have a fallback pool"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "pets").filter(isPackagedWallpaper).length >= 4,
  "Pets mode should include several packaged local animal or pet wallpapers for offline refresh"
);
assert.ok(
  filterWallpapersForTheme(FALLBACK_WALLPAPERS, "tv").length > 0,
  "TV mode should have an interim fallback pool before TMDb TV provider is configured"
);
assert.equal(inferQuoteId("Milky Way Carina Nebula", "NASA"), "cosmic-patience");
assert.equal(inferQuoteId("Lake reflection and ocean coast", "Wikimedia"), "water-still");
assert.equal(inferQuoteId("African wolf in Serengeti", "Wiki Loves Earth"), "patient-life");
assert.equal(inferQuoteId("Taipei sunrise panorama", "Wikimedia Featured"), "city-dawn");
assert.equal(inferQuoteId("Kilauea lava wildfire", "USGS"), "earth-fire");
assert.equal(inferQuoteId("Blue Marble satellite earth", "NASA"), "single-earth");
assert.equal(inferQuoteId("Calanche de Piana cliffs", "Wikimedia"), "mountain-rain");

const valid: WallpaperItem = {
  id: "valid",
  title: "Valid",
  author: "Known author",
  source: "wikimedia",
  sourceUrl: "https://example.com/valid",
  imageUrl: "https://example.com/valid.jpg",
  thumbnailUrl: "https://example.com/valid-thumb.jpg",
  license: "Public domain",
  width: 3840,
  height: 2160,
  category: "landscape",
  quality: "featured",
  sourceCollection: "Featured Pictures",
  quoteId: "quiet-horizon",
  fetchedAt: 1,
};

const wikimediaOriginal = {
  ...valid,
  id: "wikimedia-original",
  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Example_original.jpg",
  thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example_original.jpg/640px-Example_original.jpg",
};
const wikimediaDisplayUrl = getDisplayUrl(wikimediaOriginal);
assert.match(wikimediaDisplayUrl, /\/thumb\/a\/ab\/Example_original\.jpg\/2560px-Example_original\.jpg$/);
assert.equal(wikimediaOriginal.imageUrl.includes("/thumb/"), false, "source imageUrl should remain the original asset URL");
assert.equal(getDisplayUrl({ ...valid, imageUrl: "/assets/wallpapers/local.jpg" }), "/assets/wallpapers/local.jpg");

const wallpaperShellSource = readFileSync("src/components/wallpaper/wallpaper-shell.tsx", "utf8");
const wallpaperSourcesSource = readFileSync("src/lib/wallpaper-sources.ts", "utf8");
assert.ok(wallpaperShellSource.includes("backgroundImage: `url(\"${displayUrl}\")`"));
assert.ok(wallpaperShellSource.includes("image.src = displayUrl"));
assert.ok(wallpaperSourcesSource.includes("const displayUrl = getDisplayUrl(item);"));
assert.equal(wallpaperSourcesSource.includes('cache: "reload"'), false);

const filtered = filterUsableWallpapers([
  valid,
  { ...valid, id: "small", width: 2800 },
  { ...valid, id: "vertical", width: 2400, height: 3200 },
  { ...valid, id: "no-license", license: "" },
  { ...valid, id: "gif", imageUrl: "https://example.com/motion.gif" },
  { ...valid, id: "thumb-url", imageUrl: "https://example.com/thumb/valid.jpg" },
]);

assert.deepEqual(filtered.map((item) => item.id), ["valid"]);
assert.equal(isZoomWallpaperCandidate(valid), true);
assert.equal(isZoomWallpaperCandidate({ ...valid, width: 2999 }), false);
assert.equal(isZoomWallpaperCandidate({ ...valid, imageUrl: "https://example.com/preview-valid.jpg" }), false);

const award = { ...valid, id: "award", quality: "award" as const, width: 5000, fetchedAt: 2 };
const remote = { ...valid, id: "remote", quality: "remote" as const, width: 5000, fetchedAt: 3 };
assert.ok(scoreZoomWallpaper(award) > scoreZoomWallpaper(remote), "award/featured images should outrank ordinary remote images");
assert.deepEqual(filterZoomWallpapers([remote, award]).map((item) => item.id), ["award", "remote"]);

const merged = mergeWallpaperLibrary([valid], [
  { ...valid, id: "newer", fetchedAt: 4 },
  { ...valid, id: "valid", title: "Updated", fetchedAt: 5 },
]);
assert.equal(merged.length, 2);
assert.equal(merged.find((item) => item.id === "valid")?.title, "Updated");

const pruned = pruneWallpaperLibrary(
  Array.from({ length: 15 }, (_, index) => ({ ...valid, id: `item-${index}`, fetchedAt: index }))
);
assert.equal(pruned.length, 33);
assert.equal(pruned[0].id, "item-14");
assert.ok(
  pruned.filter((item) => FALLBACK_WALLPAPERS.some((fallback) => fallback.id === item.id)).length >= WALLPAPER_CURATED_MIN,
  "pruned library should preserve the curated fallback floor"
);
assert.ok(
  pruned.filter((item) => FALLBACK_WALLPAPERS.some((fallback) => fallback.id === item.id) && isPackagedWallpaper(item)).length >= 8,
  "pruned library should prioritize packaged fallbacks so offline refresh remains diverse"
);

const next = getNextWallpaper([valid, { ...valid, id: "second" }], "valid");
assert.equal(next?.id, "second");

const avoidingRecent = pickWallpaperAvoidingRecent(
  [valid, { ...valid, id: "recent-a" }, { ...valid, id: "fresh-choice" }],
  "valid",
  ["recent-a"]
);
assert.equal(avoidingRecent?.id, "fresh-choice", "manual wallpaper rotation should skip recently viewed assets");
const avoidingRecentFallback = pickWallpaperAvoidingRecent(
  [valid, { ...valid, id: "recent-a" }],
  "valid",
  ["recent-a"]
);
assert.equal(avoidingRecentFallback?.id, "recent-a", "rotation should still return a wallpaper after the recent pool is exhausted");

const refreshed = pickWallpaperAfterRefresh(
  [valid, { ...valid, id: "fresh", fetchedAt: 10 }],
  "valid",
  [{ ...valid, id: "fresh", fetchedAt: 10 }]
);
assert.equal(refreshed?.id, "fresh", "refresh should prefer newly fetched wallpapers when available");
const refreshedFallback = pickWallpaperAfterRefresh(
  [valid, { ...valid, id: "fallback-refresh", fetchedAt: 2 }],
  "valid",
  []
);
assert.equal(refreshedFallback?.id, "fallback-refresh", "manual refresh should still rotate when remote providers return no usable wallpapers");
const refreshedAvoidingRecent = pickWallpaperAfterRefresh(
  [valid, { ...valid, id: "fresh-a", fetchedAt: 11 }, { ...valid, id: "fresh-b", fetchedAt: 12 }],
  "valid",
  [{ ...valid, id: "fresh-a", fetchedAt: 11 }, { ...valid, id: "fresh-b", fetchedAt: 12 }],
  ["fresh-a"]
);
assert.equal(refreshedAvoidingRecent?.id, "fresh-b", "refresh should avoid recently viewed fresh remote assets when possible");

const cacheBatch = getWallpaperCacheBatch(
  Array.from({ length: 12 }, (_, index) => ({ ...valid, id: `cache-${index}` })),
  "cache-5"
);
assert.equal(cacheBatch.length, 8);
assert.equal(cacheBatch[0]?.id, "cache-5", "cache batch should start with the current wallpaper");

console.log("wallpaper data tests passed");

import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import {
  DEFAULT_WALLPAPER_PREFS,
  FALLBACK_WALLPAPERS,
  filterZoomWallpapers,
  filterUsableWallpapers,
  getNextWallpaper,
  getRandomWallpaper,
  isPackagedWallpaper,
  isZoomWallpaperCandidate,
  mergeWallpaperLibrary,
  pruneWallpaperLibrary,
  scoreZoomWallpaper,
} from "../src/lib/wallpaper-sources";
import { ZOOM_CURATED_WALLPAPERS } from "../src/lib/zoom-curated-wallpapers";
import type { WallpaperItem } from "../src/lib/wallpaper-types";

assert.equal(DEFAULT_WALLPAPER_PREFS.defaultMode, "wallpaper");
assert.equal(DEFAULT_WALLPAPER_PREFS.autoUpdate, true);
assert.equal(DEFAULT_WALLPAPER_PREFS.rotationInterval, "open");
assert.deepEqual(DEFAULT_WALLPAPER_PREFS.enabledCategories, [
  "landscape",
  "aerial",
  "landmark",
  "space",
  "animals",
  "ocean",
  "weather",
]);

assert.ok(ZOOM_CURATED_WALLPAPERS.length >= 30, "curated registry should keep at least thirty sourced wallpapers");
assert.ok(FALLBACK_WALLPAPERS.length >= 6, "fallback library should include at least six packaged local wallpapers");
assert.ok(FALLBACK_WALLPAPERS.every(isPackagedWallpaper), "fallback wallpapers should be packaged local display assets");
assert.ok(
  FALLBACK_WALLPAPERS.every((item) => {
    const aspectRatio = item.width / item.height;
    const filePath = `public${item.imageUrl}`;
    const stat = existsSync(filePath) ? statSync(filePath) : null;
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
      && !/\/thumb\/|preview|width=960|thumbnail/i.test(item.imageUrl)
      && stat
      && stat.size > 500_000
      && stat.size < 6_500_000;
  }),
  "fallback wallpapers should be local optimized high-resolution assets with attribution"
);

const sourceCollections = new Set(FALLBACK_WALLPAPERS.map((item) => item.sourceCollection));
assert.ok(
  sourceCollections.size >= 3,
  "curated Zoom registry should cover at least three award, featured, or official source collections"
);

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
assert.equal(pruned.length, 15 + FALLBACK_WALLPAPERS.length);
assert.ok(isPackagedWallpaper(pruned[0]), "packaged local wallpapers should lead the pruned library");
assert.ok(
  pruned.filter((item) => FALLBACK_WALLPAPERS.some((fallback) => fallback.id === item.id)).length >= FALLBACK_WALLPAPERS.length,
  "pruned library should preserve all packaged fallbacks"
);

const next = getNextWallpaper([valid, { ...valid, id: "second" }], "valid");
assert.equal(next?.id, "second");

const randomPool = [
  { ...valid, id: "first", imageUrl: "/assets/wallpapers/first.jpg", thumbnailUrl: "/assets/wallpapers/first.jpg" },
  { ...valid, id: "second", imageUrl: "/assets/wallpapers/second.jpg", thumbnailUrl: "/assets/wallpapers/second.jpg" },
  { ...valid, id: "third", imageUrl: "/assets/wallpapers/third.jpg", thumbnailUrl: "/assets/wallpapers/third.jpg" },
];
assert.equal(getRandomWallpaper(randomPool, "first", () => 0)?.id, "second");
assert.equal(getRandomWallpaper(randomPool, "first", () => 0.99)?.id, "third");
assert.equal(getRandomWallpaper(randomPool, "only", () => 0)?.id, "first");

console.log("wallpaper data tests passed");

import assert from "node:assert/strict";
import {
  DEFAULT_WALLPAPER_ENABLED_CATEGORIES,
  DEFAULT_WALLPAPER_PREFS,
  fetchRemoteWallpapers,
  filterWallpapersForTheme,
  getWallpaperFetchCategories,
  isAutoMixWallpaper,
  isScienceWallpaperSource,
  isTechnicalWallpaper,
  isZoomWallpaperCandidate,
  scoreZoomWallpaper,
} from "../src/lib/wallpaper-sources";
import { FALLBACK_WALLPAPERS } from "../src/lib/wallpaper-sources";
import type { WallpaperItem } from "../src/lib/wallpaper-types";

const aesthetic: WallpaperItem = {
  id: "aesthetic",
  title: "Lake reflection at dawn",
  author: "Known author",
  source: "wikimedia",
  sourceUrl: "https://example.com/lake",
  imageUrl: "https://example.com/lake.jpg",
  thumbnailUrl: "https://example.com/lake-thumb.jpg",
  license: "Creative Commons Attribution 4.0",
  width: 3840,
  height: 2160,
  category: "landscape",
  quality: "featured",
  sourceCollection: "Wikimedia Featured Pictures",
  quoteId: "water-still",
  fetchedAt: 1,
};

const nasaSpace: WallpaperItem = {
  ...aesthetic,
  id: "nasa-space",
  title: "Cosmic cliffs in the Carina Nebula",
  author: "NASA, ESA, CSA, STScI",
  source: "nasa",
  sourceUrl: "https://images.nasa.gov/details/carina",
  imageUrl: "https://example.com/carina.jpg",
  thumbnailUrl: "https://example.com/carina-thumb.jpg",
  license: "NASA media guidelines",
  category: "space",
  sourceCollection: "NASA / Webb Featured Pictures",
  quoteId: "cosmic-patience",
};

const technicalSatellite: WallpaperItem = {
  ...aesthetic,
  id: "technical-satellite",
  title: "Thermal satellite heatmap radar diagram",
  source: "nasa",
  license: "NASA media guidelines",
  category: "aerial",
  sourceCollection: "NASA Earth Observatory mission instrument chart",
  quoteId: "single-earth",
};

assert.equal(DEFAULT_WALLPAPER_PREFS.themeMode, "auto");
assert.deepEqual(DEFAULT_WALLPAPER_PREFS.enabledCategories, DEFAULT_WALLPAPER_ENABLED_CATEGORIES);
assert.deepEqual(getWallpaperFetchCategories(DEFAULT_WALLPAPER_PREFS), DEFAULT_WALLPAPER_ENABLED_CATEGORIES);
assert.deepEqual(getWallpaperFetchCategories({ ...DEFAULT_WALLPAPER_PREFS, themeMode: "space" }), ["space"]);

assert.equal(isTechnicalWallpaper(technicalSatellite), true);
assert.equal(isZoomWallpaperCandidate(technicalSatellite), false);
assert.equal(isScienceWallpaperSource(nasaSpace), true);
assert.equal(isAutoMixWallpaper(aesthetic), true);
assert.equal(isAutoMixWallpaper(nasaSpace), false);
assert.equal(isAutoMixWallpaper(technicalSatellite), false);
assert.ok(scoreZoomWallpaper(aesthetic) > scoreZoomWallpaper(nasaSpace), "Auto-safe featured images should outrank science providers by default");

const autoPool = filterWallpapersForTheme([aesthetic, nasaSpace, technicalSatellite], "auto");
assert.deepEqual(autoPool.map((item) => item.id), ["aesthetic"]);
const spacePool = filterWallpapersForTheme([aesthetic, nasaSpace, technicalSatellite], "space");
assert.deepEqual(spacePool.map((item) => item.id), ["nasa-space"]);

assert.ok(filterWallpapersForTheme(FALLBACK_WALLPAPERS, "auto").length >= 8);
assert.ok(filterWallpapersForTheme(FALLBACK_WALLPAPERS, "auto").every(isAutoMixWallpaper));
assert.ok(filterWallpapersForTheme(FALLBACK_WALLPAPERS, "space").some((item) => item.source === "nasa"));

async function main() {
  const requestedUrls: string[] = [];
  const fetchMock = async (input: string) => {
    requestedUrls.push(input);
    return {
      ok: true,
      async json() {
        if (input.includes("commons.wikimedia.org")) {
          return { query: { pages: {} } };
        }
        return { collection: { items: [] } };
      },
    } as Response;
  };

  await fetchRemoteWallpapers(getWallpaperFetchCategories(DEFAULT_WALLPAPER_PREFS), Date.now(), fetchMock);
  assert.equal(requestedUrls.some((url) => url.includes("images-api.nasa.gov")), false, "Auto Mix refresh must not call NASA");

  requestedUrls.length = 0;
  await fetchRemoteWallpapers(["space"], Date.now(), fetchMock);
  assert.equal(requestedUrls.some((url) => url.includes("images-api.nasa.gov")), true, "Space refresh may call NASA");

  console.log("wallpaper policy tests passed");
}

void main();

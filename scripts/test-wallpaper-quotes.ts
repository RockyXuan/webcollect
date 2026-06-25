import assert from "node:assert/strict";
import {
  WALLPAPER_QUOTES,
  getWallpaperQuote,
  getWallpaperQuoteCounts,
  selectWallpaperQuote,
  validateWallpaperQuote,
} from "../src/lib/wallpaper-quotes";
import type { WallpaperItem } from "../src/lib/wallpaper-types";

const counts = getWallpaperQuoteCounts();

assert.ok(WALLPAPER_QUOTES.length >= 400, "wallpaper quote library should have hundreds of usable entries");
assert.ok(counts.general >= 150, "general quote library should include at least 150 entries");
assert.ok(counts.pet >= 80, "pet quote library should include at least 80 entries");
assert.ok(counts.movie >= 80, "cinema/movie quote library should include at least 80 entries");
assert.ok(counts.tv >= 60, "TV quote library should include at least 60 entries");
assert.ok(counts.fallback >= 30, "fallback quote library should include at least 30 entries");

const ids = new Set<string>();
const zhTexts = new Set<string>();
const enTexts = new Set<string>();
for (const quote of WALLPAPER_QUOTES) {
  const validation = validateWallpaperQuote(quote);
  assert.equal(validation.valid, true, `${quote.id} should be valid: ${validation.reason || ""}`);
  assert.equal(ids.has(quote.id), false, `duplicate quote id: ${quote.id}`);
  ids.add(quote.id);
  assert.equal(zhTexts.has(quote.zh), false, `duplicate Chinese quote: ${quote.zh}`);
  zhTexts.add(quote.zh);
  assert.equal(enTexts.has(quote.en), false, `duplicate English quote: ${quote.en}`);
  enTexts.add(quote.en);
  assert.ok(quote.zh.trim().length > 0 && quote.en.trim().length > 0, `${quote.id} should be bilingual`);
}

function wallpaper(overrides: Partial<WallpaperItem>): WallpaperItem {
  return {
    id: "wallpaper",
    title: "Test wallpaper",
    author: "WebCollect",
    source: "fallback",
    sourceUrl: "https://example.com",
    imageUrl: "https://example.com/image.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    license: "Creative Commons Zero",
    width: 3840,
    height: 2160,
    category: "landscape",
    quality: "curated",
    sourceCollection: "Test collection",
    quoteId: "quiet-horizon",
    fetchedAt: 0,
    ...overrides,
  };
}

const petSelection = selectWallpaperQuote({
  wallpaper: wallpaper({ id: "pet-wallpaper", title: "Cat by the window", category: "animals", tags: ["cat", "pet"] }),
  themeMode: "pets",
});
assert.equal(petSelection.quote.kind, "pet", "Pets mode should prefer pet quotes");
assert.equal(petSelection.reason, "mode-kind");

const cinemaSelection = selectWallpaperQuote({
  wallpaper: wallpaper({ id: "cinema-wallpaper", title: "City neon frame", tags: ["cinema", "night"] }),
  themeMode: "cinema",
});
assert.equal(cinemaSelection.quote.kind, "movie", "Cinema mode should prefer movie/cinematic quotes");
assert.equal(cinemaSelection.reason, "mode-kind");
assert.match(cinemaSelection.quote.sourceNote || "", /not a quote from an existing copyrighted film/i);

const tvSelection = selectWallpaperQuote({
  wallpaper: wallpaper({ id: "tv-wallpaper", title: "Kitchen table episode", tags: ["tv", "episode"] }),
  themeMode: "tv",
});
assert.equal(tvSelection.quote.kind, "tv", "TV mode should prefer TV quotes");
assert.equal(tvSelection.reason, "mode-kind");
assert.match(tvSelection.quote.sourceNote || "", /not a quote from an existing copyrighted TV show/i);

const first = selectWallpaperQuote({
  wallpaper: wallpaper({ id: "dedupe-wallpaper", title: "Lake reflection", category: "ocean" }),
  themeMode: "nature",
});
const second = selectWallpaperQuote({
  wallpaper: wallpaper({ id: "dedupe-wallpaper", title: "Lake reflection", category: "ocean" }),
  themeMode: "nature",
  recentQuoteIds: [first.quote.id],
});
assert.notEqual(second.quote.id, first.quote.id, "recent quote history should avoid immediate repeats when alternatives exist");

assert.equal(getWallpaperQuote("quiet-horizon").id, "quiet-horizon", "legacy quote ids must remain resolvable");

const mountainSelection = selectWallpaperQuote({
  wallpaper: wallpaper({
    id: "mountain-cliff-wallpaper",
    title: "Calanche de Piana red granite cliffs and rocky mountain road",
    category: "landscape",
    tags: ["mountain", "cliff", "rock", "canyon", "granite"],
    sourceCollection: "Wikimedia Featured Pictures",
    quoteId: "water-still",
  }),
  themeMode: "nature",
});
assert.ok(
  mountainSelection.quote.tags.some((tag) => /(mountain|stone|rock|journey|height|resilience)/i.test(tag)),
  `mountain and cliff wallpapers should select mountain/rock/journey quotes, got ${mountainSelection.quote.id}`
);
assert.doesNotMatch(
  `${mountainSelection.quote.id} ${mountainSelection.quote.zh} ${mountainSelection.quote.en} ${mountainSelection.quote.tags.join(" ")}`,
  /water|ocean|sea|lake|river|tide|潮|水|海|湖|河/i,
  "mountain and cliff wallpapers should not receive water/tide quotes"
);

const natureSelection = selectWallpaperQuote({
  wallpaper: wallpaper({ id: "nature-default-wallpaper", title: "Wide mountain forest trail", category: "landscape", tags: ["mountain", "forest"] }),
  themeMode: "nature",
});
assert.doesNotMatch(
  `${natureSelection.quote.id} ${natureSelection.quote.source} ${natureSelection.quote.sourceNote || ""}`,
  /WebCollect .*original|WebCollect .*原创|原创短句|原创氛围台词|original cinematic caption/i,
  "normal wallpaper quote display should not use WebCollect-original or synthetic caption sources"
);

const autoAnimalSelection = selectWallpaperQuote({
  wallpaper: wallpaper({ id: "auto-animal-wallpaper", title: "Cat by the window", category: "animals", tags: ["cat", "pet"] }),
  themeMode: "auto",
});
assert.doesNotMatch(
  `${autoAnimalSelection.quote.id} ${autoAnimalSelection.quote.source} ${autoAnimalSelection.quote.sourceNote || ""}`,
  /WebCollect .*original|WebCollect .*原创|原创短句/i,
  "Auto Mix should not display WebCollect pet-original captions even for animal wallpapers"
);

console.log("wallpaper quote tests passed");

# WebCollect Quote And Wallpaper Audit

## Current Files

- `src/components/wallpaper/wallpaper-shell.tsx`
  - Renders the wallpaper stage, bottom bilingual quote, attribution, controls, keyboard entry, wheel switching, and background refresh.
- `src/components/wallpaper/wallpaper-settings-dialog.tsx`
  - Exposes theme modes and wallpaper categories.
- `src/lib/wallpaper-quotes.ts`
  - Stores the current bilingual quote list and resolves a quote by `quoteId`.
- `src/lib/wallpaper-types.ts`
  - Defines wallpaper categories, providers, theme modes, items, and preferences.
- `src/lib/wallpaper-sources.ts`
  - Filters usable wallpapers, scores quality, fetches remote Wikimedia/NASA sources, caches images, and maps images to `quoteId`.
- `src/lib/wallpaper-store.ts`
  - Persists preferences/library, picks the current wallpaper, rotates, refreshes, and caches the current/next wallpaper.
- `src/lib/zoom-curated-wallpapers.ts`
  - Contains the local curated wallpaper fallback library.
- `scripts/test-wallpaper-data.ts`
  - Verifies fallback wallpaper count, quality filters, theme filtering, refresh behavior, and quote references.
- `scripts/test-wallpaper-wiring.ts`
  - Verifies wiring between wallpaper shell, settings, store, sources, and extension new tab.

## Current Counts

- Quote entries: 412 in `WALLPAPER_QUOTES`.
  - General: 159
  - Pet: 81
  - Cinema/movie-mode original captions: 80
  - TV-mode original captions: 60
  - Space: 2
  - Fallback: 30
- Curated/fallback wallpaper entries: 42 in `ZOOM_CURATED_WALLPAPERS`.
- Packaged local wallpaper files: 17 under `public/assets/wallpapers`.
- Current theme modes: `auto`, `nature`, `cinema`, `tv`, `pets`, `art`, `space`.
- Current wallpaper categories: `landscape`, `aerial`, `landmark`, `space`, `animals`, `ocean`, `weather`.
- Current remote providers in code: Wikimedia Commons and NASA Images, with NASA only fetched when `space` is enabled.
- Current explicit mode pools:
  - Auto Mix: 33 total, 13 packaged, 0 science-source items
  - Nature: 28 total, 12 packaged, 0 science-source items
  - Cinema: 18 total, 9 packaged, 0 science-source items
  - TV: 18 total, 9 packaged, 0 science-source items
  - Pets: 15 total, 4 packaged, 0 science-source items
  - Art: 18 total, 9 packaged, 0 science-source items
  - Space: 4 total, 2 packaged, NASA/ESA allowed by explicit opt-in

## Current Quote Logic

The UI calls:

```ts
const quote = getWallpaperQuote(prefs.currentQuoteId || wallpaper.quoteId);
```

`getWallpaperQuote` preserves legacy direct lookup, while the store now calls `selectWallpaperQuote` when a wallpaper is selected. The quote engine can choose by exact asset id, media tags, source title, theme kind, wallpaper category, asset tags, and recent quote history. It falls back to safe bilingual entries instead of collapsing everything to the same few ids.

Remote wallpapers still call `inferQuoteId(title, sourceCollection)` for backward-compatible asset metadata, but visible display uses `currentQuoteId` from the quote engine so repeated remote assets can still receive varied, mode-appropriate bilingual lines.

## Current Wallpaper Mode Logic

- `auto` uses landscape, landmark, animals, and ocean while excluding science/technical items.
- `nature` uses landscape, animals, and ocean.
- `cinema` prefers curated assets with explicit `modes: ["cinema"]` metadata and falls back to landscape, landmark, and ocean if remote results do not carry modes.
- `tv` prefers curated assets with explicit `modes: ["tv"]` metadata and falls back to landscape, landmark, and ocean if remote results do not carry modes.
- `pets` prefers curated assets with explicit `modes: ["pets"]` metadata and uses animal-tagged fallbacks; it now includes several packaged local CC0 animal/pet images for offline refresh.
- `art` prefers curated assets with explicit `modes: ["art"]` metadata and falls back to aesthetic non-science landscape, landmark, and ocean imagery.
- `space` is the only mode that allows NASA/space imagery.

## Why The User Still Sees Repetition

This was addressed in stages:

- Quote library expanded from 12 to 412 entries.
- The store persists `currentQuoteId`, `recentQuoteIds`, `recentAssetIds`, and `recentMediaIds`.
- Rolling the mouse wheel and clicking `立即更新壁纸` now choose via `pickWallpaperAvoidingRecent`, so recent assets are skipped while there are alternatives.
- Manual refresh remains clickable while a background refresh is in flight and first performs a visible local rotation before remote providers finish.
- Curated assets now carry inferred `modes` and tags so Cinema/TV/Pets/Art are not merely accidental category matches.

## Mouse Exit Bug

`wallpaper-shell.tsx` previously wired `onMouseMove` to a fling detector. A fast left/right mouse movement could call `onEnterCollection()` without an intentional click. This contradicted the product rule: wallpaper mode should exit to the collection wall only from an explicit click or keyboard action.

This has been fixed in the current working tree by removing the mousemove/fling/long-press entry path and adding a wiring test that rejects those gestures.

## Remaining Boundaries

- Cinema/TV entries are currently clearly marked as WebCollect original mode captions, not fabricated quotes from real films or shows.
- Real film/TV stills or production quotes should only be added from a legal curated source or a configured backend provider such as TMDb. No frontend API key should be hard-coded.
- Pets mode has a real local CC0 guinea pig image plus local bird/swan animal images, but a larger true companion-animal library can still improve quality later.

## External Provider Boundaries

- No API keys should be hard-coded in the extension frontend.
- Pexels, Pixabay, TMDb, The Cat API, and The Dog API should be optional providers behind configuration/proxy boundaries.
- The first reliable stage should work offline from local curated wallpaper metadata and local bilingual quote data.
- Movie/TV quotes must not be fabricated as real quotes. If a quote is original or unverified, it must be marked clearly and should not pretend to be from a real movie/show.

## Implementation Plan

1. Keep the existing wallpaper store and `WallpaperItem` shape compatible.
2. Extend wallpaper theme modes with `pets` and `tv`.
3. Add a richer `QuoteEntry` model in `src/lib/wallpaper-quotes.ts` while preserving `getWallpaperQuote(id)`.
4. Add generated/curated local quote libraries for:
   - general classics/originals
   - pet/healing captions
   - cinema-mode original cinematic captions
   - TV-mode original serial-story captions
   - fallback safety lines
5. Add a deterministic quote engine that can:
   - filter invalid entries
   - pick by wallpaper mode/category/tags
   - avoid recent quote repetition
   - report match reason for debug/testing
6. Add lightweight recent history in wallpaper prefs/storage.
7. Update settings UI to show Auto Mix, Nature, Cinema, TV, Pets, Art, and Space.
8. Update tests:
   - quote counts
   - quote validation
   - pet/cinema/tv selection
   - recent quote dedupe
   - mouse movement cannot enter collection mode
   - build and extension wiring

## Acceptance Evidence Needed

- `scripts/test-wallpaper-wiring.ts` proves no mousemove/fling/long-press entry path remains.
- A new quote validation test proves quote counts, bilingual fields, uniqueness, and no production placeholders.
- A quote engine test proves mode and media-aware selection.
- `scripts/test-wallpaper-data.ts` continues to prove wallpaper filtering and fallback behavior.
- TypeScript, lint, and extension build pass.
- Browser verification confirms:
  - moving the mouse does not exit wallpaper mode,
  - clicking the wallpaper stage enters the collection wall,
  - keyboard Space/Enter enters the collection wall,
  - wheel changes wallpaper,
  - modes are selectable,
  - quote overlay always has Chinese and English text.

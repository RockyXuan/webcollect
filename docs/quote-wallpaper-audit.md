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

- Quote entries: 12 in `WALLPAPER_QUOTES`.
- Curated/fallback wallpaper entries: 39 in `ZOOM_CURATED_WALLPAPERS`.
- Packaged local wallpaper files: 14 under `public/assets/wallpapers`.
- Current theme modes: `auto`, `nature`, `cinema`, `art`, `space`.
- Current wallpaper categories: `landscape`, `aerial`, `landmark`, `space`, `animals`, `ocean`, `weather`.
- Current remote providers in code: Wikimedia Commons and NASA Images, with NASA only fetched when `space` is enabled.

## Current Quote Logic

The UI calls:

```ts
const quote = getWallpaperQuote(wallpaper.quoteId);
```

`getWallpaperQuote` does a direct lookup in a 12-item array and falls back to the first quote. There is no quote kind, mode, author/speaker split, media binding, recent quote history, or match reason.

Remote wallpapers call `inferQuoteId(title, sourceCollection)`, which maps image keywords to one of the existing 12 quote ids. This is why many unrelated images converge onto the same few ids such as `patient-life`, `water-still`, `mountain-rain`, and `city-dawn`.

## Current Wallpaper Mode Logic

- `auto` uses landscape, landmark, animals, and ocean while excluding science/technical items.
- `nature` uses landscape, animals, and ocean.
- `cinema` currently uses landscape, landmark, and ocean. It does not fetch movie backdrops, does not store movie metadata, and does not bind quotes to a film.
- `art` currently uses landscape, landmark, and ocean. It does not fetch museum/public-domain art yet.
- `space` is the only mode that allows NASA/space imagery.

## Why The User Still Sees Repetition

- The visible quote library is only 12 entries.
- Many curated wallpapers reference the same quote ids.
- `inferQuoteId` collapses broad categories into a handful of ids.
- There is no recent quote history preventing repetition.
- There is no separate pet, cinema, TV, art, or fallback quote library.
- There is no quote engine that can choose by asset metadata, mode, tags, or media identity.

## Mouse Exit Bug

`wallpaper-shell.tsx` previously wired `onMouseMove` to a fling detector. A fast left/right mouse movement could call `onEnterCollection()` without an intentional click. This contradicted the product rule: wallpaper mode should exit to the collection wall only from an explicit click or keyboard action.

This has been fixed in the current working tree by removing the mousemove/fling/long-press entry path and adding a wiring test that rejects those gestures.

## Missing Pieces

- Quote data model with `kind`, `tone`, `speaker`, `sourceTitle`, `mediaType`, `tmdbId`, `tvId`, `exactAssetId`, validation, and production filtering.
- Quote engine with priority:
  1. exact asset
  2. same movie `tmdbId`
  3. same TV `tvId`
  4. same normalized source title
  5. same mode/kind
  6. tag/tone match
  7. general fallback
  8. emergency fallback
- Recent history for quote ids, asset ids, and media ids.
- Pets mode with pet/healing quotes and pet-safe asset selection.
- TV mode.
- Real Cinema/TV asset metadata. Without a configured TMDb proxy/API key, this must start as curated metadata and local/remote-safe placeholders, not hard-coded frontend secrets.
- Validation scripts for quote counts, duplicate text, missing translations, placeholder text, and media binding.
- Browser verification that mouse movement no longer exits wallpaper mode.

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

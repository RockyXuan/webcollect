# WebCollect V1.2.2 header layout closeout

Release identity: `V1.2.2 / 2026年7月17日`

Release tag: `webcollect-2026-07-17-v1.2.2`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-17-v1.2.2`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-17-v1.2.2/WebCollect-Chrome-Extension-v1.2.2-2026-07-17.zip`

## Scope

- Google 登录 now has a non-shrinking wrapper, non-shrinking icon, single-line text, and stable line height.
- From 1181px through 1799px, the complete action toolbar uses a dedicated second grid row. Search, engine selection, cloud-sync status, and account controls therefore retain independent geometry instead of overflowing across grid columns.
- At 1800px and wider the existing single-row desktop composition remains. At 1180px and below the existing compact/mobile behavior remains.
- The same rules are present in Web `globals.css` and extension `extension.css`.

## Verification

- In-app Browser used one isolated localhost context at `http://127.0.0.1:5014/`.
- Before the fix, 1366px reproduced action controls overflowing 216px into the search column and a 51.7px-tall two-line Google login button.
- After the fix, 1366px rendered separate search and action rows, a 30.6px single-line login button, zero document overflow, and zero console errors.
- Visual checks also passed at 1728×1080 and 390×844 with no horizontal document overflow.
- The targeted Playwright suite inserts the real sync-badge geometry and verifies separation at 1366, 1536, 1728, 1800, and 2048 widths. All 14 responsive assertions passed before release preparation.
- Final release gate: `git diff --check`, TypeScript, ESLint, 31 files / 159 Vitest tests, all 31 legacy scripts, Web production build, extension build, extension artifact checks, and the 17.1 MiB package-size gate passed.
- Full Playwright regression: 38/38 passed, including collection-data isolation, all mindmap flows, search, section editing, wallpaper behavior, 390px compact mode, and the new signed-in header geometry coverage.
- Production dependency audit: npm Bulk Advisory API checked 207 installed production packages; info=0, low=0, moderate=0, high=0, critical=0.
- The Web build and production audit each failed once inside the restricted sandbox for expected environment reasons (Turbopack internal port `EPERM`; npm API unavailable), then passed unchanged in the approved local/network environment.

## Data boundary

This patch does not read, clear, overwrite, migrate, or write collection data. `src/lib/db.ts`, `src/lib/sync.ts`, `src/lib/seed.ts`, Supabase schema, Chrome storage, IndexedDB keys, localStorage keys, snapshots, dirty sets, cards, categories, sections, preferences, recycle bin, tombstones, and sync metadata are unchanged. The protected seed SHA-256 remains `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.

## Publication evidence

The tagged app commit, main CI, tag workflow, official asset size/SHA-256, downloaded-manifest check, and primary-profile reload evidence are appended after publication in a documentation-only commit. That follow-up is not a new application version.

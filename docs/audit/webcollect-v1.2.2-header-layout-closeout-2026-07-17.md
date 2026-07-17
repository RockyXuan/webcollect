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

- Tagged application commit: `b2a2063cb986574ffdf6e0c13c3988da6c02a26a` (`release: fix WebCollect v1.2.2 header layout`). The release tag still points to this application commit; the later evidence commit is documentation-only.
- Main CI run `29566934939` succeeded, including production audit and the complete verification job. Tag/Release workflow run `29567324457` also succeeded.
- The GitHub Release is final (not draft or prerelease) and contains exactly one asset: `WebCollect-Chrome-Extension-v1.2.2-2026-07-17.zip`, `16,957,068` bytes, SHA-256 `80ed3d0ad969d0ad3eb2485cc9a77729565a7dda0f05dcc4926f3245ec40c998`.
- The official asset was downloaded to `/private/tmp/webcollect-v1.2.2-official-20260717-1643/`. Its Manifest V3 reports version `1.2.2`, retains the stable key, new-tab override, background worker, permissions, and the same 41-file tree. `diff -qr` against the locally verified `extension/dist` was empty.
- Before updating the existing unpacked source path, an append-only copy was created at `/private/tmp/webcollect-installed-extension-backups/unpacked-before-v1.2.2-final-20260717-1645`. The official 41-file tree was then synchronized without `--delete` into the existing `~/Downloads/WebCollect-v1.1.2-rc.6/unpacked` path. A second `diff -qr` confirmed that the installed source and official download are identical.
- In the existing signed-in primary Chrome profile, the already-installed stable extension ID `immpcmhmabobllnopedaoflcjneigbko` was reloaded in place from its WebCollect-only auxiliary window. Chrome's extension details then displayed version `1.2.2`. A fresh `chrome://newtab/` showed `X rocky`, `云端已同步 16:50`, the existing six section tabs, recycle-bin count 15, bookmark bar, categories, groups, and cards. Search engine, sync badge, action controls, and account control were visually separated with no header overlap.
- The Chrome automation interface correctly refused to claim the internal `chrome://extensions` page, so the policy-bounded reload used Computer Use only inside the dedicated WebCollect window. No unrelated personal tab was operated. The only real-profile console messages observed were pre-existing remote favicon CSP/404 failures; the application remained usable and the isolated Browser console for this patch was error-free.
- No uninstall, second Chrome profile, storage reset, collection edit, sync write, or business-data mutation was performed. This publication evidence is recorded by a documentation-only commit and does not create a new application version.

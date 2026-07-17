# WebCollect V1.2.0 mindmap closeout

Final release identity: `V1.2.0 / 2026年7月16日`

Release tag: `webcollect-2026-07-16-v1.2.0`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-16-v1.2.0`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-16-v1.2.0/WebCollect-Chrome-Extension-v1.2.0-2026-07-16.zip`

This closeout records the Fable-style 导图模式 release. The final GitHub CI run, tag workflow run, downloaded official zip size, SHA-256, manifest recheck, and primary-profile Chrome reload evidence were appended after publication by a docs-only commit. That follow-up commit is not a new application version.

## Scope

V1.2.0 adds a second collection view named 导图 beside the existing classic wall:

- Four layouts: right-side logic map, bilateral mind map, downwards organization chart, and indent tree.
- Shared TopNav, section tabs, BookmarkBar, account menu, sync state, and dialogs with classic mode.
- Read-only map canvas with SVG edges, layout rail, legend, zoom cluster, pan, cursor-anchored wheel zoom, and fit camera.
- Node dragging stores view offsets only; dragging a parent visually carries the real descendant subtree without changing category/card parentage.
- Collapse state, layout, offsets, and camera are hydrated independently per section.
- Hover preview, pin toggle, and card open reuse existing card/link/bookmark code paths.
- Add category/group/card actions reuse existing dialogs and Zustand store actions.
- Extension new-tab app reuses the same `MindmapView` and shared CSS.
- M7 accessibility and scale polish: `tree` / `treeitem` semantics, roving focus, Arrow keys, Enter, Space, focus camera, empty state, reduced-motion, compact 390px horizontal layout rail, and 300+ node viewport culling with 240px overscan.

Classic mode remains the default startup path.

## Data and sync boundary

No user collection, sync, snapshot, or cloud schema was changed.

- Unchanged: `src/lib/db.ts`, `src/lib/sync.ts`, `src/lib/seed.ts`, Supabase schema, Chrome storage namespace, snapshot schema, dirty sets, cards, categories, sections, user preferences, recycle bin, and existing sync state.
- New local-only persistent key family: `mindmapViewState:<sectionId>`.
- Storage location: existing localforage instance targeting IndexedDB database `WebCollect` and object store `webcollect_data`.
- Stored fields: `{ layout, collapsed, offsets, camera, updatedAt }`.
- Corrupt or stale view state is normalized in memory only; legacy keys are not deleted.
- Favicon/icon rendering is read-only and never calls `updateCard` while browsing the map.

## Milestone commits

- M0 `e7a3ddf` — `feat(mindmap): add view mode skeleton`
- M1 `fd39b4b` — `feat(mindmap): add layout engine`
- M2 `6888d59` — `feat(mindmap): render read-only canvas`
- M3 `3f4c84c` — `feat(mindmap): add canvas interactions`
- M4 `6252d54` — `feat(mindmap): persist section view state`
- M5 `bcc9794` — `feat(mindmap): connect collection actions`
- M6 `659bb89` — `feat(mindmap): enable extension view`
- M7 `d2c91cf` — `release: finalize WebCollect v1.2.0 mindmap`
- Release-gate stabilization `552afec` — `test: stabilize wallpaper repair regression`; this changed only the obsolete-wallpaper E2E assertion and is the commit tagged for V1.2.0.

## Automated verification

The M0–M6 gates were run per milestone before each commit. The M6 full gate passed with:

- `git diff --check`
- `corepack pnpm@9.0.0 ts-check`
- `corepack pnpm@9.0.0 lint`
- `corepack pnpm@9.0.0 test` — 28 files / 150 tests
- `corepack pnpm@9.0.0 test:legacy` — 31 scripts
- `corepack pnpm@9.0.0 build`
- `corepack pnpm@9.0.0 build:ext`
- `corepack pnpm@9.0.0 test:extension-artifact`
- `corepack pnpm@9.0.0 test:extension-size` — 17.1 MiB
- `corepack pnpm@9.0.0 test:e2e` — 23/23
- `src/lib/seed.ts` SHA-256 stayed `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`

M7 release-commit verification:

- `git diff --check` — passed
- `corepack pnpm@9.0.0 ts-check` — passed
- `corepack pnpm@9.0.0 lint` — passed
- `corepack pnpm@9.0.0 test` — 28 files / 150 tests passed
- `corepack pnpm@9.0.0 test:legacy` — 31 scripts passed
- `corepack pnpm@9.0.0 build` — passed after rerun outside the sandbox because Turbopack's internal process/port binding is blocked by the sandbox
- `corepack pnpm@9.0.0 build:ext` — passed
- `corepack pnpm@9.0.0 test:extension-artifact` — passed
- `corepack pnpm@9.0.0 test:extension-size` — 17.1 MiB, passed
- `corepack pnpm@9.0.0 exec playwright test tests/e2e/mindmap-mode.spec.ts` — 12/12 passed
- `corepack pnpm@9.0.0 test:e2e` — 26/26 passed
- `corepack pnpm@9.0.0 audit:prod` — 207 production packages, info=0 low=0 moderate=0 high=0 critical=0
- `src/lib/seed.ts` SHA-256 stayed `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`

Post-release independent rerun on 2026-07-17 also passed `ts-check`, `lint`, 28 files / 150 tests, all 31 legacy scripts, Web build, extension build, extension artifact and size gates, and the full 26/26 Playwright suite.

GitHub release evidence is recorded below.

## Real Chrome extension verification before final version bump

The existing installed extension used stable ID `immpcmhmabobllnopedaoflcjneigbko` and source path `~/Downloads/WebCollect-v1.1.2-rc.6/unpacked`. To preserve the ID, login state, IndexedDB, and sync state, the M6 build was copied into that existing unpacked source path and Chrome was reloaded in the user's signed-in primary Chrome profile. No second profile was created.

Observed before reload:

- Source path was the existing unpacked folder.
- Version still showed `1.1.2`, as expected before M7 version bump.
- Account and sync were visible: `云端已同步`.
- Classic view showed 7 sections, 63 visible card operation targets, and recycle count 15.
- No mode switch existed before M0–M6 code was loaded.

Observed after reload:

- Stable extension ID stayed `immpcmhmabobllnopedaoflcjneigbko`.
- Classic selected by default.
- Account and sync stayed visible: `云端已同步`.
- Classic view still showed 7 sections, 63 visible card operation targets, and recycle count 15.
- 导图 rendered successfully in the extension new tab.
- All four layouts rendered with 63 web nodes, 11 category nodes, and 13 group nodes.
- Console inspection found no TypeError, ReferenceError, or mindmap runtime crash. Remaining messages were pre-existing favicon/CSP/404 resource warnings.

## Final official-package Chrome reload

After the release workflow published, the downloaded official zip was unpacked and synchronized into the same already-loaded unpacked source path. A backup of the previous directory was retained under `/private/tmp/webcollect-installed-extension-backups/unpacked-before-v1.2.0-final-20260717`. No Chrome profile, extension ID, IndexedDB database, Supabase state, Chrome storage namespace, collection data, preferences, snapshots, or sync state was recreated or cleared.

On 2026-07-17 the user manually clicked the reload icon on WebCollect's existing `chrome://extensions` detail page. The resulting detail page showed:

- Enabled extension named `WebCollect`.
- Version `1.2.0`.
- Size `17.1 MB`.
- Stable extension ID `immpcmhmabobllnopedaoflcjneigbko`.

The Chrome control interface independently confirmed that the WebCollect detail tab and a `chrome://newtab/` tab were present in the same primary profile. Chrome's automation security policy does not permit DOM inspection or navigation of `chrome://newtab/`; the check stopped at that boundary and did not use another profile, raw CDP, Computer Use, or an indirect bypass. Final functional runtime confidence therefore combines the official-package build identity and manual reload above with the already completed M6 primary-profile read-only functional check (7 sections, 63 visible cards, recycle count 15, all four layouts, and no mindmap runtime crash).

## Visual evidence

Reference assets:

- `docs/design/mockups/2026-07-15-mindmap-logic-right.png`
- `docs/design/mockups/2026-07-15-mindmap-bilateral.png`
- `docs/design/mockups/2026-07-15-mindmap-tree-down.png`
- `docs/design/mockups/2026-07-15-mindmap-hover-preview.png`
- `docs/design/mockups/2026-07-15-mindmap-classic-mode.png`

Generated implementation screenshots:

- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-logic-right-1920x1080-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-bilateral-1920x1080-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-tree-down-1920x1080-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-indent-1920x1080-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-hover-preview-1920x1080-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-classic-mode-1920x1080-2026-07-16.png`

Side-by-side reference / implementation comparison screenshots:

- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-logic-right-comparison-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-bilateral-comparison-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-tree-down-comparison-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-hover-preview-comparison-2026-07-16.png`
- `docs/audit/screenshots/webcollect-v1.2.0-mindmap-classic-mode-comparison-2026-07-16.png`

The implementation screenshots use an isolated Playwright fixture derived from the documented collection hierarchy. They do not read, clear, or overwrite the user's real Chrome/IndexedDB data.

## Release evidence

- Final app implementation commit: `d2c91cf`.
- Tagged release commit: `552afecda54e1fd00d06b942e1cf1979aa4302d7`.
- `main` CI: [run 29547513319](https://github.com/RockyXuan/webcollect/actions/runs/29547513319), successful. `audit-production` completed in 22 seconds and `verify` completed in 3 minutes 52 seconds, including all 26 browser regression tests.
- Tag workflow: [run 29547698328](https://github.com/RockyXuan/webcollect/actions/runs/29547698328), successful. `verify-tag` completed in 46 seconds and published the Release.
- Release: [WebCollect v1.2.0](https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-16-v1.2.0), published, not a draft or prerelease.
- Official asset: [WebCollect-Chrome-Extension-v1.2.0-2026-07-16.zip](https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-16-v1.2.0/WebCollect-Chrome-Extension-v1.2.0-2026-07-16.zip).
- Official zip size: `16,956,179` bytes.
- Official zip SHA-256: `48a32652af3ffd4a9320d9eb39f0799a1ceb157a2fa7f7ee7544c8c7eefcaac8`; this matches the digest reported by GitHub.
- Downloaded manifest: Manifest V3, name `WebCollect`, version `1.2.0`, stable key present, new-tab override `newtab.html`, and background service worker `background.js`.
- Downloaded archive: 46 zip entries (41 files plus 5 directories) and exactly one Release asset; no duplicate official zip was published.
- Final primary-profile install identity: enabled, version `1.2.0`, size `17.1 MB`, stable ID `immpcmhmabobllnopedaoflcjneigbko` after manual reload.

## Independent review notes

The 2026-07-17 post-release review found no release-blocking correctness or data-safety defects.

- `src/lib/db.ts`, `src/lib/sync.ts`, `src/lib/seed.ts`, and Supabase schema remained unchanged from V1.1.2; the seed SHA-256 remained `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.
- The only new view-state write path uses `mindmapViewState:<sectionId>` in `WebCollect/webcollect_data`, uses the storage lock, and contains no clear/remove operation or sync/snapshot/dirty-set hook.
- The obsolete-wallpaper CI stabilization does not hide a product failure: the test still requires a packaged `.webp` and asserts that no obsolete packaged `.jpg` request occurs. It no longer assumes which valid curated wallpaper the rotation policy selects.
- The browser test named `mindmap layouts match the Fable geometry` proves that rendered DOM geometry agrees with the shipped layout engine and enforces control-layer tolerances. It is not an independent reference-image pixel-diff oracle. Independent visual evidence is instead provided by the 1920×1080 side-by-side screenshots listed above.
- The extension build reports a non-blocking Vite chunk-size warning for the local main bundle (`1,054.48 kB`, gzip `306.09 kB`). The package-size gate passes; a future performance-only release may lazily load the mindmap implementation when the user first switches from classic mode.

This closeout update is documentation-only and does not create a new WebCollect application version or move the V1.2.0 tag.

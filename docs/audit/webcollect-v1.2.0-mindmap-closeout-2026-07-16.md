# WebCollect V1.2.0 mindmap closeout

Final release identity: `V1.2.0 / 2026年7月16日`

Release tag: `webcollect-2026-07-16-v1.2.0`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-16-v1.2.0`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-16-v1.2.0/WebCollect-Chrome-Extension-v1.2.0-2026-07-16.zip`

This closeout records the Fable-style 导图模式 release. The final GitHub CI run, tag workflow run, downloaded official zip size, SHA-256, and manifest recheck are appended after publication by a docs-only commit. That follow-up commit is not a new application version.

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
- M7 app release commit — pending until final local gate passes.

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

GitHub CI, tag workflow, official zip download, and final real Chrome read-only check are completed after the release commit is pushed and tagged.

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

To be appended after `webcollect-2026-07-16-v1.2.0` publishes:

- Final app commit:
- `main` CI run:
- Tag workflow run:
- Official zip size:
- Official zip SHA-256:
- Downloaded manifest version:
- Downloaded asset uniqueness:
- Final real Chrome profile read-only result:

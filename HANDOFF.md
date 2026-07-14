# Project Handoff

## 2026-07-14 V1.1.2 Account Sync Release Candidate

This section supersedes older development status. V1.1.1 remains the latest stable Release until the V1.1.2 RC is installed and the final account gate passes.

- Candidate version/date: `V1.1.2 / 2026年7月14日`.
- Candidate closeout: `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`.
- Baseline and remote backup: `main@ea45b53` and `codex/backup-pre-oauth-2026-07-13`.
- Fixed: clean-checkout Web OAuth configuration, fresh-Profile inbox duplication, deterministic canonical inbox selection when old clients already produced same-section duplicates, OAuth code cleanup, custom-server HMR upgrades, concurrent floating-capture destination creation, duplicate GoTrue clients, and browser auth refresh lifecycle misuse.
- Verified so far: 128 Vitest cases, all 31 legacy scripts, all 12 Playwright cases, TypeScript, ESLint, dependency audit, extension build/artifact/size, and isolated MV3 runtime.
- Real account: Profile A passed Google sign-in, local-scope sign-out, re-sign-in, validated session, and cloud sync. The user has explicitly authorized the signed-in main Chrome for RC installation; Profile B remains the independent second-session surface.
- Data state is `364 cards / 130 categories / 24 preferences / 58 snapshots / 0 tombstones`; the old extension added one empty category while cards and other counts stayed unchanged.
- Two exact empty inbox artifacts are documented in the closeout. One still has a section-preference reference; neither may be deleted without explicit user approval.
- Publish an installable RC first, but do not describe V1.1.2 as final until the authorized Chrome and Profile B both pass, counts remain unchanged, and final main/tag/zip are pinned to one commit.

## 2026-07-12 V1.1.1 Audit And Supabase Split Handoff

This section supersedes every older status or release statement below.

- Repository: `https://github.com/RockyXuan/webcollect`
- Workspace: `/Users/rockyx/vibe coding/Web Collect 0628`
- Source of truth: `main` at tag `webcollect-2026-07-12-v1.1.1`
- Version/date: `V1.1.1 / 2026年7月12日`
- Extension zip: `WebCollect-Chrome-Extension-v1.1.1-2026-07-12.zip`
- Current closeout: `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`
- Full audit closeout: `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`
- Full execution log: `docs/audit/gpt56-full-audit-execution-2026-07-10.md`

PM now uses independent Supabase project `erzblrpfqjjwmlkxkkkb`. The former shared project contains only WebCollect; the leftover PM role was disabled and stripped of grants. WebCollect's revision/tombstone migration is live after a fresh private backup, with original row counts unchanged.

All automated gates pass at closeout: 117 Vitest cases, 31 legacy scripts, 12 Playwright cases, type check, lint, Web build, extension build/artifact/size, responsive/search/section/wallpaper flows, and isolated MV3 runtime target capture. Cold CI now waits for a real wallpaper-ready signal before entering the collection, and only the guarded local release script publishes a GitHub Release asset. The wallpaper browser suite also repairs a stale packaged `.jpg` record from IndexedDB and proves that no obsolete request survives. Remaining human-account observation is limited to real Google OAuth and two simultaneously signed-in physical Profiles.

## 2026-07-07 Claude / Codex Full-Audit Handoff

This section supersedes older handoff notes below when there is a conflict.

### Current Known-Good Source

- Remote repository: `https://github.com/RockyXuan/webcollect`
- Correct branch: `main`
- Fixed local workspace: `/Users/rockyx/vibe coding/Web Collect 0628`
- Latest pushed baseline before this docs handoff: `c31b507 fix: improve capture metadata relevance`
- Latest release: `webcollect-2026-07-02-v1.0.3`
- Latest Chrome extension zip: `WebCollect-Chrome-Extension-v1.0.3-2026-07-02.zip`
- Current app version/date: `V1.0.3 / 2026年7月2日`

### Read First

- `AGD.md`
- `docs/audit/claude-code-review-handoff-2026-07-07.md`
- `docs/audit/webcollect-full-audit-brief-2026-07-07.md`
- `docs/audit/user-screenshot-index-2026-07-07.md`
- `PROJECT_SUMMARY.md`
- `tasks/lessons.md`
- `tasks/todo.md`
- `AGENTS.md`

### Latest Completed Work To Preserve

- `V1.0.2 / 2026-07-01`: fixed extension capture target placement, top section editing/reordering, category lightweight edit, tab hover readability, delete misfire prevention, squirrel branding and version/date display.
- `V1.0.3 / 2026-07-02`: fixed capture metadata relevance, especially `docu.md` opened from X/Twitter being mislabeled with an X/Twitter description.
- Documentation-only handoff on 2026-07-07: consolidated user requirements, screenshots, implementation notes, lessons, known weak spots, Claude audit tasks, and code-review self-assessment into `AGD.md` and `docs/audit/*`.

### Current Risks To Audit

- Real installed Chrome extension behavior still needs long-running confirmation for floating capture, context menu icons, toolbar icon clarity, and target placement.
- Metadata extraction is improved but still rule-based; keep testing source-platform vs target-page mismatches.
- Cloud sync across real Windows/Mac devices remains the most data-sensitive area.
- Drag, resize, and edit mode have regressed repeatedly; browser verification is required for UI changes.
- Old docs are still present for history; do not treat older sections as newer than `AGD.md`.

## 2026-06-28 Current Thread Handoff Update

This section supersedes older handoff notes below when there is a conflict.

### Current Known-Good Source

- Remote repository: `https://github.com/RockyXuan/webcollect`
- Correct branch for the next thread: `main`
- Fixed local workspace for future threads: `/Users/rockyx/vibe coding/Web Collect 0628`
- Historical Codex workspace for this thread: `/Users/rockyx/Documents/Codex/2026-06-14/webcollect-main-clean`
- Do not continue from old directory: `/Users/rockyx/Documents/webcollect`
- Latest pushed baseline before this handoff task: `06672b6 docs: record layout floating release`
- Planned release for this handoff batch: `webcollect-2026-06-28-capture-panel-ux`
- Planned Chrome extension zip name: `WebCollect-Chrome-Extension-capture-panel-ux-2026-06-28.zip`

### What This Thread Completed Since The Last Release

- Re-cloned from GitHub `main` into a clean directory after the old local checkout was stale/dirty.
- Repaired GitHub/Clash workflow enough for `gh` auth and release operations to work from this machine.
- Stabilized layout wrapping and floating capture visibility in commit `dfd23fc`, with release `webcollect-2026-06-25-layout-floating-fix`.
- Added non-blocking locked-layout hints, clearer lock/unlock icons, compact category width behavior, and better wallpaper quote semantic matching.
- Fixed cloud-aware refresh/manual sync and explicit floating-capture destination resolution so selected targets should not silently fall into the default inbox.
- Added English-to-Chinese description localization for existing cards and floating capture saves.
- Added/expanded wallpaper refresh, cache, local fallback, provider filtering, and quote matching, but wallpaper quality/refresh should still be watched in the real installed extension.
- Reworked group/card action menus so edit actions live under the hover three-dot menus, with the star favorite button preserved.
- 2026-06-28 UI polish:
  - Category top glass headers now inherit and clip to rounded corners, avoiding exposed corner triangles/shadow artifacts.
  - Floating capture side button defaults to about two-thirds size (`sizeScale = 0.67`).
  - User menu adds `浮窗大小` slider plus `小 / 中 / 原始` presets.
  - Floating capture panel is draggable, persists its position in `webcollect.capture.panelPosition`, and does not close on outside click.
  - Long create-section/category/group panel states keep bottom actions visible via a scrollable body and sticky action area.
  - Capture actions are now ordered `保存` on the left and `取消` on the right.

### Verification Already Run For Latest Batch

```bash
node --import tsx scripts/test-floating-capture-health.ts
node --import tsx scripts/test-layout-preferences.ts
./node_modules/.bin/tsc -p tsconfig.json
./node_modules/.bin/eslint .
node ./extension/build.mjs
git diff --check
```

Results:

- TypeScript passed.
- ESLint passed with 0 errors and 6 existing warnings.
- Extension build passed and rebuilt `extension/dist/assets/floating-capture.js`.
- Diff whitespace check passed.
- in-app Browser smoke check loaded `http://localhost:5015/` with no relevant console errors.
- Dedicated Chrome floating-capture verification passed by injecting built `extension/dist/assets/floating-capture.js` into `http://127.0.0.1:5015/` with a mocked extension API:
  - side button measured `159x48`
  - long destination-creation state kept actions visible
  - action order was `保存 / 取消`
  - panel moved from `{ left: 380, top: 183 }` to `{ left: 260, top: 90 }`
  - stored position became `{"left":260,"top":90}`
  - outside click did not close the panel
  - screenshot: `/private/tmp/webcollect-floating-capture-verify.png`

### Important Current Risks

- Real installed Chrome extension behavior must still be confirmed by the user after downloading the latest Release package.
- Cross-device sync still needs real Mac/Windows confirmation with the user's actual cloud data.
- Layout/drag/blank-space issues have regressed repeatedly in prior passes; every future layout change needs real visual checks at two viewport sizes.
- Wallpaper refresh and quote quality remain user-sensitive; do not claim it is complete without checking installed extension behavior.
- Website favicon/icon caching is improved but still needs long-running real use observation for small/niche sites.

### Required Next-Thread Preflight

Run these before code changes:

```bash
pwd
git status -sb
git log --oneline --decorate -8
git remote -v
gh auth status
git ls-remote --heads origin main
```

Then read:

- `PROJECT_SUMMARY.md`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT.md`
- `AGENTS.md`
- `tasks/lessons.md`
- `tasks/todo.md`
- `CODEX_GO_MODE_STATUS.md`

### Recommended Next Steps

1. Confirm the latest release asset `WebCollect-Chrome-Extension-capture-panel-ux-2026-06-28.zip` exists after this handoff is pushed.
2. Ask the user to install that package and confirm:
   - category corner artifacts are gone,
   - floating side tool is smaller and adjustable,
   - capture panel can be dragged and remains open,
   - long new-destination forms keep Save/Cancel visible,
   - Save is left and Cancel is right.
3. If user reports another UI regression, reproduce in an auxiliary Chrome/Codex Workbench or in-app Browser before editing.
4. Keep data safety first: no clearing IndexedDB, no Supabase reset, no seed overwrite of user data.

## 2026-06-14 Current Thread Handoff Update

This update supersedes the older 2026-05-25 handoff notes when there is a conflict.

### Current Known-Good Source

- Remote repository: `https://github.com/RockyXuan/webcollect`
- Correct branch for the next thread: `main`
- Latest verified main commit at handoff time: `80e1d90 ci: fix Chrome extension release workflow`
- Latest verified Release tag: `webcollect-2026-06-13-80e1d90`
- Latest Chrome extension asset:
  `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-06-13-80e1d90/WebCollect-Chrome-Extension-webcollect-2026-06-13-80e1d90.zip`

Important local workspace warning:

- Do not continue from `/Users/rockyx/Documents/webcollect` without first protecting its uncommitted changes. That local directory was observed to be stale and dirty: it was ahead of its old `origin/main`, missing the latest Zoom/Release commits, and had uncommitted changes in extension/auth/build files.
- The clean copy used for the latest successful release was `/private/tmp/webcollect-main-docs-rules-copy`, with `main` aligned to `origin/main` at `80e1d90`.
- For a new thread, the safest path is to clone or fetch a fresh copy of `main` into a new clean directory, then read this handoff and `NEXT_THREAD_PROMPT.md`.

### What This Thread Completed

- Merged the Zoom wallpaper/new-tab mode into the main product line.
- Added local bundled high-quality wallpaper assets for Chrome extension startup so the new tab does not depend on a remote image before first paint.
- Added bilingual calm quote text over Zoom mode and improved Zoom visual presentation.
- Fixed the Chrome extension OAuth contract by stabilizing the extension ID and documenting the fixed Supabase redirect URL.
- Fixed the Chrome extension Release workflow so GitHub Actions now produces a real `WebCollect-Chrome-Extension-*.zip` asset instead of leaving users with only GitHub's automatic Source code archives.
- Removed accidental mouse/long-press/swing entry from the bookmark wall into Zoom mode. The only intended wall-to-Zoom entry is the explicit top/right Zoom or wallpaper button.
- Added or preserved tests for wallpaper wiring, layout preferences, layout sizing, floating capture targets, and auth contract checks.

### Current GitHub / Release Status

- A GitHub Actions workflow named `WebCollect Chrome Extension Release` exists and triggers on tags matching `webcollect-*`.
- The previous Release failure root cause was `pnpm/action-setup@v4` receiving a hardcoded `version: 10.25.0` while `package.json` declares `packageManager: pnpm@9.0.0`. The workflow was fixed by removing the hardcoded pnpm version.
- The latest known successful workflow run produced the Release `webcollect-2026-06-13-80e1d90` with a Chrome extension zip asset.
- The user attempted to repair GitHub CLI auth on the Mac. Terminal showed success with `repo` and `workflow` scopes stored in `/Users/rockyx/.config/gh/hosts.yml`, but Codex's sandboxed command environment still intermittently reported invalid token and DNS failures. Treat Codex GitHub/DNS status as a known environment risk and run a preflight before any GitHub work.

### Required Preflight For Next Thread

Run these before making code changes:

```bash
git status -sb
git log --oneline --decorate -8
gh auth status
git ls-remote --heads origin main
gh release view webcollect-2026-06-13-80e1d90 --repo RockyXuan/webcollect --json name,url,tagName,assets
```

If `gh` or DNS fails inside Codex, do not keep retrying. Report that the GitHub environment is blocked and ask the user to verify from ordinary Terminal, or use the GitHub connector only if it is clearly available.

### Browser Workspace Rule

- For local development previews, prefer the Codex in-app Browser / `@Browser`.
- If Chrome is required, use the Chrome secondary window and the `Codex Workbench` tab group.
- Do not use the user's primary Chrome window or current active tab as the task workspace.
- If the browser context is occupied or changed by the user, return to `@Browser`, Safari, the Chrome secondary window, or `Codex Workbench`; do not repeatedly open new tabs in the user's main browser.

### Recommended Next Steps

1. Start from a fresh `main` checkout at or after `80e1d90`.
2. Confirm the latest Release asset can be downloaded and loaded as an unpacked Chrome extension.
3. On Windows, install the latest Release and retest:
   - Zoom wallpaper randomization across multiple new tabs.
   - Local bundled wallpaper startup speed and image clarity.
   - Bilingual quote rendering and idle hints.
   - Only explicit button entry from bookmark wall into Zoom mode.
   - 2x2 / 1x4 group layout resizing and cross-device layout memory.
   - Floating capture destination accuracy, especially saving to the selected section/group instead of the inbox.
   - Google login and Supabase sync stability on Windows and Mac.
4. Keep user data safety first: do not clear, reseed, overwrite, or push default/empty data over cloud data unless the user explicitly chooses the destructive reset flow.

Generated on 2026-05-25 for the WebCollect handoff from the Windows Codex thread to a new development thread.

## 1. Project Snapshot

WebCollect is a personal smart bookmark workspace: a Next.js web app plus a Chrome extension new-tab/content-script experience for collecting, organizing, searching, syncing, and restoring webpage collections.

Current stack:

- Next.js 16 App Router, React 19, TypeScript 5.
- Tailwind CSS 4 style layer plus project-specific `wc-*` glass UI classes.
- Zustand-style local store in `src/lib/store.ts`.
- Local persistence with `localforage` / IndexedDB.
- Supabase Auth + database sync for account-scoped data.
- Chrome Manifest V3 extension built with Vite in `extension/`.
- Drag/drop powered by `@dnd-kit`.

Current product goal:

- Preserve the existing data model and sync safety while continuing the UI/product polish: blue-glass hierarchy, global search, global bookmark bar, floating capture, cloud rollback, and non-disruptive edit mode.

## 2. Current Workspace State

Inspected workspace:

- Windows path used for the actual work: `C:\Users\asus\Documents\Codex\2026-05-02\https-github-com-rockyxuan-webcollect-coze`
- Remote: `origin https://github.com/RockyXuan/webcollect`
- Branch at inspection time: `ai-next-fixes`
- Last committed baseline before this handoff commit: `8bd2485 fix: stabilize sync drag and lessons`

Important note:

- A later shell context pointed to `C:\Users\asus\Documents\Codex\2026-05-17\rockyxuan-webcollect-https-github-com-rockyxuan`, but the meaningful git workspace and all current changes were in the 2026-05-02 directory above.

Uncommitted work at inspection time was large and intentional. It included:

- Web and extension blue-glass UI refresh.
- Global search command-panel behavior.
- Global pinned bookmark bar.
- Edit-mode jelly action docks.
- Floating capture widget and mascot assets.
- Cloud snapshot/version rollback support.
- Sync hardening and safety lessons.
- Review/test scripts and project notes.

Local-only files intentionally ignored and not meant for git:

- `tmp/`
- `LASTWEBCOLLECT MD.docx`
- `lastwebcollectthreadmd.txt`

## 3. How To Run

Install dependencies:

```bash
corepack pnpm install --frozen-lockfile
```

Start web development server:

```bash
corepack pnpm dev
```

The app is expected to run on port 5000 through the project scripts/server defaults unless overridden with `PORT`.

Type-check:

```bash
corepack pnpm ts-check
```

Lint:

```bash
corepack pnpm lint
```

Build Chrome extension:

```bash
corepack pnpm build:ext
```

Build the Next.js app with webpack:

```bash
corepack pnpm exec next build --webpack
```

Check whitespace:

```bash
git diff --check
```

Optional focused script checks:

```bash
corepack pnpm tsx scripts/test-workspace-search.ts
corepack pnpm tsx scripts/test-pinned-bookmarks.ts
corepack pnpm tsx scripts/test-cloud-snapshots.ts
corepack pnpm node scripts/generate-webcollect-review.mjs
```

Chrome extension loading:

1. Run `corepack pnpm build:ext`.
2. Open Chrome extensions page.
3. Load unpacked extension from `extension/dist`.

## 4. Key Files And Directories

- `README.md` - project overview. Some older Chinese text may appear garbled in Windows console output; prefer opening in an editor.
- `AGENTS.md` - repository rules. The most important rule is data safety: do not delete or overwrite user workspace data.
- `package.json` - scripts and dependency list.
- `src/app/page.tsx` - main WebCollect page composition.
- `src/app/globals.css` - primary web UI visual system, including the blue-glass `wc-*` classes.
- `src/components/nav/top-nav.tsx` - header, search input/dropdown, section tabs, account controls, bookmark bar placement.
- `src/components/bookmark/bookmark-bar.tsx` - global pinned bookmark bar UI and edit mode.
- `src/components/layout/sortable-grid.tsx` - main section/category/group layout, drag/drop, edit-mode docks.
- `src/components/card/web-card.tsx` - website card rendering, semantic icons, hover detail, pin controls, card action dock.
- `src/components/ui/edit-action-dock.tsx` - reusable jelly/floating action dock used by edit mode.
- `src/components/dialogs/card-dialog.tsx` - add/edit website modal.
- `src/components/dialogs/local-snapshot-dialog.tsx` - version rollback UI for cloud/manual/system/local snapshots.
- `src/components/auth/user-menu.tsx` - account/settings panel, sync controls, visual scale, floating capture settings.
- `src/components/hot-recommendation.tsx` - discovery/recommendation center.
- `src/lib/store.ts` - main client store and actions.
- `src/lib/db.ts` - local persistence helpers.
- `src/lib/sync.ts` - Supabase sync logic and safety checks.
- `src/lib/local-snapshots.ts` - local snapshot serialization and daily/manual backup helpers.
- `src/lib/cloud-snapshots.ts` - account-scoped cloud snapshot archive.
- `src/lib/workspace-search.ts` - global search index/scoring/tokenization.
- `src/lib/pinned-bookmarks.ts` - bookmark bar utilities and state helpers.
- `src/lib/visual-scale.ts` - visual-scale migration and rendering baseline.
- `src/lib/floating-capture.ts` - floating capture preference/shared helpers.
- `src/storage/database/shared/schema.ts` - Supabase schema types.
- `src/storage/database/supabase-init.sql` - SQL bootstrap/migration reference.
- `extension/background.js` - MV3 background bridge, context menu, capture handling.
- `extension/src/newtab-app.tsx` - extension new-tab React app.
- `extension/src/extension.css` - extension mirror of the Web UI styles; keep this in sync with important `wc-*` web CSS.
- `extension/src/content/floating-capture.ts` - content-script floating capture pill/panel.
- `extension/src/assets/mascots/` - extension mascot and WC/add-button assets.
- `public/assets/mascots/` - public mascot assets used by web/settings previews.
- `scripts/generate-webcollect-review.mjs` - read-only project review report generator.
- `scripts/test-workspace-search.ts` - focused search behavior checks.
- `scripts/test-pinned-bookmarks.ts` - focused bookmark-bar behavior checks.
- `scripts/test-cloud-snapshots.ts` - focused cloud snapshot serialization/dedupe checks.
- `tasks/todo.md` - running implementation checklist.
- `tasks/lessons.md` - important lessons and data-safety notes from this long thread.

## 5. What Has Been Done

Blue-glass UI refresh:

- Reworked the page, header, category panels, group panels, cards, settings panel, modals, and discovery surfaces around the same soft blue-glass language.
- Tightened spacing and visual scale so the current 100% should feel close to the old preferred 90% density.
- Strengthened card and panel boundaries so the UI is less washed out on different displays.
- Mirrored important visual classes into `extension/src/extension.css` so the extension does not lose web-only styling.

Global search:

- Added a pure front-end search index in `src/lib/workspace-search.ts`.
- Search now indexes section/category/group/card title, URL/domain, shortcut, description, long description, and notes.
- Search dropdown includes a Google search row plus internal WebCollect results with paths like `HODL / DEFI / pendle`.
- Multi-word matching supports partial memory cases such as searching by title pieces, notes, or descriptions.

Global pinned bookmark bar:

- Added `pinnedBookmarkItems` preference data and utilities.
- Added `src/components/bookmark/bookmark-bar.tsx`.
- Bookmark bar is global across sections and references existing cards rather than copying card data.
- Normal mode stays compact and avoids hover expansion.
- Bookmark bar edit mode enables drag sorting, label/display edits, and unpin behavior.

Edit-mode jelly action docks:

- Added `src/components/ui/edit-action-dock.tsx`.
- Category/group actions now float in a jelly/glass dock instead of taking layout space.
- Website card edit/delete/move actions are also presented through floating controls rather than widening the card.
- Goal: entering edit mode should preserve the normal layout dimensions.

Website cards:

- Added/expanded hover detail behavior so clipped titles/descriptions can be inspected without changing card width.
- Added hover pin-star behavior for card-to-bookmark actions while keeping normal card sizing stable.
- Added more semantic fallback icon logic for common Chrome/website labels.

Floating capture extension:

- Added content-script floating capture widget with chipmunk/otter mascot pill assets.
- Supports hover reveal, edge docking, dragging, context-menu capture, visible link prompt, and current-page capture.
- Added settings previews in the account panel.
- Uses committed local assets under `extension/src/assets/mascots/` and `public/assets/mascots/`; do not depend on Downloads.

Cloud snapshots/version rollback:

- Added account-scoped `workspace_snapshots` schema and cloud snapshot helpers.
- Manual save is intended to create a persistent cloud snapshot for the logged-in account.
- System automatic snapshots should dedupe to one latest entry per day.
- Rollback UI separates cloud manual saves, cloud daily automatic saves, and local fallback backups.

Sync safety:

- Hardened sync rules to avoid pushing a default/flattened local workspace over a richer cloud workspace.
- Added/reset sync markers and improved local-vs-cloud status display.
- Manual sync should trust the currently visible workspace, but destructive/default-state sync paths should stay guarded.
- Lessons recorded in `tasks/lessons.md`.

Discovery center:

- Polished recommendation cards/buttons/categories.
- Replaced Chinese letter shorthand category badges with more icon-like category signals where possible.

Project review tooling:

- Added `scripts/generate-webcollect-review.mjs`.
- Added focused test scripts for search, pinned bookmarks, and cloud snapshots.
- Added generated report under `docs/reports/`.

## 6. Important Decisions

- Do not treat Homely JSON or early seed imports as the latest WebCollect restore source unless the user explicitly asks. The user clarified those were old/import/reference data, not the current curated workspace.
- Manual snapshots must follow the account/cloud, not the local extension install. Deleting and reloading the extension must not erase manually saved versions.
- System snapshots should be daily-deduped. Do not create a new system backup every minute.
- Ordinary sync and rollback are separate concepts. Snapshot archive entries should be restore points, not automatic merge inputs.
- Do not overwrite cloud data with a suspicious local default state. Richer cloud structure should win unless the user intentionally resets/clears/restores.
- Keep extension styles in sync manually. The Chrome extension does not automatically receive all Next/global CSS behavior.
- The floating capture pill should use committed image assets, not the Windows Downloads folder.
- Edit mode should be non-layout-disruptive. Action controls should float above the layout and use tooltips/labels for clarity.
- The bookmark bar references existing cards. If a card is deleted or moved to trash, the bookmark bar should ignore the dead reference rather than copying stale site data.

## 7. Open Issues And Risks

- Browser visual QA was not completed in this final handoff pass. The builds pass, but the new thread should still inspect the UI in a real browser and extension.
- Supabase SQL must be applied/verified in the real project before cloud snapshot archive behavior is guaranteed for every account. Check RLS for `workspace_snapshots`.
- Lint currently passes with warnings, including `@next/next/no-img-element`, a stale `.eslintignore` warning, and one unused eslint-disable warning.
- Next build passes but warns that a custom Babel config disables SWC.
- Extension build passes but warns about a large chunk and an ineffective dynamic import warning.
- Old Windows console output can garble Chinese markdown text. Use an editor that preserves UTF-8 when editing docs/tasks.
- The worktree originally had large local-only artifacts: `LASTWEBCOLLECT MD.docx`, `lastwebcollectthreadmd.txt`, and `tmp/`. They are ignored now and should not be committed later.
- User data remains sensitive. Before any data migration, sync rewrite, restore script, or reset flow, create a cloud manual save and ideally a local export.
- The user is moving development to Mac mini, so paths will change. Do not hard-code Windows-only paths into application code.

## 8. Recommended Next Steps

1. Pull the branch on the Mac mini and read this file, `AGENTS.md`, `tasks/lessons.md`, and `tasks/todo.md`.
2. Run `git status -sb` before touching anything. Do not overwrite user changes.
3. Install dependencies with `corepack pnpm install --frozen-lockfile`.
4. Run the regression commands: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `corepack pnpm exec next build --webpack`, and `git diff --check`.
5. Start the app with `corepack pnpm dev` and visually verify the main page at the local URL.
6. Load `extension/dist` as an unpacked Chrome extension and test new-tab UI plus the content-script floating capture widget.
7. Verify global search with examples like `pendle`, `VPN`, and multi-word title/note fragments.
8. Verify the bookmark bar: pin from a card, edit the bar, reorder, unpin, refresh, and confirm persistence.
9. Verify edit mode: category/group/card jelly action docks should not change layout width/height.
10. Verify Supabase cloud snapshots on a logged-in account, including manual save, reload/reinstall survival, daily system dedupe, and restore.

## 9. Verification Log

Actually run during the recent work before this handoff:

- `corepack pnpm ts-check` - passed.
- `corepack pnpm lint` - passed with warnings:
  - 6 warnings total at handoff time.
  - Several `@next/next/no-img-element` warnings.
  - One unused eslint-disable warning in `src/app/api/supabase-config/route.ts`.
  - One unused `useState` warning in `src/components/dialogs/recycle-bin-dialog.tsx`.
- `corepack pnpm build:ext` - passed with Vite warnings:
  - main chunk larger than 500 kB.
  - one dynamic import warning.
- `corepack pnpm exec next build --webpack` - passed with known custom Babel/SWC warnings.
- `git diff --check` - passed, only CRLF conversion warnings from Git on Windows.
- `corepack pnpm tsx scripts/test-workspace-search.ts` - passed.
- `corepack pnpm tsx scripts/test-pinned-bookmarks.ts` - passed.
- `corepack pnpm tsx scripts/test-cloud-snapshots.ts` - passed.

Not fully verified in this handoff pass:

- Full browser visual QA after the final handoff files.
- Real Chrome extension reload on the user's Chrome profile after the latest handoff commit.
- Supabase RLS and migration execution against production/cloud database.
- Cross-device persistence from Windows to Mac mini.

## 10. Notes For Future Codex

- Start with code and git status. If this document conflicts with the code, trust code and `git status`.
- Do not assume old chat context is complete or reliable. This handoff is a summary, not a substitute for reading the changed files.
- Treat `tasks/lessons.md` as important guardrails, especially around data restoration and sync.
- Never use Homely import data as a recovery source unless the user explicitly asks.
- Keep `.gitignore` exclusions for local old-thread exports and `tmp/`.
- Do not commit real secrets, `.env*`, browser profile data, or downloaded thread exports.
- When changing web UI `wc-*` classes, check whether matching extension styles are also needed in `extension/src/extension.css`.
- When changing data structures, update `src/lib/types.ts`, local snapshots, cloud snapshots, sync, Supabase SQL/schema, and any focused test scripts together.
- Prefer incremental fixes over rewrites. The project has fragile user data and a long UI tuning history.
- Before major changes, ask the user whether they have made a current manual cloud save.

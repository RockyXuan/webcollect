# WebCollect Task Plan

## Current Task: 2026-07-14 V1.1.2 Account Sync Closeout

- [x] Back up main, local workspace state, and the existing private Supabase archive before account testing.
- [x] Fix clean-checkout Web OAuth configuration and verify only the public WebCollect anon role is exposed.
- [x] Prevent fresh Profiles from uploading a duplicate bootstrap inbox while preserving legitimate same-name inboxes in other sections.
- [x] Handle old-client same-section empty inbox duplicates deterministically without deleting them or routing new captures by database row order.
- [x] Remove consumed OAuth codes, restore custom-server HMR upgrades, and serialize the complete floating-capture queue drain.
- [x] Reuse one GoTrue client per browser context and preserve Supabase's browser-managed foreground/background auth refresh lifecycle.
- [x] Pass 129 Vitest cases, all 31 legacy scripts, all 13 Playwright cases, type check, lint, Web/extension builds, dependency audit, extension artifact/size, and isolated MV3 runtime.
- [x] Complete real Google OAuth sign-in/sign-out/re-sign-in and cloud sync in Profile A.
- [x] Publish and byte-verify the installable V1.1.2 RC3 Prerelease, including tag, unique zip, manifest, SHA-256, and local unpacked copy.
- [ ] Update the explicitly authorized signed-in Chrome from RC2 to RC3 without uninstalling it; verify manifest version, top-bar wallpaper switch, and real cloud wall.
- [ ] User completes Google account/security confirmation in the independent Profile B; verify two sessions and unchanged `364 / 130 / 24 / 58` cloud counts.
- [x] Run the production Web build in an isolated APFS-cloned workspace without interrupting the OAuth server.
- [ ] After both Profiles pass, finalize docs and publish the exact final V1.1.2 zip.

Current evidence: `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`.

## Current Task: 2026-07-12 V1.1.1 Independent Audit Closeout

- [x] Independently verify the PM Supabase split, PM GitHub/Vercel deployment, and old-project residue.
- [x] Create a fresh private WebCollect cloud backup and record counts/checksums before SQL.
- [x] Apply revision/tombstone/workspace-version migrations and verify unchanged legacy counts.
- [x] Disable the leftover PM login role and revoke its WebCollect privileges.
- [x] Remove legacy child-process configuration and service-role fallback.
- [x] Fix short-screen wallpaper settings reachability and section tab accessibility.
- [x] Repair stale persisted packaged wallpaper paths and prove zero obsolete `.jpg` requests in a real browser.
- [x] Fix cold-CI hydration readiness and make one guarded script the sole Release publisher.
- [x] Pass 117 Vitest cases, 31 legacy scripts, 12 Playwright cases, TypeScript, ESLint, production dependency audit, Web/extension builds, and isolated extension runtime.
- [x] Finalize `main`, GitHub tag/Release, and zip URL on the exact verified V1.1.1 commit.

Current evidence: `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`.

## Current Task: 2026-07-07 Full Project Audit Handoff Docs

- [x] Re-read current project handoff and summary docs -> Verification: inspected `HANDOFF.md`, `PROJECT_SUMMARY.md`, `NEXT_THREAD_PROMPT.md`, `tasks/lessons.md`, `tasks/todo.md`, `CODEX_GO_MODE_STATUS.md`, current git log, and version files.
- [x] Confirm data files are not being changed -> Verification: read `src/lib/seed.ts`; this task only adds/updates Markdown documentation.
- [x] Consolidate latest requirements for Claude audit -> Verification: added `AGD.md` and `docs/audit/webcollect-full-audit-brief-2026-07-07.md`.
- [x] Preserve screenshot context without fabricating missing assets -> Verification: added `docs/audit/user-screenshot-index-2026-07-07.md` and documented that old temp PNG files are no longer available.
- [x] Route future threads to the new audit entry -> Verification: updated `PROJECT_SUMMARY.md`, `HANDOFF.md`, `NEXT_THREAD_PROMPT.md`, `tasks/lessons.md`, and `README.md`.
- [x] Prepare docs for GitHub main -> Verification: staged documentation passes `git diff --cached --check`; final commit/push status is reported in the task response.

## Claude Full-Audit Backlog

- [x] Add Claude code-review handoff -> Verification: `docs/audit/claude-code-review-handoff-2026-07-07.md` lists implementation progress, repeated failures, wallpaper risks, UI issues, and self-assessment.
- [ ] P0: Re-audit floating capture destination placement -> Verification: existing/new target, new section/category/group, queue replay, stale explicit target fail-safe.
- [ ] P0: Re-audit metadata extraction relevance -> Verification: social-source external links, doc/product homepages, GitHub, YouTube/X, and target/source host mismatch cases.
- [ ] P0: Re-audit edit mode dangerous actions -> Verification: clicking tabs in edit mode never triggers delete; delete is only in explicit menu/dialog path.
- [ ] P1: Re-audit squirrel branding in a real installed extension -> Verification: toolbar icon, context menu icon, manifest icons, retina clarity, and right-click menu behavior.
- [ ] P1: Re-audit Web/extension CSS parity -> Verification: tab hover, active, editing, dialogs, floating panel, long text overflow.
- [ ] P1: Re-audit sync safety -> Verification: local-first startup, cloud restore, multi-tab fences, reset marker, rollback snapshot coverage.
- [ ] P2: Improve screenshot evidence discipline -> Verification: future screenshots copied into `docs/audit/screenshots/` and indexed in `docs/audit/user-screenshot-index-2026-07-07.md`.

## Current Task: Corner Polish And Floating Capture Panel UX

- [x] Remove category top-corner visual leaks -> Verification: category decorative pseudo layer stays disabled, and category headers now clip their own glass background to inherited top rounded corners.
- [x] Shrink the floating capture side tool to about two-thirds size -> Verification: default `sizeScale` is `0.67`; built script measured button size `159x48`.
- [x] Add user-adjustable floating capture size controls -> Verification: user menu now has a `浮窗大小` slider plus `小 / 中 / 原始` presets backed by persisted capture prefs.
- [x] Keep the capture panel usable after adding new destinations -> Verification: panel body scrolls, actions are sticky, and a long create-section/category/group state keeps `保存 / 取消` visible.
- [x] Make the capture panel movable and persistent -> Verification: panel header drag updates `webcollect.capture.panelPosition`; clicking outside does not close the panel.
- [x] Swap capture panel action order -> Verification: panel actions render `保存` on the left and `取消` on the right.
- [x] Run verification -> Verification: floating capture health, layout preference tests, TypeScript, ESLint, extension build, diff check, Browser page smoke, and dedicated Chrome floating-capture injection test pass.

## Review

This pass is scoped to UI polish and floating-capture ergonomics. It does not change bookmark data, sync schema, capture queue semantics, or cloud APIs. The main app Browser smoke check used `http://localhost:5015/`; the deeper floating-capture check injected the built `extension/dist/assets/floating-capture.js` into a dedicated Chrome page with a mocked extension API and verified the actual shadow-DOM behavior.

## Current Task: Layout Drag Stability And Floating Capture Recovery

- [x] Rework parent category sizing to wrap real group rows -> Verification: `getParentContentWidthRem` now packs fixed group widths, ignores historical `widthPercent` for rendered width, and browser measurements show right blank under 30px in both checked viewports.
- [x] Stop group/card drag UI from being clipped by parent glass panels -> Verification: category body, category panel, and group panel now use visible overflow in both Web and extension CSS.
- [x] Keep group card columns fixed across resolutions -> Verification: Web and extension card grids use `repeat(var(--wc-card-columns), ...)`; layout tests confirm saved/legacy column intent is stable.
- [x] Restore floating capture injection visibility -> Verification: `floating-capture.js` is built as a classic IIFE content script instead of ESM with top-level imports, and the health test checks manifest, assets, prefs recovery, and built output.
- [x] Add floating capture self-healing and recovery entry -> Verification: legacy hidden prefs normalize back to visible, expired pause clears, and the user menu exposes `恢复小松鼠浮窗`.
- [x] Run focused and broad verification -> Verification: layout scripts, floating capture health/target scripts, description/icon scripts, TypeScript, ESLint, extension build, diff check, and dedicated Chrome layout/health checks pass.
- [x] Commit, push, package, and publish release -> Verification: pushed commit `dfd23fc`, published tag `webcollect-2026-06-25-layout-floating-fix`, and uploaded `WebCollect-Chrome-Extension-layout-floating-fix-2026-06-25.zip`.

## Review

This task fixes the two current blockers without touching bookmark data or cloud schema. Parent categories now fit their actual subgroup rows instead of preserving old percent widths that created huge blank panels; subgroup/card grids keep fixed columns across display sizes; overflow is visible so drag/menu layers are not trapped by rounded parent cards. Floating capture was likely disappearing because the built content script was emitted as ESM while Chrome manifest content scripts run as classic scripts. The build now emits a separate IIFE content script and adds health markers plus preference recovery. Automated Chrome command-line extension auto-load was limited in this environment, so the browser proof uses a dedicated Chrome page, built-script injection, and mocked extension API; the package build itself is now structurally correct for real Chrome installation. The downloadable release asset is named with the date at the end.

## Current Task: Lock Hint, Compact Category Layouts, And Wallpaper Quote Matching

- [x] Replace blocking locked-layout alerts with a near-pointer hint -> Verification: source has no `window.alert`/`alertLayoutLocked` path for locked layout, and dedicated Chrome measured `alertCount = 0` with the lightweight hint visible.
- [x] Make lock state visually clear -> Verification: locked categories use a stronger lock button state with closed/open lock icons, larger icon size, tooltip, and `aria-pressed`.
- [x] Compact category whitespace from historical widths -> Verification: subgroups now use content-fit rem widths based on stable card columns instead of percent flex-basis; parent panels fit the actual row width.
- [x] Preserve cross-resolution column consistency -> Verification: dedicated Chrome at 2048x1200 and 1440x1000 kept `download / YT TT INS X` at 2 columns and `download / 其他` at 1 column.
- [x] Improve wallpaper quote semantic matching -> Verification: mountain/cliff/rock/canyon assets avoid water/tide quotes, normal modes avoid WebCollect synthetic quote sources, and wallpaper display reselects a real-source quote when old cached synthetic quotes are present.
- [x] Run verification -> Verification: layout scripts, wallpaper scripts, TypeScript, ESLint, extension build, diff check, and dedicated Chrome visual checks pass.

## Review

Locked category resizing now shows a non-blocking hint instead of a modal confirmation, and the lock button state is easier to read. Category panels now ignore old percent flex-basis values for actual wrapping, so the red-box empty-space issue is reduced to a small breathing gap while keeping saved card-column intent stable across resolutions. Wallpaper quote selection now rejects WebCollect-origin filler in normal modes and prioritizes semantically related sourced bilingual quotes for mountain/rock scenes.

## Current Task: Localize English Web Descriptions

- [x] Add shared English-description localization helper -> Verification: `src/lib/description-translation.ts` detects all-English text and returns Chinese summaries for known sites/common phrases.
- [x] Migrate existing card descriptions on load -> Verification: `loadData` calls `localizeCardDescriptions(cards)` and saves changed cards.
- [x] Localize floating capture descriptions before save -> Verification: content script localizes visible textarea/meta text, and queue drain localizes again before creating `WebCard`.
- [x] Localize manual add/edit dialog descriptions -> Verification: metadata fetch and submit paths call `localizeDescriptionText`.
- [x] Run verification -> Verification: description translation test, floating capture target test, TypeScript, ESLint, extension build, and diff check pass.

## Review

WebCollect now has a shared local description-localization layer. It does not depend on a private API key or network translation service, so floating capture can still save reliably offline. Known sites such as Gmail, GitHub, YouTube, X/Twitter, Discord, Bilibili, OpenAI/ChatGPT, DeepSeek, Notion, Figma, TweetMesh, and Pendle get targeted Chinese summaries; unknown all-English descriptions get a Chinese fallback summary instead of staying as a full English paragraph. For professional arbitrary sentence-by-sentence translation, a future pass should add a backend translation proxy or a stable browser translation API.

## Current Task: Cloud Sync Refresh And Floating Capture Targets

- [x] Make manual cloud sync bidirectional -> Verification: `manualSync` now runs full `syncData(user.id)` even when the Mac has no local dirty changes, then reloads the protected local view.
- [x] Make the header refresh cloud-aware -> Verification: logged-in refresh first runs manual cloud sync, then reloads with collapse protection; local-only refresh remains available when logged out.
- [x] Prevent refresh collapse from replacing the visible wall -> Verification: `loadData({ preserveOnCollapse: true })` keeps the previous UI if the new result looks suspiciously smaller.
- [x] Fix explicit floating-capture destinations -> Verification: selected targets such as `主页 / 常用 / 看世界` resolve by ID or exact path and fail visibly if stale, instead of falling into the default inbox.
- [x] Refresh floating-capture destination cache after data loads -> Verification: data reload publishes destination cache updates for the extension popup/content script path.
- [x] Run focused and broad verification -> Verification: sync/capture tests, startup/cloud/search/layout/icon/wallpaper scripts, TypeScript, ESLint, extension build, local HTTP check, and Safari UI refresh smoke check pass.
- [x] Commit, push, package, and publish the new extension release -> Verification: release tag `webcollect-2026-06-24-sync-refresh-capture` is the target package for this fix.

## Review

Manual cloud sync and the top refresh action now pull cloud changes before repainting the wall, so another device's saved card should no longer require a full page reload or local dirty change to appear. Refresh has a guard against transient collapsed snapshots, and floating capture now treats an explicit user-selected destination as authoritative: stale IDs are resolved by exact section/category/group names, and unresolved explicit targets stay failed instead of silently saving to `主页 / 节流 / 收集箱`. The published package still needs the user to confirm the real Windows-to-Mac path with live data.

## Current Task: Expand Wallpaper Library And Background Refresh

- [x] Preserve current wallpaper/bookmark behavior boundaries -> Verification: this task only adds wallpaper store/shell/data/test/asset changes on top of the existing uncommitted UI search/menu work.
- [x] Fix refresh root causes -> Verification: remote/curated wallpapers can become the current wallpaper, refresh checks run from wallpaper mode on startup/focus/online/interval, and cached local image coverage increases beyond current+next.
- [x] Expand local packaged fallback set -> Verification: 8 files exist in `public/assets/wallpapers` and `extension/dist/assets/wallpapers`; the curated registry points those packaged entries to local `/assets/wallpapers/...` URLs.
- [x] Improve quote/image matching -> Verification: additional quote IDs exist and curated/remote inference maps space, water, mountain, city, animal, and earth/fire scenes to more fitting bilingual quotes.
- [x] Run focused tests and rendered verification -> Verification: wallpaper data/wiring tests, `ts-check`, `lint`, `build:ext`, `git diff --check`, and Browser smoke check pass.

## Review

Wallpaper rotation is no longer restricted to packaged images on startup, so remote curated/fetched images can become the active wallpaper. Online refresh now checks from wallpaper mode on startup, focus, visibility return, network return, and a 30-minute background cadence while respecting a 6-hour refresh gate. Successful remote refreshes prefer a newly fetched wallpaper, and local browser caching now covers up to 8 images instead of only current+next. Two curated Wikimedia/USGS images were downloaded into `public/assets/wallpapers`, bringing the packaged fallback and extension build output to 8 images. Quote matching now includes additional bilingual quote IDs and uses title-first inference so source names such as “Wiki Loves Earth” do not misclassify animal photos. Verified with focused wallpaper scripts, static checks, extension build, diff check, and an in-app Browser wallpaper smoke check showing a remote NASA wallpaper with no console errors.

## Current Task: Keep Header Search From Filtering Wall

- [x] Remove wall-level search filtering from `SortableGrid` -> Verification: typing in the header search no longer changes which categories, groups, or cards render in the wall.
- [x] Preserve the header search panel behavior -> Verification: `TopNav` still uses `searchWorkspace` for dropdown suggestions and target navigation.
- [x] Run static and rendered verification -> Verification: type/lint/build checks pass and Browser confirms wall counts stay stable while search results open.

## Review

Header search now only drives the floating search panel. The dashboard wall no longer reads `searchQuery`, so categories, groups, and cards stay rendered while the user types. `TopNav` still runs `searchWorkspace` for dropdown suggestions and target navigation. Verified with `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `git diff --check`, and an in-app Browser interaction where typing `Pendle` kept the wall at 1 category and 1 card while showing the search panel.

## Current Task: Unify Group And Card Action Menus

- [x] Move group/category edit controls back into the three-dot action menu -> Verification: group and category headers no longer show a separate pencil button; the first menu action is the pencil edit action.
- [x] Make website cards use the same hover three-dot action pattern -> Verification: card hover shows a three-dot trigger with edit, create/group, ship, and delete actions while preserving the star pin button.
- [x] Mirror styling in Web and Chrome extension CSS -> Verification: `src/app/globals.css` and `extension/src/extension.css` keep card action trigger and star positions consistent.
- [x] Run focused verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, and `corepack pnpm build:ext`.

## Review

This task only changes UI action presentation. Group/category edit actions are folded back into the existing three-dot dock, website cards now use the same three-dot dock pattern, and the star pin button remains available. No sync, IndexedDB, Supabase, seed data, drag IDs, or card/category mutation logic was changed.

## Current Task: 2026-06-14 Thread Handoff And Release Continuity

- [x] Identify the correct latest source -> Verification: latest clean copy is `/private/tmp/webcollect-main-docs-rules-copy`, with `main` at `80e1d90`; old `/Users/rockyx/Documents/webcollect` is stale and dirty.
- [x] Record the latest successful Release -> Verification: `webcollect-2026-06-13-80e1d90` has a Chrome extension asset named `WebCollect-Chrome-Extension-webcollect-2026-06-13-80e1d90.zip`.
- [x] Record GitHub environment risk -> Verification: ordinary Terminal showed repaired auth, but Codex shell still observed token/DNS failures; next thread must preflight and stop on failure.
- [x] Update handoff prompt for the next thread -> Verification: `HANDOFF.md` and `NEXT_THREAD_PROMPT.md` now describe latest main, Release, browser workspace rules, and next validation priorities.
- [ ] Next thread should verify Windows install and continue product fixes -> Verification pending in new thread.

## Review

This task is documentation-only. It prepares a clean stage handoff so the next Codex thread does not continue from stale local code or old Release assumptions. It does not change app behavior, user data, sync logic, IndexedDB, Supabase rows, or Chrome extension runtime code.

Use this file for every non-trivial task before implementation.

## Current Task: Cloud Account Snapshot Archive

- [x] Find the root cause of missing manual versions -> Verification: header save only wrote `localSnapshotHistory` in localforage; Supabase had no account-level snapshot table.
- [x] Add an account-scoped cloud snapshot archive -> Verification: `workspace_snapshots` exists in Supabase with RLS, manual/system kinds, full workspace payload, and daily system uniqueness.
- [x] Connect manual save and daily automatic backup -> Verification: header save writes local fallback plus cloud manual snapshot when logged in; local safety snapshots upsert one cloud system snapshot per day.
- [x] Separate cloud and local rollback views -> Verification: rollback dialog now shows cloud manual saves, cloud daily auto saves, and local fallback backups separately.
- [x] Add a deterministic review script -> Verification: `scripts/generate-webcollect-review.mjs` writes `docs/reports/webcollect-review-2026-05-18.md`.

## Review

Manual saves now follow the logged-in account instead of only the extension install. Local snapshots remain as a safety net, but the durable restore points are in Supabase `workspace_snapshots` and are not part of normal sync merge.

## Current Task: Floating Mascot Pill Fidelity

- [x] Keep the confirmed animal heads unchanged -> Verification: floating capture now uses the existing chipmunk/otter head PNGs for both peek and expanded states instead of redrawing animals.
- [x] Rebuild the expanded pill as separated layers -> Verification: the old whole-pill image is replaced with a capsule shell, animal head layer, real `wc-3d.png`, and real `plus-3d.png`.
- [x] Persist the downloaded artwork inside the extension project -> Verification: `wc-3d.png` and `plus-3d.png` are trimmed transparent PNG assets under `extension/src/assets/mascots/` and copied into `extension/dist/assets/mascots/` by the extension build.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm build:ext`, `corepack pnpm lint`, and `git diff --check` pass.

## Review

This pass only changes the visual construction of the floating capture side button. Capture queueing, hover-link draft inference, panel fields, drag docking, preferences, and storage behavior are unchanged.

## Current Task: Header Save Shortcut And Capture Autofill

- [x] Move manual version save to the homepage header -> Verification: header now has a `保存` action before `刷新`, backed by the existing manual local snapshot API; rollback dialog no longer owns the save button.
- [x] Compact the right-side toolbar -> Verification: add actions now read `网页`, `分组`, and `分类` with plus icons, and the sync status badge is narrower in both web and extension styles.
- [x] Improve floating capture URL/title inference -> Verification: hover capture now prefers visible real URLs over known redirect links such as `t.co`, and derives concise titles/descriptions from nearby page text.
- [x] Replace the hover WC bubble with the selected mascot -> Verification: the hover trigger uses the chipmunk/otter head asset and hides when the capture panel is open.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, and `git diff --check` pass.

## Review

This pass keeps snapshot storage, sync payloads, queued capture storage, and WebCollect import logic unchanged. It only moves the manual save entry point, compresses header chrome, and improves the content-script draft shown before saving.

## Current Task: Edit Mode Width And Hover Details

- [x] Make section tabs clearer in edit mode -> Verification: edit-mode section controls no longer reserve hidden inline width; rename is discoverable through a dashed editable tab and hover actions.
- [x] Give website tiles a wider edit-mode layout -> Verification: edit mode uses `--wc-site-tile-edit-width` and expands child group panel widths, while normal mode keeps the fixed short tile width.
- [x] Add hover detail cards for clipped content -> Verification: hovering a site tile opens a delayed detail card with title, URL, summary, full description, and notes when available.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, and `git diff --check` pass.

## Review

This task only adjusts editing affordance, tile sizing, and hover display. It does not change card/category data ownership, sync, storage, restore, or drag IDs.

## Current Task: Snapshot Archive And Fixed Tile Widths

- [x] Separate manual saves from system snapshots -> Verification: the rollback dialog now renders manual snapshots and system automatic snapshots in separate sections.
- [x] Keep system snapshots lightweight -> Verification: local snapshot pruning now keeps only the latest non-manual snapshot for each local day while preserving manual saves separately.
- [x] Keep website tiles a consistent length -> Verification: site tiles use a shared `--wc-site-tile-width`, and group grids place fixed-width columns instead of stretching items with `1fr`.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, and `git diff --check` pass.

## Review

This task only adjusts rollback history retention/display and visual tile sizing. It does not change Supabase schema, restore semantics, sync payload shape, drag IDs, card/category ownership, or user content data.

## Current Task: High-Fidelity Blue Glass UI Phase 1

- [x] Re-read the exported UI brief and current implementation gap -> Verification: prior completed pass is visually insufficient; restart from first-viewport shell only.
- [x] Rebuild visual tokens and global shell styling -> Verification: `globals.css` now defines the blue-purple glass background, header, action, tab, and logo primitives used by the reference.
- [x] Rebuild Header and section Tabs without touching data logic -> Verification: `TopNav` keeps existing callbacks/store methods while replacing old dense chrome and mojibake labels.
- [x] Bridge the same visual system into the Chrome extension stylesheet -> Verification: `extension/src/extension.css` now contains the `wc-*` blue glass classes and the built `extension/dist/assets/main.css` includes `wc-app-header`, `wc-header-primary`, `wc-glass-card`, and `wc-site-tile`.
- [x] Verify Phase 1 with static checks and extension build -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, and `corepack pnpm build:ext` pass. Automated browser screenshot is still pending because Playwright is not installed in this workspace and no active Browser tool is available in this turn; stop here for user visual review before moving to deeper dashboard-card styling.

## Review

Phase 1 is intentionally limited to the visual foundation and top navigation shell. It does not change Supabase sync, IndexedDB, import/warehouse logic, drag/drop data behavior, seed data, or user content. The broken extension screenshot was caused by the extension build using `extension/src/extension.css` instead of Next's `src/app/globals.css`; the missing `wc-*` classes have now been duplicated into the extension stylesheet. Extension build and static checks pass; the next checkpoint is user visual review after reloading `extension/dist`.

## Current Task: Blue Glass Dashboard Phase 2

- [x] Add dashboard/card-wall visual classes without changing data flow -> Verification: `sortable-grid.tsx` only receives presentational `wc-*` classes around existing category, group, ungrouped, and card-list render paths.
- [x] Style parent category panels and subgroup panels as layered blue glass cards -> Verification: `src/app/globals.css` and `extension/src/extension.css` share matching dashboard CSS for Web and Chrome extension builds.
- [x] Improve site tile flow inside groups -> Verification: group card lists use a responsive grid so tiles wrap into compact rows instead of long sparse strips.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, and `git diff --check` pass.

## Review

Phase 2 is limited to homepage/dashboard visual polish. It adds the large glass parent panels, softer subgroup cards, responsive tile grids, and an ungrouped glass panel while preserving existing drag IDs, store calls, sync code, database code, import code, and user data. Lint still reports the same pre-existing warnings only; extension build succeeds and outputs the refreshed `extension/dist`.

## Current Task: Quiet Floating Capture Hover

- [x] Restrict default hover capture to explicit visible URL text -> Verification: sidebar/nav links do not show the hover trigger, while visible URLs such as `github.com/...` do.
- [x] Add an opt-in all-links hover mode with warning -> Verification: default is off and enabling it asks for confirmation.
- [x] Replace the hover text pill with a delayed WC round trigger -> Verification: no standalone hover text pill appears; the WC trigger appears after 0.7s and opens the form only when clicked.
- [x] Run verification and rebuild extension package -> Verification: type check, lint, extension build, diff check, and zip rebuild.

## Review

Quieted the floating capture hover path without touching sync, drag, or main data storage. By default, hover capture now only reacts to links whose visible text looks like an explicit URL; the noisy all-link hover mode is local-only, off by default, and asks for confirmation before enabling. The old text pill is replaced by a delayed round WC trigger with a progress ring, and the form opens only after clicking the WC trigger. Verification passed with type check, lint warnings only, extension build, diff check, and rebuilt extension zip.

## Current Task: Polish Floating Capture And Ungrouped Editing

- [x] Refresh floating capture destinations when the panel opens -> Verification: user sections/categories/groups appear in the floating form instead of stale defaults.
- [x] Clarify floating capture pause/disable controls and improve the WC trigger -> Verification: pause/per-site disable text is understandable and the trigger is compact.
- [x] Add an edit/exit entry to the ungrouped area -> Verification: the ungrouped area can enter and leave edit mode without relying on another category.
- [x] Constrain card description text width -> Verification: long descriptions truncate inside the card and full text remains available on hover.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, extension type check, lint, extension build, Next production build, diff check, and zip rebuild.

## Review

Polished the floating capture widget without touching sync or drag storage logic: the panel refreshes destination cache every time it opens, the target lists include sections, parent categories, and group candidates, and the current-site disable action is now labeled as permanent hiding with an account-menu restore path. The floating trigger is a compact WC button. The unclassified area now has its own edit/exit control, and card descriptions are width-constrained with ellipsis plus full text available through hover/title. Verification passed with type checks, lint warnings only, extension build, Next production build, diff check, and rebuilt extension zip.

## Current Task: Recover Lost Layout And Add Rollback Snapshots

- [x] Locate the best recoverable previous snapshot/cache without writing over current data -> Verification: cloud read attempt was non-mutating; current code now preserves future local versions because previous full snapshots were not available in the old build.
- [x] Add full local version snapshots before sync/restore/push operations -> Verification: snapshot history stores full main, warehouse, recycle-bin, section, and preference data with counts and timestamps.
- [x] Add a user-visible rollback path for local snapshots -> Verification: logged-in user menu now exposes version rollback and manual snapshot save.
- [x] Strengthen sync guards against collapsed/empty layouts overwriting richer layouts -> Verification: much smaller local snapshots now pull/merge instead of pushing, and guarded layouts prefer cloud `collectionSections/categorySectionIds`.
- [ ] Run verification and rebuild extension package -> Verification: `pnpm` checks pass; production builds currently hit Windows `spawn EPERM` in this sandbox.

## Review

Added versioned local rollback protection for the whole WebCollect data shape: sections, categories, cards, recycle bin, warehouse data, and preferences. Sync and push now create safety snapshots before touching cloud, real local edits schedule an automatic local snapshot, and the user menu exposes a manual save/restore dialog. Cloud push now refuses to replace richer cloud data with a much smaller local snapshot, and guarded restore paths prefer cloud section preferences instead of flattening sections back into the homepage. Recycle-bin destructive paths now re-read IndexedDB before writing and create a local snapshot first.

Verification so far: `corepack pnpm ts-check`, `corepack pnpm lint`, and `git diff --check` pass. `corepack pnpm build:ext` and `next build --webpack` are blocked in this environment by Windows `spawn EPERM` / Tailwind native module loading; escalation attempts timed out.

## Current Task: Prevent Cloud Section Collapse On Reinstall

- [x] Stop first-run seeding from clearing restored cloud data -> Verification: `initialized=false` only seeds the inbox when local cards/categories are truly empty.
- [x] Await login restore before local page initialization mutates IndexedDB -> Verification: cached-session startup does not race cloud restore against `loadData`.
- [x] Protect cloud multi-section layout from default-home local snapshots -> Verification: default-only local section state cannot overwrite cloud `collectionSections/categorySectionIds`.
- [x] Improve cloud push speed for cards -> Verification: cards are upserted in chunks instead of one request per card.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, rebuild zip.

## Review

Fixed the reinstall/login race that allowed a fresh extension's empty/default local homepage to mark itself newer than the cloud snapshot and collapse cloud sections back into `主页`. First-run initialization now only creates a minimal inbox when local data is truly empty; cached-session auth restore awaits cloud sync before the page starts local initialization; `loadData` migrations no longer emit local-change signals; and cloud push refuses to overwrite a real multi-section cloud layout with a default-only local layout. Card uploads now batch in chunks instead of one request per card. Verified with type check, lint, extension build, Next production build, `git diff --check`, and rebuilt `WebCollect-extension-dist.zip`.

## Current Task: Optimize Wall Layout And Top Sync Action

- [x] Stop sparse categories/groups from stretching across the whole row -> Verification: parent blocks and child groups no longer use flex-grow to consume leftover space.
- [x] Make dense groups wrap into comfortable multi-row blocks -> Verification: 8-10 cards default to a medium-width block instead of one very long strip.
- [x] Make the top sync badge clickable for manual cloud sync -> Verification: user can trigger cloud sync from the visible badge without opening the avatar menu.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, rebuild zip.

## Review

Adjusted the wall layout so parent category blocks and child group blocks use content-sized flex bases instead of growing to fill empty horizontal space. Sparse groups now stay compact, while denser 8-12 card groups default to medium-width blocks that wrap into multiple rows. The visible top sync badge is now clickable and runs manual cloud sync directly; if nothing changed locally, it returns success without doing an unnecessary cloud push. Verified with type check, lint, extension build, Next production build, and rebuilt `WebCollect-extension-dist.zip`.

## Current Task: Fix Chrome Internal Links And Link Open Modes

- [x] Route card opening through a platform-aware helper -> Verification: extension uses `chrome.tabs` for `chrome://...` URLs instead of raw `window.open`.
- [x] Add a persisted three-mode link opening preference -> Verification: user can choose background new tab, active new tab, or current tab from the top bar.
- [x] Include the preference in cloud sync without changing user content data -> Verification: preference key syncs alongside existing preferences only.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, rebuild zip.

## Review

Card clicks now go through a platform-aware opener. In the Chrome extension, WebCollect uses `chrome.tabs.create` / `chrome.tabs.update`, so Chrome internal URLs such as `chrome://history`, `chrome://settings`, and `chrome://extensions` are not routed through a normal page anchor. Added a persisted top-bar opening-mode selector with three modes: stay on WebCollect, switch to a new tab, and open in the current tab. The preference is stored locally and synced as `linkOpenMode`; no category, card, recycle-bin, or warehouse data was changed for this task. Verified with type check, lint, extension build, Next production build, and rebuilt `WebCollect-extension-dist.zip`.

## Current Task: Fix Group Move Data Loss And Sync Feedback

- [x] Fix category/group move so cards are not orphaned or left in an empty visible source group -> Verification: card drops on parent categories resolve to a renderable child group.
- [x] Reduce sync backup payload and hide raw HTML 520 errors from UI -> Verification: backup writes only counts/samples and sync errors are summarized.
- [x] Add visible top-bar sync status -> Verification: user can see syncing/synced/failed without opening the account menu.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `next build --webpack`, rebuild zip.

## Review

Implemented a focused guard for card moves into parent categories, compacted sync backups so `syncBackups` no longer stores full snapshots, summarized HTML/520 Supabase errors, and added a top-bar sync status badge. Static Web and extension builds pass; Next dev server start was attempted but the local dev process hung on requests, so it was stopped.

## Current Task: Stabilize Drag UX And Split Local/Cloud Sync Status

- [x] Stabilize drag overlay and drop layout -> Verification: drag originals no longer transform under the overlay, parent and ungrouped sort contexts are separated, and wrapped grids use rect sorting.
- [x] Make category/card drops deterministic -> Verification: drops into parent/ungrouped/group areas still resolve through explicit prefixed IDs and parent card drops resolve to renderable child groups.
- [x] Split sync display into local saved + cloud sync -> Verification: top bar shows immediate local saved state and separate cloud queued/syncing/synced/failed state.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `next build --webpack`, rebuild zip.

## Review

Reduced drag visual chaos by keeping the source item in place as a faint placeholder, using rect-grid sorting for wrapped cards/groups, and splitting parent categories from the ungrouped area into separate sortable contexts so a demotion drag no longer makes the whole wall reorder as one list. Sync feedback now reports local saved state immediately and cloud sync separately with queued/syncing/synced/failed states. Verified with type check, lint, extension build, Next production build, rebuilt zip, and a local HTTP 200 smoke check on port 5001. Playwright/browser automation was not available in this environment, so the drag interaction itself was validated by code path and build checks rather than an automated pointer simulation.

## Current Task: Fix Initial Sync Label And Parent Promotion Visibility

- [x] Suppress local-saved label during cloud restore -> Verification: startup/cloud download can show cloud syncing without claiming a local edit was saved.
- [x] Keep cards visible when a group is promoted to a parent category -> Verification: promoted groups with cards create/use a visible child group and cards do not disappear.
- [x] Add a refresh insurance action -> Verification: user can reload local IndexedDB state from the top bar if display state looks stale.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `next build --webpack`, rebuild zip.

## Review

Cloud restore now suppresses local-change events and clears the local-saved timestamp while initial sync is running, so the top badge no longer says local data was saved before the cloud snapshot has come down. Promoting a standalone group/subgroup into a parent category now repairs direct parent cards by creating or using a visible child inbox and moving those cards into it, preserving card data and making it render immediately. Added a top-bar refresh action that reloads local IndexedDB state as a safety valve. Verified with type check, lint, extension build, Next production build, rebuilt extension zip, and a local HTTP 200 smoke check.

## Current Task: Make Multi-Tab Sync Non-Destructive

- [x] Change auto cloud sync to periodic dirty-only sync -> Verification: local edits mark the snapshot dirty, cloud sync checks every 3 minutes, and no network push is attempted when local is already synced.
- [x] Prevent stale tabs from overwriting newer local data -> Verification: every cloud push re-reads IndexedDB and refuses to push over a newer cloud snapshot without pulling/merging first.
- [x] Prevent cloud restore from overwriting edits made during restore -> Verification: if local data changes while cloud is loading, restore merge aborts and pushes the latest local snapshot.
- [x] Ensure edited cards get fresh timestamps -> Verification: card edits and moves update `updatedAt`, so old cloud rows cannot win timestamp comparison.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `next build --webpack`, rebuild zip, local HTTP 200 smoke check.

## Review

Auto sync now behaves as background dirty-only sync: local edits save immediately, mark the snapshot dirty across tabs through a localStorage signal, and cloud sync runs on a 3-minute interval only when local data is newer than the last successful cloud push. Push and restore paths now use snapshot version guards so stale tabs should not overwrite newer local or cloud data. Card edits and moves refresh `updatedAt`, reducing the chance that an old cloud row wins a merge. Verified with type check, lint, extension build, Next production build, rebuilt extension zip, and HTTP 200 smoke check.

## Current Task: Recover Flattened Layout Without Deleting Data

- [x] Confirm whether data is gone or relationship metadata is flattened -> Verification: local/visible state still contains many groups/cards; Supabase has 122 category rows and 300 card rows.
- [x] Add a conservative repair path for imported Homely structure -> Verification: repair creates a local snapshot first and only relinks existing cards/categories; it does not create duplicate cards.
- [x] Expose repair and rollback actions in the user menu -> Verification: user menu includes `版本回档` and `修复导入结构`.
- [ ] Build and package the extension -> Verification: `corepack pnpm build:ext` and zip rebuild.

## Review

The current broken UI is not a total data wipe: the content rows still exist, but section/category relationships were flattened into the default homepage/ungrouped layout. Added a guarded repair action that snapshots first, reconstructs known Homely-derived parent/child and section relationships, and avoids creating new cards when URLs do not match existing data. Type check and lint pass; extension packaging is currently blocked by the Windows sandbox failing to load Tailwind's native module and Vite's `spawn` call.

## Current Task: Add Confirmed Clear Flow And Fix Snapshot UI Encoding

- [x] Repair local snapshot and rollback dialog encoding/syntax -> Verification: `corepack pnpm ts-check` passes and the dialog strings no longer contain broken template literals.
- [x] Add a triple-confirmed "save version and clear data" action -> Verification: action saves a full local snapshot first, then clears main data, recycle bin, warehouse, and preferences only after two confirms plus typed confirmation.
- [x] Allow only this explicit clear flow to push a destructive cloud snapshot -> Verification: `pushLocalSnapshotToCloud(userId, { allowDestructiveClear: true })` bypasses the normal anti-data-loss guards only for the confirmed clear path.
- [x] Prevent extension startup/auth errors from freezing the new tab -> Verification: extension init catches auth restore errors, still loads local IndexedDB, and first-run seeding only happens when local cards/categories are truly empty.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `git diff --check`, and `WebCollect-extension-dist.zip` rebuild.

## Review

Added a safer reset path for reimport testing without silently deleting data. The user menu now has a destructive action that first stores a full rollback snapshot, requires two confirmation dialogs plus typing `清空`, then clears local data and, if logged in, explicitly pushes that empty/default state to cloud so old cloud data is not pulled back. Fixed snapshot dialog mojibake that could break the extension bundle, and changed extension startup so auth/sync errors do not leave the new tab stuck on the loading screen. Verification passed; only pre-existing lint warnings remain.
## Current Task: Make Clear Create A Clean Current Workspace

- [x] Add a workspace reset marker to local snapshots and clear flow -> Verification: clear saves `currentWorkspaceResetAt` with the rollback snapshot and blank current workspace.
- [x] Stop stale cloud rows/preferences from re-entering current UI after clear -> Verification: sync filters cloud rows/preferences older than the reset marker and treats reset as an intentional replacement, not an unsafe empty snapshot.
- [x] Protect against old open tabs pushing pre-reset data -> Verification: cloud reset newer than the tab forces a pull before any push.
- [x] Filter stale local sections/categories/cards during app load -> Verification: `loadData` removes items older than the current workspace reset marker and keeps only the blank homepage/inbox current workspace.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, and `WebCollect-extension-dist.zip` rebuild.

## Review

Clear now behaves like creating a new blank document: the old data can remain in rollback snapshots, but the live workspace gets a reset marker and ignores stale sections, categories, cards, recycle-bin, warehouse, and preference data from before that marker. Normal sync still refuses accidental empty overwrites, but the confirmed clear path and later reset-aware pushes can intentionally replace old cloud rows. Verified with type check, lint, extension build, and rebuilt extension zip.

## Current Task: Remove New Tab Startup Cloud Sync Block

- [x] Identify the startup blocker -> Verification: `initialize()` restored cached auth and awaited cloud sync before local `loadData()`.
- [x] Render local IndexedDB before auth/cloud restore -> Verification: Web and extension entrypoints now call `loadData()` first and start auth initialization in the background.
- [x] Make cached-session restore non-blocking -> Verification: cached/web session initialization starts `triggerSync()` with `void` instead of awaiting it.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `git diff --check`, and `WebCollect-extension-dist.zip` rebuild.

## Review

The 20-second loading screen came from startup waiting for Supabase sync, not from local folder organization. The new tab now paints from local IndexedDB first; auth restore and cloud merge continue in the background and refresh the page after they complete. Extension build passes and the zip has been rebuilt.

## Current Task: Make Small Group Resize More Contained

- [x] Diagnose why small groups feel stuck while resizing -> Verification: child groups were clamped to at least 28% of the parent, which is too wide on large screens.
- [x] Adjust only group resize/layout behavior -> Verification: small groups now default to tighter widths and can shrink to 2x2 or single-column card layouts.
- [x] Improve resize handle hit area -> Verification: subgroup and ungrouped resize handles are wider and layered above card content.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `git diff --check`, and `WebCollect-extension-dist.zip` rebuild.

## Review

Focused only on `sortable-grid.tsx`. The root cause was the child block width floor, not sync or data state. Groups with 4 cards now start closer to a 2x2 layout, can be resized down to a single column, and small 2-card groups can be narrowed without feeling locked. Existing sync/auth/storage code was not changed.

## Current Task: Document Stabilized Sync And Drag Lessons

- [x] Consolidate the recurring sync/data-loss lessons -> Verification: `tasks/lessons.md` now defines the workspace snapshot contract, reset/rollback rules, and multi-tab sync checks.
- [x] Consolidate the drag/layout lessons -> Verification: `tasks/lessons.md` now covers hierarchy-aware drop intent, same-level reorder, card visibility, resize separation, and layout verification.
- [x] Consolidate warehouse/status/future-work lessons -> Verification: `tasks/lessons.md` now records warehouse persistence, duplicate cleanup, status display, and pre-delivery checks.
- [x] Prepare current branch for GitHub publish -> Verification: docs and current project state are ready to commit after type check, lint, extension build, and diff check.

## Review

Added a durable handoff section to `tasks/lessons.md` so future WebCollect work does not depend only on chat history. The new notes group the hard-earned rules by sync/data safety, drag/layout, warehouse persistence, status UX, and future implementation protocol.

## Current Task: Floating Capture Widget

- [x] Write the execution plan and scope boundary -> Verification: `docs/superpowers/plans/2026-05-11-floating-capture-widget.md` records queue-first isolation, default inbox behavior, and non-goals.
- [x] Add the extension content script entry -> Verification: extension manifest includes a content script and Vite emits a deterministic `assets/floating-capture.js`.
- [x] Add background queue, prefs, and context-menu handling -> Verification: content script/right-click can save capture drafts into `chrome.storage.local` without touching IndexedDB.
- [x] Drain capture queue from WebCollect new tab -> Verification: pending drafts become normal cards through existing `addCard`; duplicates are skipped.
- [x] Add account-menu floating widget settings -> Verification: global enable, hover toggle, context-menu toggle, pause, and restore are available under the user menu.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, and zip rebuild.

## Review

Implemented the floating capture widget as an isolated Chrome extension path. Ordinary pages get a shadow-DOM floating button and hover shortcut; the background service worker owns context-menu capture, metadata fetch reuse, local preferences, destination-cache reads, and queue writes. WebCollect new tab publishes a lightweight destination cache and drains pending captures through the existing `addCard` store action, skipping duplicate URLs and falling back to `收集箱` when the selected target is missing. Account settings now include local-only floating widget controls. Verification passed: root type check, extension type check, lint with pre-existing warnings only, extension build, manifest parse check, diff check, and rebuilt `WebCollect-extension-dist.zip`.
## Current Task: Stop Flattened Hierarchy Sync And Preserve New Cards

- [x] Identify the root cause of groups moving into `未分类` -> Verification: `upsertCategoriesWithParents` was writing every category with `parent_id = null` before restoring parent links, creating a user-visible flattened cloud state if interrupted.
- [x] Remove the dangerous transient-flat cloud write -> Verification: category upserts are now ordered by parent depth and write the real `parent_id` in a single pass.
- [x] Add structure-only recovery that keeps newly captured cards -> Verification: recovery restores sections/category parent links/card category IDs from the best local snapshot and does not full-rollback card content.
- [x] Expose recovery in rollback dialog and account menu -> Verification: user can run `只修结构（保留新网页）` without choosing a full snapshot rollback.
- [x] Block future pushes of flattened hierarchy over richer local snapshots -> Verification: normal sync and manual cloud push throw a clear guard error instead of writing flattened data.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, extension type check, `corepack pnpm lint`, `corepack pnpm build:ext`, `git diff --check`, zip rebuild.

## Review

Verification passed. The intended user recovery path is: load the rebuilt extension, open WebCollect, use account menu `只修结构（保留新网页）`, inspect the restored homepage/FOM/HODL/AI layout, then manually trigger cloud sync only after the visible structure is correct.
## Current Task: Simplify Sync Repair And Manual Rollback

- [x] Treat manual sync as "push the current visible workspace" -> Verification: manual sync skips the flattened-structure guard that was incorrectly blocking the user's current layout.
- [x] Merge the two structure-repair entries in the account menu -> Verification: the user menu now has one `修复结构（保留网页）` action and no separate import repair action.
- [x] Keep rollback history user-facing and manual-only -> Verification: the rollback dialog reads only manual snapshots and clear-before snapshots; automatic safety snapshots stay internal.
- [x] Fix floating widget setting text rendering -> Verification: account-menu floating widget buttons render `Hover 链接` and `右键菜单` instead of raw unicode escape text.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, extension type check, `corepack pnpm lint`, `corepack pnpm build:ext`, `git diff --check`, and zip rebuild.

## Review

Verification passed. This change intentionally does not touch seed data, drag/drop, layout, or the user's cards/categories. Manual cloud sync now treats the visible current workspace as authoritative, rollback only shows manual user versions, and the account menu exposes one conservative structure-repair action that preserves webpages.

## Current Task: Repair Invisible Cards On Refresh

- [x] Identify why warehouse still sees duplicates while homepage groups show `0` -> Verification: homepage duplicate checks read all cards, but the grid only renders cards whose category and parent/section links are visible.
- [x] Repair invisible local placements without deleting webpages -> Verification: `loadData()` now detaches groups whose parent is missing, aligns child groups to the parent section, and moves cards with missing categories into the current section inbox.
- [x] Stop sync cleanup from dropping cards with missing categories -> Verification: sync fallback moves invalid/recovered-category cards into a valid inbox before upload instead of filtering them out.
- [x] Run verification and rebuild package -> Verification: `corepack pnpm ts-check`, extension type check, `corepack pnpm lint`, `corepack pnpm build:ext`, `git diff --check`, and `WebCollect-extension-dist.zip` rebuild.

## Review

Verification passed. The intended user behavior is that the top-bar refresh is no longer just a visual reload: it also repairs non-renderable local relationships while preserving every webpage record.

## Current Task: Blue Glass UI Redesign

- [x] Record the visual scope and data-safety boundary -> Verification: `WEB_COLLECT_UI_REDESIGN_BRIEF.md` documents UI-only constraints and non-goals.
- [x] Establish the blue-purple glass visual tokens -> Verification: global CSS exposes shared surface, button, tab, tile, input, and shell styles.
- [x] Redesign the header and section tabs -> Verification: search, sync status, refresh, add actions, warehouse, recycle bin, and account menu stay wired.
- [x] Redesign the dashboard cards and site tiles -> Verification: existing drag/edit/add/delete behavior stays on the same store methods.
- [x] Redesign the add website dialog and account panel -> Verification: all existing fields and settings remain reachable.
- [x] Restyle the recommendation area -> Verification: add, hide, search, more, and settings behavior remains unchanged.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, and `corepack pnpm exec next build --webpack`.

## Review

The blue glass UI pass is implemented as a presentation-layer change. The shared visual tokens, header, section tabs, dashboard cards, website tiles, add-card dialog, account panel, and recommendation area were restyled without changing sync, IndexedDB, import, warehouse, or drag data algorithms. Verification passed for type check, lint, extension build, and Next production build. A live dev-server smoke check was attempted, but the local dev process returned a transient 500 while the production build succeeded; avoid force-killing local Node processes unless the user asks.

## Current Task: Blue Glass UI Phase 3 Modal And Account Panel Polish

- [x] Re-read the old-thread handoff and lock the Phase 3 scope -> Verification: `LASTWEBCOLLECT MD.docx` shows Phase 1/2 were user-approved and Phase 3 is the next checkpoint.
- [x] Add shared modal and settings-panel glass classes -> Verification: `src/app/globals.css` and `extension/src/extension.css` both define the same `wc-modal-*`, `wc-settings-*`, segmented, toggle, message, login, and config popover styles.
- [x] Polish the add/edit website modal without changing fields or save behavior -> Verification: `card-dialog.tsx` still uses the same `url`, category, title, descriptions, note, abbreviation, image URL, metadata fetch, `addCard`, and `updateCard` paths.
- [x] Polish the account panel and unauthenticated extension config UI -> Verification: `user-menu.tsx` preserves manual sync, sync mode, visual scale, link open mode, floating capture settings, snapshots, structure repair, clear flow, logout, login, and extension Supabase config.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm build:ext`, `corepack pnpm lint`, `corepack pnpm exec next build --webpack`, and `git diff --check` pass.

## Review

Phase 3 is scoped to presentation-layer polish. The add/edit website modal now uses a more refined two-column glass shell with a visual preview rail while preserving every input and submission path. The account menu is now a consistent right-side glass settings panel with grouped cards, segmented sync mode controls, polished range/select controls, floating-capture toggles, and a restrained danger section. The same visual classes were mirrored into extension CSS so the Chrome new-tab build does not lose the updated styling. Static verification and production builds pass; local dev-server visual QA could not be completed because the dev server did not begin listening on the test ports in this environment.

## Current Task: Blue Glass UI Phase 4 Discover Recommendations

- [x] Preserve the recommendation data and behavior boundary -> Verification: `HotRecommendation` still uses `hotSites`, `extraHotSites`, `checkSafety`, `addCard`, `hideSite`, category add popovers, and the existing hidden-site duration setting.
- [x] Add discover-center visual classes to Web and extension CSS -> Verification: `src/app/globals.css` and `extension/src/extension.css` both define `wc-discover-*`, `wc-featured-*`, category cards, and value strip styles.
- [x] Upgrade recommendation layout into a discover center -> Verification: the component now renders a hero search area, orbit visual, featured recommendation cards, six category overview cards, the original grouped recommendation list/search results, and a value strip.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm build:ext`, `corepack pnpm lint`, `corepack pnpm exec next build --webpack`, and `git diff --check` pass.

## Review

Phase 4 keeps the recommendation logic intact while changing presentation. The old compact recommendation list is now a blue-glass discover center with search, "more" toggle, settings, featured site cards, category overview cards, grouped recommendations, and a bottom value strip. Quick add, category add, hide, safety scan, hidden duration, already-added state, and extra recommendations still run through the same existing functions. Static verification passes, and lint is down to 6 pre-existing warnings after removing stale recommendation props and replacing the recommendation favicons with background-image blocks.

## Current Task: Blue Glass UI Phase 5 Static Visual QA

- [x] Audit the primary redesigned surfaces for old shadcn/backend-style residues -> Verification: header, dashboard grid, website cards, add/edit modal, account panel, and recommendation center no longer contain `bg-card`, `border-border`, `bg-popover`, `hover:bg-muted`, or `text-muted-foreground` residues in their main implementation files.
- [x] Tighten the recommendation center details -> Verification: collapsed categories, added-site rows, and category picker popovers now use the same slate/blue glass styling as the rest of the discover center.
- [x] Tighten card-wall secondary text and empty states -> Verification: website-card abbreviation/fallback text, hover details, subgroup empty states, and drag hints now use the shared slate color ramp instead of old muted tokens.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `corepack pnpm exec next build --webpack`, and `git diff --check` pass.

## Review

The primary Phase 1-4 UI surfaces are now aligned to the blue glass template at code level: background/header, section tabs, dashboard/group panels, website cards, add/edit modal, account panel, unauthenticated config panel, and recommendation/discover center. The warehouse route still has older utility classes, but it was not part of this accepted template pass. Live screenshot QA remains blocked by local permission issues around Next CLI, Chrome headless, and Node REPL, so the next useful review step is user-side loading with screenshots.

## Current Task: Screenshot Feedback Polish

- [x] Add semantic icon fallback for cards without useful favicons -> Verification: `WebCardItem` now prefers contextual Lucide icons for browser/internal tools such as Extensions, Flags, Apps, Bookmarks, Downloads, History, and Settings, while normal websites still prefer real favicons.
- [x] Refine featured recommendation primary buttons -> Verification: featured recommendation add buttons now use a smaller glass pill style instead of the oversized blue-purple filled bar.
- [x] Improve narrow-width header behavior -> Verification: compact layouts make the header non-sticky, reduce padding and control height, allow action buttons/tabs to scroll horizontally, and reduce main-content top padding in both Web and extension entrypoints.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `corepack pnpm exec next build --webpack`, and `git diff --check` pass.

## Review

This pass directly addresses the five screenshots: Chrome utility cards should no longer fall back to a generic globe when their title clearly indicates a browser function; the discover center's featured row is less visually heavy; and the narrow Chrome-window layout should show more content because the header is shorter and no longer pinned in compact width. The changes are presentation-layer only and do not alter sync, storage, card data, drag/drop, or recommendation behavior.

## Current Task: Screenshot Feedback Polish 2

- [x] Replace hot-category Chinese initials with semantic icons -> Verification: discover category cards now render icons for AI, productivity, developer, design, social media, reading, business, learning, news, shopping, video, music, and generic tools.
- [x] Redesign the floating capture side button -> Verification: the content-script floating button now uses the WebCollect blue glass style instead of the old warm brown capsule.
- [x] Add docked hover and drag behavior to the floating capture side button -> Verification: the button is half-hidden on the nearest screen edge, expands on hover/open/drag, can be dragged between left and right edges, and persists its side/top position locally.
- [x] Keep capture panel behavior intact while polishing it visually -> Verification: opening the panel, selecting destination, pausing, hiding per-site, saving to the capture queue, hover-link capture, and runtime open-panel messages still use the same existing paths.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `corepack pnpm exec next build --webpack`, and `git diff --check` pass.

## Review

The main UI template pass is effectively complete for the accepted WebCollect surfaces: header, tabs, dashboard, card wall, add/edit modal, account settings panel, discover center, and extension CSS mirror are all aligned to the blue glass direction. This follow-up removes the remaining text-initial category icons and makes the web-page floating capture widget feel like part of the same product system, with side docking, hover reveal, drag repositioning, and a blue glass capture panel.

## Current Task: Floating Capture Mascot Button

- [x] Add mascot preference to floating capture settings -> Verification: capture prefs now persist `mascot`, defaulting to `chipmunk`, with `otter` as the alternate choice.
- [x] Add account-panel mascot selector -> Verification: the extension account settings panel exposes 花栗鼠 and 水獭 options under the floating-widget controls.
- [x] Replace the generic WC side pill with mascot-head artwork -> Verification: the content script renders inline SVG head artwork for the chipmunk and otter options, keeping only the head portion in the button.
- [x] Preserve hidden-state geometry -> Verification: hidden/docked state uses only edge translation; it does not scale, squash, or otherwise deform the mascot head.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `corepack pnpm exec next build --webpack`, and `git diff --check` pass.

## Review

The floating capture entry now follows the provided mascot concept direction more closely: default chipmunk, optional otter, head-only artwork, WebCollect blue glass capsule, and unchanged click-to-collect behavior. The artwork is implemented as inline SVG inside the extension content script so it does not depend on external image assets or base64 attachments.

## Current Task: Sync Structure Collapse Hotfix

- [x] Identify the data-shape failure -> Verification: the broken state is not missing cards; it is a flattened `categorySectionIds`/`sectionId` layout where tabs can still exist while all categories point to `section-default`.
- [x] Protect cloud layout from collapsed local mappings -> Verification: sync now treats default-only category assignments as unsafe even if non-default tabs remain, and cloud section preferences win during category merge.
- [x] Fix startup ordering -> Verification: web and extension new-tab initialization await auth/cloud restore before local `loadData()` migrations can stamp the fresh local state as newer.
- [x] Keep manual sync guarded -> Verification: manual sync uses the normal protected snapshot push path; destructive guard bypass remains reserved for explicit clear/reset.
- [x] Improve header status adaptation -> Verification: sync status renders as a fixed-width two-line badge and compact widths hide quiet button labels instead of pushing account/warehouse controls down.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `corepack pnpm exec next build --webpack`, and `git diff --check` pass.

## Review

This hotfix addresses the post-reload sync scramble rather than UI polish alone. The code now protects a real cloud multi-section layout from a local state where every category has fallen back to the homepage, and the app no longer runs local migrations before the cached-session cloud restore has had a chance to repair the workspace.

## Current Task: Emergency Full Workspace Restore

- [x] Stop relying on structure-only repair -> Verification: added a startup recovery path that restores a full healthy snapshot when the current workspace is visibly collapsed.
- [x] Select the latest healthy local version -> Verification: candidates must contain many cards/categories, multiple sections with cards, non-default content, parent-child links, and no known RWA/crypto groups parked on `主页`.
- [x] Add fallback when local snapshots are unavailable -> Verification: `assets/homely411.json` can rebuild a full structured workspace with about 7 sections, 105 categories/groups, and 315 cards distributed across HODL/FOM/AI/unused.
- [x] Run recovery before cloud sync -> Verification: both Web and extension startup invoke emergency restore before `useAuthStore.initialize()`, allowing the restored local version to win the next sync.
- [x] Preserve a bad-state backup before replacing data -> Verification: Homely fallback writes a `before-emergency-homely-restore` local snapshot, while snapshot restore uses the existing rollback backup path.
- [x] Run verification -> Verification: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`, `corepack pnpm exec next build --webpack`, `git diff --check`, and extension zip rebuild pass.

## Review

The new emergency restore path targets data recovery first. On startup it detects the specific broken pattern where a large workspace is collapsed into the homepage, restores the newest healthy full local snapshot if one exists, and otherwise rebuilds a complete structured workspace from the original Homely source data. This runs before auth/cloud sync so the repaired local version is saved as the current version and can be pushed back through the normal guarded sync path.

## Correction: Snapshot-Only Restore And Cloud Duplicate Cleanup

- [x] Remove the rejected Homely fallback -> Verification: Homely is only an early import/reference fixture and must not be used as the latest WebCollect recovery source.
- [x] Expose all local versions for inspection -> Verification: the rollback dialog lists manual and system snapshots, labels their origin, and marks structure-health candidates.
- [x] Confirm the cloud data shape -> Verification: Supabase still had real FOM/HODL/AI section preferences, but homepage card copies duplicated URLs that also existed in non-home sections.
- [x] Back up before cleanup -> Verification: wrote `manualRecoveryBackup-20260518-cloud-home-duplicates` in `user_preferences` with full categories/cards/preferences before deleting rows.
- [x] Remove duplicate homepage copies -> Verification: deleted only homepage card copies whose URL also existed in a non-home section, plus empty homepage categories left behind by that cleanup.
- [x] Add recurrence guard in sync -> Verification: sync now detects large-scale homepage duplicates during merge, keeps the non-home copies, writes a local rollback candidate, and removes duplicate cloud rows.

## Review

Cloud data now keeps the real structured sections instead of the duplicated homepage pile: after cleanup Supabase has 321 cards and 116 categories, with HODL/FOM/AI/non-common content distributed by `categorySectionIds`. The backup key above is the rollback point if this candidate needs to be undone.

# WebCollect Task Plan

Use this file for every non-trivial task before implementation.

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

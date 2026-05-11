# WebCollect Lessons

Update this file whenever the user corrects the implementation or a preventable bug appears.

## 2026-05-04: Sync Must Cover The Whole User Snapshot

User correction: sync failures caused categories, sections, and warehouse data to drift or reappear.

Rule:
- Treat sync as a whole user snapshot, not just `cards` and `categories`.
- Include sections, category section mapping, cards, recycle bin, warehouse cards/categories/batches, hidden sites, pinned categories, widths, and visual scale.
- Local edits must be written immediately to IndexedDB and then pushed to cloud through a queued/debounced sync.
- Cloud data must not resurrect stale local-deleted or locally-reorganized data when the local snapshot is newer.

## 2026-05-04: Warehouse UI Can Look Empty While IndexedDB Has Data

User correction: warehouse appeared empty, then old data surfaced after a new import.

Rule:
- Warehouse must expose a refresh action that reloads IndexedDB without importing new data.
- Warehouse destructive actions must be explicit: clear all, delete existing, delete batch/category/card.
- After warehouse mutations, reload store state and trigger snapshot sync.

## 2026-05-04: Do Not Let Seed/Test Templates Leak Into User Data

User correction: old Work/AI/Dev templates kept reappearing.

Rule:
- Default templates are examples, not permanent user truth.
- Do not let stale cloud or seed data repopulate a newer user layout.
- New sections should only need an inbox unless the user imports or creates more structure.

## 2026-05-04: Encoding Problems Can Become User-Facing Bugs

User correction: default section name became garbled.

Rule:
- Use Unicode escapes for Chinese literals in sensitive code paths if the file or tooling shows mojibake.
- Verify visible labels after editing files that already contain mixed or garbled Chinese text.

## 2026-05-04: Startup Sync Must Never Delete Cloud Data

User correction: after reinstall/reload, local IndexedDB could start nearly empty and sync erased cloud data.

Rule:
- Login/startup sync is restore/merge only. It must not delete cloud-only cards or categories.
- Push sync may replace cloud only after checking the local snapshot is not empty against a non-empty cloud snapshot.
- Before deleting cloud rows, write a version backup to `syncBackups` and `syncBackupLatest`.
- If local snapshot is empty and cloud is non-empty, abort push and run pull/merge sync instead.

## 2026-05-05: Never Invent Recovery Categories In User Layout

User correction: sync created `Recovered <uuid>` categories and surfaced warehouse-like junk on the homepage.

Rule:
- Never create user-visible fallback categories named `Recovered ...`.
- If old cloud data already contains `Recovered ...`, clean it with a backup before deletion.
- Unknown local category references must not become new homepage sections/groups; keep the sync path deterministic and avoid making corrupted references look intentional.
- Warehouse section creation must update the in-memory store immediately instead of reloading or visually jumping through another page state.

## 2026-05-05: Sync Backups Must Not Block Sync

User correction: `syncBackups` wrote a huge payload and Supabase returned a Cloudflare 520 HTML page, leaving the UI stuck in sync failure.

Rule:
- Do not store full snapshots inside `user_preferences.syncBackups`; keep backup metadata compact.
- Backup writes are best-effort and must not block the main local-to-cloud snapshot push.
- Never show raw HTML error pages in the UI; summarize remote 5xx errors into a short, actionable message.
- Cards must never be assigned to a parent-only category container, because parent direct cards are not rendered in the wall layout.

## 2026-05-06: Drag Sorting Contexts Must Match Visual Regions

User correction: dragging a group into a category made unrelated blocks scatter and overlap.

Rule:
- Do not put visually separate regions into one large `SortableContext` just to support cross-region drops.
- Use separate sortable contexts for parent sections and ungrouped sections, then handle cross-region drops explicitly in `onDragEnd`.
- For wrapped/flex grids, use rectangle sorting rather than vertical list sorting.
- During drag, keep the original item as a faint stationary placeholder and let `DragOverlay` carry the floating preview.

## 2026-05-06: Sync UX Must Distinguish Local Save From Cloud Push

User correction: cloud sync can be slow, but the app should feel safe and immediate.

Rule:
- Every local mutation must quickly write to IndexedDB and update a visible local-saved timestamp.
- Cloud sync should be queued/debounced in the background and shown separately as queued, syncing, synced, or failed.
- Cloud failures must not imply local data loss; the UI should make local persistence explicit.

## 2026-05-07: Parent Categories Must Not Own Hidden Direct Cards

User correction: promoting `chrome` from ungrouped to a top-level category made its cards disappear until it was demoted again.

Rule:
- A category rendered as a parent container must not keep cards directly assigned to its own id.
- When promoting a card-owning group to a parent, create or use a visible child group and move the direct cards there.
- Refresh buttons are only a safety valve; the primary logic must keep data visible without requiring manual refresh.

## 2026-05-07: Cloud Restore Is Not A Local Edit

User correction: initial login/cloud download showed `local saved`, which made it look like an edit happened before cloud data restored.

Rule:
- Suppress local-change events during cloud restore/merge.
- Clear local saved time at the start of restore sync.
- Show local-saved status only after a real local mutation following restore.

## 2026-05-07: Multi-Tab Sync Needs Snapshot Fences

User correction: opening multiple WebCollect pages allowed old data from one tab/cloud sync to overwrite newer edits from another tab.

Rule:
- Any cloud push must re-read IndexedDB immediately before pushing; never push an in-memory store snapshot.
- Track local updated time and last successful cloud sync time. Auto sync only pushes when local updated time is newer.
- If cloud is newer than local before a push, pull/merge first instead of deleting or replacing cloud rows.
- If local data changes while cloud restore is loading, abort the restore merge and restart from the latest local snapshot.
- Every user-visible card/category edit or move must refresh `updatedAt`, otherwise old cloud rows can win timestamp merges.

## 2026-05-07: Chrome Internal URLs Need Extension Tab APIs

User correction: imported `chrome://history` style bookmarks could be copied and opened manually, but did not open from WebCollect.

Rule:
- Do not route `chrome://...` URLs through normal anchors or raw `window.open` from the extension UI.
- In Chrome extension context, open cards through `chrome.tabs.create` or `chrome.tabs.update`.
- Keep link opening behavior as a persisted user preference because launchpad users may prefer background tabs, active tabs, or replacing WebCollect itself.

## 2026-05-07: Wall Blocks Should Not Consume Empty Space

User correction: groups with only a few cards stretched across the full row, creating large blank areas and making manual layout tiring.

Rule:
- Default wall layout should be content-sized first; do not use flex-grow on category/group blocks unless the user explicitly resized.
- Dense groups should wrap into comfortable multi-row blocks instead of becoming one long horizontal strip.
- Visible sync status should be actionable; if the user can see the cloud status, they should be able to click it to sync without opening a nested menu.

## 2026-05-08: Reinstall Sync Must Never Let Defaults Beat Cloud Layout

User correction: after deleting and reloading the extension, all previously organized sections collapsed back into the homepage.

Rule:
- First-run seeding must only happen when local cards and categories are truly empty; never replace restored or partially restored user data with seed/default data.
- Login/session restore must await cloud restore before page initialization performs local migrations or writes `initialized`.
- Store migrations during `loadData` are data repair, not user edits; suppress local-change events so they do not make a default local snapshot look newer than cloud.
- A default-only local section layout must never overwrite a cloud layout that still contains real sections or `categorySectionIds`.

## 2026-05-08: Sync Needs Rollback Points Before Trusting Any Source

User correction: local cache, cloud cache, and multiple open pages could overwrite each other, leaving no easy way to recover yesterday's good layout.

Rule:
- Before cloud sync, cloud push, row deletion, rollback, and destructive local actions, write a full local snapshot that includes sections, categories, cards, recycle bin, warehouse, and preferences.
- Auto-save a local safety snapshot shortly after real local edits; cloud success must not be required for rollback protection.
- If a local snapshot is much smaller than cloud, or has a collapsed/default section layout while cloud has real sections, pull/merge cloud instead of pushing local.
- A guarded/unsafe local snapshot must not write `collectionSections` or `categorySectionIds` back over cloud layout preferences.

## 2026-05-08: Collapsed Cloud Layout Requires Conservative Structure Repair

User correction: after reinstalling, card and group rows still existed but section/category relationships were flattened, so the page looked empty even though data was present.

Rule:
- Do not tell the user data is gone when cards/groups still exist; distinguish content loss from relationship/section loss.
- If both local and cloud section preferences are already collapsed, sync cannot infer yesterday's tabs by timestamp alone. Use an explicit rollback snapshot or a conservative structure repair path.
- A repair path must create a local snapshot first, relink existing cards/categories only, and avoid inventing duplicate cards.
- Full rollback snapshots need to live outside the fragile live-sync overwrite path; compact count-only backups are diagnostic, not recovery.

## 2026-05-10: Destructive Resets Need An Explicit Bypass, Not Normal Sync

User correction: the app needs a way to save a rollback point and then intentionally clear all data for a clean reimport, without fighting the normal anti-data-loss guards.

Rule:
- Normal sync must keep refusing empty or much-smaller local snapshots over richer cloud data.
- A destructive clear must be a separate, explicit flow with a full local snapshot first and multiple confirmations.
- The cloud push bypass for destructive clear must be scoped to that one confirmed operation, not reused by automatic or manual normal sync.
- Extension startup must not depend on successful auth/cloud restore before showing local data; auth errors should be visible but never leave the new tab stuck on a loading page.

## 2026-05-10: Clear Means New Current Workspace, Not Empty Merge

User correction: after clear and reload, old empty sections/categories came back into the current UI, making a supposedly blank workspace look like a corrupted old document.

Rule:
- A confirmed clear must write a workspace reset marker, and every local/cloud load must ignore rows and preferences older than that marker for the current workspace.
- Old data may exist only as rollback snapshots or backups; it must never reappear in the live UI unless the user explicitly restores it.
- Normal sync's anti-data-loss guards must still block accidental empty overwrites, but a reset marker means the empty workspace is intentional.
- If a cloud reset marker is newer than an open tab's local marker, that tab must pull first and must not push pre-reset data back to cloud.

## 2026-05-10: New Tab Startup Must Be Local-First

User correction: after all Chrome windows were closed, opening WebCollect again spent about 20 seconds on "正在整理收藏夹" before showing the page.

Rule:
- Never await auth restore or Supabase cloud sync before rendering the new tab from local IndexedDB.
- Startup order should be local data -> paint UI -> background auth restore -> background cloud merge.
- A cached login can mark cloud sync as running, but it must not block the first visible page.
- Warehouse/background data loads should be best-effort and should not keep the main wall on a spinner.

## 2026-05-10: Small Groups Need Real Shrink Room

User correction: groups with 2-4 cards looked too wide and could not be dragged into 2x2 or single-column layouts on wide screens.

Rule:
- Do not clamp child group width to a high parent percentage such as 28%; on wide monitors that becomes hundreds of pixels and feels stuck.
- Small groups should default to contained card arrangements: 2-card groups around one/two compact rows, 4-card groups around 2x2.
- Resize handles need enough hit area and z-index to win over card hover/action surfaces.
- Keep this separate from sync/storage work; layout resize fixes must not touch cloud logic.

## 2026-05-11: Stable Sync Is A Workspace Contract, Not A Table Upload

User correction pattern: repeated fixes still lost tabs, emptied sections, duplicated warehouse items, or let stale browser tabs overwrite newer edits.

Rule:
- Treat the user's current workspace as one versioned document: sections, categories, groups, cards, recycle bin, warehouse, hidden/recommended-site state, pinned items, visual scale, link-open mode, and reset markers belong together.
- Local save is the source of immediate confidence. Every edit must write to IndexedDB quickly, then queue cloud sync as a background job.
- Cloud sync must be dirty-only and version-guarded. If nothing changed, do not push. If another tab or cloud snapshot is newer, pull/merge before pushing.
- Startup and reload must be local-first: render local data immediately, then restore auth and cloud state in the background.
- Destructive operations need an explicit bypass path. Normal sync must keep refusing empty or much-smaller snapshots over richer data; a confirmed clear can replace the cloud only after a full local snapshot and reset marker.
- Never let default seed data or old reset-era data re-enter the live UI after a user has cleared or reorganized the workspace.
- Every sync path should create or preserve rollback points before trusting either local or cloud data.

Verification checklist:
- Reinstall/reload extension, log in, confirm cloud restore does not collapse sections into homepage.
- Open two WebCollect tabs, edit in tab A, refresh/sync tab B, confirm tab B does not overwrite tab A.
- Clear current workspace, reload, confirm old rows remain only in rollback history and do not appear in the live UI.
- Import warehouse data, move some items to sections, sync, reload, confirm warehouse leftovers and moved homepage data both persist correctly.

## 2026-05-11: Drag And Layout Need Explicit Drop Intent

User correction pattern: groups could fly to other sections, but cards disappeared, group/category order could not be adjusted, or drag previews scattered the page.

Rule:
- Resolve drop intent by hierarchy, not only by the element directly under the pointer: page section -> parent category -> child group -> card.
- Same-level reorder and cross-parent moves must both reindex siblings once after the final target is known.
- Parent categories must never own hidden direct cards. If a card-owning group becomes a parent, move its cards into a visible child group.
- Drag overlays should preview movement without making unrelated blocks jump. The source item can stay as a faint placeholder while the overlay moves.
- Resize and drag are separate interactions. Resize handles must stop pointer propagation to dnd-kit without calling `preventDefault()` in a way that blocks mouse resize events.
- Layout should be content-sized by default: small groups stay compact, dense groups wrap into readable rows, and manually resized widths override automatic sizing.

Verification checklist:
- Drag a child group left/right within the same parent and confirm order persists after reload.
- Drag a parent category before/after another parent category and confirm order persists after reload.
- Drag a card/group into a different parent section and confirm the source and target remain visible with no orphaned cards.
- Resize 2-card and 4-card groups into compact shapes, then reload to confirm widths persist.

## 2026-05-11: Warehouse Must Behave Like A Persistent Staging Area

User correction pattern: warehouse looked empty until import, duplicates appeared after refresh, and sent items could be re-imported or re-sent without clear state.

Rule:
- Warehouse has its own persistent state and must not disappear just because the homepage was refreshed.
- Refresh is a reload of warehouse IndexedDB/cloud state, not a re-import.
- Provide explicit cleanup actions: clear warehouse, delete existing duplicates, delete selected batch/category/card.
- Detect duplicates against all homepage sections and mark where an item already exists before sending.
- Sending from warehouse to homepage should support existing sections and quick creation of a new section without UI jumps or route flashes.
- Import parsing must filter invalid URLs and dependency-extension URLs without letting broken records corrupt layout.

Verification checklist:
- Import the same bookmark file twice and confirm duplicate indicators plus one-click duplicate removal.
- Send a warehouse category to an existing section and to a newly created section, then reload both homepage and warehouse.
- Clear warehouse explicitly and confirm it stays empty until the user imports again.

## 2026-05-11: User-Facing Status Must Match What Actually Happened

User correction pattern: the UI said local saved during cloud restore, cloud sync looked stuck, and raw Supabase/Cloudflare HTML errors filled the menu.

Rule:
- Separate statuses: local saved, cloud queued, cloud syncing, cloud synced, cloud failed.
- Do not show "local saved" during initial cloud restore unless the user actually changed something after restore began.
- The top-bar sync badge should be both visible and actionable; users should not have to open the account menu for a normal manual cloud sync.
- Long operations need immediate feedback: refresh should spin, sync should change state, imports should show progress/summary.
- Remote HTML error pages must be summarized into short errors; never dump raw HTML into the account menu.
- Advanced personal controls such as visual scale and link-open mode belong in account settings, not crowded into the main toolbar.

Verification checklist:
- Cold open should paint from local data quickly and show cloud work separately.
- Manual top-bar sync should trigger cloud sync without opening the user menu.
- Simulated/real remote 5xx errors should show a concise message while preserving local data.

## 2026-05-11: Future Work Protocol For WebCollect

Before touching code:
- Read `AGENTS.md`, this file, and the current `tasks/todo.md`.
- State the narrow scope and which files are likely to change.
- For data-sensitive work, inspect whether the change can delete, flatten, duplicate, or resurrect user data.

During implementation:
- Make the smallest change that addresses the user-visible bug.
- Do not mix sync/storage changes with unrelated layout/UI polish unless the user explicitly asks for both.
- Do not edit `seed.ts` to "fix" user data. Seed data is not the user's current workspace.

Before delivery:
- Run `corepack pnpm ts-check`.
- Run `corepack pnpm lint`; existing warnings are acceptable only if no new errors appear.
- Run `corepack pnpm build:ext`.
- When feasible, run `next build --webpack` through the Windows Next binary.
- Rebuild the extension package when extension files changed.
- Record any new user correction here so the next session does not repeat the same mistake.

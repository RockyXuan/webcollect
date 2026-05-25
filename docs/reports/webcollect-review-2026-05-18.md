# WebCollect Review - 2026-05-18

## Summary

This report is generated from the repository state. It focuses on the data-loss and rollback work after the blue-glass UI phase.

## Root-Cause Mistakes

- Manual versions were saved only to localforage, so deleting and reloading the extension could remove the version list.
- A fresh extension install could mark a default local layout as newer before cloud restore completed, which risked flattening sections into the homepage.
- Structure-only repair was treated as enough after the workspace had already collapsed; the safer path is a full healthy account snapshot.
- Homely data was briefly treated as a latest WebCollect recovery source even though it was only an early import/reference fixture.
- Several UI passes changed presentation while data ownership was still local-first, which made the save button feel trustworthy before it was account-backed.
- Some extension UI assets and CSS lived outside the extension build path, so changes could appear in Web but not in the loaded Chrome extension.

## Fixes Implemented In This Pass

- Added the account-scoped workspace_snapshots table with RLS and a user/kind/day uniqueness rule for daily system snapshots.
- Manual header saves now create a local fallback and, when logged in, persist the full workspace snapshot to Supabase.
- Automatic safety snapshots still stay local, and also upsert one system cloud snapshot per local day when a user is logged in.
- The rollback dialog now separates cloud manual saves, cloud daily automatic saves, and local fallback backups.
- Cloud snapshot restore writes back into local IndexedDB through the shared restore path, then marks the workspace changed so guarded sync can upload it.
- A deterministic review script now summarizes the recent mistakes, fixes, data contract, git status, and verification checklist.

## Current Data Contract

- Primary workspace data lives in Supabase categories/cards plus user_preferences for sections, warehouse, recycle bin, and visual preferences.
- Account restore points live in Supabase workspace_snapshots and are not part of normal sync merge.
- Manual snapshots are permanent unless the user explicitly deletes them in a future UI.
- System cloud snapshots are deduplicated by user_id + kind + day_key, so each day keeps only the latest automatic version.
- Local snapshots remain a fast fallback, but they are not durable across extension deletion.

## Recent Task Trail

- Cloud Account Snapshot Archive
- Floating Mascot Pill Fidelity
- Header Save Shortcut And Capture Autofill
- Edit Mode Width And Hover Details
- Snapshot Archive And Fixed Tile Widths
- High-Fidelity Blue Glass UI Phase 1
- Blue Glass Dashboard Phase 2
- Quiet Floating Capture Hover
- Polish Floating Capture And Ungrouped Editing
- Recover Lost Layout And Add Rollback Snapshots
- Prevent Cloud Section Collapse On Reinstall
- Optimize Wall Layout And Top Sync Action

## Relevant Lessons

- Tabs Existing Does Not Mean Section Layout Is Safe
- Recovery Must Prefer A Full Healthy Version Over Structure Repair
- Homely Is Not A Valid Latest WebCollect Restore Source
- Manual Versions Must Be Account-Scoped Cloud Data

## Git Status

```text
## ai-next-fixes
 M extension/background.js
 M extension/build.mjs
 M extension/manifest.json
 M extension/src/extension.css
 M extension/src/newtab-app.tsx
 M extension/vite.config.ts
 M src/app/globals.css
 M src/app/page.tsx
 M src/components/auth/user-menu.tsx
 M src/components/card/web-card.tsx
 M src/components/dialogs/card-dialog.tsx
 M src/components/dialogs/local-snapshot-dialog.tsx
 M src/components/hot-recommendation.tsx
 M src/components/layout/sortable-grid.tsx
 M src/components/nav/top-nav.tsx
 M src/lib/auth-store.ts
 M src/lib/local-snapshots.ts
 M src/lib/store.ts
 M src/lib/sync.ts
 M src/storage/database/shared/schema.ts
 M src/storage/database/supabase-init.sql
 M tasks/lessons.md
 M tasks/todo.md
?? "LASTWEBCOLLECT MD.docx"
?? WEB_COLLECT_UI_REDESIGN_BRIEF.md
?? docs/
?? extension/src/assets/
?? extension/src/content/
?? lastwebcollectthreadmd.txt
?? public/assets/
?? scripts/generate-webcollect-review.mjs
?? scripts/test-cloud-snapshots.ts
?? src/lib/cloud-snapshots.ts
?? src/lib/emergency-restore.ts
?? src/lib/floating-capture.ts
?? tmp/
```

## Changed Files

```text
extension/background.js
extension/build.mjs
extension/manifest.json
extension/src/extension.css
extension/src/newtab-app.tsx
extension/vite.config.ts
src/app/globals.css
src/app/page.tsx
src/components/auth/user-menu.tsx
src/components/card/web-card.tsx
src/components/dialogs/card-dialog.tsx
src/components/dialogs/local-snapshot-dialog.tsx
src/components/hot-recommendation.tsx
src/components/layout/sortable-grid.tsx
src/components/nav/top-nav.tsx
src/lib/auth-store.ts
src/lib/local-snapshots.ts
src/lib/store.ts
src/lib/sync.ts
src/storage/database/shared/schema.ts
src/storage/database/supabase-init.sql
tasks/lessons.md
tasks/todo.md
```

## Diff Stat

```text
extension/background.js                          |  220 +++-
 extension/build.mjs                              |    7 +
 extension/manifest.json                          |   28 +-
 extension/src/extension.css                      | 1166 +++++++++++++++++++++
 extension/src/newtab-app.tsx                     |   84 +-
 extension/vite.config.ts                         |    6 +
 src/app/globals.css                              | 1172 +++++++++++++++++++++-
 src/app/page.tsx                                 |   38 +-
 src/components/auth/user-menu.tsx                |  442 +++++---
 src/components/card/web-card.tsx                 |  315 +++++-
 src/components/dialogs/card-dialog.tsx           |  394 +++++---
 src/components/dialogs/local-snapshot-dialog.tsx |  338 +++++--
 src/components/hot-recommendation.tsx            |  595 ++++++++---
 src/components/layout/sortable-grid.tsx          |  208 ++--
 src/components/nav/top-nav.tsx                   |  369 ++++---
 src/lib/auth-store.ts                            |   42 +-
 src/lib/local-snapshots.ts                       |  565 ++++++++++-
 src/lib/store.ts                                 |  159 ++-
 src/lib/sync.ts                                  |  305 +++++-
 src/storage/database/shared/schema.ts            |   29 +-
 src/storage/database/supabase-init.sql           |   32 +
 tasks/lessons.md                                 |  121 +++
 tasks/todo.md                                    |  272 +++++
 23 files changed, 6009 insertions(+), 898 deletions(-)
```

## Verification Checklist

- [ ] `corepack pnpm exec tsx scripts/test-cloud-snapshots.ts`
- [ ] `corepack pnpm ts-check`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm build:ext`
- [ ] `git diff --check`

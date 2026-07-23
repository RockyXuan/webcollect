# Project Handoff

> **2026-07-15 current workflow rule:** this repository has retired Superpowers (including `superpowers:*` / `using-superpowers`), `goal-zzx` / `zzx-goal`, and `andrej-karpathy-coding`. Do not install, enable, invoke, or imitate them. Any older instruction below that requires `tasks/todo.md`, `tasks/lessons.md`, `CODEX_GO_MODE_STATUS.md`, fixed phase counts, strict TDD, worktrees, subagents, or duplicate reviews is historical and superseded by `AGENTS.md`.

## 2026-07-23 V1.5.3 Adaptive Viewport Candidate

- Candidate identity: `V1.5.3 / 2026年7月23日`; planned tag `webcollect-2026-07-23-v1.5.3`; planned asset `WebCollect-Chrome-Extension-v1.5.3-2026-07-23.zip`.
- Closeout: `docs/audit/webcollect-v1.5.3-adaptive-viewport-closeout-2026-07-23.md`.
- A root `ResizeObserver` derives a non-persistent `wide / compressed / reflow / compact` tier from the width WebCollect actually owns and the existing visual scale.
- The wide tier preserves V1.5.2. The compressed tier uses bounded runtime density for the header and classic wall. Reflow uses a two-row toolbar. Compact keeps the existing mobile contract.
- Classic CSS and layout math share the same density, and resize interactions convert rendered dimensions back to logical dimensions before saving. Mindmap nodes and world coordinates remain outside this density path.
- No permission, dependency, storage key, data migration, Drive/backup schema, collection record, layout preference, sync state, Chrome storage, snapshot, seed, or stable extension identity changes.
- Local candidate gates pass with 436 Vitest, 31 legacy scripts, 58 Playwright tests, TypeScript, lint, both production builds, extension artifact checks, and the 17.3 MiB size gate. Formal CI, Release, official-zip audit, and real-primary-Chrome evidence remain to be appended after they actually complete.

## 2026-07-23 V1.5.2 GitHub Capture Metadata Fix

This section records the current published release. V1.5.0 remains the tab-pack/favicon feature baseline and V1.4.0 remains the cloud/data baseline.

- Published identity: `V1.5.2 / 2026年7月23日`; tag `webcollect-2026-07-23-v1.5.2`; asset `WebCollect-Chrome-Extension-v1.5.2-2026-07-23.zip`.
- Closeout: `docs/audit/webcollect-v1.5.2-github-capture-metadata-closeout-2026-07-23.md`.
- GitHub repository captures use a shared repository parser and bounded public README extraction. No Cookie, GitHub Token, AI API, translation API, or local model is used.
- Duplicate URLs require a comparison and explicit in-panel confirmation. The queue rechecks card ID, normalized URL, and `updatedAt`, then updates only non-empty title/description fields while preserving all placement and user-authored fields.
- Legacy/right-click duplicates still skip; multiple duplicates and version conflicts fail closed. No permission, dependency, storage key, Drive schema, migration, snapshot, seed, or unrelated collection behavior changes.
- Application commit `3cd02b2bc7c85e655f98e6cea5619c3f9ac710e8`, main CI `29987210999`, and Release workflow `29987630172` passed. The single official asset is `17,069,709` bytes with SHA-256 `cc76c1c06bb707d3edceb974cc1d5a7d7b81b51d9dfee704bad2d7364c81a3e9`; its 41-file tree matches the local final build.
- The existing signed-in primary-profile extension was reloaded from the official package in the auxiliary task window. Seven sections, recycle count 15, real collection data, account, tab packs, and the Drive-synced state all restored without any acceptance write.
- A post-release evidence run exposed a test-fixture race that injected the duplicate card before fresh-extension initialization had fully settled. Test-only commit `2f164a64c5c8fe8fa21ed19561415106014e0d14` now waits for IndexedDB initialization and the published capture-destination cache, then observes the confirmed update for stability; follow-up main CI `29988897257` passed. Runtime code, tag, and official asset are unchanged.

## 2026-07-23 V1.5.1 Next.js Security Patch

This section records the current published release. V1.5.0 remains the tab-pack/favicon feature baseline and V1.4.0 remains the cloud/data baseline.

- Published identity: `V1.5.1 / 2026年7月23日`; tag `webcollect-2026-07-23-v1.5.1`; asset `WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`.
- Closeout: `docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`.
- Nine new Next.js production advisories appeared after the V1.5.0 release and caused the later docs-only main run to fail its live audit. The patched line is 16.2.11.
- Only `next` and `eslint-config-next` move from 16.2.10 to 16.2.11. No WebCollect feature, storage, Drive, backup, permission, extension identity, or user-data path changes.
- Local gates pass with 413 Vitest, 31 legacy scripts, 45 Playwright tests, both production builds, artifact/size checks, and 204 production packages with zero audit findings.
- Application commit `713cdc975801b0d98b9bc0a2891e7f95592da871`, main CI `29974438847`, and Release workflow `29974689750` passed. The single official asset is `17,065,370` bytes with SHA-256 `4667cfd57ede39676b89d87cd9055313bfe52290b134d461b5fa70396f10e29d`; its 41-file tree exactly matches the local release build.
- The existing signed-in primary-profile extension was backed up append-only, updated from the official package, and reloaded in the dedicated auxiliary Chrome window. The real new tab retained the seven sections, collection wall, recycle count 15, account entry, bookmark bar, and tab-pack shelf. A Drive request timed out into the explicit local-data-preserved state; no retry or write was triggered during acceptance.

## 2026-07-22 V1.5.0 Saved Tab Packs and Favicon Recovery

This section records the V1.5.0 feature baseline; V1.4.0 remains the cloud migration baseline and V1.4.1 remains the previous published patch.

- Published identity: `V1.5.0 / 2026年7月22日`; tag `webcollect-2026-07-22-v1.5.0`; asset `WebCollect-Chrome-Extension-v1.5.0-2026-07-22.zip`.
- Closeout: `docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`.
- Saved tab packs are global fixed URL snapshots, visible beside section tabs. Dragging copies a card; source cards, order, hierarchy, dirty sets, recycle bin, and snapshots are not changed. Mindmap uses the same manager through search.
- Each pack is independently revisioned and soft-deleted in the existing Drive payload. Missing fields in legacy device files mean “unknown”, not “empty”, so they cannot erase packs.
- Portable Backup V2 includes packs and open mode; Portable Backup V1 remains accepted. V1 restore keeps the current packs because the old format could not express them.
- Favicon repair is render-first and non-destructive: immediate letter fallback, extension `_favicon`, metadata/site candidates, then a bounded rebuildable `WebCollectIcons/site_icons` cache. It does not write generic fallback URLs back to cards.
- The only permission addition is Chrome `favicon`; there is no `tabs`, `tabGroups`, host-access expansion, dependency, OAuth-scope, seed, Supabase, or collection-schema change.
- Application commits `fd3f9732ac448e46998a9660044b7175aa2c4fd1` and `2ad9375db057c9b5567ceaebce543f226b9eeef4`, main CI `29936934533`, and Release workflow `29937491867` all passed. The single official zip is `17,065,370` bytes with SHA-256 `2b499aeaa0c6ec14d5454335deb69b6a0ae3561f0e5c750c3d5ec32a42e76749`; its 41-file unpacked tree exactly matches `extension/dist`.
- The actual active unpacked source in the existing signed-in primary Chrome profile was backed up append-only and reloaded in place. Chrome showed WebCollect `1.5.0`, the stable ID, active service worker, and favicon permission. A fresh new tab preserved the seven sections, existing wall, recycle count 15, and showed the tab-pack shelf plus immediate favicon fallback. No user-triggered collection, tab-pack, or Drive write action was performed.

## 2026-07-21 V1.4.1 Floating Capture Keyboard Fix

This section records the previous V1.4.1 published patch; V1.4.0 remains the cloud/data contract baseline.

- Published version/date: `V1.4.1 / 2026年7月21日`; tag `webcollect-2026-07-21-v1.4.1`; asset `WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`.
- Closeout: `docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`.
- Keyboard events from the floating capture Shadow DOM are stopped before host-page shortcut listeners. GitHub-style `s` search no longer opens while typing in WebCollect.
- The guard does not prevent browser defaults: lowercase/uppercase input, Chinese IME, Tab, copy/paste, and focus movement remain functional; shortcuts outside the panel continue to reach the page.
- No storage key, permission, dependency, schema, collection action, Drive contract, snapshot, Chrome storage, Supabase archive, extension identity, or seed changed.
- Local gates passed: TypeScript, lint, 395 Vitest, 31 legacy scripts, 44 Playwright, Web/extension builds, artifact/size checks, real-extension keyboard verification, and a 200-package zero-finding production audit.
- Application commit `8af01d34bc5d095d7961e658558e8fa7c5c16ff0`, main CI `29842309751`, and Release workflow `29842892835` passed. The single official asset is `17,056,539` bytes with SHA-256 `abccc041f9e32c87535a6d38fa8072edb011477af6eea3da8442eda87a59e084` and exactly matches the local release build.
- The existing primary-profile extension was backed up append-only, updated without uninstalling, and reloaded in place. Chrome showed WebCollect `1.4.1` with the stable ID. On the reported GitHub page, real `sS` and pinyin key sequences stayed inside the floating field; Tab moved normally; cancelling wrote no card; and the page's own `s` shortcut still worked after close.

## 2026-07-21 V1.4.0 Google Drive Migration Release

This section records the V1.4.0 cloud/data baseline beneath the current V1.4.1 published patch.

- Published version/date: `V1.4.0 / 2026年7月21日`; tag `webcollect-2026-07-21-v1.4.0`; asset `WebCollect-Chrome-Extension-v1.4.0-2026-07-21.zip`.
- Closeout: `docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`.
- Formal cloud sync is local-first Google Drive `appDataFolder`, opt-in, and limited to `drive.appdata`. The Web build stays local-only until a future Web OAuth client exists.
- Complete JSON export/preview/restore covers workspace, recycle bin, warehouse, wallpaper, mindmap state, local/Drive history, capture settings/queue, revisions, and tombstones while excluding credentials, tokens, device identity, dirty sets, temporary state, and derived knowledge text.
- Supabase is absent from the production dependency/runtime path. Old remote data and legacy local keys remain untouched for 30 days and require a new explicit authorization before any later cleanup.
- Rocky's existing primary Chrome profile completed OAuth, idempotent migration, file-by-file schema/hash readback, manual Drive sync, new-tab restart, and a post-migration complete backup. Verified live counts were 7 sections, 135 categories/groups, 372 cards, 15 recycle entries, and 69 Drive snapshots.
- Full gates passed: zero-warning type/lint, 395 Vitest, 31 legacy scripts, 44 Playwright tests, Web/extension builds, artifact/runtime scan, 17.2 MiB size gate, and a 200-package production audit with zero findings. Application commit `c09859986439fef83b4c2cda2131b22f91f5481e`, main CI `29821265795`, and Release workflow `29821729530` passed. The official zip is `17,056,463` bytes with SHA-256 `bba2c2e537321b38567db3b71aaa8e5c724dde766e3b2089ebdf27749bb859ef`; it exactly matches the verified local build. The final primary-Chrome read-only check passed.

## 2026-07-19 V1.3.1 Header UI Release

This section records the previous V1.3.1 published release and its UI contract.

- Target version/date: `V1.3.1 / 2026年7月19日`; tag `webcollect-2026-07-19-v1.3.1`; asset `WebCollect-Chrome-Extension-v1.3.1-2026-07-19.zip`.
- Closeout: `docs/audit/webcollect-v1.3.1-header-ui-closeout-2026-07-19.md`.
- Scope: compact and unify the top toolbar across Web and extension. Neutral controls share a 38px desktop / 36px mobile light frame; `+ 网页` remains the only blue primary action; engine labels are neutral; sync color is icon-only; account and mode controls align to the shared geometry.
- Existing 1800px single-row, 1181–1799px second-row, and 390px compact behavior remains. Search, sync, wallpaper, add, recycle, warehouse, and view-mode interactions are unchanged.
- No storage key, data schema, collection action, extension permission, stable key/ID input, or sync/snapshot path changed. The seed SHA remains `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.
- Full local gates passed: 48 files / 372 Vitest, 31/31 legacy scripts, 44/44 Playwright, TypeScript, ESLint, Web/extension builds, artifact checks, the 17.4 MiB size gate, and a 208-package production audit with zero findings. Browser acceptance covered Web/extension CSS parity, all sync states, 2048/1366/390 geometry, classic/mindmap switching, no overflow, and no console error.
- Published application commit `1ef16416f58e1ab81caa1e0dd714f9fe9e3fa126`; main CI `29685287664` and Release workflow `29685512533` succeeded. The formal Release is `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-19-v1.3.1` and the direct asset is `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-19-v1.3.1/WebCollect-Chrome-Extension-v1.3.1-2026-07-19.zip`.
- The official zip is `17,113,523` bytes with SHA-256 `cae9e8e5118916e3495bfda2b5e6a86259000a6fe7924abb5f25de57a8a2dc01`. Its Manifest V3 version, stable key hash, unchanged permissions, 41-file tree, unique entries, and byte-for-byte local-build equality passed.
- The existing primary-profile source was backed up append-only, synchronized without deletion to the official package, and reloaded in place. Chrome showed WebCollect `1.3.1` with stable ID `immpcmhmabobllnopedaoflcjneigbko`; the signed-in real new tab retained `X rocky`, `云端已同步`, sections, bookmark bar, recycle count, and the mindmap collection tree. The follow-up evidence commit is documentation-only, not a new app version.

## 2026-07-19 V1.3.0 Local Smart Search Release

This section records the previous V1.3.0 search contract and published tag.

- Target version/date: `V1.3.0 / 2026年7月19日`; tag `webcollect-2026-07-19-v1.3.0`; asset `WebCollect-Chrome-Extension-v1.3.0-2026-07-19.zip`.
- Closeout: `docs/audit/webcollect-v1.3.0-smart-search-closeout-2026-07-18.md`.
- Scope: retain Google / 百度 / Bing external search and add immediate, fully local fuzzy retrieval across cards/categories/groups/sections with pinyin, typo tolerance, intent aliases, weighted full-text ranking, and an opt-in public-page knowledge cache.
- Saved fields are searchable immediately. After explicit consent, Web and extension can extract unauthenticated public HTML under strict URL, timeout, redirect, type, and size limits; neither path sends text or queries to an AI provider.
- Local derived records exist only in `WebCollectSearch/knowledge_index`. No local model is bundled or downloaded, and no OpenAI, DeepSeek, or other AI API is part of the released search path. Historical cloud-vector code is dormant and absent from the extension artifact.
- Business cards/categories/sections/preferences/recycle bin, `WebCollect/webcollect_data`, Chrome storage, dirty sets, tombstones, snapshots, workspace revisions, seed data, and collection sync are unchanged.
- Completed gates: 46 files / 348 Vitest tests, 31/31 legacy scripts, 44/44 Playwright, TypeScript, ESLint, Web/extension production builds, extension artifacts, the 17.4 MiB size gate, and a 208-package production audit with zero findings.
- Browser acceptance reused one stable in-app Browser context and confirmed external-engine fallback, local-only status, Escape/focus behavior, 390px bounds, no horizontal overflow, and zero console errors. The smart-search E2E observed zero requests to OpenAI, embeddings, or the dormant Supabase function.
- Published application commit `65033a67631095ec492470bce1e2f9b1b2ca0911`; main CI `29681646688` and Release workflow `29681869535` succeeded. The formal Release is `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-19-v1.3.0`.

## 2026-07-17 V1.2.2 Header Layout Release

This section supersedes the V1.2.1 development status once tag `webcollect-2026-07-17-v1.2.2` is published.

- Stable version/date: `V1.2.2 / 2026年7月17日`.
- Final tag: `webcollect-2026-07-17-v1.2.2`.
- Final Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-17-v1.2.2`; direct zip: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-17-v1.2.2/WebCollect-Chrome-Extension-v1.2.2-2026-07-17.zip`.
- Closeout: `docs/audit/webcollect-v1.2.2-header-layout-closeout-2026-07-17.md`.
- Scope: keeps Google 登录 on one line and prevents a real cloud-sync badge from overlapping the search-engine selector by giving 1181–1799px desktops a dedicated action row.
- Data contract: no data or persistence path changed. V1.2.1's local mode preference and V1.2.0's mindmap view-state boundary remain intact.
- Tagged application commit: `b2a2063cb986574ffdf6e0c13c3988da6c02a26a`. Main CI `29566934939` and Release workflow `29567324457` succeeded. The official zip is `16,957,068` bytes with SHA-256 `80ed3d0ad969d0ad3eb2485cc9a77729565a7dda0f05dcc4926f3245ec40c998`; its 41-file tree exactly matches the local release build and the existing unpacked installation source after an append-only backup and non-deleting sync.
- The existing signed-in primary Chrome profile reloaded the stable extension ID in place and then showed version `1.2.2`, `X rocky`, `云端已同步`, the preserved section tabs, recycle-bin count 15, bookmark bar, categories, groups, and cards. The repaired header had no search/sync/account overlap. No unrelated personal tab or collection data was operated. The follow-up closeout commit is documentation-only and is not a new application version.

## 2026-07-17 V1.2.1 Mindmap Polish Release

This section supersedes the V1.2.0 development status once tag `webcollect-2026-07-17-v1.2.1` is published.

- Stable version/date: `V1.2.1 / 2026年7月17日`.
- Final tag: `webcollect-2026-07-17-v1.2.1`.
- Final Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-17-v1.2.1`; direct zip: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-17-v1.2.1/WebCollect-Chrome-Extension-v1.2.1-2026-07-17.zip`.
- Closeout: `docs/audit/webcollect-v1.2.1-mindmap-polish-closeout-2026-07-17.md`.
- Scope: closes the independent Fable review with a current-layout reset/refit control, immediate favicon letter fallback, inherited bilateral side metadata, indexed descendant counts, and focus return to the original add button after dialog close.
- Mode behavior: first use remains classic. User choices are remembered locally through localStorage `webcollect_collection_view_mode`; invalid values or unavailable storage fall back to classic without deleting the stored value. This preference does not sync across devices.
- Data contract: `mindmapViewState:<sectionId>` remains view-only IndexedDB state. The mode key is localStorage only. Neither participates in dirty sets, snapshots, Chrome storage, Supabase, collection sync, or business schemas.
- The audit intake commit is `8859022`; the functional implementation commit is `586912a`; the tagged release commit is `6320578baab4ca24b368fb5c05e77b0c0fd5e54a`. Main CI `29554414094` and Release workflow `29554667683` succeeded. The official zip is `16,957,003` bytes with SHA-256 `28ff22082b527b59ccf4f3d1f3e50d374b813bd3f1fd07d0ec95a8dc4b0138d3`. The existing primary-profile source path was backed up, synchronized exactly to the official package, manually reloaded, and observed serving a new `新标签页 - WebCollect` with the stable extension ID. The follow-up closeout commit is documentation-only and is not a new application version.

## 2026-07-16 V1.2.0 Mindmap Release

This section supersedes older development status once the `webcollect-2026-07-16-v1.2.0` tag is published.

- Stable version/date: `V1.2.0 / 2026年7月16日`.
- Final tag: `webcollect-2026-07-16-v1.2.0`.
- Final Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-16-v1.2.0`; direct zip: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-16-v1.2.0/WebCollect-Chrome-Extension-v1.2.0-2026-07-16.zip`.
- Closeout: `docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`.
- Scope: adds the Fable-style 导图模式 beside the classic collection wall. Classic remains the default startup mode; TopNav, dialogs, BookmarkBar, sync, snapshots, recycle bin, sections, categories, cards, and preferences continue to use the V1.1.2 paths.
- Data contract: the only new persisted key family is `mindmapViewState:<sectionId>` in the existing localforage `WebCollect/webcollect_data` store. It stores layout, collapsed nodes, offsets, camera, and updatedAt only. It is not synced, snapshotted, dirty-tracked, written to Chrome storage, or represented in Supabase.
- Implemented: M0 skeleton/switch, M1 layout engine, M2 read-only canvas, M3 drag/collapse/hover, M4 per-section persistence/search focus, M5 existing collection actions, M6 extension new-tab view, and M7 tree semantics, keyboard navigation, compact 390px controls, reduced-motion compatibility, empty state, and 300+ node viewport culling.
- Real Chrome evidence before publication: the installed stable extension ID `immpcmhmabobllnopedaoflcjneigbko` was preserved by syncing the new build into the existing unpacked source path and reloading in the signed-in primary Chrome profile. Classic showed the same 7 sections / 63 visible cards / recycle count 15 before and after reload; 导图 then rendered 63 web nodes, 11 category nodes, and 13 group nodes across all four layouts. Console inspection found no mindmap runtime crash; only pre-existing favicon/CSP/resource warnings were present.
- Release evidence fields such as final main commit, GitHub CI run, tag workflow run, official zip size, and SHA-256 are appended after publication by a docs-only closeout commit. That commit is not a new application version.

## 2026-07-16 V1.1.2 Final Release

This section supersedes older development status. The user explicitly waived the independent Profile B gate on 2026-07-16 and approved the tested RC7 line for final V1.1.2 publication.

- Stable version/date: `V1.1.2 / 2026年7月15日`.
- Verified release source: `main` and tag `webcollect-2026-07-15-v1.1.2` both point to `b7b4f75e8eb8f4f2763b0ede04b1f8a49a12962d`. Any commit after it may be documentation-only handoff maintenance; do not confuse that with a newer application release.
- Final tag: `webcollect-2026-07-15-v1.1.2`.
- Final Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-15-v1.1.2`; direct zip: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-15-v1.1.2/WebCollect-Chrome-Extension-v1.1.2-2026-07-15.zip`.
- Final zip: `16,942,028` bytes; SHA-256 `79cc7fb01d678e2af24cc8b733353a4a12a6b7ddceba71a5514e7f7f7c9a1192`; downloaded GitHub asset and packaged `manifest.json` were rechecked after publication.
- Final GitHub evidence: CI run `29468884175` and tag verification/Release run `29468911858` both succeeded.
- Closeout: `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`.
- Historical pre-OAuth baseline and remote backup: `main@ea45b53` and `codex/backup-pre-oauth-2026-07-13`.
- Published RC identity: tag `webcollect-2026-07-15-v1.1.2-rc.7`, code commit `a3a2d2f429c2c56b4e8c4e33fdc6da831bec4679`, asset `WebCollect-Chrome-Extension-v1.1.2-rc.7-2026-07-15.zip`, SHA-256 `747dcdcf62134f42352d281521460116fd89b3d87ba8509f1a2f5ddfc3e8da9d`.
- RC Prerelease: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-15-v1.1.2-rc.7`; direct zip: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-15-v1.1.2-rc.7/WebCollect-Chrome-Extension-v1.1.2-rc.7-2026-07-15.zip`.
- Verified RC7 folder: `/Users/rockyx/Downloads/WebCollect-v1.1.2-rc.7/unpacked`. To preserve the stable extension ID and IndexedDB, this exact tree was synchronized into Chrome's existing `~/Downloads/WebCollect-v1.1.2-rc.6/unpacked` source path and reloaded without uninstalling; `diff -qr` confirms both trees are identical.
- RC7 includes the edge-peeking mascot, fused top-bar `壁纸 | 开/关` control, July 15 version date, stale-refresh guard, and synchronous first-frame startup-mode resolution that prevents even a transient wallpaper mount when the mode is off.
- Fixed: clean-checkout Web OAuth configuration, fresh-Profile inbox duplication, deterministic canonical inbox selection when old clients already produced same-section duplicates, OAuth code cleanup, custom-server HMR upgrades, concurrent floating-capture destination creation, duplicate GoTrue clients, and browser auth refresh lifecycle misuse.
- Verified: 138 Vitest cases, all 31 legacy scripts, all 14 Playwright cases, TypeScript, ESLint, Web/extension production builds, extension artifact/size, multi-viewport visual checks, and isolated MV3 runtime. The npm Bulk Advisory gate checked 207 production packages with zero advisories at every severity.
- Real account: Profile A passed Google sign-in, local-scope sign-out, re-sign-in, validated session, and cloud sync. RC7 then passed in the signed-in Chrome profile from a secondary-display auxiliary window: stable ID, `X rocky`, cloud wall, sync badge, startup-wallpaper OFF state, four direct-to-collection new tabs, and preserved data all verified without touching the main personal window.
- Profile B loaded RC6 but remained logged out because Google reached its passkey/Touch ID challenge. It created no cloud data; this historical attempt is no longer a release gate.
- Data state is `364 cards / 130 categories / 24 preferences / 60 snapshots / 0 tombstones`; the old extension added one empty category while primary data counts otherwise stayed unchanged.
- Two exact empty inbox artifacts are documented in the closeout. One still has a section-preference reference; neither may be deleted without explicit user approval.
- Future real extension/OAuth checks use the user's existing signed-in primary Chrome profile. Do not create a separate Chrome account/Profile merely for acceptance; with two displays, use a dedicated auxiliary window in the same profile on the secondary display and leave unrelated personal tabs untouched.
- Windows and Mac real usage provide ongoing cross-device observation. It is not a local second-Profile release gate.

## Next Major Feature Thread

- V1.5.3 is the current candidate; V1.5.2 remains the fully published fallback until V1.5.3 CI, Release, official-zip audit, and real Chrome evidence complete.
- Read `AGENTS.md`, `AGD.md`, this file, `NEXT_THREAD_PROMPT.md`, the V1.5.3 closeout, the V1.5.2 closeout, the V1.5.0 feature closeout, and the V1.4.0 data-baseline closeout before changing code.
- Ask for or read the user's new feature description, then inspect only the relevant implementation paths before choosing scope, tests, version bump, and release plan.
- Preserve the V1.4.0 local-first Drive, backup, data, and migration guarantees. Do not reset IndexedDB, old Supabase data, extension storage, categories, cards, preferences, snapshots, local view state, mode preference, knowledge consent/cache, derived vectors, or the two documented empty inbox artifacts.
- Decide the next version only after understanding the feature's actual breadth. Use the real completion date and keep package, manifest, UI version, tag, Release, and zip identity aligned.
- The copy-paste startup prompt is maintained in `NEXT_THREAD_PROMPT.md`. Older sections below are historical evidence only.

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

### Historical Next-Thread Preflight (retired as a mandatory workflow)

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
- If real extension behavior or login state requires Chrome, use the user's existing signed-in primary Chrome profile; do not create a separate test Profile/account.
- With two displays, use a dedicated auxiliary window in that same profile on the secondary display and the `Codex Workbench` tab group. Do not operate unrelated personal tabs or reuse the user's current active personal tab.
- If the browser context is occupied or changed by the user, return to `@Browser`, Safari, the dedicated secondary-display window, or `Codex Workbench`; do not repeatedly open new tabs in the personal browsing window.

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
- `tasks/todo.md` - historical implementation checklist; not a required current ledger.
- `tasks/lessons.md` - historical lessons archive; current enforceable safeguards live in `AGENTS.md`.

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

1. Pull the branch on the Mac mini and read this file plus `AGENTS.md`; consult historical task archives only when a specific old decision needs context.
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
- Treat `AGENTS.md` as the current guardrail source; `tasks/lessons.md` is historical context only.
- Never use Homely import data as a recovery source unless the user explicitly asks.
- Keep `.gitignore` exclusions for local old-thread exports and `tmp/`.
- Do not commit real secrets, `.env*`, browser profile data, or downloaded thread exports.
- When changing web UI `wc-*` classes, check whether matching extension styles are also needed in `extension/src/extension.css`.
- When changing data structures, update `src/lib/types.ts`, local snapshots, cloud snapshots, sync, Supabase SQL/schema, and any focused test scripts together.
- Prefer incremental fixes over rewrites. The project has fragile user data and a long UI tuning history.
- Before major changes, ask the user whether they have made a current manual cloud save.

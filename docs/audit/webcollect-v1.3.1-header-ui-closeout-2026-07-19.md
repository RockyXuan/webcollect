# WebCollect V1.3.1 header UI closeout

Release identity: `V1.3.1 / 2026年7月19日`

Release tag: `webcollect-2026-07-19-v1.3.1`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-19-v1.3.1`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-19-v1.3.1/WebCollect-Chrome-Extension-v1.3.1-2026-07-19.zip`

Publication status: implementation, complete local gates, and isolated-browser visual acceptance are complete. The final application commit, main CI, tag workflow, official-zip audit, and signed-in primary-Chrome read-only check are recorded below only after they actually finish.

## Scope

- Google / 百度 / Bing use a neutral gray label by default. Hover and keyboard focus keep a restrained blue affordance without making the idle engine look selected.
- 保存、刷新、壁纸、分组、分类、回收站 and 仓库 share the same light-frame surface, 38px desktop height, 14px radius, neutral text, border, and shadow.
- `+ 网页` is the only blue primary action and uses the same dimensions as the neutral controls.
- The sync status uses the same neutral container. Success, syncing, and failure color only the compact status icon.
- 登录/账户 and 经典/导图 are vertically aligned to the shared control height. The segmented mode control keeps its selected state.
- Existing responsive structure is preserved: wide desktops use one row, 1181–1799px place the action toolbar on a dedicated row, and 390px uses 36px compact controls without document overflow.
- Web and Chrome extension share equivalent visual values. No TopNav public behavior or business action changed.

## Data boundary

- This release adds no storage key and changes no IndexedDB, Supabase, Chrome storage, snapshot, dirty-set, sync, permission, or extension-ID contract.
- Cards, categories, sections, preferences, recycle bin, snapshots, tombstones, knowledge cache, mindmap view state, and sync status are not cleared, overwritten, migrated, or rewritten by the header styling.
- The protected seed file remains unchanged with SHA-256 `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.

## Visual and interaction acceptance completed before publication

- The supplied header screenshot and the implementation were placed in one desktop comparison image and reviewed for height, padding, radius, border, text color, and alignment.
- In-app Browser acceptance reused one stable `http://127.0.0.1:5014/` context at 2048×1152, 1366×768, and 390×844.
- Desktop controls measured 38px with 14px radii; mobile controls measured 36px. The 1366px action row did not overlap the search area, and the 390px page had no horizontal overflow.
- Classic and mindmap switching reused one header without duplicate views or console errors.
- Targeted tests cover Web/extension CSS parity, all three sync states, responsive geometry, neutral engine styling, and compact mobile controls.
- Design QA record: `design-qa.md`.

## Automated verification completed before publication

- `git diff --check`, TypeScript, and ESLint passed.
- Vitest: 48 files / 372 tests passed.
- Legacy regression scripts: 31/31 passed.
- Playwright: 44/44 passed, including 14 responsive/header cases and protected collection-state comparisons.
- Web and Chrome-extension production builds passed.
- Extension background/mindmap artifact checks passed; the unpacked package remains 17.4 MiB and within the existing size gate.
- Production dependency audit covered 208 packages with zero info, low, moderate, high, or critical findings.
- The protected seed SHA remained unchanged after the complete run.

## Publication evidence

- Tagged application commit: `TODO`.
- Main CI: `TODO`.
- Tag/Release workflow: `TODO`.
- Official zip size: `TODO`.
- Official zip SHA-256: `TODO`.
- Official zip manifest/tree/local-build comparison: `TODO`.
- Signed-in primary-Chrome auxiliary-window read-only check: `TODO`.

## Publication checklist

- [x] Complete all local automated gates and production dependency audit.
- [ ] Commit and push the V1.3.1 release preparation to `main`.
- [ ] Wait for the complete main CI run to succeed.
- [ ] Create and push `webcollect-2026-07-19-v1.3.1`, then wait for the Release workflow.
- [ ] Confirm the Release is neither draft nor prerelease and contains exactly one asset named `WebCollect-Chrome-Extension-v1.3.1-2026-07-19.zip`.
- [ ] Download the official asset; verify Manifest V3 version `1.3.1`, the stable key input, the unique asset tree, byte size, local-build equality, and SHA-256.
- [ ] Reload the existing unpacked extension in place in the signed-in primary Chrome profile's auxiliary WebCollect window and perform read-only visual/data/sync checks.
- [ ] Append the real evidence in a documentation-only follow-up commit. That commit is not a new application version.

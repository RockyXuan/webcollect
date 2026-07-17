# WebCollect V1.2.1 mindmap polish closeout

Release identity: `V1.2.1 / 2026年7月17日`

Release tag: `webcollect-2026-07-17-v1.2.1`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-17-v1.2.1`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-17-v1.2.1/WebCollect-Chrome-Extension-v1.2.1-2026-07-17.zip`

This closeout records the V1.2.1 polish release built from the independent Fable review in `docs/audit/claude-fable-mindmap-review-2026-07-17.md`. GitHub CI, tag workflow, Release, downloaded-asset evidence, and the policy-bounded primary-profile Chrome reload were verified after publication. This follow-up is documentation-only and is not a new application version.

## Review intake and decisions

- Review commit `8859022` was fast-forwarded only after confirming its parent was the then-current `main@9a5ce9f`; it adds the review document, its AGD entry, and three evidence screenshots without importing stale branch history.
- The review found no V1.2.0 release-blocking correctness or data-safety failure. Its P2-1, P3-1, P3-2, P3-3, and focus-return findings were reproduced and accepted.
- The user chose to remember the last classic/mindmap selection locally. First use still defaults to classic; invalid or unavailable localStorage also falls back to classic.

## Implemented changes

### Current-layout reset

- The layout rail now contains a separator and a `RotateCcw` reset button with title and `aria-label="重置当前布局的手动摆放"`.
- The button is disabled when the current section and layout have no manual offsets.
- Reset clears only the active layout's offsets. It preserves every other layout, section, collapse state, and all business data.
- The camera is fitted from a newly computed zero-offset layout and fresh bounds, avoiding a stale-state fit.
- `clearMindmapLayoutOffsets` is a pure helper covered by a single-layout isolation test.

### Local mode memory

- The only new preference key is localStorage `webcollect_collection_view_mode` with legal values `classic | mindmap`.
- Missing, malformed, or inaccessible storage defaults to classic. Malformed values are not deleted.
- Web resolves the preference after mount and shows a stable neutral shell until resolution, avoiding SSR hydration mismatch and a classic-wall flash.
- The extension resolves the same preference synchronously before React mounts.
- User selection writes immediately. It remains local to the browser profile and does not sync across devices.

### Icons, direction, and scale

- Card nodes and hover previews always render a letter fallback first. A favicon fades in only after a candidate loads; failures continue the existing read-only candidate chain.
- Candidate changes reset the load state. Browsing the mindmap never calls `updateCard`.
- Layout results now include `sideByNodeId`. Bilateral top-level side assignment is inherited by all descendants, so dragging a left branch across the root does not flip its chip.
- Logic and indent layouts report `right`; the organization chart continues to render downward.
- A tree index computes node lookup, parent lookup, and `descendantCounts` once; rendering and keyboard behavior use the index, including 300+ node trees.

### Dialog focus closure

- Web and extension entry points remember the exact mindmap `+` trigger for category/card dialogs.
- Escape, cancel, and successful submit return focus to that trigger when it is still connected and focusable.
- The existing dialogs, Zustand actions, validation, and write paths are unchanged.

## Data and sync boundary

V1.2.1 does not clear, overwrite, migrate, or duplicate user collections.

- Unchanged business paths: `src/lib/db.ts`, `src/lib/sync.ts`, `src/lib/seed.ts`, Supabase schema, Chrome storage namespaces, snapshots, dirty sets, cards, categories, sections, preferences, recycle bin, tombstones, and sync metadata.
- Existing local-only IndexedDB view state: `mindmapViewState:<sectionId>` in `WebCollect/webcollect_data`.
- New local-only UI preference: localStorage `webcollect_collection_view_mode`.
- Neither key is part of Chrome storage, snapshots, dirty sets, Supabase, collection sync, or cross-device preference sync.
- Resetting a mindmap layout writes only the target view-state offsets and camera.
- The protected seed SHA-256 remained `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621` through final release verification.

## Commits

- Review intake: `8859022` — `docs(audit): mindmap V1.2.0 independent review - pass with polish items`.
- Functional implementation: `586912a` — `feat(mindmap): polish persistent interactions`.
- Release/version/documentation and tagged release commit: `6320578baab4ca24b368fb5c05e77b0c0fd5e54a` — `release: prepare WebCollect v1.2.1 mindmap polish`.
- Post-release evidence: this documentation-only closeout commit; it does not move the V1.2.1 tag or create another application version.

## Verification completed before release preparation

- `git diff --check` — passed for the functional implementation.
- TypeScript and ESLint — passed with zero errors/warnings.
- Vitest — 31 files / 158 tests passed at the functional checkpoint; a subsequent targeted icon-state test also passed and is included in the final full rerun.
- Extension build — passed; expected non-blocking Vite chunk-size warning remains.
- Extension artifact check — passed.
- Extension size — 17.1 MiB, passed.
- Mindmap Playwright suite — 15/15 passed.
- New browser coverage includes two-node reset/refit and state isolation, bilateral chip stability after crossing the root, offline favicon fallback, mode reload/new-page/corrupt-value behavior, focus return for Escape/cancel/submit, and 330+ node count/culling/keyboard behavior.
- Protected storage snapshots are deep-compared by the suite. Only target mindmap view state and the mode localStorage key may change.

## Final local release gate

The final pre-commit local gate passed on 2026-07-17:

- `git diff --check` — passed.
- `corepack pnpm@9.0.0 ts-check` — passed.
- `corepack pnpm@9.0.0 lint` — passed with zero errors/warnings.
- `corepack pnpm@9.0.0 test` — 31 files / 159 tests passed.
- `corepack pnpm@9.0.0 test:legacy` — all 31 scripts passed.
- `corepack pnpm@9.0.0 build` — passed outside the sandbox after the sandbox correctly rejected Turbopack's internal local port binding with `EPERM`.
- `corepack pnpm@9.0.0 build:ext` — passed; local main bundle `1,055.84 kB`, gzip `306.70 kB`, with the same non-blocking chunk warning documented in V1.2.0.
- `corepack pnpm@9.0.0 test:extension-artifact` — background and mindmap artifact checks passed.
- `corepack pnpm@9.0.0 test:extension-size` — 17.1 MiB, passed.
- `corepack pnpm@9.0.0 test:e2e` — 29/29 passed.
- `corepack pnpm@9.0.0 audit:prod` — npm Bulk Advisory API checked 207 production packages; info=0, low=0, moderate=0, high=0, critical=0.
- `src/lib/seed.ts` SHA-256 — `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`, unchanged.

## Stable in-app Browser verification

The Codex in-app Browser reused one isolated context at `http://127.0.0.1:5014/`. This did not use the user's primary Chrome profile.

- Opened the collection from the existing wallpaper stage and confirmed the classic wall rendered normally.
- Switched once to 导图 and confirmed the shared TopNav, root/category nodes, layout rail, legend, zoom cluster, and disabled no-offset reset button.
- Reloaded the same tab, returned from the wallpaper stage, and confirmed 导图 remained selected rather than flashing or reverting to classic.
- Opened the root “新建分类” dialog with its real `+` button, closed it with Escape, waited for the exit animation, and confirmed focus returned to the exact trigger (`aria-label="新建分类"`) while the dialog fully detached.
- Visual inspection at the Browser's 1280×720 viewport found no control overlap or document overflow. The full Playwright gate separately passed the 1920×1080 geometry and 390×844 compact-layout coverage.
- Browser console inspection reported 0 errors.

The same release commit was pushed to `main`; main CI completed successfully before the tag was created.

## Publication and official asset evidence

- Final release and tagged commit: `6320578baab4ca24b368fb5c05e77b0c0fd5e54a`.
- Main CI: [run 29554414094](https://github.com/RockyXuan/webcollect/actions/runs/29554414094), successful. `audit-production` and `verify` both passed; `verify` completed after the full 29-test browser suite.
- Tag workflow: [run 29554667683](https://github.com/RockyXuan/webcollect/actions/runs/29554667683), successful. It re-audited production dependencies, rebuilt the extension, checked the artifact and size, packaged the zip, and published the Release.
- Release: [WebCollect v1.2.1](https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-17-v1.2.1), published on 2026-07-17, not a draft or prerelease.
- Official asset: [WebCollect-Chrome-Extension-v1.2.1-2026-07-17.zip](https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-17-v1.2.1/WebCollect-Chrome-Extension-v1.2.1-2026-07-17.zip). Exactly one Release asset was published.
- Official zip size: `16,957,003` bytes.
- Official zip SHA-256: `28ff22082b527b59ccf4f3d1f3e50d374b813bd3f1fd07d0ec95a8dc4b0138d3`; the local rehash matched GitHub's reported digest.
- Downloaded archive: 46 entries (41 files plus 5 directories). Its unpacked file tree matched the locally verified `extension/dist` exactly.
- Downloaded manifest: Manifest V3, name `WebCollect`, version `1.2.1`, stable key present, new-tab override `newtab.html`, and background service worker `background.js`.
- The stable manifest key resolves to extension ID `immpcmhmabobllnopedaoflcjneigbko`.

## Primary Chrome profile evidence

- The existing installed source path `/Users/rockyx/Downloads/WebCollect-v1.1.2-rc.6/unpacked` still contained V1.2.0 before this update and retained the stable manifest key.
- A byte-for-byte append-only backup was created at `/private/tmp/webcollect-installed-extension-backups/unpacked-before-v1.2.1-final-20260717` before replacing any source file.
- The downloaded official V1.2.1 tree was synchronized into that same source path. `diff -qr` then confirmed the installed source and official unpacked package were identical; the manifest reported `1.2.1` and stable ID `immpcmhmabobllnopedaoflcjneigbko`.
- No extension uninstall, second Chrome profile, IndexedDB reset, Chrome storage reset, Supabase operation, or collection-data mutation was performed. Unrelated personal tabs were not claimed or operated.
- Chrome exposed the existing WebCollect extension detail tabs, but its browser security policy rejected both automated `chrome://newtab` navigation and claiming the `chrome://extensions` internal tab. The verification stopped at that boundary without raw CDP, profile inspection, Computer Use, or another bypass.
- After the official files were synchronized, the user clicked the existing detail page's reload icon and opened a new tab. The user confirmed completion, and the read-only Chrome tab inventory independently observed a newly opened `新标签页 - WebCollect` at `2026-07-17T06:05:01.256Z`, proving that the primary profile's new-tab override was again being served by WebCollect after reload.
- Chrome's internal-page policy prevented DOM-level inspection of that real new tab. Final runtime confidence therefore combines the user's direct visual confirmation, the observed WebCollect-owned new-tab identity, the exact official-package/source-tree match, the stable extension ID, the completed 29/29 browser regression suite, and the earlier same-profile V1.2.0 read-only data-preservation evidence. No claim is made that internal-page DOM or IndexedDB contents were re-read through a prohibited route.
- The V1.2.1 release and Chrome closeout are complete. No additional profile, reinstall, destructive storage action, or manual release step remains.

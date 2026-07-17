# WebCollect V1.2.1 mindmap polish closeout

Release identity: `V1.2.1 / 2026年7月17日`

Release tag: `webcollect-2026-07-17-v1.2.1`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-17-v1.2.1`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-17-v1.2.1/WebCollect-Chrome-Extension-v1.2.1-2026-07-17.zip`

This closeout records the V1.2.1 polish release built from the independent Fable review in `docs/audit/claude-fable-mindmap-review-2026-07-17.md`. Release-run, downloaded-asset, and primary-profile Chrome evidence are deliberately left as pending until those checks actually complete. They will be appended after publication by a documentation-only commit, which is not a new application version.

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
- The protected seed SHA-256 remains `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621` before final release verification.

## Commits

- Review intake: `8859022` — `docs(audit): mindmap V1.2.0 independent review - pass with polish items`.
- Functional implementation: `586912a` — `feat(mindmap): polish persistent interactions`.
- Release/version/documentation: this release-preparation commit; its final tagged SHA is recorded after publication to avoid a self-referential commit hash.
- Post-release evidence commit: pending and documentation-only.

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

Push to `main` and successful main CI remain pending until the release commit is created.

## Publication and official asset evidence

Pending until the GitHub tag workflow completes:

- Final release commit and tagged commit.
- Main CI run and tag workflow run.
- Published Release state and unique official asset.
- Downloaded official zip byte size and SHA-256.
- Manifest V3, version, stable key, new-tab override, background worker, and archive entry count.

## Primary Chrome profile evidence

Pending until the official package is available. The final smoke check must reuse the already signed-in primary Chrome profile, stable extension ID, and existing unpacked source path. It must not uninstall the extension, create a second profile, clear IndexedDB/Chrome storage, or operate unrelated personal tabs. If Chrome internal-page automation is blocked, the check may request one manual reload and must stop at the policy boundary rather than bypass it.

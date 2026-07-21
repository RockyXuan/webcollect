# WebCollect V1.4.1 floating capture keyboard closeout

Release identity: `V1.4.1 / 2026年7月21日`

Release tag: `webcollect-2026-07-21-v1.4.1`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-21-v1.4.1`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-21-v1.4.1/WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`

Publication status: local implementation and verification complete; GitHub and official-package evidence will be appended after publication.

## Root cause and fix

- The floating capture panel is rendered in an open Shadow DOM. Keyboard events are composed, so `keydown`, `keypress`, and `keyup` crossed the shadow boundary and reached host-page shortcut listeners.
- Outside the shadow tree, the retargeted event appeared to originate from the ordinary `DIV` host instead of an editable input. GitHub therefore treated `s` / `S` as its global search shortcut even while the user was typing in WebCollect.
- V1.4.1 installs a capture-phase guard on `window`, checks `event.composedPath()` for the WebCollect host, and stops only those three keyboard event types before the host page receives them.
- The guard never calls `preventDefault()`. Browser-default text entry, uppercase/lowercase input, Chinese IME composition, Tab focus movement, select controls, copy/paste, and undo remain available. Page shortcuts outside WebCollect remain untouched.

## Data and compatibility boundary

- No collection action, persistence key, schema, permission, dependency, OAuth scope, Drive endpoint, snapshot path, Chrome storage contract, sync revision, tombstone, knowledge cache, or seed record changed.
- Opening and testing the panel does not enqueue or save a card. Real-profile acceptance must close the panel without pressing `保存`.
- The existing complete backup `/Users/rockyx/Downloads/WebCollect-complete-backup-2026-07-21T09-37-42-202Z.json` was parsed with the project validator before code changes. Its valid internal content hash is `eac1cf524d0ade019ae847a1b6751f9271b822c6b1ac9c8ba5ed5e7cf5ed16c1`; counts are 7 sections, 135 categories/groups, 372 cards, 15 recycle-bin entries, 4 local versions, 69 Drive versions, and 2 mindmap view-state records.
- The protected seed SHA remains `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.
- V1.4.0 remains the Google Drive, complete JSON, local-first, migration, and 30-day Supabase safety baseline.

## Verification

- The new isolated Chromium regression first failed on V1.4.0 and recorded every `s` / `S` as host-page capture and bubble events whose retargeted target was `DIV`.
- After the fix, the same real extension build verified title, URL, description, and create-section inputs; lowercase/uppercase text; synthetic IME composition; copy/paste; Tab navigation; outside-page shortcuts; half-face hover/click behavior; and zero console errors.
- Static regression checks require `composedPath()` host filtering, capture-phase `keydown` / `keypress` / `keyup` listeners, `stopImmediatePropagation()`, and the absence of `preventDefault()`.
- TypeScript and ESLint passed without warnings.
- Vitest: 52 files / 395 tests passed.
- Legacy regression scripts: 31/31 passed.
- Playwright: 44/44 passed after running one dedicated local test server; a prior overlapping-run infrastructure attempt was discarded after its shared server exited and produced only `ERR_CONNECTION_REFUSED` failures.
- Web and Chrome-extension production builds passed.
- Extension background/mindmap artifact checks and the 17.2 MiB size gate passed.
- Production dependency audit covered 200 packages with zero info, low, moderate, high, or critical findings.

## Commits and publication checklist

- Implementation commit: `2617ccd` (`fix(extension): isolate floating capture shortcuts`).
- Release commit: pending.
- Main CI: pending.
- Release workflow: pending.
- Official zip audit: pending.
- Existing signed-in primary-Chrome read-only verification: pending.

- [x] Validate a complete readable backup before code changes.
- [x] Reproduce the leak with a real built extension and host-page capture/bubble listeners.
- [x] Implement minimal keyboard isolation without preventing browser defaults.
- [x] Pass local unit, legacy, real-extension, Playwright, Web/extension build, artifact, size, seed, and production-audit gates.
- [ ] Reload the existing primary-profile installation in place and verify GitHub without saving a card.
- [ ] Push the V1.4.1 application commit to `main` and wait for main CI.
- [ ] Push the formal tag and wait for the Release workflow.
- [ ] Download and audit the single official asset.
- [ ] Append real publication evidence in a documentation-only commit; it is not a new application version.

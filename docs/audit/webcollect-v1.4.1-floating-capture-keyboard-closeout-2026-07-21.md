# WebCollect V1.4.1 floating capture keyboard closeout

Release identity: `V1.4.1 / 2026年7月21日`

Release tag: `webcollect-2026-07-21-v1.4.1`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-21-v1.4.1`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-21-v1.4.1/WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`

Publication status: complete. The application commit, main CI, formal tag, Release workflow, single official asset, official-package audit, and existing-primary-Chrome acceptance all passed. The follow-up closeout update is documentation-only and is not a new application version.

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
- Main CI run `29842309751` passed both `verify` and `audit-production`, including the new real-extension regression and all 44 Playwright cases: `https://github.com/RockyXuan/webcollect/actions/runs/29842309751`.
- The existing signed-in primary Chrome profile was updated in place without uninstalling or creating another profile. Chrome reported WebCollect `1.4.1`, stable ID `immpcmhmabobllnopedaoflcjneigbko`, and the active service worker. The exact GitHub page from the user report was reused: typing real `sS` and `sS sousuo` key sequences in the floating title field did not open GitHub search; Tab moved focus to the URL field; the panel was cancelled without saving; after the panel closed, pressing `s` in the page still opened GitHub search. No unrelated personal tab was operated.
- Before replacing the installed files, the active V1.4.0 source was copied append-only to `/private/tmp/webcollect-installed-extension-backups/v1.4.0-before-v1.4.1-20260721-02`. The installed source, local release build, and downloaded official package subsequently matched exactly.

## Formal publication and official-package audit

- Tagged application commit: `8af01d34bc5d095d7961e658558e8fa7c5c16ff0`.
- Release workflow `29842892835` passed and published the formal Release: `https://github.com/RockyXuan/webcollect/actions/runs/29842892835`.
- The Release contains exactly one asset, `WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`, at `17,056,539` bytes.
- Official asset SHA-256: `abccc041f9e32c87535a6d38fa8072edb011477af6eea3da8442eda87a59e084`; it matches the GitHub asset digest.
- Zip integrity, unique entry names, the 41-file unpacked tree, byte-for-byte equality with `extension/dist`, manifest version `1.4.1`, stable extension ID, and content-script uniqueness passed.
- Permissions remain `storage`, `activeTab`, `identity`, and `contextMenus`; the only OAuth scope remains `https://www.googleapis.com/auth/drive.appdata`. The official package contains no Google client secret, Supabase credential, OpenAI/DeepSeek key, or new permission.

## Commits and publication checklist

- Implementation commit: `2617ccd` (`fix(extension): isolate floating capture shortcuts`).
- Release commit: `8af01d34bc5d095d7961e658558e8fa7c5c16ff0` (`release: prepare WebCollect v1.4.1 shortcut fix`).
- Main CI: `29842309751`, successful.
- Release workflow: `29842892835`, successful.
- Official zip audit: successful; one asset, `17,056,539` bytes, SHA-256 `abccc041f9e32c87535a6d38fa8072edb011477af6eea3da8442eda87a59e084`.
- Existing signed-in primary-Chrome verification: successful on the reported GitHub page, with no card saved.

- [x] Validate a complete readable backup before code changes.
- [x] Reproduce the leak with a real built extension and host-page capture/bubble listeners.
- [x] Implement minimal keyboard isolation without preventing browser defaults.
- [x] Pass local unit, legacy, real-extension, Playwright, Web/extension build, artifact, size, seed, and production-audit gates.
- [x] Reload the existing primary-profile installation in place and verify GitHub without saving a card.
- [x] Push the V1.4.1 application commit to `main` and wait for main CI.
- [x] Push the formal tag and wait for the Release workflow.
- [x] Download and audit the single official asset.
- [x] Append real publication evidence in a documentation-only commit; it is not a new application version.

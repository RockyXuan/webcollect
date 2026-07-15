# WebCollect V1.1.2 account sync closeout

Updated: 2026-07-15
Release candidate identity: `V1.1.2 / 2026年7月15日`
RC tag: `webcollect-2026-07-15-v1.1.2-rc.6`
Previous RC tags: `webcollect-2026-07-15-v1.1.2-rc.5`, `webcollect-2026-07-14-v1.1.2-rc.4`, `webcollect-2026-07-14-v1.1.2-rc.3`, `webcollect-2026-07-14-v1.1.2-rc.2`, `webcollect-2026-07-14-v1.1.2-rc.1`
Planned final tag: `webcollect-2026-07-15-v1.1.2`
Current gate: RC6 is published, downloaded, byte-verified, and loaded under the stable extension ID in the user's explicitly authorized signed-in Chrome. The real account, cloud wall, startup-wallpaper switch, metadata fix, and sync badge passed there. The only remaining account-level gate is a second independent Profile B session; Google reached its passkey/Touch ID step, which requires the user. Do not call the final release complete until that independent-session proof passes or the user explicitly waives it.

This patch follows the V1.1.1 full-project audit. It focuses on the last real-account observation and on defects found while reproducing a fresh Profile login. The PM split and the live WebCollect database migration remain documented in `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`.

## Data protection receipt

- Baseline `main`: `ea45b5311c0fcff50e17d880156204905df1fbda`.
- Remote backup branch: `codex/backup-pre-oauth-2026-07-13`.
- Existing private cloud archive: `/private/tmp/webcollect-supabase-backup-post-split-2026-07-12T14-19-32-568Z.tgz`.
- Archive SHA-256: `037db35b113bcf59748aaa3415209745a5aa08d9f628511eb1fc27a6b700813e`.
- A fresh workspace snapshot was created before account testing.
- Last verified cloud counts are `364 cards / 130 categories / 24 preferences / 60 snapshots / 0 tombstones / 1 workspace-version row`. The category count increased by one when the old extension in the user's signed-in Chrome synced on 2026-07-14; later RC verification added safety snapshots without decreasing cards, categories, preferences, or tombstones.
- The public schema contains only seven WebCollect tables (`users`, `categories`, `cards`, `user_preferences`, `workspace_snapshots`, `workspace_tombstones`, and `workspace_versions`), all with RLS enabled; no Portfolio Management table has returned.
- `src/lib/seed.ts` is byte-for-byte unchanged from the baseline commit.
- Tests use isolated IndexedDB and temporary Chrome Profiles. They do not clear or rename the user's real categories or cards.

## Current RC6 publication receipt

- Code identity: `b9b41fcc828ca00e96cd1e0c29e0f4994c483b2d` at tag `webcollect-2026-07-15-v1.1.2-rc.6`.
- Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-15-v1.1.2-rc.6` (GitHub Prerelease).
- Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-15-v1.1.2-rc.6/WebCollect-Chrome-Extension-v1.1.2-rc.6-2026-07-15.zip` (`16,941,931` bytes).
- SHA-256: `2e9496d8554f160343c9237221f34f2b698b8b9f0b184975f50ab8a8eae0db8a`.
- Downloaded zip: `/Users/rockyx/Downloads/WebCollect-v1.1.2-rc.6/WebCollect-Chrome-Extension-v1.1.2-rc.6-2026-07-15.zip`.
- Unpacked extension: `/Users/rockyx/Downloads/WebCollect-v1.1.2-rc.6/unpacked`.
- The downloaded archive declares WebCollect `1.1.2` / Manifest V3; its unpacked contents match `extension/dist` exactly.
- The user's signed-in Chrome now loads RC6 from the unpacked folder above under extension ID `immpcmhmabobllnopedaoflcjneigbko`; it was replaced without uninstalling, preserving IndexedDB and the real wall.
- RC4 made prerelease publication guarded and repeatable, RC5 retained a hoverable edge-peeking mascot and dated the build for July 15, and RC6 prevents a stale startup refresh from rolling the wallpaper-mode preference back.
- `main` later gained documentation-only commit `40d597eb0363bb9872c7859757191b7fb9de2099`; the RC6 binary remains pinned to the code identity above.
- RC1 through RC5 remain historical evidence; RC6 supersedes them for installation and account acceptance.

## Top-bar wallpaper startup switch acceptance

- The left half of the fused control enters the wallpaper page immediately; it does not change the saved startup preference.
- The right half is an accessible `role="switch"` with visible `开/关` state and persists the existing `defaultMode` preference used by the wallpaper settings dialog.
- Turning it off keeps the current collection visible and makes the next reload/new tab enter the collection directly; turning it back on makes the next reload/new tab show wallpaper first.
- The switch does not open the wallpaper settings dialog and rapid clicks are serialized while IndexedDB persistence is in flight.
- Isolated Chromium acceptance passed at `2048x1152`, `1440x900`, `1024x768`, and `390x844`; all had zero document-level horizontal overflow. The mobile toolbar retains its deliberate recoverable horizontal scroller.

## Edge-peeking mascot acceptance

- Resting right-dock geometry exposes `50.07%` of the slightly tilted chipmunk face; resting left-dock geometry exposes `50.00%` with mirrored tilt.
- Hover exposes the full `159px` capture pill, hides the standalone peek face, and keeps the mascot fully visible.
- Clicking the revealed pill still opens the floating capture panel.
- The isolated Chromium run reports zero console errors; the repeatable command is `corepack pnpm@9.0.0 test:extension-peek`.

## Root causes fixed

### Local Web Google OAuth was configuration-dependent

The Web build fetched `/api/supabase-config`, but a clean local checkout returned `503` when private environment files were absent. The Chrome extension already shipped the same public anon configuration, so the Web path behaved differently from the extension.

Fix:

- one shared public Supabase configuration module now serves Web and extension clients;
- deployment environment values still override the fallback as a pair;
- tests decode the fallback JWT and prove it is only the public `anon` role for WebCollect project `qxlkigwadvgkoeqdojxx`;
- real Profile A Google sign-in, sign-out, and sign-in again passed.

The anon key is a public browser credential. Access remains enforced by the existing Supabase session and row-level security policies; no service-role credential was added.

### A fresh Profile could create a duplicate inbox before pulling cloud data

The first sync normalized local bootstrap ID `cat-inbox` to a new UUID before loading the cloud category set. A fresh Profile could therefore upload a second empty inbox instead of reusing the existing inbox for that section.

Fix:

- cloud categories and `categorySectionIds` load before local ID normalization;
- only exact bootstrap IDs (`cat-inbox` and `cat-inbox-*`) named `收集箱` are eligible;
- reconciliation selects the cloud inbox by section mapping, then remaps pre-login cards and child categories;
- multiple legitimate same-name inboxes in other sections are preserved;
- both normal merge and fallback snapshot-push paths have regression coverage;
- an unresolved or ambiguous target is not heuristically merged.

### OAuth callback code could remain in the address bar

After a real PKCE sign-in, Profile A could retain `?code=...` because client initialization and development refresh raced. Once `getUser()` validates the remote session, WebCollect now removes only the consumed `code` query parameter and preserves unrelated parameters. The behavior is covered by a unit test and passed in Profile A.

### Repeated login could create two GoTrue clients in one browser context

An unauthenticated startup cleared the local Supabase auth keys and also discarded the in-memory client. Clicking Google login immediately created another `GoTrueClient` with the same storage key. Supabase warned that concurrent clients could race over the persisted session.

Fix:

- clearing WebCollect's local auth keys no longer discards the configured client;
- saving the same Supabase URL and anon key reuses the existing client;
- a genuine configuration change stops the old refresh loop before replacing the client;
- normal local-scope logout removes and revokes the session without disabling Supabase's browser-managed foreground/background refresh lifecycle;
- Google login no longer calls the React-Native-style manual refresh controls that Supabase documents as inappropriate for ordinary browser visibility management;
- regression tests instantiate the real Supabase client and fail if the official multiple-client warning returns;
- the dedicated Profile B browser was reopened on the fixed code and produced no GoTrue warning or console error before Google handoff.

### The custom Next server dropped the HMR WebSocket upgrade

The custom HTTP server forwarded ordinary requests but never attached Next's upgrade handler. Development pages rendered, while the HMR WebSocket failed.

Fix:

- `src/server.ts` attaches `app.getUpgradeHandler()` after `app.prepare()`;
- a real `101 Switching Protocols` handshake passed for both `localhost` and `127.0.0.1`;
- loopback development origins are explicit;
- stale `.next` output was removed before rechecking hydration and console state.

### Simultaneous capture-drain triggers could duplicate a new destination

The isolated extension screenshot exposed two `Runtime Audit` tabs from one queue item. Initialization, focus, and the service-worker queue message could call `drainFloatingCaptureQueue()` concurrently. Rebased IndexedDB writes correctly preserved both writers, but that also preserved two independently created section IDs.

Fix:

- the complete queue read, destination creation, IndexedDB rebase, and queue replacement now run under one `Web Lock` with a process fallback;
- a concurrent regression test first failed and now proves two callers create one section, one group, and one card;
- isolated MV3 runtime now hard-fails unless matching section and group counts are exactly one;
- final runtime result: `matchingSectionCount=1`, `matchingGroupCount=1`, zero console errors.

### Existing same-section inbox duplicates made bootstrap selection row-order dependent

While preparing the installable RC on 2026-07-14, the user's older signed-in Chrome extension uploaded another empty top-level `收集箱`. It shares the same section mapping as the populated inbox. The previous V1.1.2 candidate used the first matching database row, so a fresh Profile could map its pre-login capture to an empty duplicate solely because of query order.

Fix:

- exact-name, top-level inbox candidates remain scoped to the same collection section;
- the canonical candidate is selected deterministically by descending card count, then oldest creation time, then lexical ID;
- no existing category is deleted or merged automatically;
- red/green tests cover normal sync and fallback snapshot push with the empty duplicate intentionally returned before the populated inbox;
- both paths preserve the existing cloud rows, avoid uploading a third inbox, and map new captures to the populated canonical inbox.

### A stale gh keychain token blocked an otherwise valid Release path

The repository's normal Git credential remained valid for fetch and push, while `gh auth status` used a separate expired token. Repeating browser device authorization was both noisy and unnecessary.

Fix:

- `scripts/gh-proxy.sh` now reuses the existing `git credential fill` result when no explicit `GH_TOKEN` or `GITHUB_TOKEN` is supplied;
- the credential is process-local, never printed, and terminal prompting is disabled;
- a regression contract checks the fallback and guards against echoing the token;
- a live read-only probe identified the expected GitHub account and confirmed push permission without another browser login.

## Account-level observation

### Profile A

- Dedicated Browser Profile, not the user's main Chrome window.
- Real Google OAuth sign-in passed.
- Remote session validation passed through `supabase.auth.getUser()`.
- Sign-out cleared the remote and local session.
- Re-sign-in passed, the real account avatar rendered, cloud sync completed, and the callback URL returned to `/` without a stale code.
- Supabase recorded one account session created/refreshed during this test window.

### Authorized signed-in main Chrome

- The user explicitly authorized the existing main Chrome for this RC account closeout; only the WebCollect task tab was operated, and unrelated personal tabs were not opened or changed.
- RC6 loaded under the stable extension ID and displayed `2026年7月15日 · V 1.1.2`.
- The real `X rocky` account, `云端已同步` badge, populated cloud wall, and account settings rendered without re-login.
- The top-bar startup-wallpaper switch reported ON and a fresh new tab showed wallpaper first; the earlier OFF/refresh/restore regression run proved the preference no longer rolls back after a stale refresh.
- The corrected card `docu.md — AI 负责写作，docu.md 完成其余工作。` remained present in the real wall.
- The account panel and wall were inspected read-only. No card, category, preference, recycle-bin item, or login session was deleted or edited.

### Profile B

- Dedicated physical Chrome process and separate user-data directory: `/private/tmp/webcollect-oauth-profile-b2-20260713`.
- Remote debugging is isolated on `127.0.0.1:9227`.
- The previous login window was closed before Google callback and is not counted as a passing session.
- RC6 loaded successfully with the same extension ID, version `1.1.2`, active service worker, working new-tab page, and no GoTrue warning before Google handoff.
- Google OAuth reached the account passkey/Touch ID challenge. It was not bypassed; after the Google page expired, the Profile returned cleanly to WebCollect's `Google 登录` state.
- Profile B has not synced or created cloud data and is not counted as a passing second session.
- Password, second factor, CAPTCHA, and Google safety approval must be completed by the user. They are not copied, scripted, or bypassed.
- Pending acceptance after the user completes the challenge: real avatar and sync badge render, existing wall loads, cloud remains `364 / 130 / 24`, no additional inbox is uploaded, and two recent account sessions are visible concurrently.

## Empty artifacts requiring explicit approval

The pre-fix Profile A run created one empty category row:

- exact category ID: `fd2f806e-cae1-4ef4-a1c5-00ed452f83ca`;
- name: `收集箱`;
- card references: `0`;
- section preference references: `0`.

The older signed-in Chrome extension created another empty row while this RC was being prepared:

- exact category ID: `d32df270-e3bb-458f-a8b3-d41dad0fef43`;
- name: `收集箱`;
- card references: `0`;
- section preference references: `1` (`categorySectionIds`, same section as the populated inbox).

Both rows are empty, but the project's highest-priority rule forbids deleting or rewriting any category without explicit user approval. The second row is also still referenced by a preference. V1.1.2 prevents either row from causing another bootstrap duplicate, but retains both rows and their evidence.

## Verification receipt before the final account gate

- Vitest: 23 files, 132 tests passed.
- Legacy compatibility: all 31 scripts passed.
- Playwright Web E2E: all 14 tests passed with one worker; four cold-start timeouts seen under five concurrent workers passed individually and did not reproduce as product assertion failures.
- TypeScript and ESLint: passed.
- Web production build: all 10 routes/pages and the custom server bundle passed.
- Extension build, background artifact, and 25 MiB size gate passed; unpacked size is 17.1 MiB.
- Production dependency audit through the npm registry: no known vulnerabilities.
- Supabase security advisor reports only the optional leaked-password protection warning; WebCollect currently uses Google OAuth rather than password login. The performance advisor reports one informational unused index and no blocking issue.
- Isolated MV3 runtime: service worker, private URL refusal, public metadata, desktop/mobile wallpaper geometry, exact target capture, concurrency uniqueness, and zero console errors passed.
- Persisted non-account screenshots include the previous extension wallpaper/runtime evidence plus `docs/audit/screenshots/webcollect-v1.1.2-rc3-wallpaper-toggle-2048x1152-2026-07-14.png` and `docs/audit/screenshots/webcollect-v1.1.2-rc3-wallpaper-toggle-390x844-2026-07-14.png` for the new fused control.
- Isolated tests did not change cloud data or seed content. The separate increase from 129 to 130 categories was caused by the older signed-in Chrome extension before the RC was installed and is recorded above.

## Finalization checklist

- [x] Publish V1.1.2 RC6 and verify its tag, code commit, prerelease flag, unique asset, size, SHA-256, manifest, and unpacked contents.
- [x] Update the explicitly authorized signed-in Chrome to RC6 without uninstalling it; verify the loaded version/date, real account, cloud wall, sync badge, top-bar switch, metadata fix, and stable extension ID.
- [ ] Complete Google OAuth in the independent Profile B.
- [ ] Verify two recent sessions, both cloud walls, and unchanged `364 / 130 / 24` primary data counts.
- [ ] Record the user's decision for both proven-empty category artifacts; default is retain.
- [x] Re-run unit, legacy, TypeScript, ESLint, extension build/runtime, dependency audit, and Supabase advisors after the latest auth fix.
- [x] Re-run Web E2E against the stable OAuth server and production build in an isolated APFS-cloned workspace without interrupting Profile B.
- [x] Update `AGD.md`, handoff/status files, and this document with the exact RC code commit.
- [x] Push the verified RC code to `main`.
- [x] Publish and verify RC6 asset `WebCollect-Chrome-Extension-v1.1.2-rc.6-2026-07-15.zip`.
- [ ] Publish final `WebCollect-Chrome-Extension-v1.1.2-2026-07-15.zip` after account acceptance or an explicit user waiver of the independent Profile B gate.

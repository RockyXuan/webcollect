# WebCollect V1.1.2 account sync closeout

Updated: 2026-07-14
Release candidate identity: `V1.1.2 / 2026年7月14日`
RC tag: `webcollect-2026-07-14-v1.1.2-rc.1`
Planned final tag: `webcollect-2026-07-14-v1.1.2`
Current gate: publish the installable RC first, then verify the user's explicitly authorized signed-in Chrome plus a second independent Profile; do not call the final release complete until the account-level section below is closed.

This patch follows the V1.1.1 full-project audit. It focuses on the last real-account observation and on defects found while reproducing a fresh Profile login. The PM split and the live WebCollect database migration remain documented in `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`.

## Data protection receipt

- Baseline `main`: `ea45b5311c0fcff50e17d880156204905df1fbda`.
- Remote backup branch: `codex/backup-pre-oauth-2026-07-13`.
- Existing private cloud archive: `/private/tmp/webcollect-supabase-backup-post-split-2026-07-12T14-19-32-568Z.tgz`.
- Archive SHA-256: `037db35b113bcf59748aaa3415209745a5aa08d9f628511eb1fc27a6b700813e`.
- A fresh workspace snapshot was created before account testing.
- Current cloud counts are `364 cards / 130 categories / 24 preferences / 58 snapshots / 0 tombstones / 1 workspace-version row`. The category count increased by one when the old extension in the user's signed-in Chrome synced on 2026-07-14; no card, preference-row, snapshot, or tombstone count decreased.
- The public schema contains only seven WebCollect tables (`users`, `categories`, `cards`, `user_preferences`, `workspace_snapshots`, `workspace_tombstones`, and `workspace_versions`), all with RLS enabled; no Portfolio Management table has returned.
- `src/lib/seed.ts` is byte-for-byte unchanged from the baseline commit.
- Tests use isolated IndexedDB and temporary Chrome Profiles. They do not clear or rename the user's real categories or cards.

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

### Profile B

- Dedicated physical Chrome process and separate user-data directory: `/private/tmp/webcollect-oauth-profile-b2-20260713`.
- Remote debugging is isolated on `127.0.0.1:9227`.
- The previous login window was closed before Google callback and is not counted as a passing session.
- The user has now explicitly authorized the existing signed-in main Chrome as the account-bearing verification surface; first install the RC there and confirm its actual extension version, then use the separate Profile B for the second-session proof.
- Password, second factor, CAPTCHA, and Google safety approval must be completed by the user. They are not copied, scripted, or bypassed.
- Pending acceptance after callback: real avatar and sync badge render, existing wall loads, cloud remains `364 / 130 / 24`, no additional inbox is uploaded, and two recent account sessions are visible concurrently.

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

- Vitest: 22 files, 129 tests passed.
- Legacy compatibility: all 31 scripts passed.
- Playwright Web E2E: all 12 tests passed.
- TypeScript and ESLint: passed.
- Web production build: all 10 routes/pages and the custom server bundle passed.
- Extension build, background artifact, and 25 MiB size gate passed; unpacked size is 17.1 MiB.
- Production dependency audit through the npm registry: no known vulnerabilities.
- Supabase security advisor reports only the optional leaked-password protection warning; WebCollect currently uses Google OAuth rather than password login. The performance advisor reports one informational unused index and no blocking issue.
- Isolated MV3 runtime: service worker, private URL refusal, public metadata, desktop/mobile wallpaper geometry, exact target capture, concurrency uniqueness, and zero console errors passed.
- Persisted non-account screenshots: `docs/audit/screenshots/webcollect-v1.1.2-extension-wallpaper-1440x900-2026-07-13.png`, `docs/audit/screenshots/webcollect-v1.1.2-extension-wallpaper-390x844-2026-07-13.png`, and `docs/audit/screenshots/webcollect-v1.1.2-extension-collection-1440x900-2026-07-13.png`.
- Isolated tests did not change cloud data or seed content. The separate increase from 129 to 130 categories was caused by the older signed-in Chrome extension before the RC was installed and is recorded above.

## Finalization checklist

- [ ] Publish and install the V1.1.2 RC in the explicitly authorized signed-in Chrome; verify the loaded manifest version.
- [ ] Complete Google OAuth in the independent Profile B.
- [ ] Verify two recent sessions, both cloud walls, and unchanged `364 / 130 / 24 / 58` counts.
- [ ] Record the user's decision for both proven-empty category artifacts; default is retain.
- [x] Re-run unit, legacy, TypeScript, ESLint, extension build/runtime, dependency audit, and Supabase advisors after the latest auth fix.
- [x] Re-run Web E2E against the stable OAuth server and production build in an isolated APFS-cloned workspace without interrupting Profile B.
- [ ] Update `AGD.md`, handoff/status files, and this document with the exact commit.
- [ ] Push the verified commit to `main`.
- [ ] Publish and verify RC asset `WebCollect-Chrome-Extension-v1.1.2-rc.1-2026-07-14.zip`, then publish final `WebCollect-Chrome-Extension-v1.1.2-2026-07-14.zip` after account acceptance.

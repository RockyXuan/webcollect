# WebCollect V1.1.0 audit closeout

Current release note: V1.1.0 remains the full audit and database-migration record. The installable release was superseded the same day by V1.1.1 after GitHub cold-start E2E and duplicate-release-publisher fixes. Read `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md` first for current release identity.

Date: 2026-07-12
Release identity: `V1.1.0 / 2026年7月12日`
Release tag: `webcollect-2026-07-12-v1.1.0`

This document is the current audit and handoff entry. Earlier audit files remain useful for requirement history, but any earlier statement that the PM split or WebCollect sync migration is still pending is superseded here.

## Executive result

- Portfolio Management is running from its independent Supabase project `erzblrpfqjjwmlkxkkkb`; its `main` deployment was independently checked against commit `00003384a52cecb4fc1607526ae80db0049ce0c1`.
- The former shared project `qxlkigwadvgkoeqdojxx` now contains only WebCollect application tables. No PM tables, views, types, or sequences remain.
- One missed PM residue was found: login role `alphalens_app` still had grants on WebCollect tables. It is now `NOLOGIN`, has no WebCollect table grants, and cannot connect.
- WebCollect's revision/tombstone/workspace-version migration is live. Legacy row counts did not change.
- The audited code, Web build, extension build, isolated extension runtime, responsive browser flows, and production dependency audit pass.

## Data protection and live migration

Fresh post-split backup created before any WebCollect SQL:

- Archive: `/private/tmp/webcollect-supabase-backup-post-split-2026-07-12T14-19-32-568Z.tgz`
- Archive SHA-256: `037db35b113bcf59748aaa3415209745a5aa08d9f628511eb1fc27a6b700813e`
- Manifest SHA-256: `15c37ce5ed4a87ee8f38f2d7604d3372aae93298f0e6303189347cffe8497fca`
- Permissions: archive `0600`; expanded backup directory `0700`.

Counts before and after migration:

| Table | Rows before | Rows after |
| --- | ---: | ---: |
| `users` | 1 | 1 |
| `categories` | 128 | 128 |
| `cards` | 364 | 364 |
| `user_preferences` | 22 | 22 |
| `workspace_snapshots` | 57 | 57 |
| `workspace_tombstones` | absent | 0 |
| `workspace_versions` | absent | 1 |

Applied live migrations:

1. `preserve_client_updated_at_20260712`
2. `webcollect_sync_revisions_v1_1_0`
3. `retire_shared_pm_role_20260712`
4. `restrict_trigger_function_execution_20260712`

Live transactional probes were rolled back and proved:

- unchanged writes receive a server timestamp;
- a valid client timestamp is preserved;
- workspace version increments on a real mutation;
- text IDs such as `card-local-before-first-sync` are valid tombstone IDs;
- rollback leaves `categories=128`, `cards=364`, `tombstones=0`, and workspace version `0`.

Post-migration access boundary:

- all seven public tables have RLS enabled;
- `anon` has zero table grants;
- trigger functions execute only for `postgres` and `service_role`;
- `alphalens_app` has no login, table, or schema-create privilege;
- an old-role connection attempt fails with PostgreSQL code `28000`.

## Root-cause fixes added in the final pass

### Supabase configuration boundary

- Removed the old `python3 + execSync + coze_workload_identity` configuration fallback.
- Ordinary app clients always use the anon key plus an optional verified user token.
- Removed silent fallback to `COZE_SUPABASE_SERVICE_ROLE_KEY`.
- Added source contracts preventing child-process configuration and service-role fallback from returning.

### Short-screen wallpaper settings

- Before: at `1280x720`, the modal exceeded the viewport; its title and `完成` button could be unreachable.
- Fix: stable max height, scrollable middle content, and a fixed footer.
- Browser geometry: dialog top `14.4`, bottom `705.6`, footer entirely inside a `720px` viewport.
- Screenshot: `docs/audit/screenshots/webcollect-v1.1-wallpaper-settings-short-screen-1280x720-2026-07-12.png`.

### Packaged wallpaper cache compatibility

- The final Web smoke log exposed requests for obsolete packaged `.jpg` paths even though the current registry and package contain `.webp` files.
- Root cause: a persisted wallpaper record with the same curated ID overrode the current built-in registry during library merge/pruning.
- Fix: curated IDs now always take their asset metadata from the current registry; remote/user-fetched entries and wallpaper preferences/history remain untouched.
- Regression evidence writes an obsolete `.jpg` record directly into IndexedDB, reloads the real page, verifies the rendered background uses `.webp`, and observes zero obsolete network requests.

### Section and search interaction

- Section draft submission reads the input's current value, covering fast paste/Enter behavior.
- Section tabs now expose a stable accessible name instead of combining the tab, drag handle, and delete button labels.
- Real browser tests create an `AI` section, click it in edit mode, and assert that neither a system dialog nor the internal delete dialog opens.
- Real browser tests switch to Baidu, enter `x`, press Enter, and observe `https://www.baidu.com/s?wd=x`.

### Extension capture target runtime

- The isolated extension runtime now queues a real capture through the built MV3 service worker.
- New-tab focus drains the queue into a newly created `Runtime Audit / Runtime Inbox` target.
- Final queue state is `imported`, with no destination error and an exact resolved destination path.
- The temporary test Profile is separate from the user's Chrome Profile and is discarded after validation.

## Verification receipt

- Production dependencies: 222 inspected; Critical 0, High 0, Moderate 0, Low 0.
- Vitest: 19 files, 116 tests passed.
- Legacy compatibility suite: all 31 scripts passed.
- TypeScript: passed.
- ESLint: passed with zero warnings and errors.
- Web production build: Next.js 16.2.10 Turbopack generated all 10 routes/pages; tsup server bundle passed.
- Extension build: passed; background and content-script artifact checks passed.
- Unpacked extension size: 17.1 MiB, below the 25 MiB release gate.
- Playwright: 12 tests pass; collection layout passes at `2048x1152`, `1440x900`, `1280x720`, `1024x768`, and `390x844`; wallpaper, stale-IndexedDB repair, search, and section flows pass.
- In-app Browser: `http://127.0.0.1:5015/`, one stable Browser context, no page console errors.
- Isolated Chromium extension: bundled service worker started, public metadata worked, private metadata targets were refused, desktop/mobile wallpaper geometry passed, and the explicit capture target imported.
- API black box: localhost, loopback, and `169.254.169.254` were refused; Example Domain metadata remained available.

## Honest remaining boundaries

- A real Google OAuth sign-in/sign-out and two simultaneously signed-in physical device Profiles still require the user's account. Automated tests cover two isolated clients and conflict journeys, but do not pretend to replace that final account-level observation.
- The Web server can pin a validated DNS address. Stable Chrome extensions do not expose the equivalent DNS API; Chrome documents `chrome.dns` as Dev-channel only. Extension literal/private URLs and every redirect are blocked, but a hostile DNS-rebinding domain cannot be closed as strongly without routing metadata through a trusted backend. Reference: https://developer.chrome.com/docs/extensions/reference/api/dns.
- Supabase still reports leaked-password protection disabled. WebCollect currently uses Google OAuth rather than password login, so this is hardening rather than a current password-flow break.
- The extension main bundle is about 294.6 KiB gzip. It is acceptable for this release but remains a future performance budget item.

## Release result

The release script runs from a clean `main` where `HEAD` exactly equals fetched `origin/main`, all three version sources equal `1.1.0`, the built manifest is current, and no stale `public/extension-dist` exists. The tag fixes the exact source commit used for the release build.

- Release: https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-12-v1.1.0
- Extension zip: https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-12-v1.1.0/WebCollect-Chrome-Extension-v1.1.0-2026-07-12.zip

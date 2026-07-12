# WebCollect V1.1.1 CI and release closeout

Date: 2026-07-12
Release identity: `V1.1.1 / 2026年7月12日`
Release tag: `webcollect-2026-07-12-v1.1.1`

This patch supersedes V1.1.0 as the current installable release. The PM split, WebCollect cloud migration, backup hashes, row counts, security findings, and full audit result remain recorded in `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`.

## Why V1.1.1 exists

The first V1.1.0 GitHub `main` run passed every non-browser gate but exposed two release-quality problems after the tag had already been published:

- eight collection E2E cases pressed Enter immediately after navigation; on a cold GitHub runner, React had not attached the wallpaper key handler yet, so the input was lost;
- both the guarded local release script and the tag workflow published an extension zip, producing two differently named assets for one release.

The release preflight also printed a misleading Git fatal message while safely probing a tag that did not exist yet.

## Fixes

- `WallpaperShell` exposes `aria-busy` and `data-wallpaper-ready` from the real persisted-store readiness state.
- Collection E2E uses one `openCollection()` helper that waits for readiness before pressing Enter and then waits for the brand shell.
- Wallpaper geometry E2E waits for the real idle-hint state after any startup wallpaper refresh instead of sleeping for a fixed 2.3 seconds.
- Progressive recommendation assertions use a bounded readiness timeout rather than a fixed sleep.
- Release preflight suppresses expected stderr from an absent tag probe.
- The local guarded release script is the only GitHub Release publisher. The tag workflow independently rebuilds and verifies the extension but has read-only contents permission and cannot attach a duplicate asset.
- A contract test prevents either release behavior from regressing.

## Verification receipt

- Vitest: 19 files, 117 tests passed.
- Legacy compatibility suite: all 31 scripts passed.
- Playwright: all 12 cases passed locally under a fresh CI-style server and in GitHub Actions.
- TypeScript and ESLint: passed.
- Production dependency audit: no known vulnerabilities.
- Web production build: passed.
- Extension build, artifact check, and 25 MiB size gate: passed; unpacked size 17.1 MiB.
- Isolated MV3 runtime: service worker, private URL refusal, public metadata, desktop/mobile wallpaper geometry, and exact capture destination passed with zero console errors.

## Release result

- Release: https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-12-v1.1.1
- Extension zip: https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-12-v1.1.1/WebCollect-Chrome-Extension-v1.1.1-2026-07-12.zip

The final `main`, tag, package version, manifest version, in-app version/date, and downloadable archive all resolve to the same audited commit.

## Remaining account-level observation

The only unresolved manual observation is real Google OAuth plus two simultaneously signed-in physical Chrome Profiles. Automated isolated two-client conflict tests do not claim to replace the user's account-level check.

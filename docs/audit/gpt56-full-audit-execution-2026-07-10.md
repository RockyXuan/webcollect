# WebCollect V1.1.0 full audit execution log

Date: 2026-07-10
Branch: `fix/sync-architecture`
Target release: `V1.1.0`

## Safety baseline

- Git worktree was clean before the audit.
- `main` was backed up to `backup/pre-v1.1.0-main-2026-07-10` and tag `backup-main-2026-07-10`.
- The audit branch was backed up to `backup/pre-v1.1.0-sync-2026-07-10` and tag `backup-sync-2026-07-10`.
- `src/lib/seed.ts` was reviewed before edits; default categories and cards must remain unchanged.
- Chrome automation cannot enter `chrome://newtab` under its security policy. A real-profile local export remains a hard gate before any data migration or release.
- No Supabase credentials are stored in the checkout. A cloud export remains a hard gate before applying SQL.
- These external gates do not block code remediation. Automated engineering acceptance uses an isolated extension Profile, deterministic IndexedDB/Supabase doubles, migration contract tests, and real local Web routes. Only account data export, live SQL, branded-Chrome shell chrome, and dual-device account behavior remain confirmation gates.

## Verified starting state

- 31 legacy script tests passed.
- TypeScript check passed.
- ESLint passed with zero warnings.
- Chrome extension build passed.
- Webpack production build passed, while the default production build stalled and the wrapper scripts assumed a global `pnpm`.
- Official npm production audit reported 55 advisories: 1 critical, 26 high, 20 moderate, and 8 low.

## Finding ledger

| ID | Priority | Area | Evidence | Status |
| --- | --- | --- | --- | --- |
| DATA-01 | P0 | Sync | Cloud-only rows can resurrect locally deleted cards/categories. | Code fixed and isolated tests passed; live Supabase migration/dual-device gate pending |
| DATA-02 | P0 | Sync | Preference unions prevent unpin, unhide, and recycle-bin empty from propagating. | Code fixed and isolated tests passed; live Supabase migration/dual-device gate pending |
| DATA-03 | P0 | Concurrency | IndexedDB and `chrome.storage` read-modify-write operations lost concurrent updates. | Fixed with lock, queue, and stale-snapshot rebase tests |
| DATA-04 | P0 | Migration | Name-based heuristics deleted legitimate categories, rewrote descriptions, and ran without a pre-migration snapshot. | Fixed with behavioral tests |
| DATA-05 | P1 | Recovery | Snapshot health used personal crypto keywords and fixed minimum workspace sizes. | Fixed with relative structural tests |
| SEC-01 | P0 | Server fetch | Metadata and safety routes can request localhost/private-network URLs. | Fixed and isolated Chromium runtime verified; final installed Chrome shell check remains a release gate |
| SEC-02 | P1 | Dependencies | Production dependency audit contains critical/high advisories and unused large dependency trees. | Fixed; official production audit reports no known vulnerabilities |
| UI-01 | P1 | Responsive | Fixed 2048px canvas with a minimum zoom clipped 1024px and 390px viewports. Vitest plus Playwright now cover five target sizes. | Fixed and browser-verified |
| UI-02 | P1 | Wallpaper | Quote, citation, and idle hint overlap at 1280x720. | Reproduced |
| AUTH-01 | P1 | Auth | Cached identity is trusted without validating the Supabase session; extension logout leaves the remote session intact. | Code fixed and isolated extension startup verified; real OAuth account gate pending |
| META-01 | P1 | Capture | Web and extension metadata extractors diverge and can select unrelated boilerplate. | Fixed with one shared structural extractor, 24 fixtures, Web API, and isolated extension runtime evidence |
| REL-01 | P1 | Release | Release script can tag a feature commit while pushing a different `main`; static extension output can be stale. | Fixed with deterministic preflight and one build source; final main/tag/Release execution pending all gates |
| BUILD-01 | P1 | Build | Scripts require global `pnpm`; production Babel config disables the default compiler. | Fixed; default Turbopack and custom server builds pass without dependency installation |

## Execution rule

Every finding must have a failing behavioral test, the smallest root-cause fix, a passing focused test, the full verification bundle, and browser evidence before it is marked complete.

## Receipts

### UI-01 responsive canvas

- Before: four of five Vitest viewport cases failed; 390px and 1024px views were clipped around a centered 2048px canvas.
- Fix: removed global CSS `zoom`, made the collection canvas fluid, and limited wide-screen enhancements to viewports at least 1440px wide.
- Focused verification: five Vitest cases and five Playwright Chromium cases pass at 2048x1152, 1440x900, 1280x720, 1024x768, and 390x844.
- Data impact: none. Seed data and persisted workspace data were not read or changed by the tests.

### DATA-04 migration safety

- Before: all three migration safety tests failed. Empty categories named like seed templates were removed, `Recovered <uuid>` content was relocated, pre-reset rows were filtered, and no pre-migration snapshot existed.
- Fix: local schema v2 snapshots first and only performs additive or visibility-preserving repairs. Automatic name-based deletion, description translation, recovered-category deletion, reset-time filtering, and direct-card reparenting were removed.
- Focused verification: migration safety tests, startup idempotency test, TypeScript, and ESLint pass.
- Data impact: the migration no longer deletes or semantically rewrites user-owned content.

### DATA-05 snapshot and recovery health

- Before: a valid one-card workspace was rejected because it was small, while orphaned card references were not identified; category names such as `zkSync` reduced the score.
- Fix: snapshot health now validates IDs and references only. Emergency recovery compares the current workspace with same-size-or-larger candidates and prompts only when the candidate has a demonstrably richer section distribution.
- Focused verification: valid small workspace, orphaned-card, small collapsed workspace, and already-healthy workspace tests pass.
- Data impact: recovery remains confirmation-only and never applies a snapshot automatically.

### DATA-01 revisioned deletion and restore

- Before: deleting an entity removed the local/cloud active row, but a stale device still held an ordinary row and could upload it again.
- Fix: cards and categories now carry a Lamport revision plus stable device ID. A deletion writes a revisioned tombstone before removing the cloud row; a deliberate restore must produce a higher revision than that tombstone.
- Database contract: `migrations/2026-07-10-sync-revisions.sql` is additive/idempotent and creates `workspace_tombstones` plus row revision columns. It has not been executed against the live project because the required exports and user confirmation are still pending.
- Focused verification: delete, stale-device sync, deliberate restore, legacy timestamp fallback, deterministic device tie-breaking, TypeScript, and ESLint pass.

### DATA-02 revisioned incremental preferences

- Before: array unions made empty values impossible to propagate, so unpin, unhide, recycle-bin clear, empty layouts, and disabled wallpaper settings could return on another device. Every sync also rewrote the full preference set.
- Fix: each preference key has an independent Lamport revision. Empty arrays, empty objects, defaults, and `false` are explicit values. Cloud writes are filtered to genuinely newer/different keys, and startup freshness reads one `workspace_versions` row with a legacy-table fallback.
- Coverage: hidden sites, pinned categories/bookmarks, layouts, scale, link mode, search engine, sections, category-to-section mapping, recycle bin, warehouse state, and wallpaper settings use the same resolver.
- Focused verification: local no-op writes do not advance revisions; device A clear/unpin/unhide wins; stale device B cannot restore old non-empty values; 31 legacy scripts and 24 Vitest cases pass.

### DATA-03 concurrent local writes

- Before: two simultaneous card captures or category additions retained only the second item. Recycle-bin and dirty-set updates had the same read-modify-write race.
- Fix: added a cross-tab Web Locks wrapper with an in-process fallback around atomic IndexedDB mutations. Floating-capture queue writes run through one background mutation queue and preserve captures created after a new-tab drain started. Whole-array drag/restore operations now replay only their delta against the latest locked snapshot.
- Focused verification: concurrent card, category, section, recycle-bin, dirty-set, stale whole-array, and queue-replacement tests pass; floating-capture target/health scripts pass.

### Snapshot completeness and restore semantics

- Local snapshots now include wallpaper settings/library, sync tombstones, per-preference revisions, extension floating-capture settings, and the full capture queue including failed items.
- User-initiated clear, full restore, and structure restore are no longer wrapped in sync-suppression. They create higher revisions/tombstones so the restored or cleared state can propagate instead of being immediately overwritten by old cloud data.
- Old snapshot revision metadata is retained for forensic export but is not blindly restored over newer local counters.

### SEC-01 remote URL and SSRF boundary

- Before: `/api/fetch-meta` and `/api/check-safety` passed user-controlled URLs to unrestricted fetch calls that followed redirects. The extension background did the same for metadata.
- Web fix: one shared URL policy rejects credentials, non-HTTP(S) schemes, localhost/internal names, private/link-local/reserved IPv4 and IPv6, obfuscated IPv4 forms, and common IPv4-over-IPv6 encodings. The server resolves every hop, rejects mixed public/private answers, and pins the socket to the validated public address to close DNS rebinding between validation and connection.
- Fetch limits: redirects are manual and bounded; every target is revalidated; metadata accepts HTML/XHTML only; response bytes, URL length, timeout, and redirect count are bounded.
- Extension fix: the same URL policy runs in the Manifest V3 service worker. Chrome does not expose a server-style DNS pinning API, so unverifiable opaque redirects are rejected instead of followed. Saving a bookmark still works when metadata enrichment is refused.
- Product wording: the recommendation UI now says `基础检查`, `基础通过`, `需留意`, and `有风险`; it no longer claims that a whitelist/HTTPS result proves a site is safe.
- Focused verification: 32 policy/fetch cases, two route-level boundary cases, extension private-target and redirect-to-private cases, all 61 Vitest tests, 31 legacy scripts, TypeScript, ESLint, and extension production build pass.
- Real Web verification: a local Next.js server returned normal metadata for `https://example.com/` and HTTP 400 before any internal fetch for `http://127.0.0.1:5011/`.
- Real extension verification: an isolated Playwright Chromium profile loaded `extension/dist`, started the Manifest V3 service worker, returned `danger` for a private URL, returned empty metadata for the metadata-service IP, fetched public Example Domain metadata, rendered the wallpaper page, entered the collection page with Enter, logged no console errors, and had no horizontal overflow at 1440x900.
- Browser constraint: [Google Chrome removed command-line side-loading in branded builds](https://developer.chrome.com/blog/extension-news-june-2025), so automated unpacked-extension validation follows [Playwright's official Chromium extension path](https://playwright.dev/docs/chrome-extensions). A final manually installed/loaded Chrome shell check remains in the release gate for toolbar and context-menu chrome.

### SEC-02 production dependency surface

- Before: the official npm production audit reported 55 advisories: 1 critical, 26 high, 20 moderate, and 8 low. The critical XML parser path came from unused AWS SDK packages; Recharts was referenced only by an unused template component; the optional Coze reporting wrapper pulled axios, langchain, OpenAI, and ws into the runtime tree.
- Removed: `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `coze-coding-dev-sdk`, `recharts`, `drizzle-zod`, `pg`, `cheerio`, and unused chart UI code. Supabase now uses its ordinary fetch path. `drizzle-orm` remains development-only because only generated schema files import it; metadata parsing uses the smaller shared `htmlparser2` implementation.
- Upgraded: Next `16.2.10`, React/React DOM `19.2.7`, ESLint Next config `16.2.10`, and Supabase `2.109.0`. Supabase `2.109.0` is the newest inspected release that declares Node 20 support; `2.110.2` requires Node 22 and was rejected for this workspace.
- Overrides: Undici `7.28.0`, PostCSS `8.5.10`, and Babel Core `7.29.6` are pinned to patched versions within compatible major lines.
- Result: production top-level dependencies fell from 62 to 48. `pnpm audit --prod --registry=https://registry.npmjs.org` reports `No known vulnerabilities found`.
- Verification: dependency-surface contract tests, all unit/legacy tests, TypeScript, ESLint, extension build, and Next 16.2.10 Webpack production build pass. BUILD-01 subsequently removed the obsolete Babel configuration and the default Turbopack production build now passes too.

### AUTH-01 verified session and logout

- Before: `initialize()` trusted the plain `webcollect_auth_session` display object and immediately marked the user logged in, including in the extension. A stale or forged cache could trigger cloud synchronization without a verified Supabase user. Extension logout skipped Supabase `signOut()` entirely.
- Startup fix: both Web and extension call `auth.getUser()` and use only the server-verified user as login authority. Missing/invalid sessions clear local auth caches and do not sync. Temporary verification failures leave collection data usable but do not claim login success.
- Logout fix: both platforms call `signOut({ scope: "local" })` to revoke the current remote session, stop the old client's token auto-refresh, then always clear the WebCollect display cache and the configured Supabase project's token, verifier, and chunk keys. A remote/network failure still logs out locally and surfaces an honest warning.
- Scope protection: local cleanup targets only the configured Supabase project and preserves unrelated localStorage/Supabase keys.
- Text cleanup: user-visible OAuth mojibake was replaced with readable Chinese, and remaining broken encoding markers in auth/sync/store comments were removed.
- Verification: four auth-state behavior tests, one project-scoped storage cleanup test, auth contract script, all 69 Vitest tests, all 31 fail-fast legacy scripts, TypeScript, ESLint, extension build, and isolated Chromium no-session startup pass with zero console errors.
- Remaining gate: a real Google OAuth sign-in/sign-out requires an authorized test/user account and would change live session state, so it remains a release-time confirmation step rather than being performed silently.

### META-01 shared relevant metadata extraction

- Before: the Web API used Cheerio while the extension background used a separate regex parser. Their priorities differed, generic X/Twitter or GitHub boilerplate could beat the target page lead, and the original extension build copied source imports that did not exist inside `extension/dist`.
- Test-first evidence: 24 representative HTML fixtures cover Docu.md reached from X, GitHub repositories, JSON-LD graphs/arrays, Open Graph, Twitter Cards, docs, articles, products, YouTube, Chinese copy, malformed metadata, redirected URLs, reversed attributes, relative media, long/empty pages, and navigation/copyright noise. The built-artifact test first failed on two unresolved `../shared/*` imports.
- Fix: Web and extension now call one DOM-based pure extractor. It scores JSON-LD, OG, Twitter Card, title, H1, and visible body leads; filters source-site/navigation/legal noise; resolves relative assets; and keeps the original description language. Translation still occurs only after the user presses the translation control.
- Build fix: the Manifest V3 service worker is now a Vite entry instead of an unprocessed file copy. CI and the release workflow reject any built service worker with unresolved relative imports.
- Verification: 25 focused metadata tests, 94 total Vitest tests, all 31 legacy scripts, TypeScript, ESLint, extension production build, and the artifact contract pass. An isolated Chromium extension runtime starts the bundled service worker, returns clean Example Domain metadata, blocks private metadata fetches, logs zero console errors, and reaches the collection page.
- Real Web verification: `/api/fetch-meta` returns `Docu.md` plus the live target site's own product description, returns a properly spaced Example Domain description, and rejects `http://127.0.0.1:5011/`. No user bookmarks, IndexedDB rows, or seed data were changed.

### BUILD-01 deterministic default build

- Before: `.babelrc` applied the React Dev Inspector Babel plugin to every Next build, disabling the default compiler. `scripts/build.sh` installed dependencies during the build and called an unspecified global `pnpm`; `scripts/dev.sh` also attempted to `SIGKILL` whatever owned port 5000.
- Root cause: the inspector was a Coze-only development aid, not a WebCollect product feature. Keeping its component, Babel plugin, middleware, and transitive packages in the production path imposed a compiler-wide cost for functionality that ordinary development and release flows did not use.
- Fix: removed the Inspector and `.babelrc`, removed its unused packages, replaced `npx only-allow` with a local package-manager guard, pinned shell entry points to `corepack pnpm@9.0.0`, removed install-on-build, and made the dev server report port conflicts instead of terminating unrelated processes.
- Focused verification: all four build contract tests, TypeScript, and ESLint pass. The exact default `corepack pnpm@9.0.0 build` command compiles with Next 16.2.10 Turbopack, generates all ten pages/routes, and bundles `src/server.ts` with tsup.
- Environment note: the restricted command sandbox initially blocked Turbopack's temporary PostCSS helper from binding a local port. Running the same command in the approved local execution boundary passed; this was an OS sandbox restriction, not an application fallback or a Webpack substitution.

### REL-01 release identity and artifact guard

- Before: `release-extension.sh` could build and tag the current feature commit, push an unrelated `main`, then publish the feature tag. It did not reject a dirty tree, an unpushed commit, mismatched product versions, a reused tag, or stale output. A tracked `public/extension-dist` copy was no longer referenced by the app and had drifted behind the real manifest, permissions, content script, and service worker.
- Fix: one pure release-state validator now requires a clean `main`, `HEAD === refs/remotes/origin/main` after fetch, matching package/manifest/app versions, an exact `webcollect-YYYY-MM-DD-vX.Y.Z` tag, no reused tag at another commit, and a built manifest matching the product version. The release shell runs it before and after `build:ext`, then runs the extension artifact contract before zipping.
- Artifact policy: `extension/manifest.json` plus a fresh `extension/dist` build are the only release source. The unused tracked `public/extension-dist` snapshot was removed instead of committing another large generated copy; CI compares the built manifest byte-for-structure with its source and verifies every service-worker relative import resolves.
- Focused verification: eleven release-state/shell-order tests pass. The real preflight rejects the current feature branch and dirty worktree as designed. A fresh extension build and final artifact test pass; the existing branding test now checks source icons, favicon entries, version display, and brand wiring without trusting a stale compiled bundle.
- Remaining execution: after all V1.1.0 gates pass, update version/date, merge the audited commit to `main`, push it, rerun preflight on that exact remote commit, then create the tag and Release. The script cannot publish from this feature branch.

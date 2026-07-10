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
| DATA-01 | P0 | Sync | Cloud-only rows can resurrect locally deleted cards/categories. | Open |
| DATA-02 | P0 | Sync | Preference unions prevent unpin, unhide, and recycle-bin empty from propagating. | Open |
| DATA-03 | P0 | Concurrency | Whole-array IndexedDB and `chrome.storage` read-modify-write operations can lose concurrent updates. | Open |
| DATA-04 | P0 | Migration | Name-based heuristics deleted legitimate categories, rewrote descriptions, and ran without a pre-migration snapshot. | Fixed with behavioral tests |
| DATA-05 | P1 | Recovery | Snapshot health used personal crypto keywords and fixed minimum workspace sizes. | Fixed with relative structural tests |
| SEC-01 | P0 | Server fetch | Metadata and safety routes can request localhost/private-network URLs. | Open |
| SEC-02 | P1 | Dependencies | Production dependency audit contains critical/high advisories and unused large dependency trees. | Open |
| UI-01 | P1 | Responsive | Fixed 2048px canvas with a minimum zoom clipped 1024px and 390px viewports. Vitest plus Playwright now cover five target sizes. | Fixed and browser-verified |
| UI-02 | P1 | Wallpaper | Quote, citation, and idle hint overlap at 1280x720. | Reproduced |
| AUTH-01 | P1 | Auth | Cached identity is trusted without validating the Supabase session; extension logout leaves the remote session intact. | Open |
| META-01 | P1 | Capture | Web and extension metadata extractors diverge and can select unrelated boilerplate. | Open |
| REL-01 | P1 | Release | Release script can tag a feature commit while pushing a different `main`; static extension output can be stale. | Open |
| BUILD-01 | P1 | Build | Scripts require global `pnpm`; production Babel config disables the default compiler. | Open |

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

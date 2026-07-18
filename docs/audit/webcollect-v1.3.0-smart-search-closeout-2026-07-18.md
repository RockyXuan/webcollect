# WebCollect V1.3.0 smart search closeout

Release identity: `V1.3.0 / 2026年7月18日`

Release tag: `webcollect-2026-07-18-v1.3.0`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-18-v1.3.0`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-18-v1.3.0/WebCollect-Chrome-Extension-v1.3.0-2026-07-18.zip`

Publication status: release preparation is complete through local verification and the live Supabase deployment. Main CI, the tag workflow, the official zip download audit, and the final read-only primary-Chrome check remain `TODO` until their real evidence exists; none is represented as already complete below.

## Scope and user flow

- The existing Google / 百度 / Bing selector and ordinary external-search behavior remain available. Pressing Enter without choosing an internal result still opens the selected external engine.
- The same TopNav search surface now returns local workspace results while the user types. It searches cards, categories, groups, and sections; cards show favicon, title, description excerpt, full collection path, and the reason for the match.
- The local ranker adds Chinese bigram similarity, English prefix and edit-distance tolerance, weighted title/domain/description/note/path signals, exact-match priority, and bounded work for short or long queries.
- Signed-in users who explicitly approve knowledge indexing can receive semantic results asynchronously. Local matches render first; semantic failure, timeout, offline state, missing configuration, or expired authentication never blocks typing or ordinary external search.
- Local and semantic card ranks are merged with weighted Reciprocal Rank Fusion while exact title/domain matches stay first. The client discards every semantic `cardId` that is absent from the current local workspace, so a stale or soft-deleted cloud vector cannot resurrect a bookmark.
- Arrow keys, Enter, Escape, pointer selection, IME composition, screen-reader listbox/status semantics, reduced motion, classic/mindmap navigation, and the 390px compact layout are covered. Web and the Chrome new-tab extension share the same contracts.

## Knowledge construction and privacy

- Each card can produce two independent semantic documents:
  - `saved-fields`: title, domain, abbreviation, short/full descriptions, user note, and section/category/group path;
  - `public-html`: text extracted only from a public unauthenticated page response.
- Public-page extraction removes scripts, navigation, footer, forms, duplicate text, and unsupported responses, and caps derived text at 6,000 characters. It does not send browser cookies, reuse a logged-in page, visit private/local addresses, bypass access controls, or write extracted content back into a `WebCard`.
- Initial public-page indexing is opt-in. The consent dialog explains which saved fields leave the device, and failures fall back to saved metadata/local search. Indexing is incremental, bounded to small request batches, fenced against account/workspace changes, and has pause/retry limits.
- URL and card mutations are checked against an authoritative local reread before cloud writes. A stale build is aborted and rescheduled instead of uploading the older snapshot. Extension reconciliation uses an isolated ledger with the same account/workspace fences.
- `text-embedding-3-small` is the only accepted model. `OPENAI_API_KEY` belongs only in the Supabase Edge Function secret store. It is not accepted from the UI, committed to Git, bundled into Web/extension assets, copied to Chrome storage, or written to logs.

## Data boundary

- Cards, categories, sections, preferences, recycle bin, snapshots, tombstones, workspace revisions, dirty sets, and the existing sync protocol retain their current schemas and behavior. The feature does not clear, overwrite, migrate, or seed any business collection data.
- Local derived state is isolated in its own localforage database/store: `WebCollectSearch/knowledge_index`. It contains rebuildable extraction/cache, consent, progress, and extension-ledger records. It does not live in `WebCollect/webcollect_data`, enter business snapshots, create dirty records, or sync through Chrome storage/Supabase collection sync.
- Cloud derived state is isolated in `public.bookmark_search_embeddings`. Its rows contain only `user_id`, `card_id`, `document_source`, SHA-256 `content_hash`, model/index metadata, timestamp, and the 1,536-dimension vector. Raw saved fields and public HTML are not retained in that table.
- The cloud primary identity is `(user_id, card_id, document_source)`, where `document_source` is strictly `saved-fields | public-html`. The dual-source boundary prevents an extension saved-fields rebuild from overwriting a richer public-page vector.
- RLS permits authenticated users to read/delete only their own rows and to insert/update only vectors whose `card_id` belongs to the same authenticated user. Anonymous table access is revoked. Semantic matching is `security invoker` and always filters by `auth.uid()`.
- The dual-source migration deletes only legacy, disposable embedding rows whose mixed source cannot be classified safely, then lets consented clients rebuild them. It does not delete cards, categories, preferences, snapshots, sync state, or any other business row.
- The protected seed file is unchanged; its SHA-256 remains `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.

## Supabase deployment and security evidence

- Migrations `20260718035443_bookmark_search_embeddings` and `20260718035513_bookmark_search_dual_sources` are applied to the WebCollect Supabase project, and the repository filenames match that live migration history. The `bookmark-search` Edge Function is deployed with JWT verification enabled.
- The live endpoint rejects missing and deliberately invalid authentication with HTTP 401. The deployed table had zero derived rows at migration close, RLS was enabled, all `SELECT | INSERT | UPDATE | DELETE` owner policies were present, and there were zero non-internal triggers, so the search table is not attached to collection synchronization. Live policy expressions require `auth.uid() = user_id`; insert/update additionally require the referenced card to belong to that same user. Request validation limits query length, document length, batch size, and allowed document sources.
- `public.consume_bookmark_search_quota(text, integer)` atomically enforces per-user minute and daily budgets for `search` and `index`. It uses an advisory transaction lock to close concurrent quota races and the Edge Function does not log query text.
- Supabase Security Advisor intentionally reports `authenticated_security_definer_function_executable` for that quota RPC. This warning is accepted because only `authenticated` can execute it, the function requires a non-null `auth.uid()`, accepts only the fixed `search | index` actions and positive units, and can only increment the caller's private quota counters; it grants no business-table access. `SECURITY DEFINER` is retained so the Edge Function can update the private quota tables atomically.
- The separate `auth_leaked_password_protection` warning predates this feature and is unrelated to the new tables/functions; WebCollect primarily uses Google OAuth. Performance Advisor has only two informational `unused_index` notices on the freshly deployed `user_id` and `card_id` indexes. The `card_id` index is deliberately retained for foreign-key cascade and reconciliation because the primary key begins with `user_id`; the standalone `user_id` index will be judged from real workload evidence rather than removed during release. Fresh unused-index statistics are not a release blocker.

## Verification completed before publication

- `git diff --check`, TypeScript, ESLint, Web production build, Chrome-extension production build, extension artifact checks, and extension package-size checks passed.
- Vitest: 45 files / 342 tests passed.
- Legacy regression scripts: 31/31 passed.
- Edge Function format/lint/type/test gate: 18/18 Deno tests passed.
- Playwright: 43/43 passed, including ordinary external search, fuzzy internal results, keyboard/IME behavior, hybrid-result stability, privacy consent, responsive search UI, classic/mindmap routing, and collection-data isolation.
- The packaged extension is 17.2 MiB and stays within the existing size gate. No runtime dependency, extension ID, manifest permission, Chrome storage namespace, or CSP exemption was added for embeddings.
- Production dependency audit covered 207 packages with zero info, low, moderate, high, or critical findings.
- Local in-app Browser acceptance used one stable isolated localhost context and confirmed the smart-search listbox, Google external-search fallback row, and local-only signed-out status. Rich-result, Escape, console, and 390px flows are additionally covered by the isolated Playwright fixtures.

## Residual P2 and operating boundary

- There is one bounded P2 eventual-consistency window for disposable extension vectors: if a cloud delete/prune commits and the local workspace changes before the post-request fence observes it, the client can stop subsequent stale writes and ledger advancement but cannot reverse the already committed derived-vector deletion. `saved-fields` is rebuilt by the bounded extension retry; `public-html` may wait for the next consented Web build because the extension intentionally does not fetch public page bodies.
- The window can temporarily reduce semantic recall; it cannot delete or alter a bookmark, category, section, preference, snapshot, tombstone, revision, dirty set, or sync record. Local fuzzy search remains fully available. Server-side conditional delete semantics can be considered later if the operational evidence justifies the extra complexity.
- Semantic indexing requires `OPENAI_API_KEY` to be configured as a Supabase secret. When it is absent or unavailable, the product must show a non-blocking status and continue with local smart search plus Google/百度/Bing.

## Publication TODO

- [ ] Record the tagged application commit on `main`.
- [ ] Wait for the complete main CI run and record its real run ID/result.
- [ ] Create and verify tag `webcollect-2026-07-18-v1.3.0`; wait for the Release workflow and record its real run ID/result.
- [ ] Confirm the final Release is neither draft nor prerelease and contains exactly one asset named `WebCollect-Chrome-Extension-v1.3.0-2026-07-18.zip`.
- [ ] Download the official asset, verify Manifest V3 version `1.3.0`, stable extension key/ID inputs, unique asset tree, byte size, and SHA-256, then compare it with the locally verified release build.
- [ ] From the existing signed-in primary Chrome profile's WebCollect auxiliary window, reload in place and perform a read-only smoke check. Do not uninstall, create a second Profile, edit real collection data, or operate unrelated personal tabs.
- [ ] Append the real CI/Release/download/Chrome evidence in a documentation-only follow-up commit. That commit is not a new application version.

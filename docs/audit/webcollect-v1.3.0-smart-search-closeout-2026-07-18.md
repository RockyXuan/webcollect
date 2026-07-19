# WebCollect V1.3.0 local smart search closeout

Release identity: `V1.3.0 / 2026年7月19日`

Release tag: `webcollect-2026-07-19-v1.3.0`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-19-v1.3.0`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-19-v1.3.0/WebCollect-Chrome-Extension-v1.3.0-2026-07-19.zip`

Publication status: application implementation and local verification are complete. Main CI, the tag workflow, the official zip download audit, and the final read-only primary-Chrome check remain `TODO` until their real evidence exists; none is represented as already complete below.

## Final product decision

- V1.3.0 uses a fully local scripted ranker. The released Web and extension search path does not call OpenAI, DeepSeek, another model provider, or the previously prepared Supabase semantic-search function.
- No local language model is bundled or downloaded. The extension package therefore remains about 17 MiB instead of growing by roughly 100–400MB.
- The earlier Supabase vector migrations and Edge Function source remain as historical, dormant infrastructure so applied migration history is not rewritten. They are not imported by the released TopNav path, and the built extension contains no OpenAI endpoint, model name, Edge Function name, or semantic-search copy.

## Scope and user flow

- The existing Google / 百度 / Bing selector and ordinary external-search behavior remain available. Pressing Enter without choosing an internal result still opens the selected external engine.
- The same TopNav surface returns local workspace results while the user types. It searches cards, categories, groups, and sections; cards show favicon, title, matched excerpt, full collection path, and match reasons.
- The local ranker combines exact title/domain priority, weighted title/domain/description/note/path/public-text fields, Chinese bigrams, English prefix and Damerau-Levenshtein tolerance, full/initial Chinese pinyin, curated intent aliases, BM25-style document relevance, and bounded query work.
- Example intents covered by the fixed regression set include `做思维导图的工具`, `保存视频的网站`, `AI 写代码`, `githb`, `siweidaotu`, `swdt`, and a term found only inside cached public-page text.
- Results are synchronous and network-free while typing. Arrow keys, Enter, Escape, pointer selection, IME composition, screen-reader listbox/status semantics, classic/mindmap navigation, and the 390px compact layout remain covered.

## Local knowledge construction and privacy

- Existing saved fields—title, domain, abbreviation, short/full description, note, and section/category/group path—are searchable immediately without a build step.
- After explicit consent, WebCollect can read unauthenticated public HTML and store up to 6,000 characters of derived text per live card in the isolated local knowledge cache. Scripts, navigation, footer, forms, noise, and duplicate text are removed.
- The extension performs public-page extraction in its existing service worker with the existing `<all_urls>` permission. Web uses the SSRF-safe server route and requires the existing signed-in session to prevent an unauthenticated public fetch proxy.
- Both paths enforce the existing public-URL policy, 8-second timeout, four-redirect limit, HTML-only response, and 1.5MB body limit. They do not attach cookies, reuse logged-in page state, visit private/local targets, or bypass access controls.
- A failed or unsupported page falls back to saved fields. Manual builds support pause/retry; saved-field and path changes update the local derived entry incrementally without revisiting every website.
- Search queries and extracted text never leave the product for AI inference. No API key is accepted from UI, localStorage, IndexedDB, Chrome storage, repository code, or extension assets.

## Data boundary

- Cards, categories, sections, preferences, recycle bin, snapshots, tombstones, workspace revisions, dirty sets, Chrome storage, Supabase business rows, seed data, and the existing sync protocol retain their schemas and behavior. The feature does not clear, overwrite, migrate, seed, or delete collection data.
- Rebuildable derived state remains isolated in `WebCollectSearch/knowledge_index`. It does not live in `WebCollect/webcollect_data`, enter business snapshots, create dirty records, or participate in Chrome/Supabase collection sync.
- Search only accepts cache entries whose `cardId` still exists locally and whose normalized source URL still matches the current card. Soft-deleted, removed, or URL-changed stale cache entries cannot reappear in results; legacy keys are left intact rather than deleted.
- The protected seed file is unchanged; its SHA-256 remains `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.

## Verification completed before publication

- `git diff --check`, TypeScript, ESLint, Web production build, Chrome-extension production build, extension artifact checks, and extension package-size checks passed.
- Vitest: 46 files / 348 tests passed.
- Legacy regression scripts: 31/31 passed.
- Playwright: 44/44 passed. The dedicated smart-search cases deep-compare protected collection/sync keys before and after fuzzy, pinyin, alias, cached-body, keyboard, IME, external-search, and 390px interactions.
- In the isolated smart-search browser run, zero requests matched `bookmark-search`, `api.openai.com`, or embedding endpoints.
- The packaged extension is 17.4 MiB and stays inside the existing size gate; the pinyin library adds roughly 0.2 MiB over the prior 17.2 MiB baseline. No extension permission, extension ID/key input, Chrome storage namespace, CSP exemption, model asset, or external script was added.
- Production dependency audit covered 208 packages with zero info, low, moderate, high, or critical findings.
- Local in-app Browser acceptance used one stable `http://127.0.0.1:5001/` context. It confirmed the Google/百度 selector, external fallback row, local-only status, Escape focus behavior, 390px panel bounds, no document overflow, and zero console warnings/errors. The same Browser context was reused and then closed.

## Historical cloud artifacts and operating boundary

- The applied `bookmark_search_embeddings` migrations and deployed `bookmark-search` function are historical derived infrastructure, not part of the V1.3.0 runtime path. Do not drop the table or rewrite migration history during release; that would be an unnecessary external destructive action.
- `OPENAI_API_KEY` is not needed by the product and should be removed from the Supabase Edge Function secret store before publication so the dormant endpoint cannot incur provider usage. This secret removal is the only pre-release cloud cleanup; it does not touch any collection or sync row.
- Old hybrid-search and cloud-index coordinator source remains temporarily for migration/audit history and targeted regression coverage, but it is unreachable from TopNav and absent from the extension artifact. It may be removed in a later maintenance release after the production transition has aged safely.

## Publication TODO

- [ ] Remove the unused Supabase `OPENAI_API_KEY` secret and record only presence/absence, never its value.
- [ ] Record the tagged application commit on `main`.
- [ ] Wait for the complete main CI run and record its real run ID/result.
- [ ] Create and verify tag `webcollect-2026-07-19-v1.3.0`; wait for the Release workflow and record its real run ID/result.
- [ ] Confirm the final Release is neither draft nor prerelease and contains exactly one asset named `WebCollect-Chrome-Extension-v1.3.0-2026-07-19.zip`.
- [ ] Download the official asset, verify Manifest V3 version `1.3.0`, stable extension key/ID inputs, unique asset tree, byte size, absence of AI endpoints/model assets, and SHA-256.
- [ ] From the existing signed-in primary Chrome profile's WebCollect auxiliary window, reload in place and perform a read-only smoke check. Do not uninstall, create a second Profile, edit real collection data, or operate unrelated personal tabs.
- [ ] Append the real CI/Release/download/Chrome evidence in a documentation-only follow-up commit. That commit is not a new application version.

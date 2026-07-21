# WebCollect V1.4.0 Google Drive migration closeout

Release identity: `V1.4.0 / 2026年7月21日`

Release tag: `webcollect-2026-07-21-v1.4.0`

Release: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-21-v1.4.0`

Asset: `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-21-v1.4.0/WebCollect-Chrome-Extension-v1.4.0-2026-07-21.zip`

Publication status: complete. The application release commit, main CI, tag workflow, official zip, real-account migration, and primary-Chrome read-only verification all passed. The follow-up closeout commit changes documentation only and is not a new application version.

## Product contract

- IndexedDB remains the first and mandatory write target. Google Drive is optional; declining authorization, being offline, or having no Google account never blocks local collection use.
- The Chrome extension connects only after an explicit user click and requests only `https://www.googleapis.com/auth/drive.appdata`. WebCollect cannot browse ordinary Drive files.
- Each device owns one workspace document in `appDataFolder`. Sync reads all device documents and merges revisions, tombstones, preferences, recycle-bin state, warehouse state, wallpaper settings, and hierarchy protections before conditionally updating only the current device file.
- View-only mindmap camera/offset state remains device-local. It is included in a user-requested portable JSON backup but not in automatic Drive workspace sync.
- Disconnecting Drive stops sync and clears the extension's cached authorization tokens; it does not delete local data or Drive app data.

## Complete JSON backup and restore

- “数据与完整备份” exports readable JSON containing the current workspace, recycle bin, warehouse, preferences, wallpaper state/list, mindmap state, collection mode, local history, readable Drive history, extension capture settings, pending capture queue, revisions, and tombstones.
- The file excludes Google/Supabase credentials, access tokens, the device identity key, dirty sets, transient sync state, and derived knowledge-cache text.
- Import validates schema, structure, counts, and SHA-256 before showing a preview. No data is written until the user confirms.
- Confirmed restore first creates an append-only safety version, pauses Drive sync, restores the archive, preserves unrelated mindmap keys, merges history, rotates the device identity, and resumes sync. Failure restores the pre-import workspace and original revision metadata.
- A disconnected local-only user receives a non-blocking reminder after 30 days without a successful JSON export.

## Supabase retirement boundary

- Formal V1.4 authentication, sync, snapshot UI, and public-page knowledge flow do not import or call Supabase.
- `@supabase/supabase-js` is no longer a production dependency. It remains development-only so immutable legacy tests and archived migration code can still be compiled and audited.
- The old configuration endpoint returns `410`, and Web public-page knowledge fetching returns an explicit unavailable status until a future Web OAuth client exists. Extension local fuzzy search and opt-in public-page knowledge extraction remain usable without AI or Supabase.
- Historical SQL, Edge Function, old session keys, and legacy source stay as non-runtime archives. No old local key or Supabase row was cleared, overwritten, or deleted.
- The former Supabase project and its data remain untouched for the user-approved 30-day safety period. Any later suspension or deletion requires a new explicit authorization.

## Rocky real-account migration evidence

- The existing signed-in primary Chrome profile and stable installed extension identity were reused; no second profile/account was created.
- Before cloud writes, multiple readable JSON backups were downloaded and independently parsed. The final pre-migration archive contained the complete merged source workspace and all available Supabase history.
- The migration source was recomputed at execution time: 7 sections, 135 categories/groups, 372 cards, 15 recycle-bin entries, and 69 cloud snapshots.
- Drive identity matched the former cloud account. The current workspace was staged idempotently, every snapshot used its immutable snapshot ID, and every uploaded file was downloaded again for schema and content-hash verification before the local provider switched to Drive.
- A migration receipt was written only after all readback checks passed. A subsequent manual Drive sync and a fresh `chrome://newtab` both succeeded.
- The post-migration complete backup is `/Users/rockyx/Downloads/WebCollect-complete-backup-2026-07-21T09-37-42-202Z.json`; it contains 7 sections, 135 categories/groups, 372 cards, 15 recycle-bin entries, 4 local versions, 69 Drive versions, and 2 mindmap view-state records. Its independently verified SHA-256 is `eac1cf524d0ade019ae847a1b6751f9271b822c6b1ac9c8ba5ed5e7cf5ed16c1`.
- Old Supabase data remained unchanged throughout migration and verification.

## Verification before publication

- `git diff --check`, TypeScript, and ESLint passed without warnings.
- Vitest: 52 files / 395 tests passed.
- Legacy regression scripts: 31/31 passed.
- Web and Chrome-extension production builds passed.
- Extension background/mindmap artifact checks and the package-size gate passed; the unpacked release build is 17.2 MiB.
- Auth/build contracts confirm the stable extension key, the allowlisted extension identity, a public OAuth client ID with no client secret, the sole `drive.appdata` scope, no Supabase production dependency, and no retired Supabase endpoint/key signature in the extension main bundle.
- The protected seed SHA remains `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`.
- Playwright: 44/44 passed, including responsive, search, wallpaper, classic/mindmap, mutation-isolation, dialog, favicon, accessibility, keyboard, and 300+ node virtualization cases.
- Production dependency audit covered 200 packages with zero info, low, moderate, high, or critical findings.
- Final primary-Chrome release check reused the existing `☁️ WebCollect Drive 迁移` task group and the existing signed-in profile. The installed source was backed up append-only, updated in place without deletion, and reloaded. Chrome displayed WebCollect `1.4.0`; a fresh `chrome://newtab` retained all seven sections, the existing wall and bookmark bar, recycle count `15`, the connected account, and `Google Drive · 已同步`. The “数据与完整备份” dialog opened with both export and validated-import entries. No business-data edit or destructive storage action was performed.
- The tagged application commit is `c09859986439fef83b4c2cda2131b22f91f5481e`. Main CI run `29821265795` passed both production audit and verification jobs; its browser regression step passed all 44 tests.
- Tag/Release workflow run `29821729530` passed the production audit, auth contract, extension build, artifact, size, packaging, and publication checks. The Release is public, non-draft, non-prerelease, and contains exactly one asset.
- The official zip is `17,056,463` bytes with SHA-256 `bba2c2e537321b38567db3b71aaa8e5c724dde766e3b2089ebdf27749bb859ef`. Its archive has 46 unique entries and 41 actual files; decompression passed with no errors.
- The downloaded manifest reports WebCollect `1.4.0`, resolves to the stable extension ID `immpcmhmabobllnopedaoflcjneigbko`, requests only `drive.appdata`, and contains no client secret. The package has no Supabase runtime endpoint/client, OpenAI/DeepSeek endpoint, or embedded secret signature. Its complete file tree and every file hash exactly match the locally verified release build.

## Publication checklist

- [x] Protect and baseline local data, Chrome storage, snapshots, sync metadata, and the old Supabase source.
- [x] Complete real Google Drive OAuth, migration, per-file readback, manual sync, restart, and portable-backup evidence.
- [x] Remove Supabase from the formal runtime and pass local type, lint, unit, legacy, Web, extension, artifact, and size gates.
- [x] Pass full Playwright and production dependency audit on the V1.4.0 release commit.
- [x] Push the V1.4.0 application commit to `main` and wait for main CI.
- [x] Push `webcollect-2026-07-21-v1.4.0` and wait for the Release workflow.
- [x] Download and audit the single official asset, including manifest, stable key, OAuth scope, tree uniqueness, size, and SHA-256.
- [x] Reload the final package in place and finish a read-only primary-Chrome smoke check.
- [x] Append real publication evidence in a documentation-only commit; it is not a new application version.

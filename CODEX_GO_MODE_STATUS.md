# Codex Go Mode Status

## Final Goal

Keep this WebCollect thread moving until the current implementation pass is genuinely complete: the fresh clean clone is used, the recent UI action-menu/search/wallpaper fixes are implemented, important checks pass, and any remaining blockers or risks are explicit.

## Completed

- Fresh clean working folder is `/Users/rockyx/Documents/Codex/2026-06-14/webcollect-main-clean`; old `/Users/rockyx/Documents/webcollect` is not used.
- Group/category edit actions are folded back into the three-dot menu.
- Website cards use the same hover three-dot action pattern while keeping the star favorite button.
- Header search no longer filters or reshapes the dashboard wall; it only drives the floating search panel.
- Wallpaper rotation is no longer restricted to packaged images at startup.
- Wallpaper background refresh now checks from wallpaper mode on startup, focus, visibility return, network return, and a 30-minute cadence with a 6-hour network refresh gate.
- Wallpaper image caching now covers up to 8 images.
- Packaged wallpaper fallback grew from 6 to 8 local files, and extension build output also contains 8 packaged wallpapers.
- Wallpaper quote matching has additional bilingual quote IDs and title-first inference to avoid source-name misclassification.
- `tasks/todo.md` records the completed action-menu, search, and wallpaper tasks.
- Category panels now use tighter default width and inner spacing to reduce unused right-side blank space.
- Parent categories now have a fixed layout lock button in the top-right header; locked categories block parent/category drag, subgroup drag/resize, card drag, and category resize with an unlock prompt.
- Category layout lock state is persisted in local storage, snapshots, and sync preference merging.
- Wallpaper mode now supports mouse-wheel switching with threshold and cooldown so wallpapers can be reviewed manually.
- Collection mode now renders inside a fixed 2048x1152 logical canvas and scales the canvas to the current viewport, so external monitors and laptop screens keep the same layout proportions.
- The fixed canvas overrides small-screen header media-query changes, preventing header/actions from switching into a different layout on laptop-sized windows.
- GitHub CLI release instability root cause was narrowed down: plain `gh auth login` timed out while posting to GitHub's device-code endpoint, but the same flow immediately received a device code when forced through the local Clash proxy at `127.0.0.1:7897`.
- Added `scripts/gh-proxy.sh` so project GitHub CLI calls can consistently use `HTTPS_PROXY`/`HTTP_PROXY` without changing system network settings or storing tokens in plaintext.
- Added `scripts/release-extension.sh` and package scripts `gh:status` / `release:extension` so future release checks/uploads use the proxy wrapper instead of ad hoc `gh` commands.
- Hardened `scripts/release-extension.sh` so it can find the local Corepack binary even when the current shell has not loaded the user's nvm PATH.

## Unfinished

- No active implementation task is pending after the latest responsive canvas pass.
- There are older historical checklist entries in `tasks/todo.md` from previous sessions, such as Windows install verification and old package rebuild notes. They are not part of this current local implementation pass.
- Changes are not committed; the working tree intentionally contains the accumulated uncommitted implementation work.

## Current Blockers

- No user decision is currently required.
- GitHub CLI account login is still required before creating the GitHub Release. The latest device code expired before the browser authorization completed.
- Shell `curl` cannot reach the existing host-side local preview from this sandbox namespace.
- No current browser verification blocker. A temporary elevated 127.0.0.1 dev server plus headless Chrome verified the responsive canvas pass.

## Next Step

- Commit and push the GitHub CLI proxy/release script stabilization.
- Ask the user to complete one GitHub device authorization while `scripts/gh-proxy.sh auth login ...` is actively waiting, then run `pnpm gh:status` and `pnpm release:extension`.

## Latest Verification

- 2026-06-17 CST implemented fixed-resolution collection canvas scaling.
- `node --import tsx scripts/test-resolution-layout.ts` passed.
- `git diff --check` passed.
- `corepack pnpm ts-check` passed with the explicit Node v20.20.2 PATH.
- `corepack pnpm lint` passed with 6 existing warnings and 0 errors.
- `corepack pnpm build:ext` passed with the existing Vite large-chunk/dynamic-import warnings.
- Browser QA used temporary `http://127.0.0.1:5001` via `corepack pnpm exec next dev -H 127.0.0.1 -p 5001` and headless Chrome.
- Viewport `2048x1152`: `.wc-resolution-canvas` scale `1`, CSS width `2048px`, rendered width `2048`, desktop header grid retained.
- Viewport `1366x768`: `.wc-resolution-canvas` scale `0.667`, CSS width `2048px`, rendered width `1366`, same desktop header grid retained.
- 2026-06-17 CST diagnosed GitHub CLI auth instability: stale `RockyXuan` gh login was removed; unproxied `gh auth login` failed with a GitHub device-code timeout; proxied login obtained code `21B8-2ADE`, but the code expired before browser authorization completed.
- `bash -n scripts/gh-proxy.sh` passed.
- `bash -n scripts/release-extension.sh` passed.
- `scripts/gh-proxy.sh auth status` reached GitHub through the proxy wrapper and returned the expected "not logged in" state instead of timing out.
- 2026-06-16 15:30 CST implemented category spacing, category layout locking, and wallpaper wheel switching.
- `git diff --check` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-layout-preferences.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-layout-sizing.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-data.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- `corepack pnpm ts-check` passed with the explicit Node v20.20.2 PATH.
- `corepack pnpm lint` passed with 6 existing warnings and 0 errors.
- `corepack pnpm build:ext` passed with the existing Vite large-chunk/dynamic-import warnings.
- Browser verification attempt: in-app Browser/Chrome tools were not exposed by tool discovery; sandbox blocked `PORT=5001 corepack pnpm tsx watch src/server.ts` with `listen EPERM` on the tsx IPC pipe; escalation approval timed out twice; bundled Playwright had no browser binary; system Chrome headless launch was terminated with process permission errors.
- 2026-06-15 07:41 CST heartbeat reran continuity checks.
- `git status -sb` still shows only the known uncommitted implementation files plus `CODEX_GO_MODE_STATUS.md` and two wallpaper image assets.
- `rg` found only older historical pending notes, not a new active implementation task from recent requests.
- `git diff --check` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-data.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- `corepack pnpm ts-check` passed with the explicit Node v20.20.2 PATH.
- `corepack pnpm lint` passed with 6 pre-existing warnings and 0 errors.
- 2026-06-15 06:41 CST heartbeat reran continuity checks.
- `git status -sb` still shows only the known uncommitted implementation files plus `CODEX_GO_MODE_STATUS.md` and two wallpaper image assets.
- `rg` found only older historical pending notes, not a new active implementation task from recent requests.
- `git diff --check` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-data.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- `corepack pnpm ts-check` passed with the explicit Node v20.20.2 PATH.
- `corepack pnpm build:ext` passed with the existing Vite large-chunk/dynamic-import warnings.
- 2026-06-15 05:40 CST heartbeat reran continuity checks.
- `git status -sb` still shows only the known uncommitted implementation files plus `CODEX_GO_MODE_STATUS.md` and two wallpaper image assets.
- `git diff --check` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-data.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- `corepack pnpm ts-check` passed with the explicit Node v20.20.2 PATH.
- `corepack pnpm lint` passed with 6 pre-existing warnings and 0 errors.
- 2026-06-15 04:38 CST heartbeat reran lightweight checks.
- `git diff --check` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-data.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- `corepack pnpm ts-check` passed with the explicit Node v20.20.2 PATH.
- 2026-06-15 03:38 CST heartbeat reran focused checks.
- `git diff --check` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-data.ts` passed.
- `/Users/rockyx/.nvm/versions/node/v20.20.2/bin/node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- `corepack pnpm ts-check` passed with the explicit Node v20.20.2 PATH.
- `corepack pnpm lint` passed with 6 pre-existing warnings and 0 errors.
- `corepack pnpm build:ext` passed with the existing Vite large-chunk/dynamic-import warnings.
- In-app Browser smoke check loaded `http://localhost:5001/`, showed a wallpaper stage with a remote NASA image, bilingual quote text, no framework overlay, and no console error/warn logs.
- Previous Browser interaction verified typing `Pendle` in header search kept wall counts stable while opening the search panel.

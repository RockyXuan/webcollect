# Codex Go Mode Status

## Final Goal

修复 WebCollect 壁纸模式的内容质量、双语台词库、Pets/Cinema/TV 模式和鼠标误退出问题；完成标准是保留当前成果，建立可扩展 quote/asset 数据结构，提供足够本地兜底内容、去重与匹配逻辑，壁纸模式只因明确点击或键盘进入收藏墙，并通过专项测试、构建和浏览器验证证明可用。

## Completed

- 阅读并消化用户提供的 `ChatGPT-Webcollect 壁纸和台词优化_副本.md`，形成 `docs/quote-wallpaper-audit.md` 审计文档。
- 移除壁纸模式里基于鼠标移动、甩动和长按的退出逻辑；现在移动鼠标不会退出，点击空白处或按 Enter 才进入网页墙。
- 扩展壁纸模式：新增 `TV` 与 `Pets`，并保留 `Auto Mix / Nature / Cinema / Art / Space`。
- 重建本地双语台词/短句库，第一阶段达到 412 条，并保留旧 `quoteId` 兼容。
- 新增 quote 选择引擎，支持按模式、标签、资产、媒体来源匹配，并通过最近历史避免短时间重复。
- 扩展壁纸偏好字段：`currentQuoteId`、`recentQuoteIds`、`recentAssetIds`、`recentMediaIds`。
- 后台刷新、滚轮换壁纸和偏好更新都会同步更新当前 quote 与最近历史。
- 滚轮和“立即更新壁纸”现在优先避开最近看过的壁纸资产，避免只在旧图或当前图上反复打转。
- 修复“后台刷新中点击刷新没反应/只换台词不换背景”的问题：刷新入口不再被 `isRefreshing` 禁用，并且旋转时以实际可见壁纸 ID 为当前项。
- Curated 壁纸资产现在会自动带上显式 `modes` 和语义 `tags`，Cinema/TV/Pets/Art 优先使用这些模式绑定，而不是只靠粗分类碰运气。
- 新增 3 张 CC0 打包本地动物/宠物壁纸：`peruvian_guineapig`、`swan_shore`、`seabird`。Pets 模式现在有 15 张显式绑定资产，其中 4 张可离线使用。
- 新增 `scripts/test-wallpaper-quotes.ts`，并扩展 `scripts/test-wallpaper-data.ts`、`scripts/test-wallpaper-wiring.ts` 覆盖本次行为。

## Unfinished

- Cinema/TV 当前是合规的原创模式短句，不伪造真实电影/剧集台词；后续若要真实影视台词，需要接入合法数据源或人工精选库。
- Pets/Cinema/TV 已有显式模式绑定和本地/远程合格池；本轮新增宠物/动物本地资产已通过本地验证。后续仍可继续增加更强的真实精选图包和合法 provider。

## Current Blockers

- 无必须由用户决策、账号登录或权限授权才能继续的阻塞。

## Next Step

- 提交、推送并发布包含本轮 Pets 本地资产和显式模式绑定的可下载扩展包；后续增强方向是继续补充合法的真实精选图片资产。

## Latest Verification

- 2026-06-22 CST `node --import tsx scripts/test-wallpaper-data.ts` passed.
- 2026-06-22 CST `node --import tsx scripts/test-wallpaper-quotes.ts` passed.
- 2026-06-22 CST `node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- 2026-06-22 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-22 CST `./node_modules/.bin/eslint` passed with 0 errors and 6 existing warnings.
- 2026-06-22 CST `node ./extension/build.mjs` passed.
- 2026-06-22 CST `git diff --check` passed.
- 2026-06-22 CST a fresh Playwright browser rerun was blocked by this Mac's local Chrome/Crashpad permission path; the fresh substitute evidence is the wiring test for mouse gestures plus the previous in-app Browser verification below against the same wallpaper code.
- 2026-06-21 CST `node --import tsx scripts/test-wallpaper-quotes.ts` passed.
- 2026-06-21 CST `node --import tsx scripts/test-wallpaper-data.ts` passed.
- 2026-06-21 CST `node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- 2026-06-21 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-21 CST `./node_modules/.bin/eslint` passed with 0 errors and 6 existing warnings.
- 2026-06-21 CST `node ./extension/build.mjs` passed.
- 2026-06-21 CST `git diff --check` passed.
- 2026-06-21 CST Browser verification used the in-app Browser workspace at `http://127.0.0.1:5014/`, not the user's Chrome profile.
- Browser verification passed: initial page is wallpaper mode; hint says wheel changes wallpaper and click/Enter enters the collection wall; large mouse movement did not leave wallpaper mode; wheel changed the displayed quote while staying in wallpaper mode; settings show `Auto Mix / Nature / Cinema / TV / Pets / Art / Space`; clicking blank wallpaper enters the collection wall; returning to wallpaper and pressing Enter enters the collection wall.
- Browser verification passed after refresh-cache fix: six wheel actions produced six distinct wallpaper background URLs; the `立即更新壁纸` control was enabled while refresh state was active and changed both the visible background URL and the displayed quote.
- 2026-06-21 CST Browser verification used the in-app Browser workspace at `http://127.0.0.1:5015/`, not the user's Chrome profile.
- Browser verification passed for the current Pets/mode-binding changes: selecting `Pets` and using the mouse wheel kept the app in wallpaper mode, produced 4 distinct local packaged animal/pet backgrounds, and did not fall back to the collection wall on mouse movement.
- 2026-06-21 CST committed `88d9c2f` and pushed to `origin/main`.
- 2026-06-21 CST published release `webcollect-2026-06-21-wallpaper-refresh-88d9c2f`.
- Release URL: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-06-21-wallpaper-refresh-88d9c2f`.
- Release asset: `WebCollect-Chrome-Extension-webcollect-2026-06-21-wallpaper-refresh-88d9c2f.zip`, size `58519226`, sha256 `ca628b9770bea55c060b57dbe6a07db1e071c40d2e3e00af158f46923197ba6b`.
- Local preview returned `GET /api/supabase-config 503` because local Supabase env is not configured; this did not block wallpaper UI verification.

# Codex Go Mode Status

## Final Goal

修复 WebCollect 网页图标偶尔刷新后丢失的问题，让顶部收藏栏和普通网页卡片共用稳定图标解析链路：优先使用已保存或已知品牌图标，失败后轮换多个 favicon 来源，最终使用语义图标或缩写兜底；保证 Gmail、B站、YouTube、GitHub、Discord、X 以及小众网站都不会出现空白图标。

## Completed

- 新增 `src/lib/site-icons.ts` 作为共享图标解析器。
- 顶部收藏栏 `BookmarkBar` 不再每次只请求 Google favicon；现在会使用 `card.imageUrl`、已知品牌稳定图标、站点 `/favicon.ico`、DuckDuckGo、Google favicon 多级候选。
- 普通网页卡片 `WebCardItem` 也切到同一套候选链路，避免卡片和顶部收藏栏表现不一致。
- 加入语义图标兜底：Gmail/邮箱、B站/YouTube/视频、GitHub/代码仓库、Discord/社群、云盘、文档、工具、安全扫描等都有稳定内置图标。
- 成功加载到非通用 provider 的稳定图标时，会写回 `card.imageUrl`，之后刷新优先复用。
- 新增 `scripts/test-site-icons.ts`，覆盖 Gmail、B站、已保存自定义图标、持久化规则和小众网站语义兜底。

## Unfinished

- 当前图标稳定性修复已完成，并已发布新的 Chrome 扩展包。

## Current Blockers

- 无需要用户决策的代码阻塞。

## Next Step

- 用户下载并重新加载新版扩展后，重点验证顶部收藏栏里的 Gmail、B站、小众网站刷新/新建页面后不再变成空白或随机丢图。

## Latest Verification

- 2026-06-21 CST `node --import tsx scripts/test-site-icons.ts` passed.
- 2026-06-21 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-21 CST `./node_modules/.bin/eslint` passed with 0 errors and 6 existing warnings.
- 2026-06-21 CST `node ./extension/build.mjs` passed.
- 2026-06-21 CST Browser verification on `http://127.0.0.1:5013/` used the in-app Browser workspace, not the user's Chrome profile.
- 2026-06-21 CST Browser icon QA passed: fixed a test card into the top bookmark bar; `.wc-bookmark-icon` rendered a non-empty image, `naturalWidth: 48`, `naturalHeight: 48`, `emptyIcons: 0`, `brokenImages: 0`.
- 2026-06-21 CST Browser console check passed with no app warning/error logs.
- 2026-06-21 CST committed `a091aa4` and pushed to `origin/main`.
- 2026-06-21 CST published release `webcollect-2026-06-21-stable-site-icons`.
- Release URL: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-06-21-stable-site-icons`.
- Release asset: `WebCollect-Chrome-Extension-webcollect-2026-06-21-stable-site-icons.zip`, size `58513948`, sha256 `b854d37d09b91b3ebdb6b2d2bb10ef346c4b43a11790c832e1ebf4cda7297d30`.

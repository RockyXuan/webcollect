# Codex Go Mode Status

## Final Goal

修复 WebCollect 收藏墙跨分辨率布局一致性，确保分类、分组和网页卡片列数不随显示器尺寸或浏览器视口重排；不同屏幕只允许整体缩放固定画布，并通过专项测试、类型检查、lint、扩展构建、浏览器双视口验证、提交推送和 release 发布证明可用。

## Completed

- 将分组内卡片列数从 CSS `auto-fill` 改为显式 `--wc-card-columns` 驱动，避免浏览器根据容器宽度自动重算列数。
- 新增稳定列数计算：优先使用已保存的 `CategoryLayoutPreference.columns`；没有保存列数时按固定规则从布局宽度或卡片数量推导。
- 分组卡片列表在普通模式和编辑模式都使用同一个列数变量，避免按钮出现时造成列数变化。
- 分类块和分组块改为不可压缩的 fixed flex basis，外层只负责 2048px 画布缩放，不再让内部布局因屏幕宽度被压窄而重排。
- 用户拖拽调整分组宽度时继续保存宽度和推导列数；锁定按钮逻辑保持不变，锁定后仍会阻止拖拽调整。
- 扩展 `scripts/test-layout-preferences.ts`，覆盖已保存 columns 优先、默认列数稳定、固定列宽样式、CSS 不再使用 `auto-fill`。
- 扩展 `scripts/test-resolution-layout.ts`，确认固定画布尺寸和缩放策略不改变布局意图。

## Unfinished

- 当前分辨率一致布局修复已完成，并已发布新的 Chrome 扩展 zip。

## Current Blockers

- 无需要用户决策的代码阻塞。
- Browser 大视口截图接口曾超时一次，已改用裁剪截图补充视觉验证；核心 DOM/CSS 双视口读数通过。

## Next Step

- 用户下载并重新加载新版扩展后，重点验证同一套真实收藏数据在外接显示器和笔记本屏幕下分类、分组、卡片列数一致，只发生整体缩放。

## Latest Verification

- 2026-06-21 CST `node --import tsx scripts/test-layout-preferences.ts` passed.
- 2026-06-21 CST `node --import tsx scripts/test-resolution-layout.ts` passed.
- 2026-06-21 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-21 CST `./node_modules/.bin/eslint` passed with 0 errors and 6 existing warnings.
- 2026-06-21 CST `node ./extension/build.mjs` passed.
- 2026-06-21 CST Browser verification on `http://127.0.0.1:5012/` used the in-app Browser workspace, not the user's Chrome profile.
- 2026-06-21 CST Browser dual-viewport DOM/CSS check passed: at `2048x1035`, first test group used `--wc-card-columns: 2`, `gridColumnCount: 2`, `--wc-resolution-scale: 0.898`; at `1540x900`, the same group used `--wc-card-columns: 2`, `gridColumnCount: 2`, `--wc-resolution-scale: 0.745`.
- 2026-06-21 CST Browser console check passed with no warning/error logs.
- 2026-06-21 CST committed `f3564e8` and pushed to `origin/main`.
- 2026-06-21 CST published release `webcollect-2026-06-21-resolution-layout`.
- Release URL: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-06-21-resolution-layout`.
- Release asset: `WebCollect-Chrome-Extension-webcollect-2026-06-21-resolution-layout.zip`, size `58512463`, sha256 `3f52e4d4b3f9daee1442a63ea08e9a115944592f7f39c93b9e08e9c0782374e6`.

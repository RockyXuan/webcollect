# Codex Go Mode Status

## Final Goal

修复 WebCollect 跨设备云同步刷新与浮窗采集目标准确性；完成标准是 Windows 或其他设备新增的网页能在 Mac 手动云同步/刷新后拉取显示，刷新不再把收藏墙临时坍缩成少量分类，浮窗显式选择 `主页 / 常用 / 看世界` 这类目标时必须进入目标分组而不是默认收集箱，并通过代码测试、构建、真实浏览器检查、提交推送和发布包证明可用。

## Completed

- 手动云同步改为安全双向同步：现在会执行完整 `syncData(user.id)`，不再因为本地 `updatedAt <= syncedAt` 就直接成功返回。
- 顶部“刷新”在已登录时会先执行云端双向同步，再通过受保护的本地加载刷新当前视图；未登录时才只是刷新本地视图。
- `loadData` 增加 `preserveOnCollapse` 防护：如果刷新结果看起来比当前 UI 异常坍缩，会保留当前页面并抛出可读错误。
- 数据加载后会异步发布浮窗目标缓存，减少浮窗用旧分项/分类/分组 ID 保存的机会。
- 浮窗目标解析收紧：显式选择分组/分类时，ID 失效会按名称路径回退；仍解析不到时失败并保留错误，不再静默落入默认收集箱。
- 浮窗队列项增加 `resolvedDestinationPath` / `destinationError` 调试字段，便于定位保存到了哪里或为什么失败。
- 新增 `scripts/test-sync-refresh-behavior.ts`，扩展 `scripts/test-floating-capture-targets.ts`，覆盖本轮同步刷新和浮窗目标回归。
- 更新旧测试以匹配当前固定布局和后台刷新语义。

## Unfinished

- 未直接操作 Windows 设备做真实跨设备端到端验证；本轮用代码路径、同步语义测试、扩展构建和本机真实页面验证覆盖。
- Chrome 隔离 profile 视觉验证受本机 Chrome/Computer Use 选择窗口限制；已停止继续操作用户主 Chrome，避免误触个人标签。
- 发布目标标签：`webcollect-2026-06-24-sync-refresh-capture`。发布后用户仍需在 Windows/Mac 实机安装并确认真实跨设备路径。

## Current Blockers

- 无代码实现阻塞。
- 隔离 Chrome 扩展视觉验证受工具限制：Computer Use 抓到的是已有 Chrome 主配置窗口，而不是刚启动的临时 profile。

## Next Step

- 用户在 Windows 和 Mac 安装发布包后重点验证：`tweetmesh` 这类跨设备新增项是否可通过 Mac 顶部云同步/刷新拉回；浮窗选择 `主页 / 常用 / 看世界` 是否进入目标分组。

## Latest Verification

- 2026-06-24 CST `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-sync-refresh-behavior.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-local-first-startup.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-cloud-snapshots.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-workspace-search.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-layout-preferences.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-layout-sizing.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-resolution-layout.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-pinned-bookmarks.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-site-icons.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-wallpaper-data.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-wallpaper-policy.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- 2026-06-24 CST `node --import tsx scripts/test-wallpaper-quotes.ts` passed.
- 2026-06-24 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-24 CST `./node_modules/.bin/eslint` passed with 0 errors and 6 existing warnings.
- 2026-06-24 CST `node ./extension/build.mjs` passed.
- 2026-06-24 CST `curl -I http://localhost:5014` returned HTTP 200 when run in the same permission context as the local dev server.
- 2026-06-24 CST Safari auxiliary browser verification: opened `http://localhost:5014`, clicked from wallpaper mode into the collection wall, confirmed toolbar and wall rendered, clicked `刷新`, and the page stayed rendered without blanking or abnormal collapse.
- 2026-06-24 CST Chrome extension observation: existing Chrome `chrome://newtab/` WebCollect page rendered with real user data and visible sync/refresh controls; isolated temp-profile Chrome visual verification was attempted but Computer Use selected the existing Chrome window, so no further Chrome interaction was performed.
- 2026-06-24 CST release target prepared: `webcollect-2026-06-24-sync-refresh-capture`.

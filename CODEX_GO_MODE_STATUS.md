# Codex Go Mode Status

## Final Goal

修复 WebCollect 收藏墙布局拖拽稳定性与浮窗注入可见性；完成证据包括布局/浮窗测试、类型检查、lint、扩展构建、真实扩展双视口与浮窗验证、提交推送和日期后缀扩展发布。

## Completed

- 收藏墙父分类宽度改为按内部每一行分组的真实固定宽度计算，旧 `widthPercent` 只用于推导列数，不再把分类撑出巨大右侧空白。
- 分组和父分类面板改为 `overflow: visible`，拖拽/菜单/预览不再被玻璃卡片父级裁剪。
- 分组卡片列数固定为 `--wc-card-columns`，Web 与扩展 CSS 均不再用 `auto-fill` 根据屏幕宽度重排。
- 历史 4 列偏好被规范化为更稳定的 1/2/3 列规则，`download / YT TT INS X` 这类分组在不同视口保持一致列数。
- 浮窗偏好增加自愈：旧版隐藏状态、过期暂停、异常 host 列表会自动规范化；用户菜单增加“恢复小松鼠浮窗”入口。
- 浮窗内容脚本增加健康标记 `__WEBCOLLECT_FLOATING_CAPTURE_HEALTH__`，可检查 host 是否出现、按钮是否可见、mascot 是否加载。
- 扩展打包修复：`floating-capture.js` 现在用单独 Vite content build 输出为 classic IIFE，不再作为带 `import` 的 ESM content script 导致 Chrome 静默不注入。

## Unfinished

- 无已知代码阻塞。
- 仍需用户安装最新 Release 包，在自己的主 Chrome 与真实网页上确认小松鼠浮窗是否稳定显示。

## Current Blockers

- 自动化 Chrome 在本机命令行 `--load-extension` 场景没有暴露 extension service worker，浏览器验证采用“构建产物 + 手动 content script 注入 + Chrome API mock”作为替代证据。代码层真实根因已修复为 classic content script。

## Next Step

- 用户安装 Release `webcollect-2026-06-25-layout-floating-fix`，下载 `WebCollect-Chrome-Extension-layout-floating-fix-2026-06-25.zip`，重点检查父分类包裹、分组拖拽和小松鼠浮窗。

## Latest Verification

- 2026-06-25 CST `node --import tsx scripts/test-layout-sizing.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-layout-preferences.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-resolution-layout.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-floating-capture-health.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-description-translation.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-site-icons.ts` passed.
- 2026-06-25 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-25 CST `./node_modules/.bin/eslint .` passed with 0 errors and 6 existing warnings.
- 2026-06-25 CST `node ./extension/build.mjs` passed; `extension/dist/assets/floating-capture.js` is IIFE, not ESM import.
- 2026-06-25 CST `git diff --check` passed.
- 2026-06-25 CST dedicated Chrome/Playwright layout verification at `http://127.0.0.1:5012/` passed:
  - 2048x1152: `download` right blank about 29.6px, overflow 0, columns 3; `常用` right blank about 29.6px, overflow 0, columns 3.
  - 1440x900: `download` right blank about 20.5px, overflow 0, columns 3; `常用` right blank about 20.5px, overflow 0, columns 3.
  - Locked-layout path reported `alertPatched: true`.
- 2026-06-25 CST floating capture health verification passed by injecting built `extension/dist/assets/floating-capture.js` into a dedicated Chrome page with mocked extension API:
  - host appeared: `#webcollect-floating-capture-host`
  - health marker: `{ injected: true, status: "visible", buttonVisible: true, mascot: "chipmunk" }`
- 2026-06-25 CST committed `dfd23fc` (`fix: stabilize layout wrapping and floating capture`) and pushed `main`.
- 2026-06-25 CST published Release `webcollect-2026-06-25-layout-floating-fix`.
- 2026-06-25 CST published asset `WebCollect-Chrome-Extension-layout-floating-fix-2026-06-25.zip`.
- 2026-06-25 CST release asset SHA-256 digest: `951d0bd8ec5b194a81368462675edc9bdecbdf2d355ac40dae4829dcf312070e`.
- Browser evidence screenshots:
  - `/private/tmp/webcollect-layout-large.png`
  - `/private/tmp/webcollect-layout-small.png`
  - `/private/tmp/webcollect-floating-capture.png`

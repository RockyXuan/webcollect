# Codex Go Mode Status

## 2026-07-12 V1.1.1 Goal Status

- PM 独立 Supabase、旧项目清理和 PM Vercel exact-SHA 已独立复核。
- WebCollect 云端新备份、同步迁移、旧 PM 角色禁用、函数权限收紧和数据计数复核已完成。
- 修复旧 Coze 子进程取配置与 service-role 回退、短屏壁纸设置裁切、分项快速提交/可访问名称。
- 新增搜索引擎、分项误删、壁纸直达主页和扩展目标队列真实浏览器验收。
- GitHub 冷启动 E2E 已改为等待真实壁纸状态就绪；tag 工作流只验证，不再与本地发布脚本重复上传 zip。
- 当前验证：117 Vitest、31 历史脚本、12 Playwright、TypeScript、ESLint、Web/扩展构建、依赖审计和隔离 MV3 runtime 通过。
- 当前发布身份：`V1.1.1 / 2026年7月12日`；精确提交与 zip 由 `webcollect-2026-07-12-v1.1.1` 固定。
- 最新证据：`docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`。

## 2026-07-07 Documentation Handoff Status

最新目标：把 WebCollect 全项目需求、用户截图、实现方式、保留边界、踩坑教训和待办，整理成 Claude/Codex 可直接读取的体检入口。

已完成：

- 新增 `AGD.md` 作为当前全项目体检总入口。
- 新增 `docs/audit/claude-code-review-handoff-2026-07-07.md`，按 Claude Code Review 需要整理实现进度、遗留问题、壁纸专项问题和自评。
- 新增 `docs/audit/webcollect-full-audit-brief-2026-07-07.md`，汇总需求、做法、保留现状、踩坑、待办和验证基线。
- 新增 `docs/audit/user-screenshot-index-2026-07-07.md`，记录用户截图名称、标注含义、对应问题和当前状态。
- 更新 `PROJECT_SUMMARY.md`、`HANDOFF.md`、`NEXT_THREAD_PROMPT.md`、`README.md`、`AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`，全部指向 `AGD.md`。

当前注意：

- 这是文档交接任务，没有修改 seed、业务逻辑、扩展构建产物或用户数据。
- 原始对话截图位于系统临时目录，2026-07-07 检查时已经过期，因此本次只保留截图索引和标注说明。
- 下一步：`git diff --check`、提交并推送 main。

## Final Goal

修复 WebCollect 收藏墙布局拖拽稳定性与浮窗注入可见性；完成证据包括布局/浮窗测试、类型检查、lint、扩展构建、真实扩展双视口与浮窗验证、提交推送和日期后缀扩展发布。

## Completed

- 2026-06-28 小修：分类顶部玻璃头部现在继承圆角并自裁剪，避免 `overflow: visible` 状态下圆角处露出矩形/三角伪影。
- 2026-06-28 小修：浮窗侧边工具默认缩小到约 2/3（`sizeScale = 0.67`），并在账户/浮窗设置里加入 `浮窗大小` 滑杆和 `小 / 中 / 原始` 预设。
- 2026-06-28 小修：浮窗收集面板改为可拖动，拖动位置持久保存到 `webcollect.capture.panelPosition`；点击外部不会自动关闭。
- 2026-06-28 小修：浮窗收集面板内容区可滚动，底部 `保存 / 取消` 操作区 sticky 保持可见；按钮顺序已改为保存在左、取消在右。
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

- 2026-06-28 CST `node --import tsx scripts/test-floating-capture-health.ts` passed.
- 2026-06-28 CST `node --import tsx scripts/test-layout-preferences.ts` passed.
- 2026-06-28 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-28 CST `./node_modules/.bin/eslint .` passed with 0 errors and 6 existing warnings.
- 2026-06-28 CST `node ./extension/build.mjs` passed; `extension/dist/assets/floating-capture.js` rebuilt.
- 2026-06-28 CST `git diff --check` passed.
- 2026-06-28 CST in-app Browser smoke at `http://localhost:5015/` loaded WebCollect without console errors; screenshot captured.
- 2026-06-28 CST dedicated Chrome floating capture verification passed by injecting built `extension/dist/assets/floating-capture.js` into `http://127.0.0.1:5015/` with mocked extension API:
  - side button measured `159x48`
  - long create-section/category/group panel kept actions visible
  - action order was `保存 / 取消`
  - dragging moved panel from `{ left: 380, top: 183 }` to `{ left: 260, top: 90 }`
  - stored panel position became `{"left":260,"top":90}`
  - clicking outside did not close the panel
  - screenshot: `/private/tmp/webcollect-floating-capture-verify.png`
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

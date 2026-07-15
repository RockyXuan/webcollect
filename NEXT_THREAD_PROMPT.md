这是一个新的 Codex 线程，请继续开发 RockyXuan/webcollect。当前上下文很长，务必先按下面顺序接手，不要从旧假设继续。

## 2026-07-15 工作流退役规则

本仓库已退役 Superpowers（含 `superpowers:*` / `using-superpowers`）、`goal-zzx` / `zzx-goal` 和 `andrej-karpathy-coding`。不要安装、启用、调用或模仿它们。可按任务复杂度使用 Codex 原生计划或 goal；测试、Review、子代理和 worktree 均由当前任务风险决定。`tasks/todo.md`、`tasks/lessons.md`、`CODEX_GO_MODE_STATUS.md` 与 `docs/superpowers/` 仅为历史档案，不是当前执行入口。

## 2026-07-14 V1.1.2 候选事实

- 第一优先事实源：`docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`。
- 已发布稳定版仍是 `V1.1.1`；`V1.1.2 RC3` 已发布为 Prerelease，tag `webcollect-2026-07-14-v1.1.2-rc.3`，本地安装目录为 `/Users/rockyx/Downloads/WebCollect-v1.1.2-rc.3/unpacked`。只有授权 Chrome + 独立 Profile B、双会话核验、生产构建、final main/tag/zip 一致后才转正式版。
- 已修根因：干净 Web OAuth 配置、新 Profile 重复收集箱、旧客户端已有同分项空重复时的 canonical 选择、回调 code、HMR upgrade、浮窗并发目标、重复 GoTrue 客户端和错误的手动浏览器 refresh 生命周期。
- 当前自动门禁：129 Vitest、31 组历史脚本、13 Playwright、TypeScript、ESLint、Web/扩展构建、依赖审计、扩展产物/体积/运行时均通过。RC3 另有顶部 `壁纸 | 开/关` 启动开关和多视口浏览器证据。
- 真实数据计数：`364 / 130 / 24 / 58 / 0 / 1`；不要删除 closeout 中记录的两条空收集箱，除非用户明确批准精确处理。
- 用户已明确授权操作其主 Chrome 和加载新扩展。复用 `Codex Workbench`，不要碰无关个人标签；不要卸载现有 WebCollect，以免清除扩展 IndexedDB，应在相同固定扩展 ID 下更新/重新加载 RC3；账号、密码、验证码或 CAPTCHA 仍由用户本人处理。

## 2026-07-12 当前事实

- 最新版本：`V1.1.1 / 2026年7月12日`
- 最新 Release：`webcollect-2026-07-12-v1.1.1`
- PM 已迁出旧 Supabase；WebCollect 云端迁移已执行并验证数据计数不变。
- 第一优先事实源：`docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`。
- 旧文档里“SQL 待执行”“PM 仍共库”“下一版 V1.0.4”等说法已过期。

## 第一件事

1. 当前固定主开发目录应是：
   `/Users/rockyx/vibe coding/Web Collect 0628`
2. 不要使用旧目录：
   `/Users/rockyx/Documents/webcollect`
3. 先阅读这些文件：
   - `AGD.md`
   - `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`
   - `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`
   - `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`
   - `docs/audit/gpt56-full-audit-execution-2026-07-10.md`
   - `docs/audit/claude-code-review-handoff-2026-07-07.md`
   - `docs/audit/webcollect-full-audit-brief-2026-07-07.md`
   - `docs/audit/user-screenshot-index-2026-07-07.md`
   - `PROJECT_SUMMARY.md`
   - `HANDOFF.md`
   - `NEXT_THREAD_PROMPT.md`
   - `AGENTS.md`
4. 运行并汇报：

```bash
pwd
git status -sb
git log --oneline --decorate -8
git remote -v
gh auth status
git ls-remote --heads origin main
```

如果 `gh` 或 GitHub 网络在 Codex 环境里失败，不要反复盲目重试。先说明 GitHub 环境卡点，再检查 Clash/GitHub 代理或让用户在普通 Terminal 验证。

## 2026-07-07 最新背景

以下是 `V1.0.3 / 2026年7月2日` 的历史背景；当前版本与状态以文件顶部的 V1.1.1 事实和 closeout 为准。7 月 1 日和 7 月 2 日已经完成：

- 扩展浮窗保存目标不再静默错放到主页或默认收集箱。
- 顶部分项支持编辑、行内改名、新增和排序，`主页` 固定。
- 分类编辑拆成轻量编辑和高级设置。
- 移除顶部分项的系统 prompt/confirm 误触路径。
- 修复 tab hover 文字变白不可读。
- 统一小松鼠品牌图标和版本日期显示。
- 修复 `docu.md` 从 X/Twitter 打开时简介误识别成 X/Twitter 的问题。

用户现在准备让 Claude 做全项目体检。不要让用户重新复述需求，直接读 `AGD.md` 和 `docs/audit/*`。

## 当前最新目标状态

本线程已经完成一批 WebCollect UI/浮窗小修，准备提交并发布：

- 分类卡片顶部圆角伪影：修复玻璃头部背景从圆角漏出的三角/阴影。
- 浮窗工具尺寸：默认缩到约 2/3，实测 `159x48`。
- 浮窗大小设置：用户菜单新增 `浮窗大小` 滑杆和 `小 / 中 / 原始` 预设。
- 收集面板可拖动：拖动位置保存到 `webcollect.capture.panelPosition`。
- 收集面板不自动消失：点击外部不会关闭，只有取消/关闭才关闭。
- 长表单按钮可见：新建分项/分类/分组把面板撑长时，底部操作区仍 sticky 可见。
- 按钮顺序：左边 `保存`，右边 `取消`。

最新计划发布：

- Release tag：`webcollect-2026-06-28-capture-panel-ux`
- Chrome 扩展 zip：`WebCollect-Chrome-Extension-capture-panel-ux-2026-06-28.zip`

如果接手时 Release 尚不存在，请先检查当前 git 状态，确认是否需要继续完成提交/推送/发布。

## 最近验证结果

这些已经跑过并通过：

```bash
node --import tsx scripts/test-floating-capture-health.ts
node --import tsx scripts/test-layout-preferences.ts
./node_modules/.bin/tsc -p tsconfig.json
./node_modules/.bin/eslint .
node ./extension/build.mjs
git diff --check
```

说明：

- ESLint 是 0 error，但仍有 6 个既有 warning。
- `node ./extension/build.mjs` 已重建 `extension/dist/assets/floating-capture.js`。
- in-app Browser 打开 `http://localhost:5015/` 冒烟检查无相关 console error。
- 专用 Chrome 注入构建产物验证通过：
  - side button: `159x48`
  - long form actions visible
  - action order: `保存 / 取消`
  - panel drag persisted `{"left":260,"top":90}`
  - outside click did not close panel
  - screenshot: `/private/tmp/webcollect-floating-capture-verify.png`

## 用户偏好和硬规则

- 用中文沟通。
- 如果要写计划，下次先翻译成中文给用户看。
- 不要把完成某个小阶段当成最终完成；只有核心功能、验证、构建、发布都完成，才说完成。
- 对 UI 改动要真实视觉验证，不能只靠代码推断。
- 本地预览优先用 in-app Browser；必须用 Chrome 时用辅助窗口或 `Codex Workbench`，不要操作用户主 Chrome 窗口。
- 数据安全第一：不清空 IndexedDB，不重置 Supabase，不用默认数据覆盖用户真实云端数据。
- 任何扩展可测试版本必须提供 GitHub Release 和 zip 直链。
- 扩展包文件名日期要放在最后，便于用户一眼看到日期。

## 下一步建议

1. 确认当前最新 commit 已推送 GitHub `main`。
2. 确认 Release `webcollect-2026-06-28-capture-panel-ux` 已创建，zip asset 名字正确。
3. 让用户安装最新扩展包后，重点确认：
   - 分类角落不再露小三角；
   - 浮窗工具大小合适且可调；
   - 收集面板可拖动、不会误关；
   - 新增分项/分类/分组后按钮不被顶掉；
   - 保存/取消位置符合要求。
4. 如果用户继续反馈布局、壁纸、同步或浮窗问题，先复现、截图、读 console/network，再动代码。

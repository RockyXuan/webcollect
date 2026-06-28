这是一个新的 Codex 线程，请继续开发 RockyXuan/webcollect。当前上下文很长，务必先按下面顺序接手，不要从旧假设继续。

## 第一件事

1. 当前固定主开发目录应是：
   `/Users/rockyx/vibe coding/Web Collect 0628`
2. 不要使用旧目录：
   `/Users/rockyx/Documents/webcollect`
3. 先阅读这些文件：
   - `PROJECT_SUMMARY.md`
   - `HANDOFF.md`
   - `NEXT_THREAD_PROMPT.md`
   - `AGENTS.md`
   - `tasks/lessons.md`
   - `tasks/todo.md`
   - `CODEX_GO_MODE_STATUS.md`
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

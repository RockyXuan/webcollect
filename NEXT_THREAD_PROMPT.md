这是一个新的 Codex 线程，请继续开发 RockyXuan/webcollect。请先完成接手检查，再决定是否继续开发。

第一步必须做：

1. 先阅读 `HANDOFF.md`、`NEXT_THREAD_PROMPT.md`、`AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`。
2. 运行并汇报：`git status -sb`、`git log --oneline --decorate -8`。
3. 确认当前目录是否是最新 `main`。不要从旧的 `/Users/rockyx/Documents/webcollect` 脏目录直接继续，除非已经保护并理解其中未提交改动。
4. 检查最新 Release：`webcollect-2026-06-13-80e1d90`。Chrome 扩展 zip 应为：
   `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-06-13-80e1d90/WebCollect-Chrome-Extension-webcollect-2026-06-13-80e1d90.zip`
5. 运行 GitHub 预检：`gh auth status`、`git ls-remote --heads origin main`。如果 Codex 内部出现 token invalid 或 DNS 解析失败，不要反复重试；直接告诉用户 GitHub 环境被阻塞。

浏览器工作区规则：

- 本地开发和 localhost 预览优先使用 `@Browser` / Codex in-app Browser。
- 必须使用 Chrome 时，优先使用 Chrome 辅窗口中的 `Codex Workbench` 标签组。
- 不要把用户主用 Chrome 窗口或当前活动标签页当作任务现场。
- 如果浏览器上下文被用户切换或占用，不要连续打开新标签页恢复；回到 `@Browser`、Safari、Chrome 辅窗口或 `Codex Workbench`。

当前已知状态：

- 最新远端主线：`main` at `80e1d90 ci: fix Chrome extension release workflow`。
- 最新成功 Release：`webcollect-2026-06-13-80e1d90`。
- Release workflow 的关键修复：删除 `pnpm/action-setup@v4` 中硬编码的 `version: 10.25.0`，让它使用 `package.json` 的 `pnpm@9.0.0`。
- Zoom 模式已合入主线，且从收藏墙进入 Zoom 模式应只通过显式按钮，不再通过长按、鼠标甩动或墙面鼠标操作触发。

下一阶段优先事项：

1. Windows 安装最新 Release 后复测 Chrome 扩展。
2. 验证 Zoom 壁纸是否多图随机，而不是每次同一张。
3. 验证本地高清壁纸秒开、文字/提示完整、图片不再黑框慢加载。
4. 修复或验证分组布局：4 张卡片默认 2x2，拉宽可 1x4，布局偏好可跨 Mac/Windows 记忆。
5. 排查悬浮采集保存目标错误：用户选择的目标组必须被尊重，不能默认落入截流收集箱/收集箱。
6. 继续把同步稳定性当作底线：任何改动都不能让默认/空/旧数据覆盖用户云端真实数据。

开发与交付规则：

- 数据安全第一，不删除、不覆盖用户收藏、分类、IndexedDB、Supabase 数据。
- 每次修改后直接同步到 `main`，不要让用户理解分支细节。
- 涉及 Chrome 扩展可测试版本时，必须给用户最新 Release 页面和 Chrome 扩展 zip 直链。
- 如果 GitHub / Release / Actions 无法验证，必须明确说明卡点，不要把旧 Release 当新版交付。

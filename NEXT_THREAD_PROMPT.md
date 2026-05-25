这是一个新的 Codex 线程，请继续开发 RockyXuan/webcollect。

请先阅读仓库里的 `HANDOFF.md`，再检查当前代码状态，不要只依赖旧聊天记忆。请至少先运行 `git status -sb`，确认当前分支、未提交改动、远端和最近提交；如果 `HANDOFF.md` 和实际代码或 git 状态冲突，以当前代码和 git 状态为准。

请注意：

- 不要覆盖、回滚或删除用户未提交改动。
- 不要提交真实密钥、token、cookie、`.env*`、浏览器资料、旧线程导出文件或 `tmp/` 草稿。
- 开始大改前先确认当前项目状态，尤其是同步、快照、Supabase schema、扩展构建和 UI 样式是否仍一致。
- 优先阅读 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`，再按 `HANDOFF.md` 的 `Recommended Next Steps` 接着做。
- 数据安全优先：不要把默认/空/错乱本地数据覆盖到云端；不要把 Homely 旧导入数据当成 WebCollect 最新恢复源，除非用户明确要求。
- Web 端重要 `wc-*` 样式改动通常也要同步到 `extension/src/extension.css`。
- 做完改动后至少运行：`corepack pnpm ts-check`、`corepack pnpm lint`、`corepack pnpm build:ext`、`corepack pnpm exec next build --webpack`、`git diff --check`。不要假装运行过未运行的验证。

当前接手建议：先确认 `ai-next-fixes` 分支是否已拉到最新，再验证搜索、全局收藏栏、编辑模式果冻浮层、悬浮采集按钮、云端手动保存/版本回档和扩展新标签页。

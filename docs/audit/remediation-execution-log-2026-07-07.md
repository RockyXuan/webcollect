# WebCollect Fable Remediation 执行日志

更新时间：2026-07-07
执行分支：`fix/sync-architecture`
依据文档：

- `docs/audit/claude-fable-code-review-2026-07-07.md`
- `docs/audit/claude-fable-remediation-plan-2026-07-07.md`

## 执行原则

- 按 Fable 方案 Phase 0 -> 1 -> 2 -> 3 -> 4 -> 5 顺序执行。
- 一个 Step 一个 commit。
- 每个 Step 结束运行 Fable 指定验证清单。
- 不清空 IndexedDB，不重置 Supabase，不操作用户主 Chrome。
- 涉及真实账号数据的动作必须有手动确认或可回退备份。

## Step 0.1 状态：建立整改分支与备份前置

已完成：

- 从 `main` 创建整改分支：`fix/sync-architecture`。
- 拉取 Fable 分支：`origin/claude/portfolio-mgmt-review-y7s6ww`。
- 原样引入 Fable 两份文档：
  - `docs/audit/claude-fable-code-review-2026-07-07.md`
  - `docs/audit/claude-fable-remediation-plan-2026-07-07.md`
- 更新 `AGD.md`，把这两份文档列为最优先阅读项。

人工门槛：

- Fable 要求在真实账号里手动触发一次“手动保存版本”，并导出一份本地 JSON 备份。
- 当前 Codex 不会擅自操作用户真实 Chrome / Supabase 数据。
- 在进入 Phase 1 同步协议改动前，需要用户确认已经完成真实账号备份，或明确接受只在代码分支中开发、暂不对真实账号执行同步验证。

## 后续步骤

- Step 0.2：新增 `scripts/test-sync-merge.ts` 同步测试骨架。
- Phase 1：按 Fable 方案修同步正确性。

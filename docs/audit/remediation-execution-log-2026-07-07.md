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

## Step 0.2 状态：同步测试骨架

已完成：

- 新增 `scripts/test-sync-merge.ts`。
- 在 `src/lib/supabase-browser.ts` 增加测试专用 fake Supabase client 注入 hook。
- 测试脚本通过内存 Map 替代 localforage，不读写真实 IndexedDB。
- 测试脚本通过 fake Supabase client 替代真实网络，不连接真实 Supabase。

已覆盖 golden cases：

- 本地新增分类/卡片会推送到云端。
- 云端新增分类/卡片会拉取到本地。
- 同 ID 冲突时云端时间戳较新则云端赢。
- 同 ID 冲突时本地时间戳较新则本地赢并推送云端。

验证结果：

- `node --import tsx scripts/test-sync-merge.ts` passed.
- `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- `node --import tsx scripts/test-floating-capture-drain.ts` passed.
- `node --import tsx scripts/test-floating-capture-health.ts` passed.
- `node --import tsx scripts/test-floating-capture-metadata.ts` passed.
- `node --import tsx scripts/test-description-translation.ts` passed.
- `node --import tsx scripts/test-extension-branding.ts` passed.
- `corepack pnpm@9.0.0 ts-check` passed.
- `corepack pnpm@9.0.0 lint` passed with existing 6 warnings.
- `corepack pnpm@9.0.0 build:ext` passed.

## Step 1.1 状态：停止无差别全量 upsert

已完成：

- 在 `src/lib/db.ts` 增加持久 dirty 集合 `syncDirtySets`。
- `saveCards` / `saveCategories` 通过本地差异检测登记新增或内容变化的卡片、分类。
- `withoutLocalChangeEvents` 包裹的同步、恢复、迁移写入不会登记 dirty。
- `syncData` 合并后只推送 `dirty ∪ localOnly ∪ localToPush`。
- `pushLocalSnapshotToCloud` 只推送 dirty、本地新增、本地更新时间较新的行。
- 分类部分推送时保留真实 `parent_id`，避免只推子分组时被拍平成顶级分类。
- 已和云端逐字段相等的分类/卡片不会 upsert。
- 同步成功后清理已处理的 dirty id。

新增验收：

- `scripts/test-sync-merge.ts` 增加“本地无改动、云端内容一致时，分类/卡片 upsert 次数为 0”的断言。

验证结果：

- `node --import tsx scripts/test-sync-merge.ts` passed.
- `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- `node --import tsx scripts/test-floating-capture-drain.ts` passed.
- `node --import tsx scripts/test-floating-capture-health.ts` passed.
- `node --import tsx scripts/test-floating-capture-metadata.ts` passed.
- `node --import tsx scripts/test-description-translation.ts` passed.
- `node --import tsx scripts/test-extension-branding.ts` passed.
- `corepack pnpm@9.0.0 ts-check` passed.
- `corepack pnpm@9.0.0 lint` passed with existing 6 warnings.
- `corepack pnpm@9.0.0 build:ext` passed.
- `git diff --check` passed.

备注：

- 本 Step 未操作用户真实 Chrome / IndexedDB / Supabase 数据。
- 真实账号双设备同步人工复验仍等待用户先完成 Fable 要求的手动备份。

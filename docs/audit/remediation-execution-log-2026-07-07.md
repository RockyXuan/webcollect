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

## Step 1.2 状态：客户端显式提供 updated_at

已完成：

- 新增 `migrations/2026-07-07-client-updated-at.sql`。
- 更新 `src/storage/database/supabase-init.sql`，新环境 bootstrap 也使用同一触发器逻辑。
- `public.set_updated_at()` 改为仅在客户端没有提供新 `updated_at` 时补 `now()`。
- `localToCloudCategory` / `localToCloudCard` upsert payload 增加本地 `updated_at`。
- `mergeByTimestamp` 注释明确相等时间戳保留本地行，避免无操作云同步回滚当前标签。

新增验收：

- `scripts/test-sync-merge.ts` 增加两设备复现场景：
  - 设备 B 无改动同步后不会刷新云端卡片。
  - 设备 A 早前本地编辑再次同步时不会被回滚。
  - 云端行保留设备 A 的客户端编辑时间戳。

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

- 本 Step 只提交迁移文件，没有连接或修改真实 Supabase。
- 真实执行迁移前仍需按 Fable 要求导出 `cards` / `categories` CSV 备份。

## Step 1.3 状态：批量 preferences 与分类分层 upsert

已完成：

- `writePreferences` 从逐 key `select -> update/insert` 改为单次批量 `upsert(rows, { onConflict: "user_id,key" })`。
- `upsertCategoriesWithParents` 从逐分类串行 upsert 改为按父子深度分层批量 upsert。
- 父分类先写，子分组后写，避免外键顺序问题。

新增验收：

- `scripts/test-sync-merge.ts` 的本地推送场景改为“父分类 + 子分组 + 卡片”。
- fake Supabase client 新增请求次数统计。
- 断言一次 `syncData` 总请求数不超过 Fable 预算 `<= 8`。

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

## Step 1.4 状态：同步完成时间戳记账

已完成：

- `syncData` 在加载本地快照时记录 `syncStartLocalUpdatedAt`。
- `pushLocalSnapshotToCloud` 在加载本地快照时记录 `syncStartLocalUpdatedAt`。
- 同步完成后 `saveLocalSnapshotSyncedAt(syncStartLocalUpdatedAt)`，不再用 `Date.now()` 抬高 synced marker。

新增验收：

- `scripts/test-sync-merge.ts` 在 fake `user_preferences` upsert 期间注入一次本地卡片修改。
- 断言同步结束后 `getLocalSnapshotUpdatedAt() > getLocalSnapshotSyncedAt()`，中途新修改会留给下一轮同步。

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

## Step 1.5 状态：single-flight 与递归深度保护

已完成：

- `sync.ts` 增加模块级 `syncInFlight`。
- 顶层 `syncData` / `pushLocalSnapshotToCloud` 并发调用会复用同一个 in-flight promise。
- `syncData` / `pushLocalSnapshotToCloud` 互调增加 `depth + 1`。
- 最大递归深度限制为 2，超过后 `console.warn` 并收敛返回。

新增验收：

- `scripts/test-sync-merge.ts` 增加并发同步用例，断言两个顶层 `syncData` 只产生一次云端读取。
- `scripts/test-sync-merge.ts` 增加持续本地写入互调用例，断言递归到深度 3 时跳过，不进入死循环。

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

## Step 1.6 状态：emergency-restore 只检测不自动回档

已完成：

- `restoreLatestHealthyWorkspaceIfNeeded` 改为只检测并返回提示候选，不再自动调用 `restoreLocalDataSnapshot`。
- 新增 `restoreEmergencyWorkspaceSnapshot(snapshotId)`，只有用户确认后才恢复。
- 删除 `EMERGENCY_RESTORE_FORCE_VERSION` 强制逻辑。
- 删除 `hasKnownCryptoGroupsInHome` 以及 zksync/layerzero/defi/coin/rwa/stock/HODL/FOM 等硬编码个人分组名判据。
- 删除 auth-store 里的 emergency pending push 自动回推通道。
- Web 页面和 Chrome 扩展新标签页都改为项目内 AlertDialog 确认恢复。

新增验收：

- 新增 `scripts/test-emergency-restore.ts`。
- 验证健康启动路径不会提示且 IndexedDB 写入次数为 0。
- 验证异常布局只提示、不写 IndexedDB、不修改卡片。
- 验证用户确认后才恢复快照并写入本地数据。

验证结果：

- `node --import tsx scripts/test-emergency-restore.ts` passed.
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

## Step 1.7 状态：删除死代码并清零 lint warning

已完成：

- 删除 `pushCardToCloud` / `pushCategoryToCloud`。
- 删除 `deleteCardFromCloud` / `deleteCategoryFromCloud`。
- 删除 `legacyLoginWithGoogleExtension`。
- 更新 `src/lib/sync.ts` 文件头注释，描述当前“快照同步 + dirty/local-only/newer rows 增量写”的真实架构。
- `src/app/api/supabase-config/route.ts` 改为静态导入 `node:child_process`，去掉无效 eslint-disable。
- 对必须兼容 Chrome 扩展的原生 `<img>` 组件加明确 lint 例外。
- 移除 `recycle-bin-dialog.tsx` 未使用的 `useState` import。

验证结果：

- `node --import tsx scripts/test-emergency-restore.ts` passed.
- `node --import tsx scripts/test-sync-merge.ts` passed.
- `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- `node --import tsx scripts/test-floating-capture-drain.ts` passed.
- `node --import tsx scripts/test-floating-capture-health.ts` passed.
- `node --import tsx scripts/test-floating-capture-metadata.ts` passed.
- `node --import tsx scripts/test-description-translation.ts` passed.
- `node --import tsx scripts/test-extension-branding.ts` passed.
- `corepack pnpm@9.0.0 ts-check` passed.
- `corepack pnpm@9.0.0 lint` passed with 0 warnings.
- `corepack pnpm@9.0.0 build:ext` passed.
- `git diff --check` passed.

Phase 1 代码侧状态：

- Step 1.1 至 Step 1.7 已按 Fable 方案完成并逐步提交。
- 真实 Supabase 迁移和双设备真实账号验收仍需用户先完成 CSV/本地备份后再执行。

## Step 2.1 状态：启动同步改为轻量新鲜度检查

已完成：

- `auth-store.triggerSync` 启动后台同步前只读云端 `user_preferences.localSnapshotUpdatedAt`。
- 增加 `decideStartupSyncAction`：云端更新走 `syncData`，本地更新走 `pushLocalSnapshotToCloud`，两端相等不做全量同步。
- `initialize()` 的缓存 session / Supabase session 恢复路径改为 `scheduleStartupSync`。
- `scheduleStartupSync` 优先使用 `requestIdleCallback`，不支持时退回 `setTimeout(0)`，避免启动同步抢首屏。
- 保留 `manualSync()` 的完整双向 `syncData`，手动刷新仍能拉取其他设备修改。

新增验收：

- 新增 `scripts/test-startup-light-sync.ts`。
- 验证本地与云端 `localSnapshotUpdatedAt` 相等时，只产生 1 次云端 `user_preferences` 查询，且同步状态标为 success。
- 验证云端新 / 本地新 / 相等三种启动决策。
- 验证 `initialize()` 不再直接 `void triggerSync(...)`，而是走 idle/timeout 调度。

验证结果：

- `node --import tsx scripts/test-startup-light-sync.ts` passed.
- `node --import tsx scripts/test-local-first-startup.ts` passed.
- `node --import tsx scripts/test-sync-refresh-behavior.ts` passed.
- `node --import tsx scripts/test-sync-merge.ts` passed.
- `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- `node --import tsx scripts/test-floating-capture-drain.ts` passed.
- `node --import tsx scripts/test-floating-capture-health.ts` passed.
- `node --import tsx scripts/test-floating-capture-metadata.ts` passed.
- `node --import tsx scripts/test-description-translation.ts` passed.
- `node --import tsx scripts/test-extension-branding.ts` passed.
- `corepack pnpm@9.0.0 ts-check` passed.
- `corepack pnpm@9.0.0 lint` passed with 0 warnings.
- `corepack pnpm@9.0.0 build:ext` passed.
- `git diff --check` passed.

## Step 2.2 状态：loadData 修复管线改为版本化本地迁移

已完成：

- `db.ts` 新增 `getDataSchemaVersion()` / `saveDataSchemaVersion()`。
- 新增 `src/lib/migrations.ts`，集中执行历史本地数据修复。
- 已迁入一次性迁移的内容包括：favicon 回填、英文简介本地化、isParent 修复、section 迁移、默认分项名称修复、Recovered 数据清理、父分类直挂卡片修复、空 seed 模板裁剪。
- `store.loadData()` 改为读数据后调用 `runLocalMigrations()`，常驻逻辑只保留过期 hidden 清理、`ensureSectionInboxes` 和最终状态提交。
- `loadData()` 移除后置迁移 `set({ cards, categories })`，正常路径只做最终一次状态提交。
- 保留分类操作里需要复用的 `ensureSectionInboxes` / `ensureParentDirectCardsAreVisible`，从 `migrations.ts` 统一导入。

新增验收：

- 新增 `scripts/test-load-data-migrations.ts`。
- 验证第一次启动会写入本地 schema version；第二次启动在已迁移且数据干净时 IndexedDB 写入次数为 0。
- 更新 `scripts/test-description-translation.ts`，让它检查英文简介迁移已迁到 `src/lib/migrations.ts`。

验证结果：

- `node --import tsx scripts/test-load-data-migrations.ts` passed.
- `node --import tsx scripts/test-startup-light-sync.ts` passed.
- `node --import tsx scripts/test-local-first-startup.ts` passed.
- `node --import tsx scripts/test-sync-refresh-behavior.ts` passed.
- `node --import tsx scripts/test-sync-merge.ts` passed.
- `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- `node --import tsx scripts/test-floating-capture-drain.ts` passed.
- `node --import tsx scripts/test-floating-capture-health.ts` passed.
- `node --import tsx scripts/test-floating-capture-metadata.ts` passed.
- `node --import tsx scripts/test-description-translation.ts` passed.
- `node --import tsx scripts/test-extension-branding.ts` passed.
- `corepack pnpm@9.0.0 ts-check` passed.
- `corepack pnpm@9.0.0 lint` passed with 0 warnings.
- `corepack pnpm@9.0.0 build:ext` passed.
- `git diff --check` passed.

## Step 2.3 状态：降低后台同步频率与云端快照体量

已完成：

- `AUTO_SYNC_INTERVAL_MS` 从 3 分钟调整为 10 分钟。
- 保留本地安全快照 10 秒防抖频率，仍能快速生成本地回滚点。
- 云端 `workspace_snapshots` 系统快照上传增加 30 分钟最小间隔。
- 云端系统快照增加内容 hash 去重；同内容即使超过 30 分钟也不重复上传。
- 云端上传逻辑改为 `maybeUploadCloudSafetySnapshot`，本地快照生成和云端上传解耦。

新增验收：

- 新增 `scripts/test-background-sync-throttle.ts`。
- 验证后台轮询间隔为 10 分钟。
- 验证云端系统快照 30 分钟节流。
- 验证 hash 忽略 snapshot entry 的 `id/createdAt`，但工作区数据变化会改变 hash。
- 验证同内容 hash 会跳过云端上传。

验证结果：

- `node --import tsx scripts/test-background-sync-throttle.ts` passed.
- `node --import tsx scripts/test-cloud-snapshots.ts` passed.
- `node --import tsx scripts/test-load-data-migrations.ts` passed.
- `node --import tsx scripts/test-startup-light-sync.ts` passed.
- `node --import tsx scripts/test-sync-merge.ts` passed.
- `node --import tsx scripts/test-floating-capture-targets.ts` passed.
- `node --import tsx scripts/test-floating-capture-drain.ts` passed.
- `node --import tsx scripts/test-floating-capture-health.ts` passed.
- `node --import tsx scripts/test-floating-capture-metadata.ts` passed.
- `node --import tsx scripts/test-description-translation.ts` passed.
- `node --import tsx scripts/test-extension-branding.ts` passed.
- `corepack pnpm@9.0.0 ts-check` passed.
- `corepack pnpm@9.0.0 lint` passed with 0 warnings.
- `corepack pnpm@9.0.0 build:ext` passed.
- `git diff --check` passed.

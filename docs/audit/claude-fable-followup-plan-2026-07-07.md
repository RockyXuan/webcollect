# WebCollect 第二轮审查与下一阶段规划（Claude Fable 5）

日期：2026-07-07（第二轮）
审查对象：分支 `fix/sync-architecture` @ `0e03cac`（对比 `main` @ `a779f26`，24 个 commit，约 +6300/-2700 行）
前置文档：
- 第一轮审查：`docs/audit/claude-fable-code-review-2026-07-07.md`
- 第一轮方案：`docs/audit/claude-fable-remediation-plan-2026-07-07.md`
- Codex 执行日志：`docs/audit/remediation-execution-log-2026-07-07.md`

---

## Part A：对 Codex 本轮执行的审查结论

### A.0 验证结果（本次实测，非转述）

| 检查 | 结果 |
|---|---|
| `pnpm ts-check` | 通过 |
| `pnpm lint` | 通过，**0 警告**（上一轮 6 个警告已清） |
| 全部 30 个 `scripts/test-*.ts` | 全部通过 |
| `pnpm build:ext` | 通过 |
| `grep window.prompt/confirm/alert src extension/src` | **0 命中** |

### A.1 逐项核对：方案执行质量

Phase 1（同步正确性）——**全部按方案落地，质量高**：

- ✅ Step 1.1 dirty 追踪：`db.ts` 在 `saveCards/saveCategories` 内自动 diff 出变更 id（比方案的调用方登记更稳，不会漏标）；推送只含 dirty ∪ localOnly ∪ localToPush，且内容与云端逐字段相等的行跳过（`cloudCardMatchesLocal`）。
- ✅ Step 1.2 客户端时间戳：`updated_at` 随行显式上传；SQL 迁移 `migrations/2026-07-07-client-updated-at.sql` 只在客户端未提供新值时才服务端补时。触发 P0-1 丢改动的机制已被拆除。
- ✅ Step 1.3 批量写：`writePreferences` 一次 `upsert(..., onConflict: "user_id,key")`；分类按父子深度分层批量 upsert。
- ✅ Step 1.4 `saveLocalSnapshotSyncedAt(syncStartLocalUpdatedAt)`，同步窗口内的修改不再被吞。
- ✅ Step 1.5 `runWithSyncGate`：single-flight + 递归深度 ≤ 2。
- ✅ Step 1.6 emergency-restore：个人数据硬编码启发式（zksync/layerzero 等）全部删除，强制 marker 删除，恢复改为 AlertDialog 用户确认，取消不动数据。
- ✅ Step 1.7 四个死推送函数与 legacy 登录已删，mojibake 注释已清。

Phase 2（性能）——**全部落地**：

- ✅ 启动轻量检查（1 个请求读云端 marker）+ `requestIdleCallback` 延迟同步（但见 A-1 缺陷）。
- ✅ `loadData` 修复管线迁入 `migrations.ts`，版本号门控只跑一次；loadData 单次 `set()`。
- ✅ 自动同步间隔 3→10 分钟；云端安全快照 30 分钟节流 + 内容 hash 去重。
- ✅ 四个网格组件 `React.memo`；热门推荐安全检查改为 IntersectionObserver 进视口才触发。

Phase 3（壁纸）——**全部落地**（但见 A-2 缺陷）：

- ✅ 展示层改 2560px 缩略图；缓存去掉 `cache:"reload"`。
- ✅ Wikimedia 按分类并行请求、gsrlimit 12→30。
- ✅ "每次打开换一张"已实现。
- ✅ `wallpaperPrefs` 进云同步（LWW by updatedAt）。
- ✅ 设置面板显示刷新状态/错误；壁纸角标显示"本地/远程"。

Phase 4.3 / 4.4 / 5.1 / 5.2 ——✅ 系统弹窗清零、sortable-grid 按方案拆成 6 个文件（含 Playwright 真浏览器验收 + 截图落库）、CI 工作流、文档收口。

**总体评价：本轮执行可以合并。以下新发现问题不阻塞合并，但 A-1、A-2 应在发版（V1.0.4）前修掉。**

### A.2 本轮审查新发现的问题

#### A-1（P1）启动新鲜度标记不对齐：push 之后每次启动仍会触发全量 syncData

- `sync.ts:1696`：`pushLocalSnapshotToCloud` 写云端 marker 用 `Math.max(localSnapshotUpdatedAt, Date.now())` ≈ **推送时刻**（T2）。
- 本地的 `localSnapshotUpdatedAt` 仍是**最后一次编辑时刻**（T1 < T2），`syncedAt` 也只记到 T1。
- 下次启动 `decideStartupSyncAction(T1, T2)` → 云端"更新" → 跑完整 `syncData`。syncData 不会把本地 marker 抬到 T2 → **之后每次启动都判定云端更新、都跑全量同步**，Step 2.1 的轻量启动被实际废掉。
- 修法见 Part C / R1.1。

#### A-2（P1）Wikimedia 2560px 缩略图返回 400（Codex 自己的 Playwright 日志已记录，未修）

- 执行日志 Step 4.4 验收记录："several Wikimedia 2560px image requests returned 400"。
- 原因：Wikimedia thumb 管线要求请求宽度**严格小于**原图宽度，且部分文件（特殊格式/特殊文件名）不支持该拼法；`getDisplayUrl` 无宽度钳制、展示层 onerror 后没有降级重试，只会永远停在预览图。
- 结果：部分远程壁纸实际仍显示不出高清版 —— 恰是用户最初抱怨的"远程不扎实"残留。
- 修法见 Part C / R1.2。
- 2026-07-08 Codex 补充：真实 Chrome headless 复验确认 `2560px-*` 仍为 HTTP 400，`1920px-*` 返回 HTTP 200；当前代码已改为 Wikimedia 标准尺寸钳制，5 张远程样本浏览器加载均通过。

#### A-3（P2）wallpaperPrefs 云同步混入高频易变字段

- 同步的是整个 prefs 对象，含 `currentWallpaperId`、`recentQuoteIds/recentAssetIds/recentMediaIds`；壁纸每 15 分钟轮换一次就 bump 一次 `updatedAt`。
- 后果：prefs 永远处于"有变化"状态，每次同步都要写；且设备 A 轮换会把设备 B 的当前壁纸"翻页"（B 下次同步后壁纸突变）。
- 修法见 Part C / R1.3（只同步稳定设置字段）。若用户明确想要"多设备镜像同一张壁纸"，则保留现状并在设置里注明——先问用户，默认按拆分做。

#### A-4（P2，观察项，不用马上动）

- `writePreferences` 现在虽是单请求，但每次同步仍全量写约 20 个 key，包括整个 warehouse/recycleBin JSON。后续可 diff 只写变化的 key；更长期是把 warehouse 移出 preferences 表。

#### A-5（P2，观察项，明确先不要动）

- 旧的启发式守卫（`localLooksMuchSmallerThanCloud`、collapse guard、`cleanDefaultSectionDuplicateCards` 的云行删除、`localHasRicherStructureSnapshot`）仍全部保留。根因（P0-1）修掉后它们理论上可以简化，但**必须等双设备真实验收稳定运行至少两周后再逐个拆**，现在动风险大于收益。

---

## Part B：用户决定（2026-07-07）

- **UI 还原度任务（Phase 4.1 design token、4.2 双端样式收敛、4.5 逐屏走查）按用户指示暂缓**，视为本轮不做，**解除 blocked 状态，不阻塞合并与发版**。Image2 样板图将来补进 `docs/design/mockups/` 后再重启，规则不变。
- goal 状态应从 blocked 恢复，按 Part C 顺序继续。

---

## Part C：下一阶段执行方案（给 Codex，按序执行）

全局规则与第一轮方案相同：一步一个 commit、每步跑完整验证清单（ts-check + lint + 全部 test 脚本 + build:ext）、绝不清空用户数据。

### Phase R1：修掉本轮新发现的代码问题（约 1 天）

#### R1.1 修启动新鲜度标记（修 A-1）

- `db.ts` 新增本地 key：`lastSeenCloudSnapshotUpdatedAt` + 读写函数。
- `pushLocalSnapshotToCloud` 成功后：`saveLastSeenCloudSnapshotUpdatedAt(snapshotUpdatedAt)`（即它写进云端的那个值）。
- `syncData` 成功后：`saveLastSeenCloudSnapshotUpdatedAt(它最终写进云端的 localSnapshotUpdatedAt 值)`。
- `auth-store` 的启动判定改为三态：
  ```ts
  // cloudMarker: 云端 localSnapshotUpdatedAt；lastSeen: 本地记录的上次已见云端值
  if (cloudMarker > lastSeen) return "sync";        // 别的设备推过新数据
  if (localUpdatedAt > localSyncedAt) return "push"; // 本地有未推改动
  return "none";
  ```
- 测试：`test-startup-light-sync.ts` 增加用例——(a) 本设备 push 完成后模拟重启，断言 `"none"`；(b) 模拟另一设备抬高云端 marker，断言 `"sync"`；(c) 本地有未同步编辑，断言 `"push"`。
- 验收：连续两次刷新页面（无编辑、无他端活动），第二次启动 Supabase 请求数 ≤ 1（只读 marker）。

#### R1.2 修 Wikimedia 缩略图 400（修 A-2）

- `getDisplayUrl(item, targetWidth)`：
  - 若 `item.width > 0 && item.width <= targetWidth` → 直接返回原图 URL（thumb 不能放大）。
  - 否则用 `Math.min(targetWidth, item.width - 1)` 拼 thumb。
- `wallpaper-shell.tsx` 加载降级链：`displayUrl` onerror → 尝试 `item.imageUrl`（原图）一次 → 再失败保持预览图并在设置面板错误区显示。用一个 `useState<"display"|"original"|"failed">` 实现，不要递归重试。
- 测试：`test-wallpaper-sources.ts` 加用例——width=2560、width=2000、width=0（未知）三种输入的 `getDisplayUrl` 输出断言。
- 验收：Playwright 重跑 Step 4.4 的浏览器验证流程，console 无壁纸图片 400；轮换 5 张远程壁纸全部能加载到清晰版。

#### R1.3 壁纸同步瘦身（修 A-3）

- 拆分：`WallpaperSyncedSettings = { defaultMode, themeMode, rotationInterval, enabledCategories, autoUpdate, showZoomHints, settingsUpdatedAt }`。
- `saveWallpaperPrefs` 只在这些字段实际变化时 bump `settingsUpdatedAt`；轮换/换语录只改本地字段，不 bump。
- `syncPreferences` 的 `wallpaperPrefs` key 改为只含 `WallpaperSyncedSettings`（key 可沿用，值收窄；`normalizeWallpaperPrefs` 已能兜住旧的全量值，无需数据迁移）。
- 拉取侧合并后仅覆盖这些字段，`currentWallpaperId`/recent 列表保持本设备状态。
- 测试：`test-wallpaper-sync.ts` 更新——(a) 轮换壁纸后 settingsUpdatedAt 不变；(b) 改 themeMode 后变；(c) 云端新 settings 拉下来后本地 currentWallpaperId 不被覆盖。

### Phase R2：真实环境验收（需要用户配合，代码零改动）

> 这些是目前**唯一挡在合并前面的事**，Codex 准备好操作指引，由用户执行。

#### R2.1 Supabase SQL 迁移（P0 级操作，先备份）

1. Supabase Dashboard → Table Editor → `cards`、`categories` 各导出一份 CSV 存本地。
2. SQL Editor 运行 `migrations/2026-07-07-client-updated-at.sql`。
3. 验证：`select prosrc from pg_proc where proname = 'set_updated_at';` 输出应包含 `is not distinct from`。
4. **注意：这个迁移不跑，分支上的客户端时间戳修复只完成了一半**（客户端会传 updated_at，但服务端触发器仍会覆盖它），P0-1 仍然存在。这是发版前的硬前提。

#### R2.2 双设备/双 profile 同步验收（P0-1 修复的最终验收）

用两个浏览器 profile 登录同一账号，按序执行并记录：

1. A 改一张卡片标题 → 等 B 自动同步（或手动） → B 看到新标题。
2. B 什么都不改，手动同步一次 → A 再手动同步 → **A 的标题不回滚**（这一步是旧 bug 的直接复现路径）。
3. A 拖动分类顺序 → B 同步后顺序一致。
4. A 断网编辑 2 张卡 → 恢复网络 → 自动同步后 B 能看到，且 A 无数据丢失。
5. 两端同时各改不同卡片 → 双方同步后两处修改都在。
6. 新开第三个干净 profile 登录 → 首次启动**不弹**"布局异常恢复"确认框、数据完整拉下。

#### R2.3 扩展真机验收

- `build:ext` 产物装入辅助 Chrome：新标签页远程壁纸能加载清晰版（R1.2 之后）、右键菜单/工具栏小松鼠图标、浮窗注入与目标落点。

### Phase R3：合并与发版（约半天）

#### R3.1 合并

- R1 全部完成 + R2.1/R2.2 通过后：`fix/sync-architecture` → `main`（开 PR 走 CI，绿了再合）。
- 合并后确认 GitHub Actions 在 main 上跑通一次。

#### R3.2 V1.0.4 发版

- 更新 `src/lib/app-version.ts`（V1.0.4 / 实际日期）、`extension/manifest.json`、`public/extension-dist/manifest.json`。
- 跑 `test-extension-branding.ts` 确认版本一致性。
- 构建、打 zip、发 GitHub Release（沿用 `webcollect-YYYY-MM-DD-v1.0.4` 命名），Release notes 用人话概括：同步不再回滚旧数据、打开速度、壁纸远程加载、去系统弹窗。
- 更新 `AGD.md` 的版本与 Release 直链。

### Phase R4：观察期后的 backlog（按优先级排列，本轮不做）

1. **守卫简化**（A-5）：双设备稳定两周后，逐个评估删除 `localLooksMuchSmallerThanCloud`、collapse guard、`cleanDefaultSectionDuplicateCards` 的云行删除路径；每删一个都要有 test-sync-merge 用例护住。
2. **writePreferences 差量写入**（A-4）：对比 cloudPrefsMap，只 upsert 变化的 key。
3. **warehouse 数据迁出 user_preferences**：建独立表，摆脱"每次同步整个仓库 JSON"。
4. **UI 还原度重启**（原 Phase 4.1/4.2/4.5）：等用户把 Image2 样板图放进 `docs/design/mockups/` 后按原方案执行；其中 4.2 的"双端 CSS 收敛为 shared.css"不依赖样板图，可以在任何空档独立做。
5. **元数据抽样测试集**：目标页/社交外链/GitHub/文档站/YouTube 各类 URL 的 title/description 提取金样本。
6. **冷启动性能计量**：在 CI 或本地脚本里加一个 Playwright 启动计时（首屏可交互时间），防止性能回退无感知。

---

## Part D：给下一个 Codex 线程的一句话入口

> 读 `docs/audit/claude-fable-followup-plan-2026-07-07.md` 的 Part C，从 R1.1 开始按序执行；UI 还原度任务已由用户决定暂缓，goal 不再 blocked；R2 需要用户操作时把指引写清楚再停下等待。

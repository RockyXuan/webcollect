# WebCollect 代码审查报告（Claude Fable 5）

审查日期：2026-07-07
审查基线：`main` @ `a779f26`（V1.0.3）
审查范围：数据同步 / 刷新 / 缓存、性能、壁纸远程下载与同步、UI 还原度、工程质量
配套文档：`docs/audit/claude-fable-remediation-plan-2026-07-07.md`（给 Codex 的分步执行方案）

## 0. 基线验证结果（本次审查实测）

| 检查 | 结果 |
|---|---|
| `pnpm ts-check` | 通过，0 错误 |
| `pnpm lint` | 0 错误，6 警告（未用变量、`<img>` 用法） |
| 6 个测试脚本（floating-capture × 4、translation、branding） | 全部通过 |
| `pnpm build:ext` | 通过 |

结论：工程基线是绿的。用户感受到的问题不是"编译坏了"，而是**架构层面的同步设计缺陷 + 启动链路过重 + 壁纸管线产出不足**。以下按严重度排序。

---

## 1. P0：同步与数据安全（用户"同步反复修不稳"的真正根因）

### P0-1 跨设备/跨标签丢改动：`updated_at` 触发器 + 全量推送 + LWW 合并的组合缺陷

这是整个项目最核心的缺陷，之前所有"守卫补丁"都是在补偿它。

三个事实叠加：

1. `src/storage/database/supabase-init.sql:91-99`：`cards`/`categories` 表有 `BEFORE UPDATE` 触发器，**任何 upsert（即使内容一字未改）都会把服务端 `updated_at` 刷成 now()**。
2. `src/lib/sync.ts` 的 `syncData` 与 `pushLocalSnapshotToCloud`：每次同步**全量 upsert 所有分类和所有卡片**（`upsertCategoriesWithParents`、`upsertCardsInChunks`），不区分是否有变化。
3. `mergeByTimestamp`（sync.ts:391）用**客户端时钟的 `updatedAt`** 和**服务端时钟的 `updated_at`** 直接比大小做 Last-Write-Wins。

失败场景（可稳定复现）：

- 设备 A 在 T1 修改了一张卡片。
- 设备 B（什么都没改）在 T2 跑了一次定时同步 → 云端**所有行**的 `updated_at` 被刷成 T2。
- 设备 A 在 T3 同步 → 云端那份**旧内容**（时间戳 T2 > T1）赢过本地新改动 → **A 的修改被静默回滚**。
- 单设备下，客户端与 Supabase 服务器的时钟偏差也会产生同样的回滚。

这精确解释了长期存在的"改好了又变回去""同步后布局回退"症状。`localLooksMuchSmallerThanCloud`、collapse guard、richer-structure guard 等十几个启发式守卫都是这个根因的下游补偿，越补越复杂。

### P0-2 `emergency-restore.ts` 启动时自动回档，启发式硬编码了用户个人数据特征

`src/lib/emergency-restore.ts:69-133`：

- `hasKnownCryptoGroupsInHome` 把 `"zksync"、"layerzero"、"defi"、"coin"、"rwa"、"stock"` 等**当前用户的具体分组名**硬编码进产品代码，作为"数据坏了"的判据。
- `currentLooksCollapsed` 认为"主页出现 crypto 分类且 HODL 分项卡片 < 8"就是数据塌了 → **每次启动（web + 扩展，先于 loadData）自动用旧快照覆盖当前数据**，并设置 `EMERGENCY_RESTORE_PENDING_PUSH` → 下一次同步把旧快照**推上云端**。
- `isHealthySnapshot` 要求 ≥40 卡片、≥20 分类、≥3 分项——这是按当前这份数据的形状写死的。
- 换新浏览器/新设备时 localStorage 无 marker → 首次启动**强制**尝试回档。

失败场景：用户哪天主动把某个币类分组挪到主页、或整理数据使数量低于阈值 → 下次打开页面被静默回档到旧快照，且旧快照随后覆盖云端。**这是"设计出来的数据丢失"**，也是"改了很多遍都没改好"体感的第二大来源。

### P0-3 同步窗口内的本地修改被标记为"已同步"

`sync.ts:1425`：`saveLocalSnapshotSyncedAt(Math.max(localSnapshotUpdatedAt, cloudSnapshotUpdatedAt, Date.now()))`。

一次全量同步要跑 10 秒以上（见 P1-1），期间用户的编辑 `updatedAt` 落在窗口内 < Date.now() → 同步结束后 `runAutoSyncPush` 判定 `localUpdatedAt <= localSyncedAt` → **这些编辑永远不会被推送**，直到用户碰巧再改点别的。

### P0-4 `syncData` ↔ `pushLocalSnapshotToCloud` 相互递归无深度限制

`pushLocalSnapshotToCloud` 有 4 个分支会调 `syncData`（sync.ts:1518、1549、1554、1568、1589），`syncData` 在 `localChangedDuringCloudLoad` 时调回 `pushLocalSnapshotToCloud`（sync.ts:1213）。另一个标签页持续写本地时可以来回打乒乓，没有 single-flight 锁、没有递归深度上限。

### P0-5 死代码：单条推送函数从未被调用且吞错误

`pushCardToCloud` / `pushCategoryToCloud` / `deleteCardFromCloud` / `deleteCategoryFromCloud`（sync.ts:2003-2045）在整个代码库无调用点，且错误只 console.error。应删除，避免误导后续开发（文件头注释描述的"on data change push single item"架构实际不存在）。

---

## 2. P1：性能（"网页打开非常慢、刷新迟钝"的根因链）

### PERF-1 每次打开页面都跑一次全量双向同步，且串行 N+1 请求

启动链路：`page.tsx init` → `auth-store.initialize` → `triggerSync` → **完整 `syncData`**。其中：

- `upsertCategoriesWithParents`（sync.ts:286-307）：**每个分类一次串行 upsert**。30 个分类 × ~150ms RTT ≈ 4.5 秒。
- `writePreferences`(sync.ts:1961-1999)：**每个 key 先 SELECT 再 UPDATE/INSERT，串行**。约 19 个 key × 2 次请求 ≈ 38 次串行往返 ≈ 6 秒。而 `user_preferences` 表明明有 `unique(user_id, key)` 约束，一次 `upsert(..., { onConflict: "user_id,key" })` 传数组就能全部搞定。
- 加上全量卡片 chunk 推送、`createLocalDataSnapshot`、同步完成后**再跑一次 `loadData`** 整页重渲染。

保守估算一次同步 10-30 秒。这就是"打开很慢、转圈很久、同步状态一直 syncing"的直接原因。

### PERF-2 高频重型后台任务

- `AUTO_SYNC_INTERVAL_MS = 3 分钟`：每 3 分钟一次**全量** push（auth-store.ts:85,300-308）。
- 每次本地修改 10 秒后：`scheduleLocalSafetySnapshot` 创建本地快照并 `saveCloudWorkspaceSnapshot` **把整个工作区（全部卡片+分类+仓库+回收站）作为一行 JSON 上传云端**（auth-store.ts:240-257）。拖拽整理十分钟 = 反复上传全库。
- 每次本地修改 5 分钟后：又一次全量 push（AUTO_SYNC_MAX_DELAY_MS）。

### PERF-3 `loadData` 启动修复管线过重（store.ts:544-747）

每次启动/每次同步后都要跑 10+ 道修复迁移：workspaceReset 过滤 → normalizeSectionName → section 迁移 → `repairMainDataVisibility` → `localizeCardDescriptions` → hidden 清理 → favicon 迁移 → `ensureSectionInboxes` → `removeRecoveredMainData` → isParent 迁移 → `ensureParentDirectCardsAreVisible` → `pruneEmptyDuplicateCategories` + `pruneEmptySeedTemplates`。每道命中都触发一次**全量数组 IndexedDB 重写**，且中途两次 `set()` 造成两次整页渲染。这些绝大多数应该是**带版本号的一次性迁移**，而不是每次启动都跑的"体检"。

### PERF-4 IndexedDB 全量数组读改写

`db.ts`：所有卡片存一个 key、所有分类存一个 key。任何一次编辑 = 读全量 → 改一条 → 写全量。store.ts 每个 action 完成后又 `set({ cards: await getCards() })` 再读一遍全量。数据量增长后每次拖拽都是双倍全量序列化。

### PERF-5 渲染层

- `sortable-grid.tsx` 1706 行，**没有任何 React.memo**；store 任何字段变化 → 整面收藏墙全部重渲染。拖拽时每帧都在重渲染大树，这是"拖拽迟钝"的直接原因。
- `globals.css` 23 处 + `extension.css` 19 处 `backdrop-filter` 玻璃层叠在全屏壁纸上，GPU 合成开销大，低端机上滚动/拖拽掉帧。
- `hot-recommendation.tsx:839` 每次打开页面自动对全部推荐站点发一次 `/api/check-safety` 网络请求。
- 首页整树 `"use client"`，无任何服务端渲染/骨架，首屏等 JS。

---

## 3. P1：壁纸专项（"远程下载/线上同步一直不扎实"的根因）

### WP-1 远程源实际产出极少，"刷新了但看起来没刷新"是真的

`wallpaper-sources.ts:384-517`：

- 实际只接了两个源：NASA 和 Wikimedia。**NASA 只在启用 space 分类时才请求，而默认分类不含 space** → 默认配置下 NASA 从不工作。
- NASA 映射要求 `links[0].width/height` 或 `data[0].width/height`（sources.ts:435-437），但 NASA images API 的搜索结果**通常不含这两个字段** → 即使启用 space，绝大多数条目因 `width < 3000` 被丢弃。
- Wikimedia 每次只搜 `gsrlimit: 12` 条，再过 `isZoomWallpaperCandidate`（≥3000×1600、比例 1.45-2.4、许可、非技术图、必须原图 URL）后**一轮通常只剩 0-3 张**。
- `WALLPAPER_REMOTE_LIMIT = 24` 实际上永远填不满；6 小时才刷新一次。用户看到"总是那几张、感觉全是本地图"完全符合代码行为。
- `wallpaper-types.ts` 声明了 `pexels/pixabay/tmdb/met/artic/smithsonian` 等 provider 类型，**一个都没实现**，是误导性死类型。

### WP-2 强制加载全尺寸原图，几十上百 MB

`isOriginalSizedImageUrl`（sources.ts:128-133）**显式拒绝 /thumb/ 缩略图**，`imageUrl` 用 Wikimedia 原始文件。精选图原图普遍 20-200MB（curated 列表里的 `NGC_3372a-full.jpg` 是著名的超大文件）。展示层（wallpaper-shell.tsx:165-183）等原图 onload 才切换 → 一般带宽下 30 秒起步甚至永远加载不完 → 用户永远停在 1600px 模糊预览或本地打包图。`cacheWallpaperImages` 又用 `cache: "reload"` + no-cors **再下载一遍同样的原图**，双倍带宽，opaque 响应无法校验成功与否。

正确做法：展示用 Wikimedia thumb 管线（如 2560px），原图只留在"查看来源"链接里。

### WP-3 "每次打开换一张"是死选项

设置对话框提供 `rotationInterval: "open"`（wallpaper-settings-dialog.tsx:35），但 `getRotationMs("open")` 返回 null，且 `initialize()` 优先保持 `currentWallpaperId` 不变 → 该选项选了等于没选。

### WP-4 壁纸完全不参与云同步

`wallpaperPrefs`/`wallpaperLibrary` 只存在本地 localforage 实例（wallpaper-db.ts），`syncPreferences` 的 key 列表里没有任何壁纸相关项。**跨设备壁纸同步功能不存在**，用户的感知（"线上同步好像一直没做好"）是事实，不是 bug 而是缺失。

### WP-5 刷新状态不可见

刷新失败只写进 store.error，设置面板不展示 lastRemoteRefreshAt、远程图数量、当前是远程图还是本地图。用户无法判断"远程到底跑没跑"，只能靠猜。

---

## 4. P1：UI 还原度与交互

### UI-1 设计基准没有落库，"八成还原度"无法收敛

用户用 Image2 生成的样板图**不在仓库里**（`docs/audit/user-screenshot-index-2026-07-07.md` 明确说原始截图临时文件已过期，只剩文字索引；`assets/image.png` 是旧版橙色 UI 的截图，不是设计稿）。`WEB_COLLECT_UI_REDESIGN_BRIEF.md` 只是方向性 brief，没有 design token（色值/圆角/模糊/阴影/间距/字号）、没有组件状态规范。**没有基准图和 token 表，任何 agent 做出来都只能是"大概像"**。这是还原度问题的第一因，必须先补基准再谈还原。

### UI-2 系统弹窗回归（违反项目自己定的底线）

- `src/components/bookmark/bookmark-bar.tsx:122-124`：编辑收藏栏标签用了**两个连续的 `window.prompt`**（改名 + 输入 "icon / label / both" 选显示模式）——这正是交接文档里承诺已清除的交互模式。
- `user-menu.tsx:283-293`（双 confirm + prompt 输入"清空"）、`top-nav.tsx:430-459`（alert）、`local-snapshot-dialog.tsx:135,156`（confirm）、`extension/src/newtab-app.tsx:331-343` 与 `warehouse/page.tsx:126`（confirm/alert）。危险操作确认可以保守，但应统一为项目内 AlertDialog。

### UI-3 组件与样式结构

- `sortable-grid.tsx` 1706 行承载了 DnD 意图解析、resize、布局数学、4 个 sortable 块组件，无 memo，事件边界复杂——这是拖拽回归反复出现的结构性原因。
- `globals.css`（2212 行）与 `extension/src/extension.css`（2000 行）双维护、近似拷贝，历史上"改一边漏一边"必然重演。

### UI-4 杂项

- 设置项"每次打开换一张"无实现（见 WP-3）——用户点了没反应属于 UI 信任损伤。
- `sync.ts`/`auth-store.ts` 等文件存在大量 mojibake 注释（`鈹€`、`涓婚〉` 等编码损坏字符），说明文件曾被错误编码保存过；`normalizeSectionName`（store.ts:68）里那组"损坏主页名"就是这次事故的产物。不影响运行但污染代码库。

---

## 5. P2：工程质量

1. 死代码：sync.ts 四个单条推送函数、auth-store.ts `legacyLoginWithGoogleExtension`、壁纸未实现 provider 类型。
2. lint 6 个警告（unused vars、`<img>`）。
3. 无 CI：6 个测试脚本只能靠人记得跑；应加 GitHub Actions。
4. 文档堆积：根目录 8 个交接类 md + docs/，多处过期事实（如 sync.ts 头注释描述的"单条推送"架构并不存在）。
5. `writePreferences` 逐 key select+write 的模式除慢外，还导致备份写入（`writeSyncBackup`）在主同步失败时状态不一致。

---

## 6. 哪些是可靠的、哪些不要动

可靠、验证过的部分（不要重写）：

- 浮窗收集三段链路（content script → background queue → store drain）有测试覆盖且全部通过；目标解析 fail-safe 逻辑成立。
- 本地快照系统（local-snapshots.ts）本身节流合理（90 秒同因节流），回档功能可用。
- 描述翻译、元数据提取的规则集有测试基线。
- 扩展构建、品牌资源管线正常。

明确不要做的事：

- 不要重写 store/sync 的数据模型或 IndexedDB schema（修的是同步协议和调度，不是存储格式）。
- 不要清空/重置任何用户数据；所有云端行删除必须先有快照。
- 不要在修同步之前动 UI（先把数据层修稳，UI 才有意义）。
- 不要一次性大重构 `sortable-grid.tsx`（分阶段拆）。

## 7. 必须在真实环境人工复验的项

1. 双设备（或双浏览器 profile）同步：A 改 → B 同步 → A 再同步，确认 A 的修改不回滚（P0-1 修复后的验收）。
2. 真实 Chrome 扩展：新标签页远程壁纸加载、右键菜单图标、浮窗注入。
3. 断网/弱网下壁纸 fallback 与恢复。
4. 新设备首次登录（无 localStorage marker）不触发意外回档（P0-2 修复后的验收）。

# WebCollect 整改执行方案（Claude Fable 5 → Codex GPT 5.5 XHigh）

日期：2026-07-07
前置阅读：`docs/audit/claude-fable-code-review-2026-07-07.md`（问题编号 P0-x / PERF-x / WP-x / UI-x 均指向该报告）
执行原则：**按阶段顺序做，一个 Step 一个 commit，每个 Step 结束跑一遍验证清单，全绿才进入下一步。禁止跨阶段合并大 diff。**

## 全局规则（每一步都适用）

1. 每步开始前 `git status -sb` 必须干净；每步一个独立 commit，消息格式 `fix(sync): ...` / `perf(boot): ...` / `feat(wallpaper): ...`。
2. 每步结束必跑：
   ```bash
   corepack pnpm@9.0.0 ts-check
   corepack pnpm@9.0.0 lint
   node --import tsx scripts/test-floating-capture-targets.ts
   node --import tsx scripts/test-floating-capture-drain.ts
   node --import tsx scripts/test-floating-capture-health.ts
   node --import tsx scripts/test-floating-capture-metadata.ts
   node --import tsx scripts/test-description-translation.ts
   node --import tsx scripts/test-extension-branding.ts
   corepack pnpm@9.0.0 build:ext
   ```
3. 绝不清空/覆盖用户 IndexedDB、Supabase、扩展本地数据；任何会删除云端行的改动，先写云端备份再删。
4. 涉及 Supabase schema 的改动写成**增量 SQL 迁移文件**放 `src/storage/database/migrations/`，不改 `supabase-init.sql` 的历史语义（新装用户仍用 init，老用户跑迁移）。
5. UI 阶段（Phase 4）之前不碰任何 CSS / 组件视觉。

---

## Phase 0：安全网（半天）

### Step 0.1 建立整改分支与云端备份
- 从 `main` 切 `fix/sync-architecture`。
- 在真实账号里先手动触发一次"手动保存版本"（云端 workspace snapshot），并导出一份本地 JSON 备份，路径记录进 PR 描述。

### Step 0.2 新增同步单元测试骨架 `scripts/test-sync-merge.ts`
- 用假的 Supabase client（内存 Map 模拟 `from().select/upsert/delete`）驱动 `syncData` / `pushLocalSnapshotToCloud`。
- 先写 3 个用例把**当前行为**固定下来（golden test）：本地新增推送、云端新增拉取、时间戳冲突取新。
- 这个脚本加进上面"每步必跑"清单。
- 验收：脚本可独立运行退出码 0。

---

## Phase 1：修同步正确性（P0，约 2-3 天）——最高优先级

### Step 1.1 停止无差别全量推送：引入 dirty 追踪（修 P0-1 的一半）
- 文件：`src/lib/db.ts`、`src/lib/sync.ts`。
- 在 `db.ts` 增加一个轻量 dirty 集合：`markDirty(kind: "card"|"category", id)`，由 `saveCards`/`saveCategories` 的调用方（store 各 action）在**明确修改了哪些条目**时登记；持久化在 localforage key `syncDirtySets`。同步成功后清空对应 id。
- `syncData` / `pushLocalSnapshotToCloud` 推送时：
  - 只 upsert `dirty ∪ localOnly ∪ localToPush` 的行；
  - **内容与云端逐字段相等的行一律不 upsert**（合并阶段已有双方数据，直接内存 diff 即可，零额外请求）。
- 验收（test-sync-merge.ts 加用例）：本地无改动时执行 syncData，模拟 client 记录到的 upsert 次数为 **0**。

### Step 1.2 `updated_at` 改为客户端显式提供（修 P0-1 的另一半）
- 新增迁移 `migrations/2026-07-xx-client-updated-at.sql`：
  ```sql
  create or replace function public.set_updated_at()
  returns trigger language plpgsql set search_path = '' as $$
  begin
    -- 只在客户端没有显式提供新 updated_at 时才服务端补时间
    if new.updated_at is not distinct from old.updated_at then
      new.updated_at = now();
    end if;
    return new;
  end; $$;
  ```
- `sync.ts` 的 `localToCloudCard` / `localToCloudCategory` 增加 `updated_at: new Date(c.updatedAt || Date.now()).toISOString()`，让每行的时间戳跟随**真正编辑它的那台设备**，而不是最后一次同步的服务器时间。
- 同时把 `mergeByTimestamp` 的冲突相等分支行为写进注释（本地优先）。
- 验收：test-sync-merge.ts 用例——设备 B 全量同步后，设备 A 早前的本地编辑在 A 下一次同步时**不被回滚**（模拟两套 client 状态跑一遍 P0-1 的失败场景，断言修改保留）。

### Step 1.3 `writePreferences` 改为单次批量 upsert（修 PERF-1 主要部分）
- `user_preferences` 已有 `unique(user_id, key)`，直接：
  ```ts
  await client.from("user_preferences").upsert(rows, { onConflict: "user_id,key" });
  ```
  一次请求写全部 key，删除逐 key SELECT+UPDATE/INSERT 的循环。
- `upsertCategoriesWithParents` 改为按深度分层，**每层一次批量 upsert**（同层无父子依赖），替代逐行串行。
- 验收：模拟 client 断言一次 syncData 的总请求数 ≤ 8（3 读 + 分类分层写 ≤2 + 卡片 chunk + 偏好 1 + 备份 1）。

### Step 1.4 修同步完成时间戳记账（修 P0-3）
- `syncData` / `pushLocalSnapshotToCloud`：在**开始加载本地数据的那一刻**记下 `syncStartLocalUpdatedAt`，结束时 `saveLocalSnapshotSyncedAt(syncStartLocalUpdatedAt)`（不是 Date.now()）。同步期间发生的新修改自然保持 `updatedAt > syncedAt`，会被下一轮推送。
- 验收：test-sync-merge.ts 用例——同步进行中注入一次本地修改，同步结束后断言 `getLocalSnapshotUpdatedAt() > getLocalSnapshotSyncedAt()`。

### Step 1.5 single-flight 锁 + 递归深度限制（修 P0-4）
- `sync.ts` 模块级：`let syncInFlight: Promise<void> | null` + `depth` 参数（最大 2，超过直接 return 并 console.warn）。`syncData` 与 `pushLocalSnapshotToCloud` 互调时传 `depth + 1`。
- 验收：用例——构造"另一标签页持续写本地"的时序，断言互调最多发生 2 层后收敛，无死循环。

### Step 1.6 拆除 emergency-restore 的自动回档（修 P0-2）
- `restoreLatestHealthyWorkspaceIfNeeded` 改为**只检测、不动作**：返回检测结果，由 UI 弹项目内 AlertDialog 问用户"检测到当前布局可能异常，是否从 X 月 X 日的快照恢复？"，用户确认才恢复；默认不恢复、不设置 pending push。
- 删除 `hasKnownCryptoGroupsInHome` 及所有硬编码个人分组名的判据；删除 `EMERGENCY_RESTORE_FORCE_VERSION` 强制逻辑。
- 保留：快照数据本身、手动回档入口。
- 验收：ts-check 通过；启动路径（page.tsx / newtab-app.tsx）在无异常时零额外 IndexedDB 写。

### Step 1.7 删除死代码
- 删 `pushCardToCloud` / `pushCategoryToCloud` / `deleteCardFromCloud` / `deleteCategoryFromCloud`、`legacyLoginWithGoogleExtension`；更新 sync.ts 头注释使其描述真实架构。
- 顺手清 lint 6 个警告。
- 验收：lint 0 警告。

### Phase 1 整体人工验收（用户配合，两个浏览器 profile）
1. A 改卡片标题 → B 手动同步 → A 手动同步 → A 的标题不回滚。
2. B 拖动分类顺序 → A 同步后看到新顺序。
3. 断网时编辑 → 恢复网络 → 自动同步成功且无数据丢失。

---

## Phase 2：修性能（PERF，约 2 天）

### Step 2.1 启动不再全量双向同步
- `auth-store.triggerSync`：登录恢复时先做**轻量新鲜度检查**——只读 `user_preferences` 里的 `localSnapshotUpdatedAt`（1 个请求），与本地比较：
  - 云端更新 → 跑一次 `syncData`（此时已是增量推送，成本低）；
  - 本地更新 → 只 `pushLocalSnapshotToCloud`；
  - 相等 → 什么都不做，直接标记 success。
- 同步放到 `requestIdleCallback`/`setTimeout(0)` 之后，绝不阻塞首屏。
- 验收：本地与云端一致时，打开页面产生的 Supabase 请求 ≤ 2；首屏渲染不等待任何网络。

### Step 2.2 `loadData` 修复管线改为版本化一次性迁移
- 新增 `db.ts`：`getDataSchemaVersion()/saveDataSchemaVersion()`（localforage key）。
- 把 store.ts loadData 里的这些步骤移入 `src/lib/migrations.ts` 的 `runLocalMigrations()`，按版本号只跑一次：favicon 迁移、isParent 迁移、section 迁移、normalizeSectionName、removeRecoveredMainData、pruneEmptySeedTemplates。
- loadData 保留的常驻逻辑只剩：读数据、过期 hidden 清理、`ensureSectionInboxes`（轻量、幂等、纯内存判断后按需写）。
- loadData 全程只允许**一次** `set()` 最终态（消除双渲染）。
- 验收：第二次启动（迁移已跑过）loadData 内 IndexedDB 写入次数为 0（可在 test 中用 localforage mock 计数）；行为用例：现有 6 个测试脚本全绿。

### Step 2.3 降低后台任务频率与体量
- `AUTO_SYNC_INTERVAL_MS` 3 分钟 → 10 分钟（有 local-change 触发的 5 分钟推送兜底在，间隔轮询只是保险）。
- `scheduleLocalSafetySnapshot`：云端 workspace snapshot 上传从"每次修改后 10 秒"改为**每 30 分钟最多一次**（本地快照保持现频率，只降云端上传频率）；跳过与上次上传内容 hash 相同的快照。
- 验收：连续拖拽 20 次卡片，网络面板中 workspace_snapshots 写入 ≤ 1 次。

### Step 2.4 渲染层减负
- store.ts 各 mutation 不再 `set({ cards: await getCards() })` 全量回读——直接用内存中已计算好的数组 `set`（IndexedDB 写继续 await）。
- `sortable-grid.tsx`：为 `SortableCategoryBlock` / `SortableSubGroupBlock` / `SortableUngroupedBlock` / `SortableCard` 套 `React.memo`，props 收敛为原始值/稳定引用；`useAppStore` 订阅改为细粒度 selector + `useShallow`。
- `hot-recommendation.tsx` 的自动安全检查改为首次滚动进入视口时再触发（IntersectionObserver），不在启动时抢带宽。
- 验收：React DevTools Profiler 手测——单张卡片改名只重渲染其所属分组子树；拖拽 FPS 目测顺滑。此步**不改任何视觉样式**。

---

## Phase 3：壁纸专项（WP，约 2 天）

### Step 3.1 展示层改用缩略图管线（修 WP-2，一步见效）
- `wallpaper-sources.ts`：新增 `getDisplayUrl(item, targetWidth = 2560)` —— Wikimedia 走 `/thumb/` 管线拼 2560px URL（`getFastPreviewUrl` 已有同样的拼法，抽出来复用）；本地打包图原样返回。
- `wallpaper-shell.tsx` 的 `imageStyle` 与 `cacheWallpaperImages` 全部改用 `getDisplayUrl`；原图 URL 只保留在 `sourceUrl`（"查看来源"）。
- `cacheWallpaperImages` 去掉 `cache: "reload"`（改默认缓存策略），避免重复下载。
- 验收：网络面板确认加载的是 `2560px-*.jpg`（几百 KB~2MB），原图 URL 不再出现；壁纸 3 秒内清晰。

### Step 3.2 提升远程产出（修 WP-1）
- Wikimedia：`gsrlimit` 12 → 30；每个分类独立请求（当前是拼一个 OR 查询），`Promise.allSettled` 并行，合并去重。
- NASA：改用 asset manifest 补维度（搜索结果无 width/height 时请求 `collection.href` 拿原图，或降低 space 图的尺寸门槛到 2000×1200），或干脆在默认分类不含 space 时删掉 NASA 分支 + 死 provider 类型（`pexels/pixabay/tmdb/met/artic/smithsonian` 从 `wallpaper-types.ts` 移除）。二选一，倾向后者（诚实优于摆设）。
- 由于展示已走缩略图（Step 3.1），`isOriginalSizedImageUrl` 的"必须原图"约束可以放宽为"元数据宽高达标即可"，让更多候选存活。
- 验收：写 `scripts/test-wallpaper-sources.ts`（mock fetch 返回真实 API 样例 JSON），断言一轮刷新产出 ≥ 10 张合格远程图；真机手测连续点"立即更新壁纸"5 次，出现 ≥ 3 张此前没见过的图。

### Step 3.3 实现"每次打开换一张"（修 WP-3）
- `wallpaper-store.initialize`：当 `prefs.rotationInterval === "open"` 时，不保留 `currentWallpaperId`，直接 `pickWallpaperAvoidingRecent` 选新图。
- 验收：设置为"每次打开换一张"后连开 5 个新标签页，5 张不同。

### Step 3.4 壁纸偏好接入云同步（修 WP-4）
- `syncPreferences` 增加一个 key：`wallpaperPrefs`（只同步 prefs：themeMode/rotationInterval/enabledCategories/autoUpdate/currentWallpaperId 等；**不同步 library**，各设备自己抓图）。
- 合并规则用 prefs 里已有的 `updatedAt` 字段做 LWW（wallpaper-db.ts 的 `saveWallpaperPrefs` 已经在写 updatedAt）。
- 拉取侧：`syncData` 结束后若云端 prefs 更新，写回 wallpaper-db 并让 wallpaper-store 重新 initialize。
- 验收：设备 A 改主题模式为"自然" → 设备 B 同步后设置面板显示"自然"。

### Step 3.5 刷新状态可见（修 WP-5）
- `wallpaper-settings-dialog.tsx` 增加只读状态行：上次远程刷新时间、库中远程图/本地图数量、最近一次刷新错误（若有）。当前壁纸角标显示"远程/本地"。
- 验收：断网点刷新 → 面板显示错误信息且壁纸回退本地图；联网点刷新 → 时间戳更新。

### Phase 3 整体验收（对照交接文档第 3 节的验收标准）
断网稳定 fallback ✓；联网能拉到可观察的新远程图 ✓；刷新不长期重复旧图 ✓；偏好跨设备同步 ✓；扩展新标签页远程图可加载（真实 Chrome 验证）✓。

---

## Phase 4：UI 还原度（UI，约 2-3 天，需用户参与）

### Step 4.0 【需要用户】补设计基准
- 请用户把 Image2 样板图重新导出，放入 `docs/design/mockups/`（命名 `YYYY-MM-DD-screen-name.png`）。**没有这一步，"还原度"没有客观标尺，后续只能按 brief 意译。**

### Step 4.1 建立 design token 单一来源
- 新建 `src/app/tokens.css`（CSS 变量：品牌色阶、玻璃表面色/边框/模糊半径、圆角档位、阴影档位、间距刻度、字号刻度），从样板图取值；`globals.css` 与 `extension.css` 中所有硬编码色值/圆角/blur 改引用变量。
- 验收：`grep -c "backdrop-filter" ` 数量不增；tokens.css 是唯一定义色值的地方（抽查 10 处）。

### Step 4.2 Web/扩展样式收敛为单一源
- 把两份 CSS 的公共部分抽成 `src/styles/shared.css`，构建时 web 与扩展各自 import + 各自的少量平台覆盖文件。以后改一处两端同步。
- 验收：双端视觉截图对比无回归；`build:ext` 通过。

### Step 4.3 清除系统弹窗残留（修 UI-2）
- `bookmark-bar.tsx` 双 prompt → 项目内 Popover 行内编辑（文本框 + icon/label/both 三选段控件）。
- `newtab-app.tsx` / `warehouse/page.tsx` 的 confirm/alert → AlertDialog / toast。
- `user-menu.tsx` 清空确认保留三重确认强度，但用 AlertDialog + 输入框实现。
- 验收：`grep -rn "window.prompt\|window.confirm\|window.alert" src extension/src` 结果为 0。

### Step 4.4 拆分 `sortable-grid.tsx`
- 按已有组件边界拆文件：`sortable-grid/index.tsx`（DnD context + 意图解析）、`category-block.tsx`、`sub-group-block.tsx`、`ungrouped-block.tsx`、`sortable-card.tsx`、`layout-math.ts`（纯函数全部移入，补单测脚本 `scripts/test-grid-layout.ts`）。**只移动不改逻辑**，diff 用 `git diff --color-moved` 自查。
- 验收：6 个测试脚本 + ts-check 全绿；拖拽/resize 手测正常。

### Step 4.5 对照样板图逐屏走查
- 按 mockup 逐屏比对：首页收藏墙、添加网页弹窗、账户面板、推荐区、壁纸设置。每屏截图存 `docs/audit/screenshots/2026-07-xx-*.png`，在 PR 里放"样板 vs 实现"对照表，偏差 >5% 的项列 TODO。
- 宽屏（≥1920）与窄桌面（~1280）各一轮。
- 验收：用户确认还原度；截图落库。

---

## Phase 5：工程护栏（P2，半天）

### Step 5.1 GitHub Actions CI
- `.github/workflows/ci.yml`：push/PR 到 main 时跑 ts-check、lint、全部测试脚本、build:ext。npm registry 注意 CI 环境用官方源（仓库 `.npmrc` 指向 npmmirror，CI 里加 `--registry` 覆盖）。

### Step 5.2 文档收口
- 更新 `AGD.md`：加入本报告与本方案的链接；把"已修复"状态同步进 `claude-code-review-handoff` 的表格。
- 修复 sync.ts / auth-store.ts 的 mojibake 注释（顺手，不单独 commit）。

### Step 5.3 版本发布
- 全部完成后升 `V1.0.4`（`src/lib/app-version.ts` + manifest × 2 + release 脚本），构建扩展 zip，发 GitHub Release。

---

## 时序与依赖总览

```
Phase 0 (安全网)
  └─ Phase 1 (同步正确性) ← 必须最先，其他一切的前提
       └─ Phase 2 (性能)   ← 依赖 1.1/1.3 的增量推送
       └─ Phase 3 (壁纸)   ← 独立，可与 Phase 2 并行
            └─ Phase 4 (UI) ← 依赖用户补设计稿 (4.0)
                 └─ Phase 5 (护栏+发版)
```

## 风险与回退

- 每个 Phase 完成后推分支并在真实账号验证，验证通过才合入 main。
- Step 1.2 的 SQL 迁移是唯一的服务端改动：迁移前在 Supabase Dashboard 里对 `cards`/`categories` 各导出一份 CSV。回退 = 重跑旧版 `set_updated_at` 定义。
- 如果 Phase 1 后用户仍报"数据回跳"，先查 `workspace_snapshots` 里最近的系统快照对比定位，不要盲改。

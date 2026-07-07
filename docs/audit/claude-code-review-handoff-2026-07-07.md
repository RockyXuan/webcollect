# WebCollect Claude Code Review 交接回顾

更新时间：2026-07-07
用途：让 Claude Fable 做代码审查前，先快速理解项目需求、实现进度、遗留问题、反复踩坑和自评缺口。
当前基线：`main`，最新功能版本 `V1.0.3 / 2026年7月2日`，最新文档提交前基线 `3caf399 docs: add full project audit handoff`。

## 2026-07-07 Fable 整改执行更新

当前执行分支：`fix/sync-architecture`。

已按 `docs/audit/claude-fable-remediation-plan-2026-07-07.md` 完成并逐步提交：

- Phase 1：同步正确性。包括 dirty row 增量写、客户端时间戳保留、偏好批量 upsert、pending local change guard、sync single-flight、emergency restore 改为用户确认。
- Phase 2：启动和性能。包括启动轻量新鲜度检查、版本化本地迁移、后台快照节流、store 写后避免全量回读、Sortable memo 和推荐区懒安全扫描。
- Phase 3：壁纸。包括 Wikimedia 2560px thumb 展示、远程刷新扩大产出、每次打开换图、`wallpaperPrefs` 云同步、刷新状态可见。
- Phase 4.0：已创建 `docs/design/mockups/`，等待用户补 Image2 样板图。
- Phase 4.3：已清除 `src` 与 `extension/src` 中的 `window.prompt` / `window.confirm` / `window.alert` 以及裸 `prompt/confirm/alert`。
- Phase 4.4：已将原 `src/components/layout/sortable-grid.tsx` 拆成 `src/components/layout/sortable-grid/` 目录模块，并补 `scripts/test-grid-layout.ts`；已用 Playwright 验证编辑模式、误删防护、resize 和分组拖拽排序。
- Phase 5.1：已新增 `.github/workflows/ci.yml`，main push/PR 自动跑 ts-check、lint、全部脚本测试和扩展构建。

当前仍未完成 / 仍需 Claude 继续审查：

- Phase 4.1、4.2、4.5 依赖用户重新提供设计样板图，不能无标尺抽 token 或做还原度对比。
- Phase 5.3 `V1.0.4` 版本升级、扩展 zip 和 GitHub Release 尚未发布。
- Supabase SQL 触发器迁移和双设备真实账号验收仍需用户备份后人工确认。

## 0. Claude 审查目标

请 Claude 不要直接重构。先做 Code Review，输出：

1. 哪些实现是可靠的，哪些只是补丁式实现。
2. P0 / P1 / P2 风险排序。
3. 每个问题的建议改法、涉及文件、验证方式。
4. 哪些代码不应改，避免破坏用户数据。
5. 哪些问题必须在真实 Chrome 扩展和真实账号里人工复验。

## 1. 需求实现情况

| 需求 | 当前进度 | 主要文件 | 备注 |
|---|---|---|---|
| 个人网页收藏墙 | 已实现，高风险需持续回归 | `src/components/layout/sortable-grid/`, `src/lib/store.ts` | 核心产品形态已可用 |
| 分项 / 分类 / 分组 / 网页四层组织 | 已实现 | `src/lib/types.ts`, `src/lib/store.ts` | 分项是后期补上的维度 |
| 分类、分组、网页拖拽排序 | 已实现但反复回归 | `src/components/layout/sortable-grid/` | 需要重点 code review 事件边界 |
| 分类/分组 resize 和紧凑布局 | 已实现但反复调过 | `src/components/layout/sortable-grid/`, `globals.css`, `extension.css` | 右侧留白、wrap、fixed columns 都改过多次 |
| 顶部分项编辑和排序 | 已实现，需真实 UI 复验 | `top-nav.tsx`, `store.ts` | `主页` 固定，其他分项可拖 |
| 分项新增/改名去系统弹窗 | 已实现 | `top-nav.tsx` | 不应再出现 `window.prompt` |
| 分类轻量编辑 + 高级设置 | 已实现，交互仍需审 | `src/components/layout/sortable-grid/`, `category-dialog.tsx` | 普通编辑不应直接弹图标/颜色大框 |
| 删除误触防护 | 已修过，需重点回归 | `top-nav.tsx`, `src/components/layout/sortable-grid/` | 编辑模式点击 tab 不得触发删除 |
| Chrome 扩展新标签页 | 已实现 | `extension/` | Vite + MV3 |
| Chrome 右键菜单收集 | 已实现，需真实扩展复验 | `extension/background.js` | 图标和 target 都需复查 |
| 浮窗小松鼠收集 | 已实现但高风险 | `extension/src/content/floating-capture.ts` | 注入、暂停、拖动、保存目标都反复改过 |
| 浮窗保存目标准确落库 | 已修复，有测试，仍需实测 | `store.ts`, `floating-capture.ts`, `background.js` | 以前严重错放到主页/节流 |
| 简介翻译按钮 | 已实现为本地规则 | `description-translation.ts` | 不是完整机器翻译 |
| 元数据提取相关性 | 已修 docu.md，用例覆盖有限 | `background.js`, `fetch-meta/route.ts` | 仍需抽样审查“文不对题” |
| 小松鼠统一品牌图标 | 已实现，需真实 Chrome 复验 | `extension/manifest.json`, `public/extension-dist/manifest.json` | Chrome 某些菜单图标受限制 |
| 版本号和日期显示 | 已实现 | `src/lib/app-version.ts`, `user-menu.tsx` | 下一功能版本应从 `V1.0.4` 起 |
| Supabase 登录和云同步 | 已实现但最高风险 | `auth-store.ts`, `sync.ts`, `supabase-browser.ts` | 用户数据安全核心 |
| 本地快照和回滚 | 已实现 | `store.ts`, `sync.ts`, rollback dialog | 需要审查覆盖范围 |
| 仓库导入和发货 | 已实现 | `store-warehouse.ts`, `warehouse/`, import dialogs | 需确认同步覆盖 |
| 热门推荐、屏蔽、安全扫描 | 已实现 | `hot-recommendation.tsx`, `hot-sites.ts` | 后续可审 UI 和数据质量 |
| 蓝玻璃 UI | 已实现但仍有体验问题 | `globals.css`, `extension.css` | Web/extension CSS 双维护 |
| 搜索浮层 | 已实现 | `top-nav.tsx` | 已避免搜索时重排收藏墙 |
| 壁纸 / Zoom 模式 | 部分实现，不稳定 | `wallpaper-*`, extension assets | 远程下载/线上同步仍是明显弱点 |

## 2. 改了很多遍仍需重点审查的问题

### 2.1 云同步和数据保护

反复问题：

- 默认 seed 或旧云端数据重新覆盖用户真实布局。
- 多标签或多设备下旧快照赢过新编辑。
- 重装扩展后首页布局被压回默认主页。
- 清空/重置和普通同步边界曾经不清楚。

自评：

- 已经加了 local-first、snapshot、collapse guard，但这类逻辑仍然复杂。
- 需要 Claude 检查每条 sync path 是否都读取最新 IndexedDB，而不是旧内存状态。
- 需要确认 sections、categorySectionIds、warehouse、recycle bin、preferences 都在同一个用户工作区快照里。

### 2.2 拖拽、resize、布局

反复问题：

- resize 和 dnd-kit pointer 事件互相抢。
- 父分类右侧大面积空白。
- 小分组无法压缩成 2x2 或单列。
- 跨区域拖拽导致卡片消失、分组散开或预览跳动。
- Web 和扩展 CSS 表现不一致。

自评：

- 原 `sortable-grid.tsx` 已拆成目录模块，但事件边界仍是重点审查对象。
- 拖拽意图应按层级解析，不应只看 pointer 下的单个元素。
- UI 改动必须带真实浏览器双视口验证。

### 2.3 浮窗收集

反复问题：

- content script 构建成 ESM 后 Chrome 静默不注入。
- 浮窗暂停/隐藏后用户找不到恢复入口。
- 目标列表缓存旧，保存到错误分项/分类/分组。
- 队列回放时没有尊重用户选择的目标。
- 从社交平台打开外链时，名称/简介被来源平台污染。

自评：

- 已补测试，但真实扩展环境覆盖不足。
- 需要 Claude 审查 content script、background queue、store drain 三段是否有重复目标解析逻辑。
- 目标解析失败必须 fail-safe，不应 fallback 到主页。

### 2.4 顶部编辑和删除误触

反复问题：

- 顶部分项以前没有编辑入口。
- 改名用了系统 prompt，体验差。
- 编辑模式下点击 AI/HODL 误弹删除确认。
- hover 后 tab 文字变白不可读。

自评：

- 当前已修，但需要交互审查：普通点击、拖拽、更多菜单、删除确认之间边界是否清楚。
- 删除类操作必须只有明确入口。

### 2.5 元数据和翻译

反复问题：

- 简介英文不翻译。
- 翻译不能依赖昂贵或不稳定服务。
- `docu.md` 被识别成 X/Twitter 简介。
- 站点规则过宽会误判，例如单字母 `x`。

自评：

- 当前是规则翻译和摘要，不是完整翻译服务。
- 需要建立网页抽样测试集：目标页、社交外链、GitHub、文档站、产品页、YouTube/X。
- 建议 Claude 评估是否需要清晰的 metadata precedence table。

## 3. 壁纸功能专项问题

用户明确担心：壁纸功能目前看一直只能本地下载，线上同步和下载功能好像一直没做好。

当前状态：

- 有本地 packaged fallback。
- 有远程/curated provider、缓存刷新、quote matching 的代码。
- 过去做过刷新、缓存、provider 限制和语义匹配。
- 但真实用户体验仍未证明稳定：可能还是本地图、旧图重复、远程刷新不明显或同步不到。

需要 Claude 重点审查：

- `src/lib/wallpaper-*` 的远程下载路径是否真的会跑。
- 扩展环境和 Web 环境的 wallpaper URL 解析是否一致。
- 远程图片缓存是否被本地 fallback 逻辑覆盖。
- 在线失败后是否会永久卡在本地 fallback。
- wallpaper 状态是否参与云同步，还是只停留在当前设备。
- quote 与图片语义匹配是否过度依赖文件名或 provider 文本。

建议验收标准：

- 断网：能稳定使用本地 fallback。
- 联网：能拉到远程新图，并可观察到不是本地包。
- 刷新：不会长期重复同一张旧图。
- 同步：若设计上应跨设备一致，必须在云端快照中能看到相关偏好；如果不应一致，文档和 UI 要说清楚。
- 扩展：重新打开新标签页后远程图仍能加载，不被 CSP 或路径问题阻断。

## 4. UI 方面遗留问题

已知问题和风险：

- 蓝玻璃 UI 已统一大方向，但一些按钮反馈弱，编辑入口层级可能不够直觉。
- 顶部分项、固定栏、分类头部、网页卡片都有不同编辑控件，存在认知负担。
- 卡片 hover、三点菜单、星标、拖拽手柄可能重叠抢事件。
- 小屏或窄宽度下，长标题/长简介/按钮文案仍可能溢出。
- 版本信息、小松鼠品牌、浮窗设置都在账户菜单里，发现性可能不足。
- Web CSS 与扩展 CSS 双维护，容易一个修了另一个漏。
- 系统弹窗已经移除过，但需要源码级搜索防回归。

建议 Claude 审查方式：

- 先审 `sortable-grid.tsx` 的状态数量和事件处理。
- 再审 `globals.css` 与 `extension.css` 的重复和差异。
- 最后按用户常用路径做 UI review：保存网页、改名、拖拽、删除、恢复、换壁纸、同步。

## 5. 避坑和自评

### 5.1 该做但没做够的

- 没有从一开始建立稳定的端到端扩展测试，导致真实 Chrome 问题反复靠用户截图发现。
- 没有一开始把截图资产保存进 repo，导致现在只能保留截图索引，不能保留原图。
- 没有把 Web CSS 和扩展 CSS 抽成更稳的共享层，后续维护成本高。
- 没有给 metadata extraction 建系统性样本库，导致 docu.md 这类错配后补测试。
- 壁纸远程下载/同步没有形成明确可验收的产品规格。
- 文档很长一段时间分散，旧交接文档可能误导下一线程。

### 5.2 做得不好的部分

- 多轮补丁让收藏墙拖拽目录模块和浮窗链路复杂度偏高。
- 有些修复先追现象，再补根因，工程边界不够干净。
- Release、manifest、public extension-dist、版本文件多处同步，容易漏。
- 部分功能“代码完成”早于“真实用户环境验证”，这在 Chrome 扩展和云同步里风险很高。
- 对用户数据安全虽然有规则，但早期同步设计不够保守，导致后续加了很多保护层。

### 5.3 后续必须坚持的底线

- 不清空 IndexedDB。
- 不重置 Supabase。
- 不用 seed 覆盖用户数据。
- 不把明确目标保存失败变成默认收集箱兜底。
- 不用系统 prompt/confirm 做核心编辑。
- 不在用户主 Chrome 窗口里做测试。
- 不把“构建通过”当成“扩展真实可用”。

## 6. 给 Claude 的建议审查路线

### P0：先看数据和保存链路

1. `src/lib/store.ts`
2. `src/lib/sync.ts`
3. `src/lib/db.ts`
4. `extension/src/content/floating-capture.ts`
5. `extension/background.js`

输出重点：

- 是否存在静默 fallback。
- 是否存在旧内存状态覆盖新 IndexedDB。
- 是否存在普通点击触发危险操作。

### P1：再看 UI 和壁纸

1. `src/components/layout/sortable-grid/index.tsx`
2. `src/components/layout/sortable-grid/category-block.tsx`
3. `src/components/layout/sortable-grid/sub-group-block.tsx`
4. `src/components/layout/sortable-grid/ungrouped-block.tsx`
5. `src/components/layout/sortable-grid/sortable-card.tsx`
6. `src/components/layout/sortable-grid/layout-math.ts`
7. `src/components/nav/top-nav.tsx`
8. `src/components/auth/user-menu.tsx`
9. `src/app/globals.css`
10. `extension/src/extension.css`
11. `src/lib/wallpaper-*`

输出重点：

- 哪些 UI 逻辑应该拆分。
- 哪些样式重复应该收敛。
- 壁纸远程下载/同步到底是否可靠。

### P2：最后看工程质量

1. 测试脚本覆盖是否足够。
2. Release 脚本是否防漏版本。
3. 文档是否还有旧事实。
4. 是否需要新增真实扩展 E2E。

## 7. 建议 Claude 不要做的事

- 不要直接重写 store 或 sync。
- 不要删除历史数据、seed、默认分类或用户内容。
- 不要先做大规模 UI 重构。
- 不要把壁纸问题只归类成 UI 问题，它可能是远程下载、缓存、同步和扩展路径共同问题。
- 不要只根据截图判断，必须读代码路径和测试。

## 8. 当前分支备份说明

2026-07-07 检查时，本地只有一个分支：

```text
main
```

因此“所有本地分支备份”的实际含义是：把当前 `main` 推到 `origin/main`，并额外推一个远端备份分支。备份分支名记录在最终任务回复和后续 git 历史中。

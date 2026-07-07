# WebCollect 全项目体检入口

更新时间：2026-07-08
面向对象：Claude / Codex / 后续任何接手 WebCollect 的开发 agent
当前主目录：`/Users/rockyx/vibe coding/Web Collect 0628`
远端仓库：`https://github.com/RockyXuan/webcollect`
主分支：`main`
当前最新已发布版本：`V1.0.3 / 2026年7月2日`
当前 main 已知基线提交：`a779f26`（Claude Fable 审查时的 main）
当前整改分支：`fix/sync-architecture`
当前整改分支最新状态：本文件随整改分支持续更新；Fable 第二轮 R1 代码项已完成，最新点以 `git log -1 --oneline` 为准。

## 2026-07-07 Fable 整改执行状态

- 已导入并按步执行 Fable 方案：`docs/audit/claude-fable-remediation-plan-2026-07-07.md`。
- 执行日志：`docs/audit/remediation-execution-log-2026-07-07.md`。
- 已完成 Phase 1 同步正确性、Phase 2 启动/性能减负、Phase 3 壁纸远程/同步/状态可见。
- Phase 4.0 已准备 `docs/design/mockups/`；用户已确认此前 Image2 要求属于误提，UI 还原度任务（Phase 4.1、4.2、4.5）本轮暂缓，不再阻塞合并/发版。
- Phase 4.3 已清除 `src` 与 `extension/src` 的系统 `prompt/confirm/alert` 残留。
- Phase 4.4 已按 Fable 方案拆分原 `sortable-grid.tsx`：DnD shell、分类块、分组块、未分类块、卡片块和布局数学已分离，并新增 `scripts/test-grid-layout.ts` 防回归；已补 Playwright 浏览器验收，覆盖编辑模式、误删防护、resize 收缩/恢复和分组拖拽排序。
- Phase 5.1 已新增 GitHub Actions CI。
- Fable 第二轮 R1 已完成：启动新鲜度 marker、Wikimedia 缩略图降级、wallpaperPrefs 稳定设置同步瘦身。
- 当前尚未合并回 `main`，也尚未发布 `V1.0.4` Release；发版前仍需用户完成 R2 Supabase SQL 迁移与双设备真实同步验收。

## 先读这个

这个文件是 WebCollect 的“全身体检交接入口”。后续 agent 不需要让用户重新复述需求，先读：

0. `docs/audit/claude-fable-followup-plan-2026-07-07.md`（**当前最新**：Fable 第二轮审查结论 + 下一阶段方案 R1-R4；UI 还原度已由用户决定暂缓，goal 不再 blocked）
0.1 `docs/audit/claude-fable-code-review-2026-07-07.md`（Claude Fable 5 第一轮全量代码审查结论：P0 同步缺陷、性能根因、壁纸根因、UI 基准缺失）
0.5 `docs/audit/claude-fable-remediation-plan-2026-07-07.md`（第一轮整改执行方案：Phase 0-5 分步操作，按序执行，每步有验收标准）
0.6 `docs/audit/remediation-execution-log-2026-07-07.md`（Codex 实际执行日志：每步改法、测试和当前阻塞）
1. `AGD.md`
2. `docs/audit/claude-code-review-handoff-2026-07-07.md`
3. `docs/audit/webcollect-full-audit-brief-2026-07-07.md`
4. `docs/audit/user-screenshot-index-2026-07-07.md`
5. `PROJECT_SUMMARY.md`
6. `HANDOFF.md`
7. `tasks/lessons.md`
8. `tasks/todo.md`
9. `AGENTS.md`

如果这些文件和旧文档冲突，以 `AGD.md` 和 `docs/audit/webcollect-full-audit-brief-2026-07-07.md` 为准。

## 产品一句话

WebCollect 是个人网页收藏工作台：用户可以用 Web 页面和 Chrome 扩展，把网页按“分项 / 分类 / 分组 / 网页”整理成可视化收藏墙，并支持浮窗收集、拖拽排序、搜索、云同步、版本回滚和扩展发布。

## 最高优先级

- 绝不清空、覆盖、重置用户 IndexedDB / Supabase / Chrome 扩展本地数据。
- 不要用默认 `seed.ts` 覆盖用户真实数据；默认数据只能作为首次空数据示例。
- 不要操作用户主 Chrome 窗口；本地验证优先用 in-app Browser，扩展验证用辅助 Chrome / Codex Workbench。
- 每次涉及 Chrome 扩展可测试版本，都要构建、打包、发布 GitHub Release，并给出 zip 直链。
- 每次推送功能版本都要更新版本号和日期；当前下一次功能补丁应从 `V1.0.4` 起。
- 小松鼠头是 WebCollect 统一品牌图标，Chrome 顶栏、右键菜单、默认图标、浮窗 UI 都应优先使用它。

## 已完成的重要需求

### 1. 固定工作区和交接

- 新固定目录：`/Users/rockyx/vibe coding/Web Collect 0628`。
- 旧目录只作历史参考，不再开发：`/Users/rockyx/Documents/webcollect`、`/Users/rockyx/Documents/Codex/2026-06-14/webcollect-main-clean`。
- 已把 `PROJECT_SUMMARY.md`、`HANDOFF.md`、`NEXT_THREAD_PROMPT.md` 作为长期交接入口。

### 2. Chrome 扩展发布和版本展示

- 已有 Release：
  - `webcollect-2026-07-01-v1.0.2`
  - `webcollect-2026-07-02-v1.0.3`
- 当前 UI 显示版本和日期：`src/lib/app-version.ts`。
- 版本一致性测试：`scripts/test-extension-branding.ts`。
- 扩展构建命令：`corepack pnpm@9.0.0 build:ext`。

### 3. 小松鼠品牌统一

- 目标：所有可控图标都换成小松鼠头像，不再用默认拼图图标。
- 作用面：Chrome 工具栏图标、右键菜单、扩展 manifest、浮窗组件、页面内品牌视觉。
- 验证脚本：`scripts/test-extension-branding.ts`。
- 注意：如果后续发现某处仍显示 Chrome 默认拼图图标，优先查 manifest icons、contextMenus icon 支持边界、构建输出 `extension/dist/icons/`。

### 4. 浮窗收集和目标落点

- 修复重点：浮窗选择的分项/分类/分组必须准确落库，不能静默掉到主页或“节流 / 收集箱”。
- 已实现目标保留：draft 保存目标 id/name/path，队列回放时严格解析。
- 显式目标找不到时应失败并保留错误，不得随意兜底到其他收集箱。
- 已错放历史卡片只做有证据修复；只能用队列中的 URL + draft.destination 证明后再搬。
- 相关脚本：
  - `scripts/test-floating-capture-targets.ts`
  - `scripts/test-floating-capture-drain.ts`
  - `scripts/test-floating-capture-health.ts`

### 5. 顶部分项编辑和排序

- 顶部分项行已支持编辑按钮。
- 进入编辑后：`主页` 固定不可拖，其他分项可横向拖拽排序。
- 分项改名改为原地编辑，不再用 `window.prompt`。
- 新增分项改为行内输入，不再用系统弹窗。
- 删除分项只允许在明确菜单入口触发，使用项目内 AlertDialog。
- 相关 store 动作：`reorderSections(orderedIds)`。

### 6. 分类轻量编辑

- 分类/分组普通编辑入口先进入轻量编辑状态。
- 轻量编辑用于：拖网页、改网页名、改简介、改分类/分组名称。
- 图标和主题色属于“高级设置”，需要额外点击高级入口才打开原来的大弹窗。
- 危险操作必须留在明确菜单项里，不得由普通点击触发。

### 7. 去弹窗化和误删防护

- 顶部分项新增/重命名不再用 Chrome 系统 prompt。
- 编辑模式下点击 AI / HODL / 其他 tab 不应弹删除确认。
- 删除确认只属于明确的删除按钮或菜单项。
- Hover 状态下非 active tab 文字必须保持可读，不能变白消失。

### 8. 描述翻译和元数据提取

- 已加浮窗简介翻译按钮，使用本地规则/免费底层逻辑，不依赖私有 API。
- 英文简介会被规则化成中文摘要。
- 已修复 docu.md 从 X/Twitter 打开时，简介被误识别成“X/Twitter 社交平台”的问题。
- `docu.md — AI writes it. docu.md does the rest.` 应提取为：
  - 名称：`Docu.md`
  - 简介：`AI 负责写作，Docu.md 完成其余工作。`
- 相关文件：
  - `src/lib/description-translation.ts`
  - `extension/src/content/floating-capture.ts`
  - `extension/background.js`
  - `src/app/api/fetch-meta/route.ts`
- 相关脚本：
  - `scripts/test-description-translation.ts`
  - `scripts/test-floating-capture-metadata.ts`

### 9. 蓝玻璃 UI、布局和拖拽

- 当前视觉方向：蓝白玻璃、轻量卡片、收藏墙工作台，而不是传统书签列表。
- 分类、分组、网页卡片多轮修过右侧留白、拖拽裁剪、固定列数和跨分辨率布局。
- 高风险文件：
  - `src/components/layout/sortable-grid/index.tsx`
  - `src/components/layout/sortable-grid/category-block.tsx`
  - `src/components/layout/sortable-grid/sub-group-block.tsx`
  - `src/components/layout/sortable-grid/ungrouped-block.tsx`
  - `src/components/layout/sortable-grid/sortable-card.tsx`
  - `src/components/layout/sortable-grid/layout-math.ts`
  - `src/app/globals.css`
  - `extension/src/extension.css`
- 每次 UI 改动都要做真实视觉检查，至少桌面宽屏和较窄桌面各一次。

### 10. 云同步、回滚和数据安全

- 本地 IndexedDB 优先，云同步在后台做。
- 启动不能等云同步才能显示页面。
- 云同步不能让默认首页覆盖用户真实云端布局。
- 多标签和多设备同步必须有 snapshot fence。
- 删除、清空、回滚、云推送前应有安全快照。

## 明确要求保持现状的部分

- 不要重做整体信息架构，除非用户明确要求。
- 不要启发式重分类历史错放网页；没有证据的只生成待整理清单。
- `主页` 分项固定第一位，不可拖动、不可删除。
- 当前小松鼠头像样子不要变；如果精修，只能提高清晰度，不能改形象。
- 不要重新引入大面积营销页、英雄区、说明型 UI；第一屏必须是可用工作台。
- 不要把系统 prompt/confirm 弹窗带回编辑流程。
- 不要让普通点击触发删除类危险行为。

## 当前不满意和待体检问题

- 真实 Chrome 主环境仍需长期验证：右键菜单图标、工具栏图标、小松鼠清晰度、浮窗注入稳定性。
- 元数据提取仍是规则驱动，需继续检测“文不对题”的简介，尤其是从 X/Twitter、重定向链接、社交卡片跳转来的网页。
- 翻译目前是本地规则/短语表，不是完整机器翻译；未来可考虑浏览器翻译 API 或后端代理。
- 云同步跨 Windows/Mac 的真实端到端仍需用户环境确认。
- 拖拽、resize、编辑状态曾反复互相影响；体检时要重点看事件边界。
- UI 还有可能存在按钮反馈弱、hover 状态不清楚、编辑入口层级不够直觉的问题。
- 旧文档很多，时间线长，后续应避免让过期文档重新成为事实来源。

## Claude 体检建议顺序

1. 先不改代码，读 `AGD.md` 和 audit brief。
2. 跑基础检查：`git status -sb`、`git log --oneline --decorate -8`、版本文件。
3. 检查数据安全路径：`src/lib/store.ts`、`src/lib/sync.ts`、`src/lib/db.ts`。
4. 检查扩展收集闭环：content script -> background queue -> store drain -> add card。
5. 检查元数据提取：网页 title/description/OG/visible text 的优先级和错配保护。
6. 检查顶部分项、分类、分组、网页编辑状态是否有误触危险。
7. 检查 Web CSS 与扩展 CSS 是否同步。
8. 做本地浏览器验证和扩展构建验证。
9. 最后输出执行方案，不要直接做大规模重构。

## 必跑验证命令

```bash
node --import tsx scripts/test-floating-capture-targets.ts
node --import tsx scripts/test-floating-capture-drain.ts
node --import tsx scripts/test-floating-capture-health.ts
node --import tsx scripts/test-floating-capture-metadata.ts
node --import tsx scripts/test-description-translation.ts
node --import tsx scripts/test-extension-branding.ts
corepack pnpm@9.0.0 ts-check
corepack pnpm@9.0.0 lint
corepack pnpm@9.0.0 build:ext
git diff --check
```

## 最近发布信息

- Release 页面：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-02-v1.0.3`
- zip 直链：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-02-v1.0.3/WebCollect-Chrome-Extension-v1.0.3-2026-07-02.zip`

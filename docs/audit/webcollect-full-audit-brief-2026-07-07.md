# WebCollect 全项目需求、做法、教训与体检清单

更新时间：2026-07-07
用途：给 Claude / Codex 做全身性体检和后续执行方案时使用。
范围：覆盖 WebCollect 从早期收藏墙、云同步、Chrome 扩展、蓝玻璃 UI、浮窗收集，到 2026-07-02 `V1.0.3` 的主要需求和坑。

## 1. 当前项目状态

- 项目：WebCollect 个人网页收藏墙。
- 当前固定工作目录：`/Users/rockyx/vibe coding/Web Collect 0628`。
- GitHub：`https://github.com/RockyXuan/webcollect`。
- 当前主分支：`main`。
- 当前最新版本：`V1.0.3 / 2026年7月2日`。
- 当前最新 Release：`webcollect-2026-07-02-v1.0.3`。
- 当前最新核心修复：网页元数据相关性，尤其是 `docu.md` 从 X/Twitter 打开后的名称/简介识别。

## 2. 产品目标

WebCollect 的目标不是做普通书签页，而是做一个可长期使用的个人网页工作台：

- 用分项组织不同场景，如主页、AI、HODL、不常用。
- 用分类和分组组织网页，支持拖拽和视觉整理。
- 用 Chrome 扩展在任意网页快速收集链接。
- 用云同步和本地快照保护跨设备数据。
- 用清晰的小松鼠品牌和蓝玻璃 UI 形成稳定识别。

## 3. 原始需求与实现梳理

### 3.1 三级收藏墙

原始需求：

- 页面要像收藏墙，不是普通列表。
- 结构为“分项 / 分类 / 分组 / 网页”。
- 网页卡片显示 favicon、名称、简介、hover 详情。
- 支持分类、分组、网页拖拽排序。

当前做法：

- 核心布局在 `src/components/layout/sortable-grid.tsx`。
- 数据存在 `src/lib/store.ts`，持久化到 `src/lib/db.ts`。
- 类型在 `src/lib/types.ts`。
- Web 和扩展共用组件，扩展 CSS 单独在 `extension/src/extension.css`。

保持现状：

- 不要改为扁平列表。
- 不要让父分类直接拥有隐藏卡片；父分类里应该有可见子分组。
- 不要让布局改动触碰 sync/schema/seed。

### 3.2 顶部分项

原始需求：

- 顶部有主页、FOM、HODL、AI、不常用等分项。
- 分项需要可新增、改名、排序。
- `主页` 固定第一位，不能拖动或删除。
- 其他分项可以横向拖拽排序。

已做做法：

- 增加顶部分项独立编辑按钮。
- 编辑状态显示拖拽手柄。
- 分项新增和改名改成行内输入。
- 移除 `window.prompt`。
- `reorderSections(orderedIds)` 只更新 `CollectionSection.order`。

仍需体检：

- 编辑模式下点击 tab 是否仍可能误触删除。
- 分项重排后是否在 IndexedDB 和云同步中稳定保存。
- Web CSS 与扩展 CSS hover/active/editing 状态是否一致。

### 3.3 分类和分组编辑

原始需求：

- 用户常用操作是改名、拖顺序、移动网页，不是改图标和颜色。
- 点编辑按钮后不应直接弹出大框。
- 大框只作为“高级设置”入口。

已做做法：

- 普通编辑进入轻量编辑模式。
- 分类/分组名称可原地改。
- 网页可拖动排序，网页标题/简介可原地改。
- 图标、主题色进入高级设置弹窗。

仍需体检：

- 轻量编辑和高级设置入口是否足够清楚。
- 编辑按钮、三点菜单、星标、拖拽手柄是否互相抢事件。
- 分类/分组删除、移动、降级是否只在明确菜单里触发。

### 3.4 浮窗收集

原始需求：

- 网页右侧出现 WebCollect 浮窗，可快速保存当前网页或链接。
- 目标可选分项、分类、分组。
- 未选目标时进入默认收集箱。
- 可暂停 1 小时、今天不显示、永久不显示。
- 面板可拖动，位置持久化。

已做做法：

- content script：`extension/src/content/floating-capture.ts`。
- background queue：`extension/background.js`。
- 目标解析和回放：`src/lib/store.ts`。
- 偏好共享类型：`src/lib/floating-capture.ts`。
- 已加健康标记和恢复入口。
- 已修复 content script IIFE 构建，避免 Chrome 静默不注入。

关键修复：

- 保存 draft 时保留目标 id/name/path。
- 队列 drain 时显式目标找不到就失败，不能掉入主页或默认收集箱。
- 已错放历史卡片只允许有证据搬移。

仍需体检：

- 真实安装扩展后，service worker、content script、右键菜单和页面浮窗是否稳定协同。
- 从 X/Twitter、GitHub、YouTube、文档站、需要重定向的网站保存时，目标是否准确。
- 暂停/隐藏偏好是否不会让浮窗永久消失且找不到恢复入口。

### 3.5 元数据提取和翻译

原始需求：

- 名称和简介应来自真实目标网页，不应被来源平台污染。
- 例如从 X/Twitter 打开 `https://docu.md/` 后：
  - 名称应是 `Docu.md`。
  - 简介应是 `AI 负责写作，Docu.md 完成其余工作。`
- 简介旁需要翻译按钮，先用免费或底层翻译能力做简单翻译。

已做做法：

- `src/lib/description-translation.ts` 提供本地翻译/摘要规则。
- `scripts/test-description-translation.ts` 覆盖已知站点和短语。
- `scripts/test-floating-capture-metadata.ts` 覆盖 docu.md 元数据。
- `extension/background.js` 和 `/api/fetch-meta` 增加 title 解析、可读文本兜底和站点错配保护。
- 移除 X/Twitter 中过于宽泛的单字母 `x` 匹配，避免任何英文文本都误判为 X。

保持现状：

- 当前不依赖私有 API key。
- 不要为了翻译牺牲保存稳定性；翻译失败也要能保存。

仍需体检：

- 针对常见网页抽样，检查名称/简介是否“文不对题”。
- 对 source host 和 target host 不一致的情况，优先信任 target 页面。
- 针对 Open Graph、Twitter Card、document title、visible text 建议建立明确优先级表。

### 3.6 小松鼠品牌和图标

原始需求：

- Chrome 顶栏图标、右键菜单图标、页面内图标都要统一。
- 使用用户指定的小松鼠头像。
- 精度要够，不能模糊；精修只能增强清晰度，不改变形象。

已做做法：

- manifest、public extension-dist、extension icons、浮窗 UI 已做统一。
- `scripts/test-extension-branding.ts` 检查版本和图标资源。

仍需体检：

- Chrome 某些菜单位置可能受浏览器限制，不一定支持自定义图标。
- 多尺寸 PNG 是否真的覆盖 16/32/48/128。
- retina 下是否清晰。

### 3.7 版本号和日期

原始需求：

- 每次推到 GitHub 后要显示版本号和日期。
- 小改动增加第三位数，大改动增加第二位或第一位。
- 当前版本在 `1.0.x` 左右。
- UI 上用浅灰字体显示，例如“7月1日，版本 V1.0.2”。

已做做法：

- `src/lib/app-version.ts` 存版本和日期。
- `src/components/auth/user-menu.tsx` 显示版本。
- manifest 和 package 版本保持一致。
- `scripts/test-extension-branding.ts` 检查一致性。

保持现状：

- 下一次功能修复应更新到 `V1.0.4` 或按变更范围调整。
- 文档-only 小提交不一定发布扩展包，但如果涉及可测试扩展，必须 Release。

### 3.8 云同步和回滚

原始需求：

- 本地改动要立即保存。
- 云同步不能让数据丢失。
- 跨设备、重装扩展、重新登录后，用户布局不能被默认数据覆盖。
- 手动保存版本和回滚要可用。

已做做法：

- 本地 IndexedDB 优先。
- Supabase 后台同步。
- 增加 rollback snapshots、manual/system snapshots。
- 启动 local-first，不能等云同步才渲染。
- 同步前后加 size/collapse guard。

仍需体检：

- Windows/Mac 真实跨设备同步。
- 多标签同时打开的冲突保护。
- 清空/重置工作区的 reset marker 是否仍可靠。
- 云端 schema 和本地 schema 是否长期一致。

### 3.9 壁纸和沉浸模式

原始需求：

- 新标签页可以切换更安静的壁纸/Zoom 模式。
- 壁纸要有质量，不能总是旧图或不匹配的句子。
- Quote 要和图片语义匹配。

已做做法：

- 本地 packaged fallback。
- provider 限制和缓存刷新。
- quote semantic matching。

仍需体检：

- 真实扩展长期打开时是否仍重复旧图。
- NASA/科研图是否仍被不合适地放入默认池。
- quote 与图片语义是否仍偶发不匹配。

### 3.10 仓库和导入

原始需求：

- 支持导入 Homely JSON。
- 仓库是 staging area，不应和主页混在一起。
- 可以从仓库发货到主页指定位置。
- 重复项要可识别和清理。

已做做法：

- 仓库独立 store 和 IndexedDB。
- 导入、批次管理、发货弹窗。
- 软删除和回收站。

仍需体检：

- 仓库和主页同步是否覆盖完整数据。
- 重复导入后的去重反馈是否足够清楚。
- 发货到新分项/分类/分组是否仍准确。

## 4. 截图和用户标注

截图索引见：`docs/audit/user-screenshot-index-2026-07-07.md`。

注意：用户早期截图来自对话附件，原始临时 PNG 文件在 2026-07-07 检查时已经不在 `/var/folders/.../T/` 中，因此本次只把截图名称、标注含义、对应问题和当前状态写入仓库。后续新截图必须复制到 `docs/audit/screenshots/` 再引用，避免临时文件过期。

## 5. 反复踩坑

### 5.1 数据安全

- `seed.ts` 是默认示例，不是用户当前数据。
- 清空 IndexedDB、重置 Supabase、默认数据覆盖用户数据都属于高危操作。
- 同步逻辑必须覆盖 sections、categorySectionIds、warehouse、recycle bin、preferences，不只是 cards/categories。

### 5.2 拖拽和 resize

- dnd-kit 的 pointer 事件和 resize 的 mouse 事件容易互相抢。
- resize handle 应 `stopPropagation()`，不要随便 `preventDefault()`。
- SortableContext 必须匹配视觉区域，不能为了跨区拖拽把全部东西塞进一个大 context。

### 5.3 布局宽度

- flex 的 `width`、`minWidth`、`flex-basis`、`shrink` 曾多次造成空白或换行。
- 父分类应按内部分组真实行宽包裹。
- 小组默认紧凑，大组自然换行，手动宽度优先。

### 5.4 扩展样式

- Web CSS 和扩展 CSS 是两套入口。
- Tailwind v4 + Vite 不会自动扫描 `@/` 别名引用，扩展 CSS 必须保留 `@source`。
- 修 Web UI 时必须同步检查 `extension/src/extension.css`。

### 5.5 Chrome 扩展构建

- MV3 content script 不能输出带 top-level import 的 ESM。
- `floating-capture.js` 要作为 classic IIFE 注入。
- 真实安装扩展行为和 mock 注入验证不同，Release 后仍需用户实测。

### 5.6 系统弹窗和误删

- `window.prompt` / `window.confirm` 在体验上不可接受。
- 删除动作必须在明确菜单入口和项目内 AlertDialog 内。
- 编辑模式点击 tab 不应触发删除确认。

### 5.7 元数据错配

- 来源平台的标题/简介容易污染目标网页。
- X/Twitter 的 `x` 不能作为普通关键词匹配。
- 需要比较 source host 和 target host；不一致时谨慎使用来源文本。

## 6. 做得不好的地方

- 很多功能靠多轮补丁长出来，文档一度分散，容易让下一线程读到旧事实。
- UI 交互仍存在“入口多、层级深”的风险，尤其是编辑/高级设置/删除/拖拽。
- 扩展真实环境验证依赖用户安装，自动化覆盖还不够完整。
- 元数据提取和翻译仍偏规则化，缺少系统性网页抽样评估。
- 小松鼠图标资源如果未来继续压缩/拷贝，可能出现清晰度回退。
- Release、版本、manifest、public extension-dist 多处需要同步，容易漏。

## 7. 待办事项

### P0

- 全面检查浮窗保存目标：已有目标、新建分项、新建分类、新建分组、队列回放、失败保留。
- 抽样检查元数据提取：从社交平台打开的外链、GitHub README、文档站、产品首页、YouTube/X 链接。
- 检查编辑模式危险操作：点击 tab、拖动 tab、点击空白、点击高级设置、点击删除入口。

### P1

- 建立真实扩展 E2E 验证方案，尽量减少只靠 mock 注入。
- 视觉巡检 Web 和扩展：tab hover、按钮反馈、长文本溢出、卡片 hover 详情。
- 检查 Chrome 图标多尺寸和 retina 清晰度。
- 检查 sync snapshot 是否覆盖所有当前数据字段。

### P2

- 设计更稳定的翻译/摘要服务，但不能依赖用户手动配置 API key。
- 清理过期文档，把旧文档标成历史，减少事实冲突。
- 给 UI 状态建立更系统的 screenshot regression。
- 给 Release 流程加版本一致性自动检查。

## 8. 建议 Claude 输出的体检结果格式

Claude 读完后，建议输出：

1. 当前判断：哪些问题已修好，哪些仍有风险。
2. 风险排序：P0 / P1 / P2。
3. 执行方案：每个问题对应文件、改法、验证方法。
4. 不建议做的事：会破坏数据或扩大风险的方案。
5. 需要用户实测的清单：只列必须在真实 Chrome/真实账号里看的部分。

## 9. 当前验证基线

最近已通过的核心验证包括：

```bash
node --import tsx scripts/test-description-translation.ts
node --import tsx scripts/test-floating-capture-metadata.ts
node --import tsx scripts/test-floating-capture-health.ts
node --import tsx scripts/test-floating-capture-targets.ts
node --import tsx scripts/test-floating-capture-drain.ts
node --import tsx scripts/test-extension-branding.ts
corepack pnpm@9.0.0 ts-check
corepack pnpm@9.0.0 lint
corepack pnpm@9.0.0 build:ext
git diff --check
```

Lint 当前 0 error，但有 6 个既有 warning。不要把 warning 当成新错误，也不要顺手大改无关组件。

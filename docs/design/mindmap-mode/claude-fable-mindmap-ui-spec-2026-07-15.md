# WebCollect 导图模式（Mindmap Mode）UI 实现文档

作者：Claude Fable 5
日期：2026-07-15
执行者：Codex（按 M0→M7 顺序逐步实现，每步一个 commit，每步跑完整验证清单）

## 0. 交付物索引（设计基准已全部落库）

| 文件 | 说明 |
|---|---|
| `docs/design/mindmap-mode/mindmap-mockup.html` | **可交互设计大样**（独立 HTML，双击即开）。四种布局、拖拽、悬停预览、折叠、经典⇄导图切换全部可操作。实现时以它为像素级基准。 |
| `docs/design/mockups/2026-07-15-mindmap-logic-right.png` | 右侧逻辑图（默认布局） |
| `docs/design/mockups/2026-07-15-mindmap-bilateral.png` | 双侧脑图 |
| `docs/design/mockups/2026-07-15-mindmap-tree-down.png` | 下行组织图（网页纵向堆叠） |
| `docs/design/mockups/2026-07-15-mindmap-hover-preview.png` | 网页节点悬停预览卡 |
| `docs/design/mockups/2026-07-15-mindmap-classic-mode.png` | 经典模式 + 转换提示 |

大样中的布局算法、间距参数、交互时序都是**可直接移植的参考实现**（内嵌 `<script>` 共约 400 行，无任何外部依赖）。

## 1. 需求回顾（用户原话要点）

1. 一键把当前收藏墙转换成思维导图布局，两种模式随时互切。
2. 提供多种主流导图布局（不只向右展开）。
3. 区块可自由拖动，但**连接线必须保留**，清晰展示 分项→分类→分组→网页 的从属关系。
4. 卡片沿用现有设计：默认显示标题，悬停显示简介详情。
5. 两种模式数据增删改**完全同步**；拖拽/换布局**绝不改变从属关系**（"血缘关系固定"）。
6. 视觉风格与现有蓝玻璃主页保持一致。

## 2. 设计原则

- **单一数据源**：导图是现有 zustand `useAppStore` 的**另一个视图**，不是另一份数据。导图里的增删改直接调用现有 store actions（`addCategory` / `addCard` / `updateCard` / `softDeleteCard`…），云同步、快照、dirty 追踪自动继承，零新增同步逻辑。
- **位置是视图状态，层级是数据**：节点坐标偏移、折叠状态、当前布局只存在"导图视图状态"里（独立 localforage key），**永远不写回 categories/cards**。删掉视图状态，导图退回自动布局，数据毫发无损。
- **零新增运行时依赖**：大样已证明自研布局（纯函数）+ SVG 连线 + 绝对定位 DOM 节点足够。不引入 React Flow / d3（扩展包体 + CSP + 双端维护成本）。
- **所有视觉取自现有 token**：见 §4 token 表，全部来自 `src/app/globals.css`，不新造颜色。

## 3. 信息架构与数据映射

### 3.1 节点模型（运行时派生，不持久化）

```ts
type MindmapNodeType = "section" | "category" | "group" | "card";
interface MindmapNode {
  id: string;            // "sec:<sectionId>" | "cat:<categoryId>" | "grp:<categoryId>" | "card:<cardId>"
  type: MindmapNodeType;
  refId: string;         // 指回原始实体 id
  label: string;
  color?: string;        // category.color；group/card 沿父分类色
  children: MindmapNode[];
}
```

派生规则（`buildMindmapTree(sections, categories, cards, activeSectionId)` 纯函数）：

- 根 = 当前激活分项（`activeSectionId`）。默认单分项视图；切分项 tab 即切换整棵树。
- 第二层 = 该分项下的顶级分类（`!parentId && sectionId === active`），按 `order` 排序。
- 第三层 = 分组（`parentId === category.id`）；无分组的独立分类直接挂网页。
- 第四层 = 网页卡片（`card.categoryId`），按 `order` 排序。
- 与 `sortable-grid` 的 `catId()/cardId()` 前缀约定保持一致的命名风格（`layout-math.ts` 已有先例）。

### 3.2 视图状态（持久化，独立于业务数据）

```ts
interface MindmapViewState {
  layout: "logic-right" | "bilateral" | "tree-down" | "indent";
  collapsed: string[];                          // nodeId 列表
  offsets: Record<LayoutId, Record<string, { dx: number; dy: number }>>; // 拖拽偏移，按布局分开存
  camera: { x: number; y: number; k: number };  // 平移缩放
  updatedAt: number;
}
// localforage key: `mindmapViewState:<sectionId>`（沿用 db.ts 的 localforage 实例）
```

V1 只存本地，不进云同步（视图状态丢了无损失）。V2 可把 `layout` + `collapsed` 作为 `user_preferences` 的一个 key 同步，坐标偏移永远留本地。

## 4. 视觉规格（全部对应大样）

### 4.1 Token 映射

| 用途 | 值 | 来源 |
|---|---|---|
| 根节点底色 | `var(--wc-primary-gradient)` | globals.css:92 |
| 分类节点 | 白玻璃 `rgba(255,255,255,.90)→rgba(239,246,255,.72)` + `--wc-border-strong` | `.wc-glass-card` 同族 |
| 分组节点 | `rgba(255,255,255,.78)` + `rgba(96,165,250,.30)` | `.wc-site-tile` 减淡 |
| 网页节点 | 与 `.wc-site-tile` 完全同款（背景/边框/内阴影/hover 抬升） | globals.css:839 |
| 连线颜色 | 所属**分类的 color**；分类线 2.4px @55%、分组线 2px @55%、网页线 1.6px @40% | 新增（信息编码：一眼看出子树归属） |
| 画布背景 | 与 body 相同的蓝紫径向渐变 | globals.css:157-161 |
| 悬浮面板（布局轨/缩放簇/预览卡） | `.wc-glass` 同款配方 | globals.css |

### 4.2 节点尺寸（与大样一致）

| 节点 | 高 | 宽 | 圆角 | 字号/字重 |
|---|---|---|---|---|
| 分项（根） | 56px | 内容自适应，min 150 | 18px | 17px / 700，白字 + 🐿️ |
| 分类 | 46px | 自适应，min 130 | 16px | 14.5px / 650 + 9px 色点 |
| 分组 | 40px | 自适应，min 110 | 14px | 13px / 620 + 3px 渐变竖条 |
| 网页 | 44px | **固定 208px** | 14px | favicon 26px + 12.5px 标题单行截断 + hover 星标 |

### 4.3 布局参数（大样实测值，直接采用）

```ts
GAP_Y = { section: 40, category: 26, group: 12 };   // 兄弟竖向间距（按父类型）
GAP_X = { section: 96, category: 72, group: 56 };   // 父子横向间距
DOWN_GAP_Y = { section: 92, category: 76 };          // 组织图层间距
DOWN_GAP_X = 20; INDENT = 44;
```

### 4.4 四种布局

1. **右侧逻辑图（默认）**：经典 tidy tree。子树高度 = max(节点高, Σ子树高+间距)，父节点在子树包围盒垂直居中。
2. **双侧脑图**：顶级分类按索引奇偶交替分到右/左两侧，两侧各自跑逻辑图（左侧镜像），根节点在两侧包围盒之间垂直居中。
3. **下行组织图**：分类/分组横向铺开、层层向下；**分组下的网页改为纵向列表堆叠**（脊线连接，见大样截图）——否则叶子层横向爆宽，这是大样迭代中踩过并修掉的坑，实现时不要回退。
4. **缩进树**：子节点向下缩进 44px 排列，直角圆弧折线连接（适合超大数据量的紧凑浏览）。

连线：逻辑图/脑图/组织图用三次贝塞尔（控制点取水平/垂直中点），缩进树和组织图叶子层用带 8px 圆角的直角折线。**具体 path 公式抄大样 `edgePath()`。**

## 5. 组件清单

目录：`src/components/mindmap/`（新建，不碰 `sortable-grid/`）

| 组件 | 文件 | 职责 |
|---|---|---|
| `MindmapView` | `index.tsx` | 装配层：订阅 store（细粒度 selector）、构建树、挂载画布/轨/簇/图例/预览 |
| `MindmapCanvas` | `canvas.tsx` | 平移（空白处拖动）、滚轮缩放（以光标为锚）、fit-to-view、`transform` 应用 |
| `EdgeLayer` | `edge-layer.tsx` | 单个 `<svg>` 绘制全部连线；拖拽时用 rAF 重算 path |
| `MindmapNode` | `node.tsx` | 四种节点渲染（含折叠 chip、添加 chip、拖拽 handler）；`React.memo` |
| `NodeHoverPreview` | `hover-preview.tsx` | 悬停 380ms 出卡：favicon、标题、URL、简介、位置面包屑、打开/收藏按钮；离开 200ms 收起；防出屏翻转 |
| `LayoutRail` | `layout-rail.tsx` | 左侧玻璃轨，四个布局按钮（SVG 微缩示意图 + tooltip），`aria-pressed` |
| `ZoomCluster` | `zoom-cluster.tsx` | 右下 −/百分比/＋/适应画布 |
| `HierarchyLegend` | `legend.tsx` | 左下层级图例 + "拖动区块自由摆放，从属关系与连线始终保留" |
| 布局引擎 | `layout-engine.ts` | **纯函数**：`buildMindmapTree` / `layoutLogicRight` / `layoutBilateral` / `layoutTreeDown` / `layoutIndent` / `edgePath` / `fitCamera`。零 React 依赖，可被测试脚本直接跑 |
| 视图状态 | `src/lib/mindmap-view-state.ts` | localforage 读写 + zustand `useMindmapStore`（layout/collapsed/offsets/camera） |
| 模式切换 | 改 `top-nav.tsx` | 顶栏加 分段控件「经典 / 导图」（样式见大样 `.mode-switch`：胶囊底 + 选中态渐变填充），仅在主视图显示 |

复用不新造：favicon 渲染复用 `web-card.tsx` 的 `getSiteIconCandidates/getSemanticSiteIcon`；悬停卡用现有 `HoverCard`（radix）或大样的手写实现二选一；toast 复用现有顶部状态条方案；添加分类/分组/网页直接打开现有 `CategoryDialog` / `CardDialog`（预填 parentId/categoryId）。

## 6. 交互规范

| 交互 | 行为 | 硬性约束 |
|---|---|---|
| 一键转换 | 顶栏分段控件切换；180ms 交叉淡入 + 1.5% 缩放；进导图后自动 fit | 切换不触发任何数据写入 |
| 节点拖拽 | pointer capture；**整棵子树随根一起平移**；连线实时跟随；位移写入 `offsets[layout][nodeId]` | **只写视图状态，绝不改 parentId/categoryId/order**（需求"血缘固定"）。3px 死区防误拖 |
| 折叠/展开 | 父节点朝外侧的圆形 chip：展开时 hover 显示"−"，折叠时常显子孙计数徽标 | chip `pointerdown` 需 `stopPropagation`，不能触发拖拽 |
| 添加 | 父节点第二个 chip "+"：分项→添加分类、分类→添加分组、分组→添加网页；打开现有对话框，落库后节点带 pop-in 动画出现，toast「已添加 · 与经典模式实时同步」 | 必须走现有 store actions |
| 悬停预览 | 仅网页节点；380ms 延迟出现、离开 200ms 收起；预览卡可进入（可点按钮）；拖拽开始立即隐藏 | 编辑/删除入口 V1 不放预览卡（走经典模式），避免误删风险 |
| 打开网页 | 单击网页节点（非拖拽）= `openWebCollectUrl(url, linkOpenMode)`，与经典模式一致 | 拖拽死区内的 click 才算点击 |
| 平移/缩放 | 空白拖动平移；滚轮缩放 0.25–2.0 以光标为锚；−/＋按钮 ×1.15 步进；适应画布留 60px 边距并避开左轨 | `touch-action: none`；`prefers-reduced-motion` 时关动画 |
| 分项切换 | 顶栏 tab 即切树，每分项独立记忆视图状态 | — |
| 键盘 | Tab 可聚焦节点，Enter 打开/进入，方向键在兄弟/父子间移动焦点（M7 做） | 焦点态用现有 `focus-visible` 外圈 |

## 7. 与经典模式的双向同步（机制说明）

因为两个模式共享同一个 `useAppStore`：

- 导图里添加/改名/删除 → store action → IndexedDB + dirty 标记 → 自动云同步 → 经典模式下次渲染自然一致。**不需要写任何"模式间同步"代码，禁止另建数据副本。**
- 经典模式的增删改 → 导图重建树（`buildMindmapTree` 是 selector 派生），新节点落在自动布局位置。
- 已删除实体的 offsets/collapsed 残留：读取时按现存 nodeId 过滤即可（惰性清理）。

## 8. 实现步骤（M0→M7，每步一个 commit）

每步结束必跑：`corepack pnpm@9.0.0 ts-check && corepack pnpm@9.0.0 lint`、全部 `scripts/test-*.ts`、`corepack pnpm@9.0.0 build:ext`。

- **M0 骨架与开关**：建 `src/components/mindmap/` 目录与空组件、`useMindmapStore`；TopNav 加「经典/导图」分段控件（先只切一个空画布视图）。验收：切换不报错、经典模式零回归。
- **M1 布局引擎 + 测试**：移植大样四个布局函数与 `edgePath` 为纯函数；新增 `scripts/test-mindmap-layout.ts`：① 树构建正确（分项/分类/分组/网页层级、排序）；② 四种布局无节点重叠（包围盒两两相交检查）；③ 组织图下网页为纵向堆叠（同组卡片 x 相同）；④ 折叠后子孙不参与布局。
- **M2 只读画布**：EdgeLayer + MindmapNode 渲染、平移缩放、fit。验收：真实数据 100+ 节点渲染正常，Playwright 截图对照大样。
- **M3 交互**：子树拖拽（offsets）、折叠 chip、悬停预览。验收：拖拽后连线不断、层级数据零变化（用 test 断言 categories/cards 深比较不变）。
- **M4 模式互通**：切换动画、分项 tab 联动、视图状态持久化（localforage per section）。验收：刷新页面后布局/折叠/相机复原。
- **M5 数据操作**：+ chip 接现有对话框；单击打开网页。验收：导图加的网页切回经典模式立即可见，且触发了 dirty 标记（自动同步）。
- **M6 扩展端接入**：`extension/src/newtab-app.tsx` 挂同一组件；核对 `extension.css` 需要的样式（新样式尽量写在共享层，双端只写一份）。验收：`build:ext` 后新标签页可用。
- **M7 打磨与发版**：键盘可达性、空状态（无分类时引导添加）、>300 节点时只渲染视口内节点（简单包围盒裁剪即可）、`prefers-reduced-motion`；Playwright 四布局截图入 `docs/audit/screenshots/`；版本号按当时最新功能版本递增，发 Release。

## 9. 验收清单（对照用户需求逐条）

- [ ] 顶栏一键切换经典⇄导图，往返无数据变化
- [ ] 四种布局可选且各自可用（右逻辑/双侧/组织图/缩进树）
- [ ] 任意拖动节点，连线保留、层级不变（拖完切回经典模式验证结构原样）
- [ ] 网页节点默认只显示图标+标题，悬停出简介预览卡
- [ ] 导图内添加分类/分组/网页，经典模式同步出现，并进入云同步
- [ ] 视觉与主页蓝玻璃一致（对照 5 张落库截图）
- [ ] Web 与 Chrome 扩展新标签页两端可用
- [ ] 刷新后布局选择、折叠状态、相机位置保持

## 10. 风险与禁区

1. **禁止**在拖拽/布局代码里调用 `saveCategories/saveCards` —— 视图状态与业务数据物理隔离是本设计的第一原则。
2. **禁止**为导图另建数据镜像或独立同步通道；一切数据操作走现有 store actions。
3. 不动 `sync.ts` / `db.ts` 业务键；`mindmapViewState:*` 是唯一新增的本地 key。
4. 性能预算：拖拽和平移必须只做 transform/path 更新（rAF 合帧），不允许触发 React 全树重渲染——节点组件必须 `React.memo`，坐标经由 style 直改（参考大样的做法）。
5. 大样中 favicon 是字母色块（离线演示用）；实现时换回现有 favicon 管线，注意 `onerror` 兜底已有现成逻辑。
6. `wc-resolution-viewport` 的 zoom 缩放容器与导图画布的 transform 会叠加——导图视图应挂在 zoom 容器**之外**或对其取逆，M2 时先在两种分辨率下实测再定。

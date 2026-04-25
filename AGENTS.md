# WebCollect — 个人网页收藏墙

## 项目概览

WebCollect 是一个美观、可拖拽的网页收藏与导览门户。用户可以把喜欢的网站像便签一样贴在墙上，支持分类管理、跨分类拖拽、自动抓取网页元数据（Open Graph）。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **状态管理**: Zustand
- **拖拽**: @dnd-kit/core + @dnd-kit/sortable
- **本地存储**: IndexedDB (localforage)
- **OG 抓取**: cheerio (后端 API)
- **主题**: amber 暖色调 + classic 字体 + retro 阴影

## 目录结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fetch-meta/     # OG 信息抓取 API
│   │   │   └── check-safety/   # 网站安全检查 API
│   │   ├── layout.tsx          # 根布局 + metadata
│   │   ├── page.tsx            # 主页面（导航墙）
│   │   └── globals.css         # 主题变量 + Tailwind
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 基础组件
│   │   ├── card/web-card.tsx   # 网站卡片组件
│   │   ├── layout/sortable-grid.tsx  # 拖拽网格布局
│   │   ├── nav/top-nav.tsx     # 顶部导航
│   │   ├── hot-recommendation.tsx  # 热门网站推荐区
│   │   ├── dialogs/            # 添加/编辑弹窗
│   │   └── error-boundary.tsx  # 错误边界组件
│   ├── lib/
│   │   ├── types.ts            # TypeScript 类型定义
│   │   ├── db.ts               # IndexedDB 封装（卡片/分类/隐藏网站）
│   │   ├── store.ts            # Zustand 状态管理
│   │   ├── seed.ts             # 默认示例数据
│   │   ├── hot-sites.ts        # 热门推荐网站数据（主列表 + 补充列表）
│   │   ├── icons.ts            # Lucide 图标静态映射
│   │   └── utils.ts            # 通用工具函数 (cn)
│   └── hooks/                  # 自定义 Hooks
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 构建和测试命令

```bash
# 开发（端口 5000，含 HMR）
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint
```

## 核心功能模块

| 模块 | 文件 | 说明 |
|------|------|------|
| 数据层 | `src/lib/db.ts` | IndexedDB 操作：卡片/分类/隐藏网站的 CRUD、导入导出 |
| 状态管理 | `src/lib/store.ts` | Zustand Store：全局状态、搜索、编辑模式、拖拽重排、分类重排、隐藏网站管理 |
| 卡片组件 | `src/components/card/web-card.tsx` | 条状卡片：8x8 图标/缩写 + 名称 + 简介 + 左边框分类色彩标记 + HoverCard |
| 拖拽布局 | `src/components/layout/sortable-grid.tsx` | flex-wrap 块状布局：自动双列 + resize + 编辑模式拖拽 |
| 添加/编辑 | `src/components/dialogs/card-dialog.tsx` | 弹窗表单：URL、自动抓取、手动编辑 |
| 分类管理 | `src/components/dialogs/category-dialog.tsx` | 分类创建/编辑：12 种图标 + 8 种颜色 |
| 热门推荐 | `src/components/hot-recommendation.tsx` | 热门网站推荐：查重、收集箱快捷添加、隐藏/不感兴趣、安全扫描 |
| OG 抓取 | `src/app/api/fetch-meta/route.ts` | POST {url} → 解析 title/description/image/favicon |
| 安全检查 | `src/app/api/check-safety/route.ts` | POST {urls} → 批量安全检查（白名单/HTTPS/TLD/URL模式） |

## 布局系统设计

### 核心布局模型
- **分类块自动双列**: 卡片数 < 6 的分类块默认 `calc(50% - 6px)`，两两并排；卡片数 >= 6 的大分类默认占满整行
- **用户手动调整优先**: 用户拖拽调整宽度后保存 `widthPercent`，覆盖自动宽度
- **卡片流**: 每个分类块内部使用 `flex flex-wrap`，拉宽块时卡片自动换行到多行
- **双向 resize**: 右边缘拖拽调宽度，底边缘拖拽调高度（双击重置高度）
- **自由拖拽重排**: 编辑模式下每个分类块左侧出现 GripVertical 拖拽手柄，可自由拖拽到任意位置

### 拖拽系统
- **类型前缀 ID**: 分类 `cat:xxx`，卡片 `card:xxx`，碰撞检测只匹配同类型
- **三种拖拽场景**: 分类重排、卡片拖到分类标题（跨分类）、卡片拖到另一卡片
- **编辑模式双层控制**: 全局 editMode + 分类 editingCategoryId

### Resize 交互
- **横向 resize**: 拖拽块右侧边缘的竖线手柄，宽度以百分比存储（最小 30%，最大 100%）
- **纵向 resize**: 拖拽块底部边缘的横线手柄，设置 max-height 后内容可滚动（双击重置为 auto）

## 热门推荐系统

### 数据来源
- **主列表** (`hotSites`): 70+ 全球知名网站，14 个分类
- **补充列表** (`extraHotSites`): 30+ 额外网站，点击"更多"按钮加载

### 查重机制
- 对比用户已有卡片的 URL 域名（`new URL().hostname`）
- 已添加的网站不再从列表中隐藏，而是降低透明度 + 显示 "✓ 已添加" 标记
- 点击"已添加 N"小箭头可展开查看已添加项

### 收集箱功能
- 默认分类 "cat-inbox"（收集箱），用于暂存从热门推荐添加的网站
- 每个热门网站右侧有 "+" 按钮，点击直接添加到收集箱
- 也保留分类选择下拉菜单，可选择添加到指定分类

### 隐藏/不感兴趣机制
- 每个推荐网站有 EyeOff（不感兴趣）按钮
- 点击后弹出时长选择：一周(1w)、两周(2w)、一个月(1m)、永久(permanent)
- 隐藏的网站显示为灰色 + 删除线 + Eye 图标（可取消隐藏）
- 数据存储在 IndexedDB 的 `hiddenSites` 中（per-user 设计，未来按 userId 隔离）
- 页面加载时自动清理过期的隐藏记录（非 permanent 的到期自动恢复显示）

### 智能排序与折叠
- 有未添加网站的分类排在前面
- 全部已添加的分类自动排到最后，默认折叠，显示灰色"全部已添加 (N)"标签
- 点击小箭头可展开查看

### 安全扫描
- 批量 API: POST {urls: string[]} → {results: SafetyCheckResult[]}
- 多层检查：白名单(100+域名) + HTTPS + 可疑TLD + URL模式 + HTTP可达性
- 页面加载时自动扫描前 20 个未添加网站

## 关键数据类型

```ts
interface WebCard {
  id: string;
  url: string;
  title: string;
  shortDesc: string;
  fullDesc: string;
  note: string;
  abbreviation: string;
  imageUrl: string;
  categoryId: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;   // lucide icon name
  color: string;  // hex color
  order: number;
  createdAt: number;
}

type HideDuration = "1w" | "2w" | "1m" | "permanent";

interface HiddenSite {
  siteId: string;
  siteUrl: string;
  hiddenAt: number;
  duration: HideDuration;
}

interface UserPreferences {
  hiddenSites: HiddenSite[];
}
```

## 用户偏好与开发规范（CRITICAL）

> 以下规则来自用户反复强调的要求，每次修改代码前必须遵守。

### 1. 不改没让改的地方
- 用户没有明确要求修改的内容，绝对不要动
- 特别是上方卡片墙的分类、网站数据，不要随意增删改
- 每次只改用户要求的功能，不要"顺手"改其他地方

### 2. 布局不能有大面积留白
- 页面右侧不能有大面积空白
- 分类块默认两列并排自动排列（卡片数 < 6 占 50%，>= 6 占 100%）
- 热门推荐区域用多列网格填满
- 卡片内容用 flex-wrap 自动换行，拉宽时自然填充

### 3. 图标/图片必须持久化
- favicon 一旦获取就保存到 IndexedDB，代码更新不能丢失
- seed 数据中的 imageUrl 使用可靠的 Google Favicon API
- 三层回退：card.imageUrl → Google Favicon API → 缩写占位
- 数据迁移：loadData 时自动为空 imageUrl 的卡片补充 favicon URL

### 4. 每个功能必须可用
- 做完功能后必须自测：点击每个按钮，确认不崩溃
- 弹窗必须有 DialogDescription（Radix UI accessibility 要求）
- 关键组件包裹 ErrorBoundary，防止单点崩溃拖死整页
- store 中所有被调用的函数必须存在（如 toggleEditMode）

### 5. 分类块可编辑
- 点击分类标题旁的铅笔图标，同时打开分类编辑弹窗和卡片编辑模式
- 可修改分类名称、图标、颜色

### 6. 热门推荐的行为规范
- 已添加的网站不隐藏，而是灰色标记 "✓ 已添加"
- 全部已添加的分类折叠到底部
- 所有分类默认展开（不用手风琴折叠）
- "不感兴趣"的网站可隐藏，有4种时长可选
- 推荐网站要尽量多、尽量全，涵盖国内外主流网站
- 只有验证过的知名网站才能进入推荐列表

### 7. 代码质量
- 禁止隐式 `any`
- Lucide 图标使用静态映射，不要动态创建组件
- 颜色使用 Tailwind 语义化变量（bg-card, text-foreground 等）
- 禁止蓝紫色渐变（AI 味太浓）
- 字体：font-serif（Noto Serif SC）用于标题，font-sans 用于正文

### 8. 数据安全（CRITICAL — 用户反复强调）
- **严禁覆盖用户已有数据**：初始化时必须 MERGE（合并），绝不能覆盖
- page.tsx 中的初始化逻辑：只添加缺失的默认分类/卡片，不删除已有内容
- store.ts 的 loadData：包含恢复机制 — 如果 categories 为空但 initialized=true，自动合并默认数据
- 用户手动添加/修改的分类、卡片、大分类等，代码更新时绝不丢失
- 每次修改 seed.ts 时，只能添加新的默认项，不能删除已有的默认分类 ID
- 如果需要清除浏览器数据重建，用户需手动清除 IndexedDB

## Chrome 插件预留

- 数据操作通过 `store.ts` 抽象，未来可替换底层为 Chrome Storage API
- 卡片数据格式标准化（UUID、创建时间、标签、URL、元数据）
- 导入/导出 JSON 功能已就绪，便于插件数据迁移
- 抓取逻辑通过后端 API 实现，插件版可直接通过 content script 读取 tab 信息
- 隐藏网站数据 (hiddenSites) 按 per-user 设计，未来可按 userId 隔离

## 常见问题

### 拖拽时卡片闪烁/跳动
检查 `SortableContext` 的 `items` 是否正确更新，确保 `order` 字段在拖拽后重新排序。

### OG 抓取失败
部分网站有反爬虫机制或需要特定 User-Agent。已在 `fetch-meta` 中设置浏览器 UA 和 8s 超时。

### 图片跨域不显示
外部图片通过 `<img>` 标签直接加载，若网站禁止跨域则显示缩写占位。

### resize 不生效
确保拖拽的是右侧或底部的细线手柄，而非卡片内容区域。

### Lucide 图标 static-components 报错
不要在渲染时动态创建组件，应使用 switch-case 直接渲染具体图标组件。

### 安全检查 API 返回 400
确保 POST body 使用 `{urls: [...]}` 格式（批量）或 `{url: "..."}` 格式（单条）。

### HMR 缓存导致旧代码
删除 `.next` 目录后重启 dev server：`rm -rf .next && pnpm dev`。

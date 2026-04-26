# WebCollect — 个人网页收藏墙

## ⚠️ 开发第一要义：严禁擅自删除数据 (CRITICAL)

> **这是所有规则中最重要的规则，违反此规则将导致用户数据丢失，必须回滚重做。**

### 核心原则
1. **绝不删除用户数据**：用户在页面上添加的分类、网站、置顶设置、隐藏记录等，都是用户的财产
2. **绝不覆盖用户数据**：修改代码时，`seed.ts` 中的默认数据只能增加，不能减少或替换
3. **绝不擅自修改用户已定好的内容**：分类名称、网站URL、图标颜色等，用户没让你改就不准改
4. **每次改代码前必须备份**：先读取当前数据，确认不会破坏已有内容后再动手

### 数据保护流程 (MANDATORY)
```
1. 读取 seed.ts 当前所有分类和卡片数据
2. 确认改动范围，标记哪些数据不能动
3. 只在用户明确要求的位置做修改
4. 改完后再次确认：原有数据是否完整保留
5. 如果发现数据丢失，立即恢复
```

### 当前种子数据快照 (seed.ts)

#### 父分类（顶级分类）
| ID | 名称 | 图标 | 颜色 | 排序 |
|----|------|------|------|------|
| cat-work | 工作 | Briefcase | #B8860B | 0 |
| cat-ai | AI | Brain | #8B5CF6 | 1 |
| cat-dev | 开发 | Terminal | #4A7C59 | 2 |
| cat-inbox | 收集箱 | Inbox | #888888 | 99 |

#### 子分组（二级分组）
| ID | 名称 | 图标 | 颜色 | 父分类 | 排序 |
|----|------|------|------|--------|------|
| cat-1 | 常用 | Star | #B8860B | cat-work | 0 |
| cat-3 | 设计灵感 | Palette | #9B7E8E | cat-work | 1 |
| cat-2 | AI工具 | Wrench | #4A6FA5 | cat-ai | 0 |
| cat-4 | 开发者 | Code2 | #4A7C59 | cat-dev | 0 |
| cat-5 | 阅读 | BookOpen | #8B6F5C | cat-dev | 1 |

#### 默认网站卡片
| 分组 | 名称 | URL |
|------|------|-----|
| 常用 | Notion | https://www.notion.so |
| 常用 | Google | https://www.google.com |
| 常用 | ChatGPT | https://chat.openai.com |
| 常用 | Gmail | https://mail.google.com |
| AI工具 | ChatGPT | https://chat.openai.com |
| AI工具 | Claude | https://claude.ai |
| AI工具 | Gemini | https://gemini.google.com |
| AI工具 | Midjourney | https://www.midjourney.com |
| 设计灵感 | Figma | https://www.figma.com |
| 设计灵感 | Dribbble | https://dribbble.com |
| 设计灵感 | Are.na | https://www.are.na |
| 设计灵感 | Behance | https://www.behance.net |
| 开发者 | GitHub | https://github.com |
| 开发者 | Stack Overflow | https://stackoverflow.com |
| 开发者 | Vercel | https://vercel.com |
| 开发者 | npm | https://www.npmjs.com |
| 阅读 | 掘金 | https://juejin.cn |
| 阅读 | 知乎 | https://www.zhihu.com |
| 阅读 | Medium | https://medium.com |

> ⚠️ 用户可能在页面上额外添加了分类（如"AI设计"、"AI开发"、"搜索"、"墙内"、"影音"等），这些存储在 IndexedDB 中，代码层面绝不能清除。

---

## 项目概览

WebCollect 是一个美观、可拖拽的网页收藏与导览门户。用户可以把喜欢的网站像便签一样贴在墙上，支持分类管理、跨分类拖拽、自动抓取网页元数据（Open Graph）。

### 双平台架构

WebCollect 同时支持 **Web 版本**（Next.js）和 **Chrome 扩展版本**（Vite + React SPA），共享同一套核心组件和数据层。

| 平台 | 入口 | 构建 | 存储方式 |
|------|------|------|---------|
| Web | `src/app/` | `pnpm build` (Next.js) | IndexedDB |
| Chrome 扩展 | `extension/src/` | `pnpm build:ext` (Vite) | IndexedDB / chrome.storage |

### 版本技术栈

- **Framework**: Next.js 16 (App Router) / Vite (扩展版)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **状态管理**: Zustand
- **拖拽**: @dnd-kit/core + @dnd-kit/sortable
- **本地存储**: IndexedDB (localforage)
- **OG 抓取**: cheerio (后端 API) / 客户端 CORS 代理 (扩展版)
- **平台适配**: `src/lib/platform.ts` — 统一 API 调用接口
- **主题**: amber 暖色调 + classic 字体 + retro 阴影

## 目录结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
├── extension/                  # Chrome 扩展
│   ├── src/
│   │   ├── newtab.html         # 扩展新标签页 HTML 入口
│   │   ├── newtab.tsx          # React 挂载入口
│   │   ├── newtab-app.tsx      # 扩展版 App 组件（状态路由）
│   │   └── stubs/              # Next.js 模块替换（next/link, next-themes）
│   ├── dist/                   # 构建产物（加载到 Chrome 的目录）
│   ├── manifest.json           # Chrome Manifest V3
│   ├── background.js           # Service Worker（OG 抓取代理）
│   ├── vite.config.ts          # Vite 构建配置
│   └── build.sh                # 构建脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fetch-meta/     # OG 信息抓取 API
│   │   │   ├── check-safety/   # 网站安全检查 API
│   │   │   └── supabase-config/ # Supabase 配置 API（提供 URL + anon key 给浏览器）
│   │   ├── auth/callback/      # OAuth 回调路由
│   │   ├── warehouse/            # 仓库（导入）页面
│   │   ├── layout.tsx          # 根布局 + metadata
│   │   ├── page.tsx            # 主页面（导航墙）
│   │   └── globals.css         # 主题变量 + Tailwind
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 基础组件
│   │   │   ├── platform-link.tsx   # 平台感知链接（Web: next/link, Ext: <a>）
│   │   ├── auth/
│   │   │   └── user-menu.tsx       # 登录按钮 + 用户头像菜单 + 同步状态
│   │   ├── card/
│   │   │   ├── web-card.tsx          # 主页网站卡片
│   │   │   └── warehouse-card.tsx    # 仓库网站卡片
│   │   ├── layout/
│   │   │   ├── sortable-grid.tsx     # 主页拖拽网格布局
│   │   │   └── warehouse-grid.tsx    # 仓库网格布局
│   │   ├── nav/top-nav.tsx     # 顶部导航（含登录按钮）
│   │   ├── hot-recommendation.tsx  # 热门网站推荐区
│   │   ├── dialogs/
│   │   │   ├── card-dialog.tsx       # 添加/编辑网页卡片
│   │   │   ├── category-dialog.tsx   # 分类创建/编辑
│   │   │   ├── import-dialog.tsx     # 仓库导入弹窗
│   │   │   ├── ship-to-main-dialog.tsx # 仓库发货到主页弹窗
│   │   │   └── recycle-bin-dialog.tsx # 回收站弹窗（恢复/永久删除）
│   │   └── error-boundary.tsx  # 错误边界组件
│   ├── lib/
│   │   ├── types.ts            # TypeScript 类型定义
│   │   ├── db.ts               # IndexedDB 封装（主页卡片/分类/隐藏网站/置顶分类/回收站）
│   │   ├── db-warehouse.ts     # 仓库 IndexedDB 封装（独立命名空间）
│   │   ├── platform.ts         # 平台适配器（Web API / Chrome 扩展 API 统一接口）
│   │   ├── store.ts            # 主页 Zustand 状态管理
│   │   ├── store-warehouse.ts  # 仓库 Zustand 状态管理
│   │   ├── auth-store.ts       # Auth Zustand 状态管理（Google OAuth + 会话）
│   │   ├── sync.ts             # 本地↔云端数据同步服务
│   │   ├── supabase-browser.ts # 浏览器端 Supabase 客户端（轻量，无 Node.js 依赖）
│   │   ├── import-parser.ts    # Homely JSON 解析器
│   │   ├── seed.ts             # 默认示例数据
│   │   ├── hot-sites.ts        # 热门推荐网站数据（主列表 + 补充列表）
│   │   ├── icons.ts            # Lucide 图标静态映射
│   │   └── utils.ts            # 通用工具函数 (cn)
│   ├── storage/database/       # Supabase 数据库
│   │   ├── supabase-client.ts  # 服务器端 Supabase 客户端（Node.js 环境）
│   │   └── shared/schema.ts    # 数据库 Schema (Drizzle ORM)
│   └── hooks/                  # 自定义 Hooks
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 构建和测试命令

```bash
# 开发（Web 版本，端口 5000，含 HMR）
pnpm dev

# 构建 Web 版本
pnpm build

# 构建 Chrome 扩展版本
pnpm build:ext

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint
```

## 核心功能模块

| 模块 | 文件 | 说明 |
|------|------|------|
| 数据层 | `src/lib/db.ts` | IndexedDB 操作：卡片/分类/隐藏网站/置顶分类的 CRUD、导入导出 |
| 状态管理 | `src/lib/store.ts` | Zustand Store：全局状态、搜索、编辑模式、拖拽重排、分类降级/升级、隐藏网站管理、置顶分类、默认屏蔽时长 |
| 卡片组件 | `src/components/card/web-card.tsx` | 两行卡片：favicon + 名称(行1) + 简介(行2) + 左边框分类色彩标记 + HoverCard |
| 拖拽布局 | `src/components/layout/sortable-grid.tsx` | 三级层级布局：分类→分组→网页 + 降级/升级拖拽 + 编辑模式 |
| 添加/编辑 | `src/components/dialogs/card-dialog.tsx` | 弹窗表单：URL、自动抓取、手动编辑 |
| 分类管理 | `src/components/dialogs/category-dialog.tsx` | 分类创建/编辑：12 种图标 + 8 种颜色 |
| 热门推荐 | `src/components/hot-recommendation.tsx` | 热门网站推荐：查重、收集箱快捷添加、隐藏/不感兴趣、安全扫描、设置面板 |
| OG 抓取 | `src/app/api/fetch-meta/route.ts` | POST {url} → 解析 title/description/image/favicon |
| 平台适配 | `src/lib/platform.ts` | 统一 API 调用：Web 调 /api/*，扩展调 chrome.runtime.sendMessage |
| 扩展入口 | `extension/src/newtab-app.tsx` | 扩展版 App：状态路由（main/warehouse），复用共享组件 |
| 扩展构建 | `extension/vite.config.ts` | Vite 构建：别名替换 next/link, next-themes；输出到 extension/dist |
| 安全检查 | `src/app/api/check-safety/route.ts` | POST {urls} → 批量安全检查（白名单/HTTPS/TLD/URL模式） |
| 仓库数据层 | `src/lib/db-warehouse.ts` | 仓库独立 IndexedDB：卡片/分类/导入批次的 CRUD，与主页数据隔离 |
| 仓库状态 | `src/lib/store-warehouse.ts` | 仓库 Zustand Store：仓库数据加载、导入、删除、发货到主页 |
| 导入解析 | `src/lib/import-parser.ts` | Homely JSON 解析器：识别分组类型、映射到三级模型、过滤无效链接 |
| 仓库页面 | `src/app/warehouse/page.tsx` | 独立仓库页面：导入预览、批次管理、一键删除/覆盖、发货到主页 |
| 仓库网格 | `src/components/layout/warehouse-grid.tsx` | 仓库专用网格布局（只读展示，无拖拽编辑） |
| 仓库卡片 | `src/components/card/warehouse-card.tsx` | 仓库专用卡片（精简样式，显示批次标签） |
| 导入弹窗 | `src/components/dialogs/import-dialog.tsx` | JSON 上传 → 解析预览 → 确认导入 |
| 发货弹窗 | `src/components/dialogs/ship-to-main-dialog.tsx` | 选择分组/分类 → 选择主页目标 → 一键发货 |
| 回收站 | `src/components/dialogs/recycle-bin-dialog.tsx` | 查看/恢复/永久删除回收站条目 |
| 软删除 | `src/lib/store.ts` (softDelete*) | 分类/分组/卡片删除 → 移入回收站 → 可恢复 |
| 回收站数据层 | `src/lib/db.ts` (recycleBin*) | IndexedDB 存储回收站条目的 CRUD |
| 认证 | `src/lib/auth-store.ts` | Auth Zustand Store：Google OAuth 登录、会话管理、同步触发 |
| 同步服务 | `src/lib/sync.ts` | 本地 IndexedDB ↔ 云端 Supabase 同步：Last-Write-Wins 合并 |
| 浏览器客户端 | `src/lib/supabase-browser.ts` | 浏览器端 Supabase 客户端（轻量，无 Node.js 依赖） |
| Supabase 配置 | `src/app/api/supabase-config/route.ts` | API 路由：为浏览器提供 Supabase URL + anon key |
| OAuth 回调 | `src/app/auth/callback/route.ts` | OAuth 重定向回调处理 |
| 用户菜单 | `src/components/auth/user-menu.tsx` | 登录按钮 + 用户头像/菜单 + 同步状态指示器 |
| 数据库 Schema | `src/storage/database/shared/schema.ts` | Supabase 数据库表定义（users, categories, cards, user_preferences） |
| 数据库客户端 | `src/storage/database/supabase-client.ts` | 服务器端 Supabase 客户端（Node.js 环境，含 loadEnv） |

## 布局系统设计

### 三级层级结构
- **分类（Parent Category）**: 顶级容器，如"工作"、"AI"、"开发"，包含一个或多个分组
- **分组（Sub-Group）**: 二级容器，有 `parentId` 指向父分类，如"常用"、"AI工具"、"开发者"
- **网页（WebCard）**: 最小单元，属于某个分组

### 降级模式（编辑模式）
- **未分类区域**: 页面底部显示"未分类"区域，包含所有没有 `parentId` 且没有子分组的分类
- **拖拽降级**: 编辑模式下，"未分类"区域的分组可以拖拽到父分类头部区域，自动设置 `parentId`
- **升级为分类**: 父分类内的分组有"升级"按钮（ArrowUpFromLine 图标），点击后移回"未分类"
- **拖拽ID前缀**: 父分类 `cat:xxx`，未分类分组 `ungrouped:xxx`，父分类放置区 `drop-parent:xxx`
- **Store 方法**: `moveCategoryToParent(categoryId, parentId)` 和 `detachCategoryFromParent(categoryId)`

### 核心布局模型
- **分类块自动双列**: 卡片数 < 6 的分类块默认 `calc(50% - 6px)`，两两并排；卡片数 >= 6 的大分类默认占满整行
- **用户手动调整优先**: 用户拖拽调整宽度后保存 `widthPercent`，覆盖自动宽度
- **卡片流**: 每个分类块内部使用 `flex flex-wrap`，拉宽块时卡片自动换行到多行
- **自由拖拽重排**: 编辑模式下每个分类块左侧出现 GripVertical 拖拽手柄，可自由拖拽到任意位置

### 拖拽系统
- **类型前缀 ID**: 父分类 `cat:xxx`，未分类分组 `ungrouped:xxx`，卡片 `card:xxx`，父分类放置区 `drop-parent:xxx`
- **拖拽场景**: 父分类重排、未分类分组重排、分组降级到父分类、卡片跨分组拖拽
- **编辑模式双层控制**: 全局 editMode + 分类 editingCategoryId

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
- 点击后直接屏蔽（默认1周），不再弹出时长选择器
- 被屏蔽的网站从列表中消失，不再灰色展示
- 屏蔽时长可在设置中修改：一周(1w)、两周(2w)、一个月(1m)、永久(permanent)
- EyeOff 图标 hover 提示："可在'热门网站推荐设置'中选择屏蔽时长"
- 数据存储在 IndexedDB 的 `hiddenSites` 中（per-user 设计，未来按 userId 隔离）
- 页面加载时自动清理过期的隐藏记录（非 permanent 的到期自动恢复显示）

### 设置面板
- 热门推荐右上角齿轮图标，点击打开
- 包含：统计信息（可添加/已添加/已隐藏）、默认屏蔽时长、安全扫描
- 原"多少可添加/已添加"文字已收纳进设置面板

### 智能排序与折叠
- 有未添加网站的分类排在前面
- 全部已添加的分类自动排到最后，默认折叠，显示灰色"全部已添加 (N)"标签
- 点击小箭头可展开查看

### 安全扫描
- 批量 API: POST {urls: string[]} → {results: SafetyCheckResult[]}
- 多层检查：白名单(100+域名) + HTTPS + 可疑TLD + URL模式 + HTTP可达性
- 页面加载时自动扫描前 20 个未添加网站

### 分类选择与置顶
- 分类选择使用 Popover + 3列网格布局（320px 宽）
- 每个分类项 hover 时右上角出现 Pin 图标，点击置顶/取消
- 已置顶分类排在前面，Pin 图标始终显示+蓝色高亮
- 置顶数据保存到 IndexedDB，刷新不丢失

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
  parentId?: string; // 父分类ID，有此字段表示是"分组"(子分类)，无此字段表示是"分类"(顶级)
  isParent?: boolean; // true = 顶级分类（如"开发"），false/undefined = 分组或未分类项
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
  pinnedCategoryIds: string[];
  defaultHideDuration: HideDuration;
}

interface RecycleBinItem {
  id: string;           // unique bin entry ID
  type: "category" | "group" | "card";
  name: string;         // display name for the recycle bin UI
  deletedAt: number;    // timestamp when deleted
  categories: Category[];  // affected categories (for category: parent + children)
  cards: WebCard[];     // affected cards
}
```

## 用户偏好与开发规范（CRITICAL）

> 以下规则来自用户反复强调的要求，每次修改代码前必须遵守。

### 1. ⚠️ 严禁擅自删除数据（最高优先级）
- **绝不删除用户数据**：分类、网站、置顶设置、隐藏记录等
- **绝不覆盖用户数据**：seed.ts 默认数据只能增加，不能减少
- **绝不擅自修改用户已定好的内容**：分类名称、网站URL等
- **每次改代码前必须备份**：先读取当前数据，确认不会破坏已有内容

### 2. 不改没让改的地方
- 用户没有明确要求修改的内容，绝对不要动
- 特别是上方卡片墙的分类、网站数据，不要随意增删改
- 每次只改用户要求的功能，不要"顺手"改其他地方

### 3. 布局不能有大面积留白
- 页面右侧不能有大面积空白
- 分类块默认两列并排自动排列（卡片数 < 6 占 50%，>= 6 占 100%）
- 热门推荐区域用多列网格填满
- 卡片内容用 flex-wrap 自动换行，拉宽时自然填充

### 4. 图标/图片必须持久化
- favicon 一旦获取就保存到 IndexedDB，代码更新不能丢失
- seed 数据中的 imageUrl 使用可靠的 Google Favicon API
- 三层回退：card.imageUrl → Google Favicon API → 缩写占位
- 数据迁移：loadData 时自动为空 imageUrl 的卡片补充 favicon URL

### 5. 每个功能必须可用
- 做完功能后必须自测：点击每个按钮，确认不崩溃
- 弹窗必须有 DialogDescription（Radix UI accessibility 要求）
- 关键组件包裹 ErrorBoundary，防止单点崩溃拖死整页
- store 中所有被调用的函数必须存在（如 toggleEditMode）

### 6. 分类块可编辑
- 点击分类标题旁的铅笔图标，同时打开分类编辑弹窗和卡片编辑模式
- 可修改分类名称、图标、颜色

### 7. 热门推荐的行为规范
- 已添加的网站不隐藏，而是灰色标记 "✓ 已添加"
- 全部已添加的分类折叠到底部
- 所有分类默认展开（不用手风琴折叠）
- "不感兴趣"的网站点击 EyeOff 直接屏蔽（默认1周）
- 屏蔽时长可在设置中修改
- 推荐网站要尽量多、尽量全，涵盖国内外主流网站
- 只有验证过的知名网站才能进入推荐列表

### 8. 代码质量
- 禁止隐式 `any`
- Lucide 图标使用静态映射，不要动态创建组件
- 颜色使用 Tailwind 语义化变量（bg-card, text-foreground 等）
- 禁止蓝紫色渐变（AI 味太浓）
- 字体：font-serif（Noto Serif SC）用于标题，font-sans 用于正文

### 9. 编辑模式铁律（CRITICAL — 用户反复强调）
- **必须有退出编辑的入口**：进入编辑模式后，必须有明确方式退出（按钮/双击空白处）
- **编辑按钮位置**：每个分类头部 hover 显示编辑按钮，点击进入编辑模式
- **退出编辑按钮**：编辑模式下，每个分类头部显示"退出编辑"按钮（替代编辑按钮）
- **双击空白退出**：编辑模式下，双击页面任意空白区域可退出编辑模式
- **不得删除已有功能**：每次改代码前确认不会破坏已实现的功能，改完必须验证

### 10. 改动影响检查（铁律补充）
- **改前确认范围**：先读代码，标记改哪些文件、哪些函数
- **改后对比检查**：改完后对比改动范围，确认没有误改其他逻辑
- **如果发现新 bug**：立即回滚到上一版本，重新审视需求后再修改
- **不要"顺手优化"**：用户没让你改的地方绝对不要动

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

---

## 开发反思与防错指南（CRITICAL）

> 以下内容来自实际开发中的教训总结。每次修改代码前必须通读此章节，避免重蹈覆辙。

### 三条铁律

#### 铁律一：改前先备份数据
1. 修改代码前，先读取 `seed.ts` 和用户可能存在的 IndexedDB 数据（通过 `store.ts` 的 `loadData`）
2. 确认修改范围：只动需要动的文件和函数
3. 绝对不要在修改功能代码时"顺手"改数据结构、删默认分类、改网站 URL
4. 改完后二次确认：原有数据是否完整保留

#### 铁律二：严格只改用户要求的内容
1. 用户让改什么就改什么，不要"顺便优化"其他代码
2. 如果用户指令有歧义，**必须停下来确认**，不要自作主张
3. 改 A 功能时，不要碰 B 功能的代码，即使你觉得"顺便修一下更好"
4. 以下是容易混淆的点，务必确认后再动手：
   - "分类"（顶级大类，如"开发"）vs "分组"（子分类，如"常用"）→ 用户说"分类"就是顶级，说"分组"就是子级
   - "升级"（分组→顶级分类）vs "脱离/提级"（从父分类移出回到未分类）→ 需确认用户要哪个
   - "拉宽"（调整宽度）vs "拉伸"（同义，都是 resize）→ 同一个意思
   - "降级"（顶级分类→分组）vs "拖入"（把未分类分组拖到父分类里）→ 降级是大类变小组，拖入是小分组归入大类

#### 铁律三：改完必须自测三遍
1. **编译检查**：`pnpm ts-check` + `pnpm lint` 必须零错误
2. **服务存活**：`curl -I -s --max-time 3 http://localhost:5000` 确认 200
3. **功能验证**：在页面上实际操作修改的功能，确认可用
4. **回归验证**：确认之前正常的功能没有被破坏
5. **日志检查**：`tail -n 50 /app/work/logs/bypass/app.log /app/work/logs/bypass/console.log | grep -iE "error|exception"` 无新错误

### 历史错误档案

#### 错误 1：拉伸与拖动事件冲突（发生 3 次）

**现象**：点击拉伸手柄无法拖动，或者拖动时同时触发了排序拖拽。

**根因**：dnd-kit 使用 `PointerSensor` 监听 `pointerdown` 事件，而拉伸手柄使用 `onMouseDown`。两者是不同的事件系统，`e.stopPropagation()` 只能阻止同级事件冒泡，不能跨事件类型。

**正确做法**：
```tsx
// ✅ 正确：在拉伸手柄上同时用 onPointerDown 阻止 dnd-kit，onMouseDown 处理拉伸逻辑
<div
  className="resize-handle"
  onPointerDown={(e) => e.stopPropagation()}  // 阻止 pointerdown 冒泡到 dnd-kit
  onMouseDown={handleResizeStart}              // 正常处理拉伸
/>

// ❌ 错误：在 onPointerDown 中调用 preventDefault()
<div
  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
  onMouseDown={handleResizeStart}
/>
// preventDefault() 会阻止浏览器生成后续的 mousedown 事件，
// 导致 handleResizeStart 永远不会被触发！
```

**关键记忆**：`preventDefault()` 和 `stopPropagation()` 作用不同——前者阻止浏览器默认行为（可能抑制后续事件），后者阻止事件冒泡。拉伸场景只需 `stopPropagation()`。

---

#### 错误 2：flex 布局中 width / minWidth / flex-basis 的混淆（发生 4 次）

**现象**：
- 拉宽一个分组后，相邻分组被挤压成两行
- 拉宽后分组内部出现留白
- 外部分类拉宽后，内部分组没有自动填充

**根因**：在 flex 容器中，`width`、`minWidth`、`flex: 0 0 XX%`、`flex: 1 1 0%` 的行为完全不同：

| CSS 属性 | 行为 | 适用场景 |
|----------|------|----------|
| `width: XX%` | 固定宽度，flex 项目可能被压缩 | 全宽独占的块（父分类） |
| `minWidth: XX%` | 最小宽度，内容超出可扩展 | 需要保底但不限宽的场景 |
| `flex: 0 0 XX%` | 固定基准，不增不减 | 手动调整过宽度的分组 |
| `flex: 1 1 0%` | 均分空间，可增可减 | 默认未调整的分组 |
| `shrink-0` | 永不压缩 | 会导致相邻项换行而非压缩 |

**正确做法（"包中包"模型）**：
```
外层分类（width: XX%）→ 占据页面指定比例宽度
  └─ 内层分组（flex: 1 1 0%）→ 均匀填充分类空间
     └─ 卡片（min-w-[140px] flex-1）→ 在分组内自适应排列
```
- 外层拉宽 → 内层分组自动填满（`flex: 1 1 0%` 自然扩展）
- 内层分组拉伸 → 设为 `flex: 0 0 XX%`，其余分组压缩（`flex: 1 1 0%` 自然收缩）
- 不用 `shrink-0`，除非明确不想让某项被压缩

**关键记忆**：用户说的"包中包"模型——外层包变大，里面的东西自动跟着变；里面某个东西变大了，旁边的就被挤小。这就是 flex 的 `grow` 和 `shrink` 的本职工作，不要用 `shrink-0` 强行禁用。

---

#### 错误 3：跨 SortableContext 拖拽失败（发生 1 次）

**现象**：从"未分类"区域拖分组到上方父分类时，拖到中间就"丢了"，无法放下。

**根因**：最初把父分类和未分类分组放在两个独立的 `SortableContext` 中，`closestCenter` 碰撞检测只能匹配同一 Context 内的项目。

**正确做法**：所有顶层可拖拽项放在同一个 `SortableContext`，碰撞检测用 `pointerWithin` + `rectIntersection` 组合策略。通过 ID 前缀（`cat:xxx`、`ungrouped:xxx`）区分拖拽类型。

---

#### 错误 4：数据模型变更未考虑布局影响（发生 1 次）

**现象**：添加 `isParent` 字段后，"添加分类"创建的分类出现在"未分类"区域而非顶级分类区域。

**根因**：布局代码用 `!c.parentId && categories.some(sg => sg.parentId === c.id)` 判断顶级分类，新创建的分类没有 `parentId` 也没有子分组，所以被归入"未分类"。

**正确做法**：数据模型变更必须同步更新布局逻辑。添加 `isParent` 字段后，布局判断条件也要改为 `!c.parentId && (c.isParent || hasSubGroups)`。

---

#### 错误 5：改了 A 坏了 B（发生多次）

**现象**：修复拖拽手柄后卡片的编辑/删除按钮消失了；修复分组宽度后卡片的固定宽度丢了。

**根因**：在修改一个组件时，不自觉地改动了其他逻辑分支的代码。例如修改 `editMode` 条件时改了 `if` 的范围，影响了旁边的按钮渲染。

**正确做法**：
1. 修改前先通读目标函数/组件的完整代码
2. 用注释标记要改的行，确认不影响其他分支
3. 改完后 `git diff` 逐行检查，确保只改了目标代码
4. 回归测试：确认相关功能仍然正常

---

#### 错误 6：HMR 缓存导致改了等于没改（发生 2 次）

**现象**：修改了代码但页面行为没变化，或者出现已修复的旧错误。

**根因**：`.next` 缓存了旧编译结果，HMR 有时无法正确增量更新。

**正确做法**：如果修改后页面行为异常，先 `rm -rf .next` 清缓存，再重启 dev server。

---

### 拖拽系统速查

#### ID 前缀规则
| 前缀 | 含义 | 可拖拽目标 |
|------|------|-----------|
| `cat:xxx` | 父分类 | 重排序 |
| `ungrouped:xxx` | 未分类分组 | 重排序 / 拖入父分类降级 |
| `sub:xxx` | 父分类内的子分组 | 重排序 |
| `card:xxx` | 网页卡片 | 跨分组拖拽 |
| `drop-parent:xxx` | 父分类放置区 | 接收未分类分组降级 |

#### 拖拽与拉伸的事件隔离
```tsx
// 拉伸手柄模板（三个层级通用）
<div
  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20"
  onPointerDown={(e) => e.stopPropagation()}  // 阻止 dnd-kit 捕获
  onMouseDown={handleResizeStart}              // 处理拉伸逻辑
/>
```

#### 拉伸逻辑模板
```tsx
const handleResizeStart = (e: React.MouseEvent) => {
  e.stopPropagation();
  const container = resizeRef.current;
  if (!container) return;
  const startX = e.clientX;
  const startWidth = container.offsetWidth;

  const handleMouseMove = (me: MouseEvent) => {
    const dx = me.clientX - startX;
    const parentWidth = container.parentElement?.offsetWidth || 1;
    const newPercent = Math.max(15, Math.min(100, ((startWidth + dx) / parentWidth) * 100));
    container.style.width = `${newPercent}%`;
    setCategoryWidth(category.id, newPercent);  // 持久化
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

#### Flex 布局速查
```
父分类块：style={{ width: `${widthPercent}%` }} + overflow-hidden
  └─ 子分组容器：flex flex-wrap gap-3
       ├─ 未调整分组：flex: 1 1 0%（均分空间）
       └─ 手动调整分组：flex: 0 0 XX%（固定宽度）
            └─ 卡片容器：flex flex-wrap gap-1
                 └─ 单个卡片：min-w-[140px] flex-1（自适应）
```

### 每次修改前的 Checklist

```
□ 1. 读取当前 seed.ts 和相关文件，确认数据不会丢失
□ 2. 只改用户要求的文件和函数，标记不动的地方
□ 3. 改完后 pnpm ts-check + pnpm lint 确认零错误
□ 4. curl 确认服务存活
□ 5. 在页面上实际操作修改的功能
□ 6. 回归测试：拖拽、拉伸、添加/编辑/删除、升级/降级
□ 7. 检查日志无新错误
□ 8. git diff 确认只改了目标代码
```

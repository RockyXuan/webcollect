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
│   │   ├── api/fetch-meta/     # OG 信息抓取 API
│   │   ├── layout.tsx          # 根布局 + metadata
│   │   ├── page.tsx            # 主页面（导航墙）
│   │   └── globals.css         # 主题变量 + Tailwind
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 基础组件
│   │   ├── card/web-card.tsx   # 网站卡片组件（条状 + 左边框色彩标记 + Hover 详情浮层）
│   │   ├── layout/sortable-grid.tsx  # 拖拽网格布局（flex-wrap 内容流 + 双向 resize）
│   │   ├── nav/top-nav.tsx     # 顶部导航 + 搜索 + 编辑模式
│   │   └── dialogs/            # 添加/编辑弹窗
│   ├── lib/
│   │   ├── types.ts            # TypeScript 类型定义
│   │   ├── db.ts               # IndexedDB 封装
│   │   ├── store.ts            # Zustand 状态管理
│   │   ├── seed.ts             # 默认示例数据（18 个网站、5 个分类）
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
| 数据层 | `src/lib/db.ts` | IndexedDB 操作：卡片/分类的 CRUD、导入导出 |
| 状态管理 | `src/lib/store.ts` | Zustand Store：全局状态、搜索、编辑模式、拖拽重排、分类重排 |
| 卡片组件 | `src/components/card/web-card.tsx` | 条状卡片：8x8 图标/缩写 + 名称 + 简介 + 左边框分类色彩标记 + HoverCard 显示 fullDesc/note + 编辑模式操作按钮 |
| 拖拽布局 | `src/components/layout/sortable-grid.tsx` | 常用栏置顶全宽 + 下方分类 flex-wrap 块状布局：每块可横向/纵向拖拽 resize、内容 flex-wrap 自动换行、编辑模式上下移动分类、@dnd-kit 跨分类拖拽 |
| 添加/编辑 | `src/components/dialogs/card-dialog.tsx` | 弹窗表单：URL、自动抓取、手动编辑，支持预选分类 |
| 分类管理 | `src/components/dialogs/category-dialog.tsx` | 分类创建/编辑：12 种图标 + 8 种颜色 |
| OG 抓取 | `src/app/api/fetch-meta/route.ts` | POST {url} → 解析 title/description/image/favicon |

## 布局系统设计

### 核心布局模型
- **常用栏**: 全宽置顶，卡片 flex-wrap 自动换行
- **分类块**: flex-wrap 布局排列，默认各占 50% 宽度
- **卡片流**: 每个分类块内部使用 `flex flex-wrap`，拉宽块时卡片自动换行到多行
- **双向 resize**: 右边缘拖拽调宽度，底边缘拖拽调高度（双击重置高度）
- **分类重排**: 编辑模式下可通过上下箭头移动分类顺序

### Resize 交互
- **横向 resize**: 拖拽块右侧边缘的竖线手柄，宽度以百分比存储（最小 30%，最大 100%）
- **纵向 resize**: 拖拽块底部边缘的横线手柄，设置 max-height 后内容可滚动（双击重置为 auto）
- **视觉反馈**: resize 过程中显示 ring 提示

## 关键数据类型

```ts
interface WebCard {
  id: string;
  url: string;
  title: string;
  shortDesc: string;    // 一句话简介（约 7-8 字）
  fullDesc: string;     // 详细介绍（Hover 显示）
  note: string;         // 备注（Hover 显示）
  abbreviation: string; // 简写
  imageUrl: string;
  categoryId: string;
  order: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;   // lucide icon name
  color: string;  // hex color
  order: number;
}
```

## 代码风格指南

- 默认按 TypeScript `strict` 心智写代码
- 禁止隐式 `any`
- 组件文件使用 `"use client"` 标记客户端组件
- 颜色使用 Tailwind 语义化变量（`bg-card`, `text-foreground` 等）
- 字体使用 `font-serif`（Noto Serif SC）用于标题，`font-sans` 用于正文
- Lucide 图标使用 `icons.ts` 中的静态映射，避免动态组件创建（react-hooks/static-components 规则）

## Chrome 插件预留

- 数据操作通过 `store.ts` 抽象，未来可替换底层为 Chrome Storage API
- 卡片数据格式标准化（UUID、创建时间、标签、URL、元数据）
- 导入/导出 JSON 功能已就绪，便于插件数据迁移
- 抓取逻辑通过后端 API 实现，插件版可直接通过 content script 读取 tab 信息

## 常见问题

### 拖拽时卡片闪烁/跳动
检查 `SortableContext` 的 `items` 是否正确更新，确保 `order` 字段在拖拽后重新排序。当前使用 `rectSortingStrategy` 适配 flex-wrap 布局。

### OG 抓取失败
部分网站有反爬虫机制或需要特定 User-Agent。已在 `fetch-meta` 中设置浏览器 UA 和 8s 超时。

### 图片跨域不显示
外部图片通过 `<img>` 标签直接加载，若网站禁止跨域则显示缩写占位。生产环境可配置图床代理。

### resize 不生效
确保拖拽的是右侧或底部的细线手柄，而非卡片内容区域。resize 手柄在 hover 时会变为 primary 色。

### Lucide 图标 static-components 报错
不要在渲染时动态创建组件（如 `const Icon = getLucideIcon(name)`），应使用 switch-case 直接渲染具体图标组件，参考 `CategoryIcon` 组件。

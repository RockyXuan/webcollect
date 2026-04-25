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
│   │   ├── card/web-card.tsx   # 网站卡片组件
│   │   ├── layout/sortable-grid.tsx  # 拖拽网格布局
│   │   ├── nav/top-nav.tsx     # 顶部导航 + 搜索
│   │   ├── nav/category-tabs.tsx     # 分类 Tab 栏
│   │   └── dialogs/            # 添加/编辑弹窗
│   ├── lib/
│   │   ├── types.ts            # TypeScript 类型定义
│   │   ├── db.ts               # IndexedDB 封装
│   │   ├── store.ts            # Zustand 状态管理
│   │   ├── seed.ts             # 默认示例数据
│   │   ├── icons.ts            # Lucide 图标动态获取
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
| 状态管理 | `src/lib/store.ts` | Zustand Store：全局状态、搜索、编辑模式、拖拽重排 |
| 卡片组件 | `src/components/card/web-card.tsx` | 横向条状卡片：32x32 图标/缩写 + 完整名称 + 简介 + 编辑模式显隐操作按钮 + Hover 详情浮层 |
| 拖拽布局 | `src/components/layout/sortable-grid.tsx` | 常用栏置顶全宽 + 下方分类 flex-wrap 块状布局：每个块可 resize 调整宽度、内部横向滚动、@dnd-kit 跨分类拖拽 |
| 添加/编辑 | `src/components/dialogs/card-dialog.tsx` | 弹窗表单：URL、自动抓取、手动编辑，支持预选分类 |
| 分类管理 | `src/components/dialogs/category-dialog.tsx` | 分类创建/编辑：名称、图标（12 种）、颜色（8 种） |
| OG 抓取 | `src/app/api/fetch-meta/route.ts` | POST {url} → 解析 title/description/image/favicon |

## 关键数据类型

```ts
interface WebCard {
  id: string;
  url: string;
  title: string;
  shortDesc: string;    // 一句话简介（约 7-8 字）
  fullDesc: string;     // 详细介绍（Hover 显示）
  note: string;         // 备注
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

## Chrome 插件预留

- 数据操作通过 `store.ts` 抽象，未来可替换底层为 Chrome Storage API
- 卡片数据格式标准化（UUID、创建时间、标签、URL、元数据）
- 导入/导出 JSON 功能已就绪，便于插件数据迁移
- 抓取逻辑通过后端 API 实现，插件版可直接通过 content script 读取 tab 信息

## 常见问题

### 拖拽时卡片闪烁/跳动
检查 `SortableContext` 的 `items` 是否正确更新，确保 `order` 字段在拖拽后重新排序。

### OG 抓取失败
部分网站有反爬虫机制或需要特定 User-Agent。已在 `fetch-meta` 中设置浏览器 UA 和 8s 超时。

### 图片跨域不显示
外部图片通过 `<img>` 标签直接加载，若网站禁止跨域则显示缩写占位。生产环境可配置图床代理。

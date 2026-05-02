# WebCollect 开发进度与交接文档

> 本文档记录截至 2025-04-27 的完整开发进度、已完成功能、待办事项、踩坑记录。
> 供后续 AI 编程工具（如 Codex）快速接手项目使用。

---

## 一、项目简介

**WebCollect** — 个人网页收藏墙，类似于 Homely / start.me 的浏览器新标签页导航站。

- **核心价值**：把常用网站像便签一样贴在墙上，支持分类管理、拖拽排列、自动抓取网页元数据
- **双平台**：Web 版（Next.js，可部署到 Vercel）+ Chrome 扩展版（覆盖新标签页）
- **数据架构**：本地 IndexedDB 优先 + Supabase 云端同步（Google OAuth 登录后跨设备同步）

---

## 二、当前进度总览

### ✅ 已完成的功能

| # | 功能 | 状态 | 关键文件 |
|---|------|------|----------|
| 1 | 三级层级布局（分类→分组→网页） | ✅ 完成 | `sortable-grid.tsx`, `store.ts` |
| 2 | 拖拽排列（跨分组拖卡片、分类重排、降级/升级） | ✅ 完成 | `sortable-grid.tsx`, `store.ts` |
| 3 | 分类块宽度拉伸（拖拽右侧手柄） | ✅ 完成 | `sortable-grid.tsx`, `store.ts` |
| 4 | 编辑模式（进入/退出、分类头部编辑按钮、双击空白退出） | ✅ 完成 | `sortable-grid.tsx` |
| 5 | 内联编辑（点击分类/分组/网页名称直接编辑） | ✅ 完成 | `sortable-grid.tsx` |
| 6 | 添加/编辑网页卡片（自动抓取 OG 元数据） | ✅ 完成 | `card-dialog.tsx`, `fetch-meta/route.ts` |
| 7 | 分类创建/编辑（12种图标 + 8种颜色） | ✅ 完成 | `category-dialog.tsx` |
| 8 | 热门网站推荐（70+网站、查重、收集箱快捷添加、不感兴趣屏蔽） | ✅ 完成 | `hot-recommendation.tsx`, `hot-sites.ts` |
| 9 | 网站安全扫描（白名单+HTTPS+TLD检查） | ✅ 完成 | `check-safety/route.ts` |
| 10 | 仓库系统（导入 Homely JSON、批次管理、发货到主页） | ✅ 完成 | `warehouse/`, `store-warehouse.ts` |
| 11 | 删除 + 回收站（软删除、恢复、永久删除） | ✅ 完成 | `recycle-bin-dialog.tsx`, `store.ts` |
| 12 | 平台适配层（Web/扩展 API 统一接口） | ✅ 完成 | `platform.ts`, `platform-link.tsx` |
| 13 | Chrome 扩展（新标签页覆盖、Vite 构建、样式隔离） | ✅ 完成 | `extension/` |
| 14 | Supabase 数据库表 + RLS 策略 | ✅ 完成 | `shared/schema.ts` |
| 15 | Auth Store（Google OAuth 登录/登出、会话管理） | ✅ 代码完成 | `auth-store.ts` |
| 16 | 同步服务（本地↔云端双向同步、Last-Write-Wins） | ✅ 代码完成 | `sync.ts` |
| 17 | 浏览器端 Supabase 客户端 | ✅ 代码完成 | `supabase-browser.ts` |
| 18 | 登录 UI（Google 登录按钮 + 用户头像菜单 + 同步状态指示器） | ✅ 代码完成 | `user-menu.tsx`, `top-nav.tsx` |
| 19 | OAuth 回调路由 | ✅ 代码完成 | `auth/callback/route.ts` |
| 20 | Supabase 配置 API | ✅ 完成 | `api/supabase-config/route.ts` |

### 🔴 未完成 / 需要验证的功能

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 1 | **Google OAuth 登录实际可用** | ❌ 未验证 | 代码已写好，但 Supabase 中 Google Provider 未启用，需在 Dashboard 开启 |
| 2 | **数据同步端到端验证** | ❌ 未验证 | sync.ts 代码完成，但需要登录后才能测试 |
| 3 | **扩展版 OAuth 登录** | ❌ 未验证 | chrome.identity.launchWebAuthFlow 代码已写，未实测 |
| 4 | **扩展版 Supabase 配置获取** | ⚠️ 需补充 | 扩展无法调用 /api/supabase-config，需要从扩展环境获取 Supabase URL+Key |
| 5 | **定时自动同步** | ⏳ 未实现 | 目前只在登录时触发一次同步，需要增加定时/数据变更时自动同步 |
| 6 | **同步冲突高级处理** | ⏳ 未实现 | 当前是简单的 Last-Write-Wins，未来可能需要字段级合并或用户选择 |
| 7 | **多用户支持** | ⏳ 未实现 | 当前设计已预留 user_id，RLS 已配置，但 UI 层面尚未区分 |

---

## 三、Supabase 配置状态

### 数据库表（已创建 + RLS 已配置）

| 表名 | 用途 | 唯一约束 | RLS |
|------|------|----------|-----|
| `users` | 用户信息 | id (PK) | ✅ 用户只能读写自己的数据 |
| `categories` | 分类/分组 | id (PK) | ✅ 用户只能读写自己的数据 |
| `cards` | 网页卡片 | id (PK) | ✅ 用户只能读写自己的数据 |
| `user_preferences` | 用户偏好 | (user_id, key) unique | ✅ 用户只能读写自己的数据 |

### 连接信息

| 项目 | 值 |
|------|-----|
| Supabase URL | `https://br-tidy-kitty-81d335ca.supabase2.aidap-global.cn-beijing.volces.com` |
| 环境变量名 | `COZE_SUPABASE_URL`, `COZE_SUPABASE_ANON_KEY` |
| 配置 API | `/api/supabase-config` → 返回 URL + anonKey |
| Google Provider 状态 | ❌ **未启用** |

### ⚠️ 要让登录功能可用，必须做的事

1. **Supabase Dashboard** → Authentication → Providers → Google → **启用**
2. 填入 Google Cloud Console 创建的 OAuth 2.0 Client ID + Client Secret
3. Google Cloud Console 的 Authorized redirect URIs 添加：
   ```
   https://br-tidy-kitty-81d335ca.supabase2.aidap-global.cn-beijing.volces.com/auth/v1/callback
   ```
4. 如果使用自定义域名部署 Web 版，还需在 Supabase Authentication → URL Configuration → Redirect URLs 中添加你的域名回调地址

---

## 四、Chrome 扩展现状

### 已解决的关键问题

1. **Service Worker 语法错误**：background.js 不能用 TypeScript 类型标注
2. **资源路径**：Vite 必须设置 `base: './'`，否则 Chrome 无法加载绝对路径资源
3. **CSP 阻止外部字体**：改为 HTML `<link>` 加载 Google Fonts
4. **Tailwind CSS v4 扫描问题**（最坑）：`@tailwindcss/vite` 只扫描 Vite 模块图中的文件，必须用 `@source` 指令显式指定扫描目录
5. **仓库按钮路由问题**：TopNav 新增 `onWarehouse` 回调，扩展版用回调切换视图

### 扩展版 OAuth 还需要做的

1. 扩展无法访问 `/api/supabase-config`，需要在扩展中硬编码 Supabase URL+Key 或通过 `chrome.storage` 获取
2. `chrome.identity.launchWebAuthFlow` 需要在 Google Cloud Console 中配置 Chrome 扩展的 OAuth Client ID
3. manifest.json 已添加 `identity` 权限

---

## 五、架构设计

### 双平台代码共享策略

```
src/lib/          ← 共享核心逻辑（store, db, types, auth-store, sync, platform）
src/components/   ← 共享 UI 组件（web-card, sortable-grid, dialogs, user-menu）
src/app/          ← Web 版专用（Next.js App Router, API Routes）
extension/src/    ← 扩展版专用（Vite 入口, stubs 替换 next/link 和 next-themes）
```

### 平台适配器

```typescript
// src/lib/platform.ts
export const isChromeExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

// API 调用统一接口
export async function fetchMeta(url: string) {
  if (isChromeExtension) {
    // 扩展: chrome.runtime.sendMessage → background.js 处理
  } else {
    // Web: fetch('/api/fetch-meta', ...)
  }
}
```

### 数据同步架构

```
┌──────────────┐     ┌──────────────┐
│  IndexedDB   │     │   Supabase   │
│  (本地存储)   │ ←→  │  (云端存储)   │
│              │     │              │
│ - categories │     │ - categories │
│ - cards      │     │ - cards      │
│ - preferences│     │ - user_preferences │
└──────────────┘     └──────────────┘
       ↑                    ↑
       │                    │
  store.ts            auth-store.ts
  (本地状态)          (登录状态 + 同步触发)
       │                    │
       └────── sync.ts ─────┘
         (Last-Write-Wins 合并)
```

### 同步流程

1. **用户登录** → auth-store 检测到新 session
2. **触发 syncData()** → 从 Supabase 拉取云端数据
3. **合并逻辑**：逐条对比 `updatedAt` 时间戳，较新的版本胜出
4. **写回双方**：合并结果同时写入 IndexedDB 和 Supabase
5. **UI 更新**：store.ts 重新 loadData() 刷新页面

---

## 六、关键文件清单

### 认证 & 同步相关（新增）

| 文件 | 用途 | 注意事项 |
|------|------|----------|
| `src/lib/auth-store.ts` | Auth Zustand Store | 管理 user/session/syncStatus，登录时触发同步 |
| `src/lib/sync.ts` | 同步服务 | syncToCloud/syncFromCloud/mergeSync，依赖 db.ts + supabase-browser.ts |
| `src/lib/supabase-browser.ts` | 浏览器端 Supabase 客户端 | 轻量实现，从 /api/supabase-config 获取配置 |
| `src/app/api/supabase-config/route.ts` | 配置 API | 读取 COZE_SUPABASE_URL/COZE_SUPABASE_ANON_KEY |
| `src/app/auth/callback/route.ts` | OAuth 回调 | 处理 Google OAuth 重定向后的 code exchange |
| `src/components/auth/user-menu.tsx` | 用户菜单组件 | 未登录→登录按钮，已登录→头像+菜单+同步状态 |
| `src/storage/database/shared/schema.ts` | 数据库 Schema | Drizzle ORM 定义 4 张表 |
| `src/storage/database/supabase-client.ts` | 服务器端客户端 | 模板文件，使用 loadEnv 读取环境变量 |

### Chrome 扩展相关

| 文件 | 用途 | 注意事项 |
|------|------|----------|
| `extension/manifest.json` | Manifest V3 | 已添加 identity 权限 |
| `extension/background.js` | Service Worker | **必须用纯 JS**，不能用 TypeScript |
| `extension/vite.config.ts` | Vite 构建 | `base: './'`，别名替换 next/link |
| `extension/src/newtab-app.tsx` | 扩展版 App | 状态路由 main/warehouse，传递 onWarehouse 回调 |
| `extension/src/extension.css` | 扩展 CSS | `@source` 指令指定 Tailwind 扫描目录 |
| `extension/src/stubs/` | Next.js 模块替换 | next-link.tsx, next-themes.ts |
| `extension/build.sh` | 构建脚本 | Vite 构建 + 复制 manifest/icons/background.js 到 dist/ |

### 核心共享模块

| 文件 | 用途 |
|------|------|
| `src/lib/store.ts` | 主页 Zustand Store（全局状态、搜索、编辑、拖拽、软删除） |
| `src/lib/store-warehouse.ts` | 仓库 Zustand Store |
| `src/lib/db.ts` | IndexedDB 封装（主页数据 + 回收站 + 隐藏网站 + 置顶分类） |
| `src/lib/db-warehouse.ts` | 仓库 IndexedDB 封装 |
| `src/lib/platform.ts` | 平台适配器（Web/扩展 API 统一接口） |
| `src/lib/types.ts` | TypeScript 类型定义 |
| `src/lib/seed.ts` | 默认示例数据（⚠️ 只增不减） |
| `src/components/layout/sortable-grid.tsx` | 主页拖拽网格布局 |
| `src/components/card/web-card.tsx` | 网页卡片组件 |
| `src/components/nav/top-nav.tsx` | 顶部导航（含 UserMenu + 回收站） |
| `src/components/dialogs/card-dialog.tsx` | 添加/编辑网页弹窗 |
| `src/components/dialogs/category-dialog.tsx` | 分类创建/编辑弹窗 |
| `src/components/dialogs/recycle-bin-dialog.tsx` | 回收站弹窗 |

---

## 七、踩坑记录（必读）

### 坑 1：Tailwind CSS v4 + Vite 扩展构建（最坑，卡了 2 轮）

**现象**：Chrome 扩展页面样式完全丢失，只有纯 HTML 无样式。

**根因**：Tailwind CSS v4 的 `@tailwindcss/vite` 插件只扫描 Vite 模块图中的文件。扩展入口 `newtab-app.tsx` 通过 `@/` 别名引用 `src/components/` 中的组件，但 Tailwind 不会跟随别名去扫描这些文件。结果 CSS 只有 14KB，几乎所有工具类都缺失。

**修复**：在 `extension/src/extension.css` 中添加 `@source` 指令：
```css
@source "../src/components";
@source "../src/lib";
@source "../src/hooks";
```
CSS 从 14KB 增长到 123KB。

**教训**：Vite + Tailwind CSS v4 构建非标准项目（如 Chrome 扩展）时，必须用 `@source` 显式指定扫描路径。

### 坑 2：AlertDialog 双重弹出卡死

**现象**：删除分类时弹出两个确认框，焦点卡死无法操作。

**根因**：多个 CategoryBlock/SubGroupBlock 各自内联了非受控的 `AlertDialogTrigger`，Radix UI 的焦点陷阱冲突。

**修复**：全部改为受控模式（`useState` + `open`/`onOpenChange`）。

**教训**：Radix UI 的 AlertDialog 在列表中多次使用时，必须用受控模式，不能用 `AlertDialogTrigger` 非受控模式。

### 坑 3：Chrome 扩展 Service Worker 语法错误

**现象**：加载扩展报 `SyntaxError: Unexpected token ':'`。

**根因**：`background.js` 使用了 TypeScript 类型标注（如 `let level: 'safe' | 'caution'`），Chrome 的 Service Worker 不支持。

**修复**：改为纯 JavaScript 写法。

**教训**：Chrome 扩展的 background.js / Service Worker 必须是纯 JS。

### 坑 4：Vite base 路径导致扩展资源加载失败

**现象**：扩展加载后资源 404。

**根因**：Vite 默认 `base: '/'`，生成的资源引用是 `/assets/xxx.js`，Chrome 扩展无法解析绝对路径。

**修复**：`vite.config.ts` 设置 `base: './'`。

### 坑 5：CSP 阻止 Google Fonts

**现象**：字体不加载。

**根因**：CSS `@import` 加载 Google Fonts 被 CSP 阻止。

**修复**：改为 HTML `<link>` 标签加载，同时在 manifest.json 的 CSP 中允许 `style-src 'unsafe-inline' https://fonts.googleapis.cn` 和 `font-src https://fonts.gstatic.cn`。

### 坑 6：扩展版仓库按钮报错

**现象**：点击仓库按钮报错。

**根因**：TopNav 中仓库按钮使用 `PlatformLink` 跳转 `/warehouse`，Chrome 扩展 SPA 无此路由。

**修复**：TopNav 新增 `onWarehouse` 回调 prop，扩展版传回调切换视图状态。

### 坑 7：拉伸与拖拽事件冲突（发生 3 次）

**根因**：dnd-kit 用 `PointerSensor` 监听 `pointerdown`，拉伸手柄用 `onMouseDown`。需要在拉伸手柄上同时加 `onPointerDown={(e) => e.stopPropagation()}` 阻止 dnd-kit 捕获。

**关键**：不要在 `onPointerDown` 中调用 `preventDefault()`，它会阻止浏览器生成后续 `mousedown` 事件。

### 坑 8：flex 布局 width/minWidth/flex-basis 混淆（发生 4 次）

**核心模型**："包中包"
- 外层分类：`width: XX%` 占指定比例
- 内层分组：`flex: 1 1 0%` 均分空间（默认）或 `flex: 0 0 XX%`（手动调整后）
- 卡片：`min-w-[140px] flex-1` 自适应

**教训**：不要用 `shrink-0` 强行禁用压缩，让 flex 的 grow/shrink 自然工作。

### 坑 9：HMR 缓存导致改了等于没改

**现象**：代码修改后页面行为没变化。

**修复**：`rm -rf .next && pnpm dev` 清缓存重启。

---

## 八、后续开发路线图

### P0 — 让登录和同步可用（最优先）

1. **启用 Google Provider**：Supabase Dashboard → Authentication → Providers → Google → 启用
2. **端到端测试 Web 版登录**：点击登录按钮 → Google OAuth → 回调 → 获取 session → 数据同步
3. **修复可能的问题**：OAuth 回调路由、session 持久化、RLS 策略验证
4. **扩展版 Supabase 配置**：硬编码 URL+Key 或从 chrome.storage 获取
5. **扩展版 OAuth 测试**：chrome.identity.launchWebAuthFlow 实测

### P1 — 完善同步体验

1. **定时自动同步**：每 5 分钟自动同步一次（登录状态下）
2. **数据变更时触发同步**：添加/编辑/删除卡片后自动推送到云端
3. **同步状态 UI 优化**：顶部导航栏显示同步状态（同步中/已同步/冲突/失败）
4. **离线模式**：未登录时正常使用本地数据，登录后自动合并

### P2 — 扩展功能

1. **Chrome Web Store 上架**：准备宣传图、描述、隐私政策
2. **Vercel 部署 Web 版**：配置自定义域名 + Supabase 回调 URL
3. **书签栏导入**：从 Chrome bookmarks API 导入现有书签
4. **快捷键支持**：Ctrl+K 搜索、Ctrl+N 添加卡片

### P3 — 多用户 & 开放

1. **用户注册/登录 UI 优化**：支持 Google + GitHub + Email 多种登录方式
2. **数据隔离验证**：确保不同用户之间数据完全隔离
3. **分享功能**：公开某个分类的链接，其他人可查看
4. **团队版**：共享分类，多人协作

---

## 九、开发环境快速启动

```bash
# 安装依赖
pnpm install

# 开发 Web 版（端口 5000，含 HMR）
pnpm dev

# 构建 Chrome 扩展
pnpm build:ext

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint

# 清除缓存重启
rm -rf .next && pnpm dev
```

### 环境变量

| 变量名 | 用途 | 来源 |
|--------|------|------|
| `COZE_SUPABASE_URL` | Supabase 项目 URL | Coze 沙箱自动注入 |
| `COZE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | Coze 沙箱自动注入 |
| `COZE_SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | 仅服务器端使用 |
| `DEPLOY_RUN_PORT` | 服务端口（5000） | Coze 沙箱自动注入 |

---

## 十、关键约定 & 禁令

1. **严禁删除 seed.ts 中的任何默认数据** — 只增不减
2. **严禁"顺手优化"** — 用户没让改的不要改
3. **每次修改前必须备份** — 先读现有数据，确认不会破坏
4. **颜色必须用 Tailwind 语义化变量** — `bg-card`, `text-foreground` 等，禁止硬编码 Hex/RGB
5. **禁止蓝紫色渐变** — AI 味太浓
6. **Lucide 图标用静态映射** — 不要动态创建组件
7. **弹窗必须有 DialogDescription** — Radix UI accessibility 要求
8. **修改后必须跑 ts-check + lint** — 零错误才能提交
9. **改 A 不能坏 B** — 改完必须回归测试
10. **background.js 必须纯 JS** — Chrome Service Worker 不支持 TypeScript

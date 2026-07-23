# projects

## WebCollect V1.5.1 Next.js 安全补丁版

V1.5.1 将 Web 运行时从 Next.js `16.2.10` 升级到官方修复版 `16.2.11`，关闭 2026-07-22 晚于 V1.5.0 发布出现的 9 条生产依赖安全公告。标签组、favicon、Google Drive、完整备份、扩展权限和用户数据契约全部保持 V1.5.0 行为。

目标 Release：`webcollect-2026-07-23-v1.5.1`；目标扩展资产：`WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`。实施与验证见 `docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`。

## WebCollect V1.5.0 标签组与图标自愈版

V1.5.0 新增可跨分项使用的“标签组”：把网页卡片拖到顶部标签组即可保存为固定模板，点击后一次打开组内全部网页；标签组随 Google Drive 同步并进入完整 JSON 备份，但不会修改或移动原收藏。导图模式可在管理面板中搜索并加入网页。

本版同时重做 favicon 回退链：图标始终先显示字母兜底，扩展优先使用 Chrome 内置 favicon，再尝试收藏元数据与站点图标；可重建图标缓存独立于业务数据、同步和备份。扩展只新增 Chrome `favicon` 权限，不申请 `tabs` 或 `tabGroups`。

正式 Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-22-v1.5.0`。扩展 zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-22-v1.5.0/WebCollect-Chrome-Extension-v1.5.0-2026-07-22.zip`；SHA-256：`2b499aeaa0c6ec14d5454335deb69b6a0ae3561f0e5c750c3d5ec32a42e76749`。实施、数据边界与发布证据见 `docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`。

## WebCollect V1.4.1 浮窗快捷键修复版

V1.4.1 修复网页浮窗输入框与宿主网站快捷键冲突：在名称、地址、简介或新建目标名称中输入 `s` / `S`、使用中文输入法、Tab 或复制粘贴时，按键只作用于 WebCollect，不再触发 GitHub 等网页的全局搜索。浮窗外的网页快捷键保持正常。

正式 Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-21-v1.4.1`。扩展 zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-21-v1.4.1/WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`；SHA-256：`abccc041f9e32c87535a6d38fa8072edb011477af6eea3da8442eda87a59e084`。实施与发布证据见 `docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`。

## WebCollect 当前接手入口

如果你是后续接手 WebCollect 的 Claude / Codex / 其他 agent，请先读：

1. `AGENTS.md`
2. `AGD.md`
3. `docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`
4. `docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`
5. `docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`
6. `docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`
7. `docs/audit/webcollect-v1.3.1-header-ui-closeout-2026-07-19.md`
8. `docs/audit/webcollect-v1.3.0-smart-search-closeout-2026-07-18.md`
9. `docs/audit/webcollect-v1.2.2-header-layout-closeout-2026-07-17.md`
10. `docs/audit/webcollect-v1.2.1-mindmap-polish-closeout-2026-07-17.md`
11. `docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`
12. `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`
13. `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`
14. `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`
15. `docs/audit/claude-code-review-handoff-2026-07-07.md`
16. `PROJECT_SUMMARY.md`
17. `HANDOFF.md`

项目已于 2026-07-15 退役 Superpowers、`goal-zzx` / `zzx-goal` 和 `andrej-karpathy-coding` 工作流。`tasks/todo.md`、`tasks/lessons.md`、`CODEX_GO_MODE_STATUS.md` 与 `docs/superpowers/` 只保留历史事实，不是新任务的必读、必写或执行入口。

当前固定开发目录：`/Users/rockyx/vibe coding/Web Collect 0628`。
当前代码版本：`V1.5.1 / 2026年7月23日`。
当前发布目标：`webcollect-2026-07-23-v1.5.1`；扩展 zip `WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`。
发布证据：详见 V1.5.1 closeout；V1.5.0 标签组/favicon 与 V1.4.0 Google Drive/完整备份边界继续保持。
历史 RC7：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-15-v1.1.2-rc.7`。
如果旧说明和 `AGD.md` 冲突，以 `AGD.md` 为准。

V1.5.1 只升级 Next.js 安全补丁；V1.5.0 的标签组和 favicon、V1.4.0 的 Google Drive、完整 JSON、本地优先与数据安全保证保持不变。

这是一个基于 [Next.js 16](https://nextjs.org) + [shadcn/ui](https://ui.shadcn.com) 的全栈应用项目，由扣子编程 CLI 创建。

## 快速开始

### 启动开发服务器

```bash
coze dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

开发服务器支持热更新，修改代码后页面会自动刷新。

### 构建生产版本

```bash
coze build
```

### 启动生产服务器

```bash
coze start
```

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── layout.tsx           # 根布局组件
│   ├── page.tsx             # 首页
│   ├── globals.css          # 全局样式（包含 shadcn 主题变量）
│   └── [route]/             # 其他路由页面
├── components/              # React 组件目录
│   └── ui/                  # shadcn/ui 基础组件（优先使用）
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── lib/                     # 工具函数库
│   └── utils.ts            # cn() 等工具函数
└── hooks/                   # 自定义 React Hooks（可选）

server/
├── index.ts                 # 自定义服务器入口
├── tsconfig.json           # Server TypeScript 配置
└── dist/                    # 编译输出目录（自动生成）
```

## 核心开发规范

### 1. 组件开发

**优先使用 shadcn/ui 基础组件**

本项目已预装完整的 shadcn/ui 组件库，位于 `src/components/ui/` 目录。开发时应优先使用这些组件作为基础：

```tsx
// ✅ 推荐：使用 shadcn 基础组件
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>标题</CardHeader>
      <CardContent>
        <Input placeholder="输入内容" />
        <Button>提交</Button>
      </CardContent>
    </Card>
  );
}
```

**可用的 shadcn 组件清单**

- 表单：`button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`
- 布局：`card`, `separator`, `tabs`, `accordion`, `collapsible`, `scroll-area`
- 反馈：`alert`, `alert-dialog`, `dialog`, `toast`, `sonner`, `progress`
- 导航：`dropdown-menu`, `menubar`, `navigation-menu`, `context-menu`
- 数据展示：`table`, `avatar`, `badge`, `hover-card`, `tooltip`, `popover`
- 其他：`calendar`, `command`, `carousel`, `resizable`, `sidebar`

详见 `src/components/ui/` 目录下的具体组件实现。

### 2. 路由开发

Next.js 使用文件系统路由，在 `src/app/` 目录下创建文件夹即可添加路由：

```bash
# 创建新路由 /about
src/app/about/page.tsx

# 创建动态路由 /posts/[id]
src/app/posts/[id]/page.tsx

# 创建路由组（不影响 URL）
src/app/(marketing)/about/page.tsx

# 创建 API 路由
src/app/api/users/route.ts
```

**页面组件示例**

```tsx
// src/app/about/page.tsx
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '关于我们',
  description: '关于页面描述',
};

export default function AboutPage() {
  return (
    <div>
      <h1>关于我们</h1>
      <Button>了解更多</Button>
    </div>
  );
}
```

**动态路由示例**

```tsx
// src/app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <div>文章 ID: {id}</div>;
}
```

**API 路由示例**

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

### 3. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 4. 样式开发

**使用 Tailwind CSS v4**

本项目使用 Tailwind CSS v4 进行样式开发，并已配置 shadcn 主题变量。

```tsx
// 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button className="bg-primary text-primary-foreground">
    主要按钮
  </Button>
</div>

// 使用 cn() 工具函数合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>
  内容
</div>
```

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

推荐使用 `react-hook-form` + `zod` 进行表单开发：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱'),
});

export default function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('username')} />
      <Input {...form.register('email')} />
      <Button type="submit">提交</Button>
    </form>
  );
}
```

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 shadcn 组件构建 UI
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`

### 创建业务组件

1. 在 `src/components/` 下创建组件文件（非 UI 组件）
2. 优先组合使用 `src/components/ui/` 中的基础组件
3. 使用 TypeScript 定义 Props 类型

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

推荐使用 Prisma 或 Drizzle ORM，在 `src/lib/db.ts` 中配置。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **字体**: Geist Sans & Geist Mono
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [shadcn/ui 组件文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **优先使用 shadcn/ui 组件** 而不是从零开发基础组件
3. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
4. **使用 TypeScript** 进行类型安全开发
5. **使用 `@/` 路径别名** 导入模块（已配置）

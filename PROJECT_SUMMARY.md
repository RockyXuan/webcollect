# WebCollect Project Summary

## 2026-07-14 V1.1.2 候选接手入口

优先读 `AGD.md` 与 `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`。当前稳定版仍是 V1.1.1；V1.1.2 先以 RC 安装到用户明确授权的主 Chrome，再用独立 Profile B 完成第二会话验收。

本轮候选修复：Web 本地 OAuth 公共配置、新 Profile 重复收集箱、同分项已有空重复时的 canonical 选择、OAuth code 清理、HMR WebSocket、浮窗并发重复目标、重复 Supabase 客户端和浏览器刷新生命周期。旧扩展在 2026-07-14 又上传一条空收集箱，云端现为 `364 cards / 130 categories / 24 preferences / 58 snapshots`；代码不删除现有记录，只阻止继续生成并确保新收藏落入已有卡片的收集箱。

## 2026-07-12 最新接手入口

先读 `AGD.md`、`docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md` 和 `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`。前者保留完整需求历史，后两者记录 CI/发布收口及 PM 分库、WebCollect 云端迁移和全项目验收事实。

当前最新状态：

- 最新提交：以 Release tag `webcollect-2026-07-12-v1.1.1` 指向为准
- 最新版本：`V1.1.1 / 2026年7月12日`
- 最新 Release：`webcollect-2026-07-12-v1.1.1`
- 最新 zip：`WebCollect-Chrome-Extension-v1.1.1-2026-07-12.zip`
- 最新新增文档：
  - `AGD.md`
  - `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`
  - `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`
  - `docs/audit/gpt56-full-audit-execution-2026-07-10.md`
  - `docs/audit/claude-code-review-handoff-2026-07-07.md`
  - `docs/audit/webcollect-full-audit-brief-2026-07-07.md`
  - `docs/audit/user-screenshot-index-2026-07-07.md`

如果旧文档和这些新文档冲突，以 `AGD.md` 和 `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md` 为准。

## 一句话概览

WebCollect 是一个个人网页收藏墙：既是 Next.js Web 应用，也是 Chrome 新标签页扩展。核心目标是让用户把网页按“分项 / 分类 / 分组 / 网页”组织成可视化墙面，并支持悬浮收集、跨设备同步、壁纸模式、搜索、回滚和扩展发布。

## 当前正确工作目录

- GitHub 仓库：`https://github.com/RockyXuan/webcollect`
- 当前固定主开发目录：`/Users/rockyx/vibe coding/Web Collect 0628`
- 历史 Codex 临时目录：`/Users/rockyx/Documents/Codex/2026-06-14/webcollect-main-clean`
- 当前主分支：`main`
- 不要继续使用旧目录：`/Users/rockyx/Documents/webcollect`
- 数据安全底线：不清空、不重置、不覆盖用户 IndexedDB / Supabase / Chrome 扩展本地数据。

## 技术栈

- Next.js 16 App Router + React 19 + TypeScript 5
- Tailwind CSS 4 + 项目自定义 `wc-*` 蓝玻璃 UI 系统
- Zustand 风格 store：`src/lib/store.ts`
- IndexedDB/localforage 本地持久化
- Supabase Auth + 云同步
- Chrome Manifest V3 扩展，入口在 `extension/`
- Vite 构建扩展新标签页和 content script
- `@dnd-kit` 支撑分类、分组、网页拖拽

## 核心模块

- `src/components/layout/sortable-grid.tsx`：收藏墙布局、拖拽、锁定、分类/分组/网页交互。
- `src/components/nav/top-nav.tsx`：顶部导航、搜索、刷新、保存、壁纸入口。
- `src/components/auth/user-menu.tsx`：登录、同步、回滚、浮窗设置、视觉设置。
- `src/lib/store.ts`：主数据 store、同步入口、刷新保护、捕获队列导入。
- `src/lib/sync.ts`：Supabase 双向同步与安全保护。
- `src/lib/floating-capture.ts`：浮窗偏好共享类型与规范化。
- `extension/src/content/floating-capture.ts`：网页里的 WebCollect 浮窗/收集面板。
- `extension/background.js`：MV3 service worker、收集队列、目标缓存、右键/浮窗桥接。
- `src/lib/wallpaper-*`：壁纸库、刷新、来源、quote 匹配。
- `extension/src/extension.css` 与 `src/app/globals.css`：Web 与扩展两套 UI 样式，需要同步维护关键 `wc-*` 类。

## 近期已完成的重要工作

- 克隆与环境：从 GitHub `main` 重新拉了干净目录，旧 `/Users/rockyx/Documents/webcollect` 已标记不用。
- GitHub/Release：修复过 GitHub CLI 和代理问题；后续 `gh` 已能登录 RockyXuan，release 脚本支持代理并把日期放在 zip 文件名末尾。
- 蓝玻璃 UI：主页、分类、分组、网页卡片、发现中心、顶部栏、设置面板进入统一蓝玻璃风格。
- 跨分辨率布局：固定画布缩放思路已建立，分组卡片列数不再随屏幕宽度 auto-fill 重排。
- 分类/分组动作菜单：编辑、新增、提升、迁移、删除统一收纳进三点菜单；网页卡片也统一为 hover 三点动作，星标保留。
- 搜索：顶部搜索只影响浮层搜索结果，不再过滤或重排下方收藏墙。
- 云同步/刷新：顶部刷新和手动同步已改为云端感知双向同步，并加了刷新坍缩保护。
- 浮窗采集目标：明确目标时优先按 ID 和路径解析，不再静默落入默认收集箱。
- 英文简介：添加时和已有数据加载时会把全英文简介转换为中文摘要。
- 壁纸：扩展本地 fallback、刷新策略、provider 限制、quote 语义匹配做过多轮修复；NASA/科研图不应进入普通默认池。
- 网站图标：增加常见站点与 favicon 缓存/兜底思路，仍需真实长期观察。
- 浮窗恢复：`floating-capture.js` 已改成 classic IIFE content script，避免 Chrome 静默不注入。
- 2026-06-28 小修：浮窗侧边工具默认缩小到约 2/3，可在用户菜单调大小；收集面板可拖动、位置持久保存、内容滚动、底部 `保存 / 取消` 固定可见；分类顶部圆角伪影已修。

## 当前最新验证

最近一次完整验证覆盖：

```bash
node --import tsx scripts/test-floating-capture-health.ts
node --import tsx scripts/test-layout-preferences.ts
./node_modules/.bin/tsc -p tsconfig.json
./node_modules/.bin/eslint .
node ./extension/build.mjs
git diff --check
```

结果：

- TypeScript 通过。
- ESLint 0 error，仍有 6 个既有 warning。
- 扩展构建通过，`extension/dist/assets/floating-capture.js` 已重建。
- `git diff --check` 通过。
- in-app Browser 打开 `http://localhost:5015/` 冒烟检查无 console error。
- 专用 Chrome 注入构建后的 `floating-capture.js` 验证通过：
  - 侧边浮窗按钮 `159x48`
  - 新建分项/分类/分组导致内容变长时，底部操作按钮仍可见
  - 按钮顺序为 `保存 / 取消`
  - 面板可拖动并保存到 `webcollect.capture.panelPosition`
  - 点击面板外部不会自动关闭
  - 证据截图：`/private/tmp/webcollect-floating-capture-verify.png`

## 当前未完成/需继续观察

- 需要用户安装最新 GitHub Release 包后，在真实 Chrome 主环境确认浮窗、小松鼠、收集框拖动是否稳定。
- 跨 Windows/Mac 的云同步仍需要用户实机确认，尤其是 Windows 新增网页后 Mac 手动同步/刷新是否马上出现。
- 网站图标偶发丢失需要长期真实数据观察，必要时进一步完善 favicon 缓存、站点规则和兜底图标。
- 壁纸质量和刷新缓存已多轮优化，但用户仍可能继续反馈“旧图重复/刷新不换”，下一线程应先复测真实扩展包。
- 分类/分组拖拽和右侧留白是反复高风险区域，任何 UI 改动后必须双视口真实检查。

## 交付规则

- 每次扩展可测试版本都要 `node ./extension/build.mjs`。
- 需要用户下载测试时，用 release 脚本发布新版 zip，文件名保持日期在末尾，例如：
  `WebCollect-Chrome-Extension-capture-panel-ux-2026-06-28.zip`
- 推送前必须确认 `git status -sb`，不要混入旧目录或无关文件。
- 不要用 `git reset --hard` 或清空 IndexedDB/Supabase 修问题。
- Chrome 验证优先用辅助窗口 / Codex Workbench，不要操作用户主 Chrome 窗口。

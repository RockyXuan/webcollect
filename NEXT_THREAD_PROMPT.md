# WebCollect 下一大型功能线程提示词

## 2026-07-23 V1.5.3 动态视口适配正式状态

- 当前正式版本：`V1.5.3 / 2026年7月23日`；tag `webcollect-2026-07-23-v1.5.3`；资产 `WebCollect-Chrome-Extension-v1.5.3-2026-07-23.zip`。
- 最新 closeout：`docs/audit/webcollect-v1.5.3-adaptive-viewport-closeout-2026-07-23.md`。
- 根容器按实际可用宽度选择 `wide / compressed / reflow / compact`，因此 Chrome 顶部标签和侧边标签不需要专门识别。
- 1680px 左右温和压缩顶部三行和经典收藏墙，1536px 左右切换两行工具栏，390px 保持紧凑无横向溢出。
- 导图节点、连线、相机和世界坐标不进入页面密度缩放；响应式密度不持久化、不进入 Drive 或同步。
- 本地门禁、main CI `29994891634`、Release workflow `29995423399` 和官方 zip 审计均已通过；官方 zip SHA-256 为 `4d41b3e721463446bbde515d470ea6dc8079c85039fd4929c02c8f819c7074e4`。
- V1.5.2 保留为稳定回退版本。

## 2026-07-23 V1.5.2 GitHub 收藏信息修复状态

- 当前正式版本：`V1.5.2 / 2026年7月23日`；tag `webcollect-2026-07-23-v1.5.2`；资产 `WebCollect-Chrome-Extension-v1.5.2-2026-07-23.zip`。
- 最新 closeout：`docs/audit/webcollect-v1.5.2-github-capture-metadata-closeout-2026-07-23.md`。
- GitHub 仓库标题统一为仓库名，公开 README 的首段实质介绍优先进入简介；本地粗译不可靠时保留英文，不调用 AI、翻译 API、GitHub Token 或本地模型。
- 重复网址只在浮窗明确确认后更新，且入库前复核 ID、网址和版本；只改非空标题/简介，保留分项、分类、位置、备注、简称、图标和创建时间。
- 不新增权限、依赖、存储 key、Drive Schema 或迁移；不批量改写历史收藏。
- 应用提交 `3cd02b2bc7c85e655f98e6cea5619c3f9ac710e8`、main CI `29987210999` 和 Release workflow `29987630172` 均成功；正式 zip 为单一资产，`17,069,709` bytes，SHA-256 `cc76c1c06bb707d3edceb974cc1d5a7d7b81b51d9dfee704bad2d7364c81a3e9`。
- 现有主 Chrome Profile 辅助任务窗口已原位重载官方包；7 个分项、回收站 15、真实收藏、账户、标签组和 Drive 同步状态完整，未执行写入。
- 发布后的测试夹具竞态已由测试专用提交 `2f164a64c5c8fe8fa21ed19561415106014e0d14` 修复，后续 main CI `29988897257` 全绿；正式运行时代码、tag 与官方资产未改变。

## 2026-07-23 V1.5.1 Next.js 安全补丁状态

- 当前正式应用版本：`V1.5.1 / 2026年7月23日`；tag `webcollect-2026-07-23-v1.5.1`；资产 `WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`。
- 最新 closeout：`docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`。
- V1.5.1 只把 `next` 与 `eslint-config-next` 从 `16.2.10` 升级到官方安全修复版 `16.2.11`；不改变 V1.5.0 标签组/favicon 或 V1.4.0 Drive/完整备份契约。
- 本地 413 Vitest、31 legacy、45 Playwright、类型、lint、Web/扩展构建、产物/体积和 204 个生产依赖零漏洞审计已经通过；应用提交 `713cdc975801b0d98b9bc0a2891e7f95592da871`、main CI `29974438847` 与 Release workflow `29974689750` 均成功。
- 正式 Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-23-v1.5.1`；zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-23-v1.5.1/WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`；单一资产 `17,065,370` bytes，SHA-256 `4667cfd57ede39676b89d87cd9055313bfe52290b134d461b5fa70396f10e29d`。
- 现有主 Chrome Profile 的辅助窗口已原位重载；7 个分项、收藏墙、回收站 15、账户入口、书签栏和标签组入口完整。Drive 当时超时并安全降级到本机数据保留状态，验收没有点击重试或执行写入。

## 2026-07-22 V1.5.0 标签组与 favicon 状态

- 当前正式应用版本：`V1.5.0 / 2026年7月22日`；tag `webcollect-2026-07-22-v1.5.0`；资产 `WebCollect-Chrome-Extension-v1.5.0-2026-07-22.zip`。
- 最新 closeout：`docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`。
- 标签组是全局固定 URL 模板：拖拽只复制，不修改收藏；导图通过管理器搜索添加；最多 50 个去重 URL，超过 10 个打开前确认。
- 标签组按记录通过现有 Google Drive 工作区同步并使用软删除；旧设备 payload 缺失字段时不得把本地标签组当成空数据覆盖。
- 完整 JSON 当前 Schema 为 V2，包含标签组和打开方式；仍接受 V1，恢复 V1 时保留现有标签组。
- favicon 使用字母即时兜底、Chrome `_favicon`、元数据/直连候选和独立可重建缓存。缓存不属于业务数据、Drive、备份或 dirty set。
- 扩展仅新增 `favicon` 权限；不得增加 `tabs`、`tabGroups` 或额外主机权限。
- 应用提交 `fd3f9732ac448e46998a9660044b7175aa2c4fd1` 与拖拽修复 `2ad9375db057c9b5567ceaebce543f226b9eeef4` 已进入 main；main CI `29936934533` 与 Release workflow `29937491867` 均成功。
- 正式 zip 为单一资产，`17,065,370` bytes，SHA-256 `2b499aeaa0c6ec14d5454335deb69b6a0ae3561f0e5c750c3d5ec32a42e76749`；现有主 Chrome Profile 已原位更新并通过真实新标签页只读验收。

## 2026-07-21 V1.4.1 浮窗快捷键修复状态

- 当前正式应用版本：`V1.4.1 / 2026年7月21日`；tag `webcollect-2026-07-21-v1.4.1`；资产 `WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`。
- 最新 closeout：`docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`。V1.4.1 只修复浮窗键盘事件穿透；应用提交 `8af01d34bc5d095d7961e658558e8fa7c5c16ff0`，main CI `29842309751` 与 Release workflow `29842892835` 均成功，官方 zip 和真实 Chrome 验收已完成。
- 浮窗内输入 `s` / `S`、中文 IME、Tab 或复制粘贴不会再触发 GitHub 等宿主网页的快捷键；浮窗外的网页快捷键仍正常。
- V1.4.1 不新增存储 key、权限或依赖，不修改业务数据、Drive、Chrome storage、快照、seed 或同步协议。
- 官方 zip 为单一资产，`17,056,539` bytes，SHA-256 `abccc041f9e32c87535a6d38fa8072edb011477af6eea3da8442eda87a59e084`；现有主 Chrome Profile 已原位更新到 V1.4.1 并在报告问题的 GitHub 页面通过输入与浮窗外快捷键回归，未保存收藏。
- Google Drive `appDataFolder` 已成为正式同步路径，只申请 `drive.appdata`；本地 IndexedDB 永远先写，无账号/离线继续可用。
- Rocky 真实数据已经完成迁移、逐文件回读、手动同步、重启和完整 JSON 复核；旧 Supabase 数据保持不动 30 天。
- 正式运行时不含 Supabase 依赖或请求；历史代码/SQL/会话 key 只作回退档案，不得破坏性清理。
- 迁移和发布清单已经闭合；后续任务不要重新迁移、不要让用户重复授权，也不要清理 30 天保险期内的旧 Supabase 数据。

这是一个新的 Codex 线程。请在固定工作区 `/Users/rockyx/vibe coding/Web Collect 0628` 接手 `RockyXuan/webcollect`，并在我随后描述需求后实现一个新的大型功能。

## 先确认当前基线

- 当前正式版本：`V1.5.3 / 2026年7月23日`；V1.5.2 为稳定回退版本。
- V1.5.3 closeout：`docs/audit/webcollect-v1.5.3-adaptive-viewport-closeout-2026-07-23.md`。
- V1.5.2 closeout：`docs/audit/webcollect-v1.5.2-github-capture-metadata-closeout-2026-07-23.md`。
- V1.5.1 closeout：`docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`。
- V1.5.0 closeout：`docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`。
- V1.5.0 应用提交 `fd3f9732ac448e46998a9660044b7175aa2c4fd1` 与 `2ad9375db057c9b5567ceaebce543f226b9eeef4`、main CI `29936934533`、Release workflow `29937491867`、官方 zip 审计和现有主 Chrome Profile 验收均已完成。
- V1.4.1 closeout：`docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`。
- V1.4.1 应用提交 `8af01d34bc5d095d7961e658558e8fa7c5c16ff0`，main CI `29842309751` 与 Release workflow `29842892835` 均成功；官方 zip 审计与现有已登录主 Chrome Profile 验收已经完成。
- V1.4.0 closeout：`docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`。它继续是 Google Drive、完整 JSON、真实迁移与 30 天 Supabase 保险期的数据基线。
- 当前正式 Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-23-v1.5.3`；zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-23-v1.5.3/WebCollect-Chrome-Extension-v1.5.3-2026-07-23.zip`。V1.5.0 继续作为标签组/favicon 功能基线。
- V1.3.0 保留 Google / 百度 / Bing，新增纯本地模糊检索、拼音、错字容错、意图别名、加权全文排序和 opt-in 公开网页知识缓存；不调用 AI API，也不捆绑本地模型。348 unit、31 legacy、44 E2E、Web/扩展构建、17.4 MiB 门禁和 208 个生产依赖零漏洞审计已完成。
- V1.4.0 将正式云同步切换为用户自己的 Google Drive 隐藏应用目录，并增加完整 JSON 备份/恢复；本地 IndexedDB 仍是第一写入目标，V1.3.1 顶栏与 V1.3.0 本地搜索行为保持不变。

## 第一件事

先阅读：

1. `AGENTS.md`
2. `AGD.md`
3. `HANDOFF.md`
4. `docs/audit/webcollect-v1.5.3-adaptive-viewport-closeout-2026-07-23.md`
5. `docs/audit/webcollect-v1.5.2-github-capture-metadata-closeout-2026-07-23.md`
6. `docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`
7. `docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`
8. `docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`
9. `docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`
10. `docs/audit/webcollect-v1.3.1-header-ui-closeout-2026-07-19.md`
11. `docs/audit/webcollect-v1.3.0-smart-search-closeout-2026-07-18.md`
12. `docs/audit/webcollect-v1.2.2-header-layout-closeout-2026-07-17.md`
13. `docs/audit/webcollect-v1.2.1-mindmap-polish-closeout-2026-07-17.md`
14. `docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`
15. `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`
16. `PROJECT_SUMMARY.md`
17. 本文件

然后运行并用中文简要汇报：

```bash
pwd
git status -sb
git log --oneline --decorate -8
git remote -v
git tag --list 'webcollect-2026-07-23-v1.5.2' --points-at HEAD
```

不要使用旧目录 `/Users/rockyx/Documents/webcollect`，也不要从旧分支、旧 RC 或旧交接目标继续开发。

## 接收新功能的方式

我会在新线程里说明大型功能需求。收到后：

1. 先结合现有代码复述你对目标、用户流程和边界的理解。
2. 检查相关模块、数据模型、同步影响、扩展权限和既有测试，不要先入为主重构全项目。
3. 如果仍有会改变产品行为的关键歧义，再集中问我；可从代码和文档确认的内容不要反复询问。
4. 根据复杂度自主决定是否使用原生计划或 goal。不要调用、安装或模仿已退役的 Superpowers、`goal-zzx` / `zzx-goal`、`andrej-karpathy-coding`。
5. 完整执行实现、局部测试、全量回归、浏览器验收、版本更新、文档更新、提交、推送和 Release，不要停在方案或半成品。

## 不可破坏的现状

- 不得清空、覆盖或重置用户 IndexedDB、Supabase、Chrome storage、收藏、分类、分项、偏好、回收站、快照或同步状态。
- 不得用 `seed.ts` 覆盖真实用户数据；未经明确授权，不删除 closeout 中记录的两条空收集箱。
- 保留 V1.1.2 已修复的同步修订、tombstone、canonical 收集箱、并发浮窗队列、OAuth、启动壁纸零闪烁和发布门槛。
- 保留 V1.2.2 数据边界：导图视图状态只存 `mindmapViewState:<sectionId>`，模式只存 localStorage `webcollect_collection_view_mode`；不得把它们加入同步、快照、Chrome storage 或云 schema。
- 保留 V1.3.0 搜索边界：`WebCollectSearch/knowledge_index` 只装可重建本地派生缓存、同意和进度；它不进入业务 IndexedDB、Chrome storage、快照、dirty sets、Supabase 或同步。历史向量表/Edge Function 不在运行路径中，不要重新接回，也不要破坏性删除。
- 不要给 V1.3.0 增加 OpenAI、DeepSeek、其他 AI API 或本地大模型；当前产品决策是纯本地脚本检索。
- 保留搜索引擎选择、壁纸模式开关、顶部分项编辑、分类轻量编辑、翻译、目标分类、小松鼠品牌和半脸悬停浮窗。
- 新功能若触及同步或迁移，必须先用隔离数据和快照验证；任何真实云端破坏性操作仍需在执行前说明。

## 浏览器与真实扩展验证

- 普通 localhost 和 UI 检查优先使用 in-app Browser，并复用同一上下文。
- 需要真实 Chrome 登录态、扩展、右键菜单或 `chrome://newtab` 时，使用用户现有已登录主 Chrome profile，不另建第二个本机 Profile。
- 双屏时使用同一 profile 的副屏辅助窗口或 `Codex Workbench`，不要操作主屏的 X、视频、Gmail、ChatGPT 或其他个人标签。
- 用户的 Windows 与 Mac 日常使用作为跨设备持续观察，不再设置独立 Profile B 发布门槛。

## 版本与交付

- 这是大型功能时通常考虑升级到下一个小版本；最终按实际影响范围决定，不能在理解需求前机械定版。
- 使用实际完成日期，并同步更新 package、manifest、页面版本、文档、tag、Release 和 zip 文件名。
- 涉及 Chrome 扩展时，必须提供正式 Release 页面和 zip 直链，并核对 tag、main、manifest、SHA-256 与 CI 属于同一发布身份。
- 最终回复先说明“完成、未完成或卡在哪里”，再给测试证据和用户需要执行的唯一下一步。

## 新需求

我接下来要增加的功能是：

> 在这里接着写需求。不要让我重新复述 V1.1.2 之前的项目背景，直接根据上述文件接手。

# WebCollect 下一大型功能线程提示词

## 2026-07-21 V1.4.1 浮窗快捷键修复状态

- 当前应用版本：`V1.4.1 / 2026年7月21日`；目标 tag `webcollect-2026-07-21-v1.4.1`；资产 `WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`。
- 最新 closeout：`docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`。V1.4.1 只修复浮窗键盘事件穿透；发布后应以该 closeout 的真实 CI、Release 和官方 zip 证据为准。
- 浮窗内输入 `s` / `S`、中文 IME、Tab 或复制粘贴不会再触发 GitHub 等宿主网页的快捷键；浮窗外的网页快捷键仍正常。
- V1.4.1 不新增存储 key、权限或依赖，不修改业务数据、Drive、Chrome storage、快照、seed 或同步协议。
- Google Drive `appDataFolder` 已成为正式同步路径，只申请 `drive.appdata`；本地 IndexedDB 永远先写，无账号/离线继续可用。
- Rocky 真实数据已经完成迁移、逐文件回读、手动同步、重启和完整 JSON 复核；旧 Supabase 数据保持不动 30 天。
- 正式运行时不含 Supabase 依赖或请求；历史代码/SQL/会话 key 只作回退档案，不得破坏性清理。
- 迁移和发布清单已经闭合；后续任务不要重新迁移、不要让用户重复授权，也不要清理 30 天保险期内的旧 Supabase 数据。

这是一个新的 Codex 线程。请在固定工作区 `/Users/rockyx/vibe coding/Web Collect 0628` 接手 `RockyXuan/webcollect`，并在我随后描述需求后实现一个新的大型功能。

## 先确认当前基线

- 当前应用版本：`V1.4.1 / 2026年7月21日`；tag `webcollect-2026-07-21-v1.4.1`；正式资产 `WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`。
- V1.4.1 closeout：`docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`。
- V1.4.0 closeout：`docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`。应用提交 `c09859986439fef83b4c2cda2131b22f91f5481e`，main CI `29821265795` 与 Release workflow `29821729530` 均成功；官方 zip 审计与现有已登录主 Chrome Profile 最终只读验收已经完成。
- 正式 Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-21-v1.4.1`；zip 直链：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-21-v1.4.1/WebCollect-Chrome-Extension-v1.4.1-2026-07-21.zip`。
- V1.3.0 保留 Google / 百度 / Bing，新增纯本地模糊检索、拼音、错字容错、意图别名、加权全文排序和 opt-in 公开网页知识缓存；不调用 AI API，也不捆绑本地模型。348 unit、31 legacy、44 E2E、Web/扩展构建、17.4 MiB 门禁和 208 个生产依赖零漏洞审计已完成。
- V1.4.0 将正式云同步切换为用户自己的 Google Drive 隐藏应用目录，并增加完整 JSON 备份/恢复；本地 IndexedDB 仍是第一写入目标，V1.3.1 顶栏与 V1.3.0 本地搜索行为保持不变。

## 第一件事

先阅读：

1. `AGENTS.md`
2. `AGD.md`
3. `HANDOFF.md`
4. `docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`
5. `docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`
6. `docs/audit/webcollect-v1.3.1-header-ui-closeout-2026-07-19.md`
7. `docs/audit/webcollect-v1.3.0-smart-search-closeout-2026-07-18.md`
8. `docs/audit/webcollect-v1.2.2-header-layout-closeout-2026-07-17.md`
9. `docs/audit/webcollect-v1.2.1-mindmap-polish-closeout-2026-07-17.md`
10. `docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`
11. `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`
12. `PROJECT_SUMMARY.md`
13. 本文件

然后运行并用中文简要汇报：

```bash
pwd
git status -sb
git log --oneline --decorate -8
git remote -v
git tag --list 'webcollect-2026-07-21-v1.4.1' --points-at HEAD
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

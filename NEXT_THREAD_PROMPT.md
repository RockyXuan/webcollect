# WebCollect 下一大型功能线程提示词

这是一个新的 Codex 线程。请在固定工作区 `/Users/rockyx/vibe coding/Web Collect 0628` 接手 `RockyXuan/webcollect`，并在我随后描述需求后实现一个新的大型功能。

## 先确认当前基线

- 已验证稳定版：`V1.2.0 / 2026年7月16日`。
- 正式 tag：`webcollect-2026-07-16-v1.2.0`。
- Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-16-v1.2.0`。
- zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-16-v1.2.0/WebCollect-Chrome-Extension-v1.2.0-2026-07-16.zip`。
- V1.2.0 closeout：`docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`。
- V1.2.0 新增 Fable 风格导图模式，经典模式仍默认启动。导图只新增本地 `mindmapViewState:<sectionId>` 视图状态，不进入 dirty sets、快照、Chrome storage、Supabase 或同步偏好。
- V1.1.2 是上一稳定边界：源码提交 `b7b4f75e8eb8f4f2763b0ede04b1f8a49a12962d`，tag `webcollect-2026-07-15-v1.1.2`，zip SHA-256 `79cc7fb01d678e2af24cc8b733353a4a12a6b7ddceba71a5514e7f7f7c9a1192`。

## 第一件事

先阅读：

1. `AGENTS.md`
2. `AGD.md`
3. `HANDOFF.md`
4. `docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`
5. `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`
6. `PROJECT_SUMMARY.md`
7. 本文件

然后运行并用中文简要汇报：

```bash
pwd
git status -sb
git log --oneline --decorate -8
git remote -v
git tag --list 'webcollect-2026-07-16-v1.2.0' --points-at HEAD
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
- 保留 V1.2.0 导图的数据边界：视图状态只存 `mindmapViewState:<sectionId>`，不得把导图布局加入同步、快照或云 schema。
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

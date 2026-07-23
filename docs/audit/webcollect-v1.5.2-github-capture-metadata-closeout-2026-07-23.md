# WebCollect V1.5.2 GitHub 收藏信息修复 Closeout

日期：2026-07-23  
版本：`V1.5.2`  
目标 tag：`webcollect-2026-07-23-v1.5.2`  
目标资产：`WebCollect-Chrome-Extension-v1.5.2-2026-07-23.zip`

## 结论

V1.5.2 修复浮窗收藏 GitHub 仓库时标题过长、项目简介不准确，以及重复网址编辑被静默跳过的问题。实现采用显式用户确认和乐观并发校验，不直接覆盖旧卡片，也不批量改写历史收藏。

本版不新增权限、依赖、存储 key、Drive Schema、Chrome storage、IndexedDB 表或数据迁移；不接入 AI、翻译 API、本地模型或 GitHub Token；不修改 seed。

## 实现

### GitHub 仓库识别

- 共享解析器供浮窗、扩展后台和 Web 元数据接口共同使用。
- `/owner/repo` 及 `tree`、`blob`、`issues` 等子页面统一取仓库名。
- GitHub 首页、用户主页、搜索、Topics、Marketplace、Settings 等保留路径不误判。

### README 简介

- 只访问公开 `raw.githubusercontent.com/{owner}/{repo}/HEAD/` 下的常见 README 文件。
- 请求不携带 Cookie、登录态或凭证；有总超时、单请求超时、约 256 KiB 上限和文本格式白名单。
- 提取器跳过徽章、图片、目录、代码、安装命令、表格、纯链接和重复噪声，取第一段实质介绍。
- README 失败时回退 GitHub 页面 OG/About 描述，不阻塞浮窗。
- GitHub 仓库不再套用平台通用简介。本地规则粗译质量不足时保留准确英文。

### 重复网址确认更新

- 浮窗保存前只读查询 `WebCollect/webcollect_data/cards`，不复制业务数据到 Chrome storage。
- 单个重复卡片显示新旧标题和简介对比，以及“更新原卡片”和“保留原内容”。
- 用户确认后，草稿携带目标卡片 ID 与确认时的 `updatedAt`。
- drain 再次核对卡片 ID、规范化 URL 和版本；多个重复或版本冲突时停止覆盖。
- 只更新非空标题、`shortDesc`、`fullDesc`；保留 ID、URL、分项、分类、顺序、备注、简称、图标和创建时间。
- 内容不变时不产生业务写入。旧队列记录和右键快速收藏重复网址仍安全跳过。

## 数据安全

- 没有清空、覆盖或迁移 IndexedDB、Chrome storage、Google Drive、旧 Supabase 保险档案、收藏、分类、分项、偏好、回收站、快照、同步状态或 seed。
- 只有用户在浮窗中明确确认且版本未冲突的目标卡片可以改变。
- 导图相机、视图偏移、标签组、图标缓存、知识缓存和完整备份 Schema 均未改变。
- `src/lib/seed.ts` SHA-256 保持 `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`。

## 自动验证

当前本地验证已完成：

- GitHub 解析器与 README 提取器纯函数测试。
- 单个重复卡片确认更新、取消、无变化、空简介、版本冲突和多个重复。
- 更新后分类、顺序、备注、简称、图标和创建时间保持不变。
- 右键/旧队列重复网址继续跳过。
- GitHub 首页通用简介、仓库本地粗译和质量回退。
- 扩展真实 MV3 隔离环境中的浮窗新旧对比、保留原内容零写入、确认更新字段保护、键盘隔离和控制台零错误。
- 57 个 Vitest 文件、420 项测试和 31 项 legacy scripts 已通过。
- TypeScript、lint、Web/扩展生产构建、扩展产物检查和 17.3 MiB 体积门禁已通过。
- 完整 Playwright 45/45 已通过；隔离 MV3 浮窗验收控制台零错误。
- 生产依赖审计覆盖 204 个包，`info/low/moderate/high/critical` 均为 0。
- seed SHA 已在最终构建后复核不变。

真实主 Chrome Profile 的辅助任务窗口已完成候选包只读验收：

- 稳定扩展 ID `immpcmhmabobllnopedaoflcjneigbko` 原位重载到 1.5.2，未卸载扩展、未建立第二个 Profile。
- `nexu-io/codex-slides` 浮窗显示标题 `codex-slides` 和项目自身简介，不再使用 GitHub 平台通用套话。
- 已存在的真实收藏触发新旧标题/简介确认面板；选择“保留原内容”后明确显示“本次没有写入”。
- 随后直接打开稳定扩展 ID 的 WebCollect 页面，7 个分项、回收站 15、标签组和原始长标题仍存在。

发布后仍需追加 main CI、Release workflow 和官方 zip 证据。

## 发布证据

发布完成后在此追加：

- 应用提交与 main CI。
- Release workflow、正式 tag 和 Release 地址。
- 官方单一 zip 的大小、SHA-256、manifest/稳定扩展 ID/权限核验及与本地构建逐字节比较。
- 现有已登录主 Chrome Profile 辅助窗口中的只读验收。

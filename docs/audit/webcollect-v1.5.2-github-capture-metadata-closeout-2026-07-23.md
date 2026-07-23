# WebCollect V1.5.2 GitHub 收藏信息修复 Closeout

日期：2026-07-23  
版本：`V1.5.2`  
正式 tag：`webcollect-2026-07-23-v1.5.2`
正式资产：`WebCollect-Chrome-Extension-v1.5.2-2026-07-23.zip`

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

## 发布证据

- 正式应用提交：`3cd02b2bc7c85e655f98e6cea5619c3f9ac710e8`。
- main CI：[`29987210999`](https://github.com/RockyXuan/webcollect/actions/runs/29987210999)，完整验证和生产依赖审计均为 `success`。
- 正式 tag workflow：[`29987630172`](https://github.com/RockyXuan/webcollect/actions/runs/29987630172)，`verify-tag` 为 `success`。
- 正式 Release：[`webcollect-2026-07-23-v1.5.2`](https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-23-v1.5.2)。
- 官方 zip：[`WebCollect-Chrome-Extension-v1.5.2-2026-07-23.zip`](https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-23-v1.5.2/WebCollect-Chrome-Extension-v1.5.2-2026-07-23.zip)；Release 只有这一份资产，大小 `17,069,709` bytes，SHA-256 `cc76c1c06bb707d3edceb974cc1d5a7d7b81b51d9dfee704bad2d7364c81a3e9`。
- 官方 zip 可无错误解包，共 46 个 zip entry、41 个实际文件、0 个重复 entry；解包树与最终本地 `extension/dist` 逐文件一致。
- 官方 manifest 为 MV3、版本 `1.5.2`，稳定扩展 ID 为 `immpcmhmabobllnopedaoflcjneigbko`；权限仍只有 `storage`、`activeTab`、`identity`、`contextMenus`、`favicon`，没有 `tabs` / `tabGroups`，Google OAuth scope 仍只有 `drive.appdata`，包内没有 Client Secret。
- 正式 tag 精确指向应用提交。发布后的纯文档证据提交不改变应用版本，也不移动 tag。
- 官方包已在现有已登录主 Chrome Profile 的辅助任务窗口原位重载，未卸载扩展、未创建第二个 Profile。稳定 ID 的真实新标签页恢复 7 个分项、回收站 15、真实收藏墙、顶部收藏栏、账户入口和标签组入口；Google Drive 状态为“云端已同步 15:18”。验收没有点击保存、刷新或其他写入操作。
- 首次发布证据提交 `f98eedcd78def55808df46615100aed1f7527441` 的 main CI `29988093195` 暴露了隔离测试夹具的初始化竞态：测试可能在新标签页首次初始化尚未写完时直接注入测试卡片，导致后续断言偶发读回夹具原标题。正式应用提交、tag workflow、官方包和真实主 Profile 均不受影响。
- 测试专用提交 `2f164a64c5c8fe8fa21ed19561415106014e0d14` 改为等待 IndexedDB 初始化完成且收藏目标缓存正式发布后再注入隔离数据，并连续观察确认更新保持稳定；本机真实扩展连续 3 次通过，main CI [`29988897257`](https://github.com/RockyXuan/webcollect/actions/runs/29988897257) 的生产审计和完整验证均为 `success`。该提交不改变扩展运行时代码或正式资产。

## 最终状态

V1.5.2 已完成实现、自动化验证、正式发布、官方包复核、真实主 Profile 只读验收以及发布后测试夹具稳定性复核。本文件之后的收尾提交只补充发布证据，不是新的应用版本。

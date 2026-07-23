# WebCollect V1.5.1 Next.js 安全补丁收口

版本身份：`V1.5.1 / 2026年7月23日`

正式标签：`webcollect-2026-07-23-v1.5.1`

正式资产：`WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`

## 触发原因

- V1.5.0 应用与 Release 已完成后，npm 在 2026-07-22 22:59–23:09 UTC 新增了 9 条 Next.js 生产安全公告。
- 后续纯文档提交的 main CI `29973753668` 因实时审计发现 `next 16.2.10` 的 4 条高危与 5 条中危问题而失败；功能 verify job 与文档本身不是触发原因。
- npm 官方审计给出的统一修复版本为 Next.js `16.2.11` 或更高。本补丁选择最小同系列升级 `16.2.11`。

## 改动边界

- `next`：`16.2.10` → `16.2.11`。
- `eslint-config-next`：`16.2.10` → `16.2.11`，与运行时保持同版本。
- 同步 package、扩展 manifest、应用版本和品牌日期为 V1.5.1 / 2026-07-23。
- 不修改标签组、favicon、收藏、分项、分类、偏好、回收站、仓库、壁纸、导图、Google Drive、完整备份、Chrome storage、权限、稳定扩展 ID、快照、Supabase 保险档案或 seed。
- 不增加依赖、存储 key、Chrome 权限、OAuth scope、外部 API 或数据迁移。

## 本地验证

- npm 官方生产依赖审计：204 个生产包，info / low / moderate / high / critical 均为 0。
- 55 个 Vitest 文件 / 413 项测试通过。
- 31/31 legacy scripts 通过。
- TypeScript 与 lint 通过。
- Next.js 16.2.11 Web 正式构建与扩展正式构建通过。
- 扩展背景脚本、导图产物和 17.3 MiB 体积检查通过。
- 45/45 Playwright 完整浏览器回归通过，包含标签组真实拖拽、favicon 回退、智能搜索、导图、壁纸和多视口检查。
- 首次 Web 构建在受限沙箱中因 Turbopack 内部进程无法绑定端口失败；按用户已授权的本机端口范围在沙箱外重跑后完整通过。这不是应用错误。

## 正式发布证据

- 应用提交 `713cdc975801b0d98b9bc0a2891e7f95592da871` 已进入 `main`。
- main CI `29974438847` 全绿；其中实时生产依赖审计与完整 verify job 均成功。
- Release workflow `29974689750` 成功发布正式标签 `webcollect-2026-07-23-v1.5.1`。
- Release 页面：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-23-v1.5.1`。
- 官方 zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-23-v1.5.1/WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`。
- Release 只有一个资产，大小 `17,065,370` bytes，SHA-256 `4667cfd57ede39676b89d87cd9055313bfe52290b134d461b5fa70396f10e29d`；GitHub digest 与本地下载复算一致。
- 官方包为 Manifest V3 `1.5.1`，保留稳定扩展身份；权限仍只有 `storage`、`activeTab`、`identity`、`contextMenus`、`favicon`，没有 `tabs` 或 `tabGroups`；OAuth scope 仍只有 `drive.appdata`。
- 官方包 41 个文件、无重复条目，解包树与本次 `extension/dist` 逐字节一致。

## 真实 Chrome 只读验收

- 使用现有已登录主 Chrome Profile 的专用辅助窗口完成；没有新建第二个 Profile，没有操作无关个人标签。
- 活跃的已解压扩展源先追加式备份到 `/private/tmp/webcollect-installed-extension-backups/active-v1.5.0-before-v1.5.1-20260723-01`，再用官方 V1.5.1 包原位更新；没有卸载扩展，也没有清空存储。
- Chrome 扩展详情页显示 WebCollect `1.5.1`、已启用、稳定身份、活动 Service Worker、预期加载目录与 favicon 权限，并确认重新加载成功。
- 同一辅助窗口的新标签页完整恢复 7 个分项、原收藏墙、回收站计数 15、账户入口、书签栏与“标签组”入口。
- Drive 状态现场显示一次“Google Drive 请求超时，本机数据保持不变”的安全降级提示；验收未点击重试，未触发收藏、标签组或 Drive 写入。该网络状态不影响本地收藏使用，也不冒充云端同步成功。
- 由于 `chrome://extensions` / `chrome://newtab` 属于 Chrome 内部页，本次使用 Computer Use 操作同一稳定辅助窗口；没有追随或操作用户主窗口。

## 发布清单

- [x] 最小依赖升级与本地完整回归。
- [x] 应用提交推送 main，main CI 全绿。
- [x] 正式 tag 与 Release workflow 全绿。
- [x] 下载官方单一 zip，复核 manifest、稳定 ID、权限、唯一文件、大小和 SHA-256。
- [x] 现有主 Chrome Profile 原位重载并完成只读验收。
- [x] 追加纯文档发布证据；它不是新应用版本。

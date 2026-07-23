# WebCollect V1.5.1 Next.js 安全补丁收口

版本身份：`V1.5.1 / 2026年7月23日`

目标标签：`webcollect-2026-07-23-v1.5.1`

目标资产：`WebCollect-Chrome-Extension-v1.5.1-2026-07-23.zip`

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

## 发布清单

- [x] 最小依赖升级与本地完整回归。
- [ ] 应用提交推送 main，main CI 全绿。
- [ ] 正式 tag 与 Release workflow 全绿。
- [ ] 下载官方单一 zip，复核 manifest、稳定 ID、权限、唯一文件、大小和 SHA-256。
- [ ] 现有主 Chrome Profile 原位重载并完成只读验收。
- [ ] 追加纯文档发布证据；它不是新应用版本。

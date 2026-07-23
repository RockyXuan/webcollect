# WebCollect V1.5.0 标签组与 favicon 自愈收口

版本身份：`V1.5.0 / 2026年7月22日`

正式标签：`webcollect-2026-07-22-v1.5.0`

正式资产：`WebCollect-Chrome-Extension-v1.5.0-2026-07-22.zip`

发布状态：应用、main CI、正式 Release、官方包审计和现有主 Chrome Profile 只读验收均已完成。本次发布后追加的证据提交只修改文档，不是新应用版本。

## 功能结果

- 顶部分项栏右侧加入全局“标签组”架，并用浅色竖线分隔。每个标签组显示图标、最多两个字符的简称和网页数量。
- 经典模式可拖动网页卡片原有手柄，将 URL 快照复制到现有标签组；拖到“+ 标签组”会新建标签组并加入。拖拽不移动原卡片。
- 导图模式通过同一个管理面板搜索收藏并加入标签组。
- 标签组是固定模板。原收藏后续编辑、移动、软删除或网页标签关闭都不会改变已保存模板。
- 点击标签组会打开所有去重后的有效 URL。单组最多 50 个；超过 10 个会再次确认。默认全部后台打开，也可选择首个标签页激活。
- 本版没有使用 Chrome 原生标签页分组，不申请 `tabs` 或 `tabGroups` 权限。

## 数据、同步和备份契约

- 新增 `SavedTabPack` / `SavedTabPackItem` / `TabPackOpenMode`。每个标签组携带独立的 `syncRevision`、`syncDeviceId`、`updatedAt` 和软删除时间。
- 标签组及打开方式存放在现有 `WebCollect/webcollect_data` IndexedDB，通过同一个 storage lock 原子读写；不写入收藏/分类 dirty sets。
- Google Drive 工作区文件增加可选的标签组字段。旧文件未携带字段时解释为“不知道”，不得把本地标签组覆盖为空；多设备按记录修订合并并保留 tombstone。
- Portable Backup 当前 Schema 升级为 V2，完整包含标签组和打开方式。V1 备份继续严格验证；由于 V1 无法表达标签组，恢复 V1 时保留设备现有标签组。
- 标签组不改变收藏、分项、分类、偏好、回收站、仓库、壁纸、导图状态、快照或旧 Supabase 数据。

## favicon 修复

- 所有收藏图标先同步显示字母兜底，favicon 加载成功后覆盖，因此网络失败或离线时不会出现空白。
- 扩展优先使用 Chrome `_favicon` 能力，再尝试收藏元数据、直接站点候选和既有回退；元数据解析会从多个 icon link 中选择更合适的资源。
- 抖音创作者中心、小红书创作者中心和豆瓣页面增加稳定站点候选；真实网页捕获时也会保存当前标签页可用的 `favIconUrl`。
- 官方候选只读核验：抖音主站 favicon 会跳转到字节官方 CDN 并返回图标，小红书创作者 favicon 直接返回图标；抖音创作者路径本身返回 HTML，因此未把这个错误响应放进候选链。
- 可重建图标缓存在独立 `WebCollectIcons/site_icons` IndexedDB 中，限制总计 8 MiB、单项 256 KiB，并限制并发写入。它不进入业务 IndexedDB、Google Drive、完整备份、Chrome storage、dirty sets、快照或 seed。
- 通用、内部、相对路径或字母兜底不会被写回 `WebCard.imageUrl`，避免再次污染持久化图标。

## 权限和安全边界

- Manifest 唯一新增权限为 `favicon`。既有权限、稳定 key、扩展 ID、CSP 和 `drive.appdata` OAuth scope 保持不变。
- 不增加运行时依赖或外部脚本，不接入 OpenAI、DeepSeek、本地模型或其他付费 API。
- 不清空、覆盖、迁移或重建真实 IndexedDB、Google Drive、Chrome storage、收藏、分类、偏好、回收站、快照、同步状态和 seed。

## 本地验证证据

- 改动前验证追加式完整 JSON 备份：7 个分项、135 个分类/分组、372 个网页、15 个回收站条目、4 个本地版本、69 个 Drive 版本、2 个导图视图状态和 0 个既有标签组。
- 备份内容 SHA-256：`eac1cf524d0ade019ae847a1b6751f9271b822c6b1ac9c8ba5ed5e7cf5ed16c1`。
- 保护 seed SHA-256：`0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`。
- in-app Browser 在同一稳定上下文完成 1920px 与 390px 验收：新建标签组、真实拖拽 ChatGPT、重复加入防重、原收藏保留、经典/导图往返、管理器搜索和移动端无横向溢出均通过，控制台零错误。
- 330 节点性能场景发现并修复了派生图标缓存的无界并发问题；改为跳过扩展内置相对资产、串行受限缓存后专项回归通过。
- 第一轮 main CI 在 GitHub Linux 环境暴露了拖拽落点的跨平台几何差异：旧逻辑按整张卡片中心命中标签组，而用户实际从左侧手柄拖动。修复后改为按真实指针起点与拖动位移命中，保留卡片矩形作为无指针事件的降级路径；专项并发连续 5 次及完整 45 项 Playwright 均通过。
- 发布前 npm 官方审计发现 `sharp 0.34.5` 受 libvips 高危公告 `GHSA-f88m-g3jw-g9cj` 影响（范围 `<0.35.0`）；锁定兼容的 `sharp 0.35.3` 后，Next.js 正式构建通过，204 个生产依赖重新审计为各级 0 项。
- 最终本地门禁：55 个 Vitest 文件 / 413 项测试、31/31 legacy scripts、45/45 Playwright、TypeScript、lint、Web/扩展正式构建、17.3 MiB 体积与扩展产物检查全部通过。

## 正式发布证据

- 应用提交 `fd3f9732ac448e46998a9660044b7175aa2c4fd1` 与跨平台拖拽修复提交 `2ad9375db057c9b5567ceaebce543f226b9eeef4` 已推送 `main`。最终 main CI `29936934533` 成功，其中 verify 与生产依赖审计均通过。
- 正式 tag `webcollect-2026-07-22-v1.5.0` 已发布；Release workflow `29937491867` 成功。Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-22-v1.5.0`；zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-22-v1.5.0/WebCollect-Chrome-Extension-v1.5.0-2026-07-22.zip`。
- Release 只有一个资产，大小 `17,065,370` bytes，SHA-256 `2b499aeaa0c6ec14d5454335deb69b6a0ae3561f0e5c750c3d5ec32a42e76749`；GitHub digest 与本地复算一致。
- 官方 zip 内 manifest 为 V3 / `1.5.0`，稳定 key 与扩展 ID 不变；权限仅为 `storage`、`activeTab`、`identity`、`contextMenus`、`favicon`，没有 `tabs` 或 `tabGroups`；OAuth scope 仍只有 `drive.appdata`。
- 官方 zip 文件名唯一，解包后的 41 个文件与已验证的 `extension/dist` 逐字节一致。

## 真实 Chrome 验收

- 在现有已登录主 Chrome Profile 的专用辅助窗口执行，未新建 Profile，未操作无关个人标签。实际启用的解压目录先追加式备份到 `/private/tmp/webcollect-installed-extension-backups/active-v1.4.1-before-v1.5.0-20260723-01`，再用官方 V1.5.0 解包树原位更新；曾误识别的旧停用目录已从其独立备份完整恢复为 V1.4.1。
- Chrome 扩展详情页确认 WebCollect `1.5.0`、17.3 MB、稳定扩展 ID、Service Worker 正常、已启用，并显示新增的站点图标读取权限。
- 同一辅助窗口新开真实新标签页后，原有 7 个分项、收藏墙和回收站计数 15 均可见；全局“+ 标签组”入口出现，favicon 在资源加载前立即显示字母兜底。同步控制仍在，未执行任何收藏、标签组或云端业务写入。
- Chrome 的自动化安全策略不允许直接导航 `chrome-extension://` 内部页，因此没有用绕过手段补做脚本检查；版本、权限和真实新标签页由 Chrome UI 直接验收，数据边界由发布前备份与无写入操作共同保护。

## 最终清单

- [x] TypeScript、lint、413 Vitest、31 项 legacy tests、Web/扩展构建、扩展产物/大小、45 项 Playwright 和生产依赖审计。
- [x] seed SHA 与完整 V1 备份重新验证；V1.5.0 验证器读取出 7/135/372/15/4/69/2 和 0 个旧标签组，原内容哈希保持一致。
- [x] 应用提交推送 `main`，main CI 全绿。
- [x] 正式 tag 与 Release workflow 全绿。
- [x] 下载官方单一 zip，复核 manifest、稳定 ID、权限、唯一文件、大小和 SHA-256。
- [x] 现有已登录主 Chrome Profile 原位重载并完成只读验收，不新建 Profile、不操作无关标签。
- [x] 追加纯文档发布证据；它不是新应用版本。

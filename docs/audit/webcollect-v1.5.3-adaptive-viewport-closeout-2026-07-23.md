# WebCollect V1.5.3 动态视口适配 Closeout

日期：2026-07-23

版本：`V1.5.3`

正式 tag：`webcollect-2026-07-23-v1.5.3`

正式资产：`WebCollect-Chrome-Extension-v1.5.3-2026-07-23.zip`

## 结论

V1.5.3 修复 Chrome 侧边标签页压缩网页可用宽度后，WebCollect 顶部工具栏提前换行、经典收藏墙仍按固定宽度排列而产生右侧大面积留白的问题。

实现只根据 WebCollect 根容器的实际宽度做运行时适配，不判断 Chrome 标签页位于顶部、左侧还是右侧，也不使用会破坏拖拽、弹窗和导图坐标的整页 `zoom` 或 `transform`。

## 实现

### 自适应密度

- 新增纯函数 `getAdaptiveLayoutMetrics`，输出 `wide / compressed / reflow / compact`、几何密度、文字密度和最低控件高度。
- 根容器使用 `ResizeObserver` 观察真实可用宽度，并结合既有 `visualScale` 计算当前显示档位。
- `≥1880px` 保持 V1.5.2 桌面几何；`1600–1879px` 在 `0.88–1` 之间平滑压缩；`1181–1599px` 固定为 `0.88` 并把操作栏放到第二行；`≤1180px` 保持现有紧凑规则。
- 密度只存在于当前 React 运行时，不新增或写入任何持久化 key。

### 顶部三行与经典收藏墙

- Logo、搜索、同步状态、操作按钮、模式开关、分项、标签组和收藏栏共享自适应尺寸变量。
- 几何最多缩小约 12%，文字最多缩小约 8%，主要按钮点击高度最低保持 36px。
- 经典分类、分组、卡片、间距和内边距使用相同密度；TypeScript 布局计算与 Web/扩展 CSS 保持一致。
- 用户原有宽度、列数和锁定状态只作为逻辑偏好读取；响应式渲染不会把临时密度写回这些偏好。

### 导图边界

- 导图只让顶部三行使用自适应密度。
- 节点尺寸、自动布局坐标、连线、world transform、相机、拖拽和悬停预览不进入页面密度缩放。
- 舞台尺寸变化继续由导图现有 `ResizeObserver` 与 `fitCamera` 处理。

## 数据安全

- 没有清空、覆盖或迁移收藏、分类、分项、标签组、偏好、回收站、快照、IndexedDB、Chrome storage、Google Drive、dirty sets、同步状态或旧 Supabase 保险档案。
- 不新增权限、依赖、存储 key、Chrome API、Drive Schema 或备份字段。
- `visualScale` 的持久化含义不变；自适应密度不持久化、不同步。
- `src/lib/seed.ts` SHA-256 保持 `0e48761b595d8303dd71c4f7a8d216424301abdec2d87b2e13533c82c58c2621`。

## 本地验证

- 纯函数覆盖 `1920、1880、1680、1600、1599、1536、1366、1180、1024、390px`，以及 `85% / 100% / 125%` 视觉缩放和异常输入。
- `1920px` 为 `wide` 且密度 `1`；`1680px` 为 `compressed`，搜索、同步与操作区不重叠，主要按钮高度 36px；`1536px` 为 `reflow` 且操作栏整齐进入第二行；`390px` 无页面横向溢出。
- 隔离的 `Chrome / 常用 / download` 三块收藏墙在 `1680px` 保持同一行；`1536px` 自然重排；切换前后受保护业务数据逐字段一致。
- 导图在 `1920→1680→1536px` 连续变化时节点逻辑坐标保持不变，四个布局入口和“适应画布”可用，业务数据逐字段一致。
- Web 与扩展的自适应 CSS 块逐字一致；旧的固定 `1181–1799px` 强制换行规则已经移除。
- 本地门禁通过：436 项 Vitest、31 组 legacy scripts、58 项 Playwright、TypeScript、lint、Web/扩展生产构建、扩展产物检查与 17.3 MiB 体积门禁。
- in-app Browser 在同一稳定本机页面完成 `1920 / 1680 / 1536 / 390px` 经典模式检查，控制台错误为 0。

## 正式发布证据

- 应用提交：`5cf6280e33213571e4133e5a412ff8d45f8ed919`。
- main CI：[`29994891634`](https://github.com/RockyXuan/webcollect/actions/runs/29994891634)，`audit-production` 与 `verify` 全部成功。
- 正式 tag workflow：[`29995423399`](https://github.com/RockyXuan/webcollect/actions/runs/29995423399)，`verify-tag`、扩展重建、产物检查、体积检查、打包与 Release 发布全部成功。
- 正式 Release：[`webcollect-2026-07-23-v1.5.3`](https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-23-v1.5.3)，不是 draft 或 prerelease。
- 官方 zip：[`WebCollect-Chrome-Extension-v1.5.3-2026-07-23.zip`](https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-23-v1.5.3/WebCollect-Chrome-Extension-v1.5.3-2026-07-23.zip)；Release 只有这一份资产，大小 `17,071,576` bytes，SHA-256 `4d41b3e721463446bbde515d470ea6dc8079c85039fd4929c02c8f819c7074e4`，与 GitHub digest 一致。
- 官方 zip 可无错误解包，共 46 个 zip entry、41 个实际文件、0 个重复 entry；解包树与正式 tag 的最终本地 `extension/dist` 逐文件一致。
- 官方 manifest 为 MV3、版本 `1.5.3`，稳定扩展 ID 为 `immpcmhmabobllnopedaoflcjneigbko`；权限仍只有 `storage`、`activeTab`、`identity`、`contextMenus`、`favicon`，没有 `tabs` / `tabGroups`，Google OAuth scope 仍只有 `drive.appdata`，包内没有 Client Secret。

## 真实 Chrome 状态

- Chrome 控制接口已识别现有已登录主 Profile 中的 WebCollect 新标签页和扩展详情页，但安全策略禁止控制 `chrome-extension://` 内部页，未使用 Computer Use 或其他方式绕过。
- 已只请求一次人工原位重载；最终的顶部/侧边标签真实只读结果在用户确认后追加。其余发布证据已经闭合。

## 当前状态

V1.5.3 已正式发布，V1.5.2 保留为稳定回退版本。本次发布证据提交只更新文档，不是新的应用版本。

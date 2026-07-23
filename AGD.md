# WebCollect 全项目体检入口

更新时间：2026-07-23
面向对象：Claude / Codex / 后续任何接手 WebCollect 的开发 agent
当前主目录：`/Users/rockyx/vibe coding/Web Collect 0628`
远端仓库：`https://github.com/RockyXuan/webcollect`
主分支：`main`
当前候选代码版本：`V1.5.3 / 2026年7月23日`；正式发布前的稳定回退版本为 `V1.5.2`。
V1.5.3 closeout：`docs/audit/webcollect-v1.5.3-adaptive-viewport-closeout-2026-07-23.md`。
V1.5.2 closeout：`docs/audit/webcollect-v1.5.2-github-capture-metadata-closeout-2026-07-23.md`。
V1.5.1 closeout：`docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`。
V1.5.0 closeout：`docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`。
V1.4.1 closeout：`docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`。它只修复网页浮窗键盘事件穿透；main CI、Release workflow、官方 zip 审计和真实 Chrome 验收均已完成。
V1.3.0 的本地智能搜索、导图、同步和数据边界继续完整保留。

## 2026-07-23 V1.5.3 动态视口适配入口

- WebCollect 只观察自身根容器的实际可用宽度，不识别或依赖 Chrome 标签页位于顶部、左侧还是右侧。
- `≥1880px` 完全保留 V1.5.2 桌面几何；`1600–1879px` 使用 `0.88–1` 的运行时密度温和压缩；`1181–1599px` 使用整齐两行工具栏；`≤1180px` 继续现有紧凑规则。
- 顶部三行、标签组、收藏栏和经典收藏墙共享尺寸变量；文字最多缩小 8%，主要点击控件最低 36px。
- 经典布局的 TypeScript 宽度计算与 CSS 使用同一密度。响应式变化只影响渲染，不会写回用户手工宽度、列数或锁定状态。
- 导图只压缩顶部三行，节点、连线、相机和世界坐标不使用页面密度缩放；舞台继续通过自身尺寸与 `fitCamera` 适配。
- 不使用整页 `zoom` 或 `transform`；不修改 `TopNav` 业务接口、`visualScale` 持久化语义、权限、依赖、存储 key、Drive Schema、Chrome storage、IndexedDB、同步、快照、seed 或扩展稳定 ID。
- 当前本地门禁：436 Vitest、31 legacy、58 Playwright、类型检查、lint、Web/扩展生产构建和 17.3 MiB 扩展体积检查通过；正式 CI、Release 和官方 zip 证据将在发布后补入 closeout。

## 2026-07-23 V1.5.2 GitHub 收藏信息修复入口

- GitHub 仓库及其 `tree`、`blob`、`issues` 等子页面统一使用仓库名作为标题；用户主页和 GitHub 保留路径不误判。
- 扩展与 Web 共用同一解析器。公开 README 只从 `raw.githubusercontent.com` 读取，限制格式、大小和超时，不携带 Cookie、登录态、Token 或其他凭证；失败时安全回退到页面简介。
- GitHub 仓库不再套用“代码托管与协作平台”通用简介；本地粗译质量不足时保留准确英文，不接入 AI、翻译 API 或本地模型。
- 重复网址必须在浮窗显示新旧标题/简介对比并由用户确认；入库时再次核对卡片 ID、网址和版本。确认后也只更新非空标题与简介，保留分类、分项、顺序、备注、简称、图标和创建时间。
- 老队列记录与右键快速收藏的重复网址继续安全跳过；多个重复卡片拒绝自动选择。无确认、无实际内容变化或版本冲突时不产生业务写入。
- 不新增权限、依赖、存储 key、Drive Schema 或数据迁移，不批量改写历史收藏，不修改 seed。
- 应用提交 `3cd02b2bc7c85e655f98e6cea5619c3f9ac710e8`、main CI `29987210999` 与 Release workflow `29987630172` 均成功。正式单一 zip 为 `17,069,709` bytes，SHA-256 `cc76c1c06bb707d3edceb974cc1d5a7d7b81b51d9dfee704bad2d7364c81a3e9`，官方解包树与最终本地构建一致。
- 现有已登录主 Chrome Profile 的辅助任务窗口已原位重载官方包；7 个分项、回收站 15、真实收藏、账户、标签组和 Google Drive“云端已同步 15:18”均恢复，验收未执行写入。
- 发布证据提交曾暴露隔离浮窗测试过早注入数据的竞态；测试专用提交 `2f164a64c5c8fe8fa21ed19561415106014e0d14` 等待工作区完全就绪并增加持久化稳定观察，后续 main CI `29988897257` 全绿。它不改变正式扩展运行时代码、tag 或资产。
- 原始外部审查证据：`docs/audit/claude-fable-capture-metadata-fix-2026-07-17.md`。其中“重复网址直接覆盖”的旧建议已由本次显式确认与版本冲突保护取代。

## 2026-07-23 V1.5.1 Next.js 安全补丁入口

- npm 在 V1.5.0 发布后新增 9 条 Next.js 生产安全公告，`16.2.10` 被判定为 4 条高危、5 条中危；官方统一修复线为 `16.2.11`。
- 本版只升级 `next` 与 `eslint-config-next` 到 `16.2.11`，并同步版本身份为 V1.5.1。标签组、favicon、Drive、备份、权限、扩展稳定 ID 和用户数据均不改变。
- 本地复核通过 413 Vitest、31 legacy、45 Playwright、TypeScript、lint、Web/扩展构建、产物/大小检查和 204 个生产依赖各级 0 漏洞审计。
- 应用提交 `713cdc975801b0d98b9bc0a2891e7f95592da871`、main CI `29974438847` 与 Release workflow `29974689750` 均成功；正式单一 zip 为 `17,065,370` bytes，SHA-256 `4667cfd57ede39676b89d87cd9055313bfe52290b134d461b5fa70396f10e29d`，41 文件解包树与本地正式构建逐字节一致。
- 现有已登录主 Chrome Profile 的辅助窗口已原位重载到 V1.5.1；7 个分项、收藏墙、回收站 15、账户入口、书签栏与标签组入口均完整。Drive 现场出现一次超时安全降级，明确保留本机数据；未点击重试或触发写入。
- 实施与验收证据见 `docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`。

## 2026-07-22 V1.5.0 标签组与 favicon 自愈入口

- 顶部分项右侧新增全局标签组架；标签组是 URL 固定快照，不移动、删除或绑定原收藏。经典模式拖拽卡片手柄复制加入，导图模式在管理面板搜索加入。
- 标签组最多 50 个去重 URL；超过 10 个打开前确认。默认全部后台打开，可改为首个激活。网页端与扩展端共用契约，扩展不申请 `tabs` 或 `tabGroups`。
- 标签组按记录保存 `syncRevision + syncDeviceId` 与软 tombstone，通过既有 Google Drive 工作区同步；旧 Drive payload 未携带标签组字段时必须保留本地数据。
- 完整 JSON 升级为 Portable Backup V2，包含标签组与打开方式；V1 备份继续可验证和恢复，并保留当前标签组。
- favicon 始终先显示字母兜底，扩展优先使用 Chrome `_favicon`，再使用持久化元数据和站点候选。派生图标缓存只在 `WebCollectIcons/site_icons`，限制 8 MiB / 单项 256 KiB，不进入业务 IndexedDB、Drive、完整备份、dirty sets 或 seed。
- 扩展唯一新增权限为 `favicon`。不新增大型依赖，不改变 Google Drive OAuth scope，不接 AI API，不修改 Supabase 保险档案。
- 应用提交 `fd3f9732ac448e46998a9660044b7175aa2c4fd1` 与拖拽修复 `2ad9375db057c9b5567ceaebce543f226b9eeef4` 已进入 `main`；main CI `29936934533` 和 Release workflow `29937491867` 均成功。
- 正式 Release 只有一个 `17,065,370` bytes 的 zip，SHA-256 `2b499aeaa0c6ec14d5454335deb69b6a0ae3561f0e5c750c3d5ec32a42e76749`；官方解包树与 `extension/dist` 逐字节一致。
- 现有已登录主 Chrome Profile 的辅助窗口已原位重载到 V1.5.0；版本、权限、原有 7 个分项、收藏墙、回收站计数 15、“+ 标签组”和 favicon 字母即时兜底均通过只读验收，未执行业务写入。
- 实施与验收证据见 `docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`。

## 2026-07-21 V1.4.1 浮窗快捷键修复入口

- 浮窗 Shadow DOM 内的 `keydown`、`keypress`、`keyup` 不再传播到宿主网页，因此输入 `s` / `S` 不会触发 GitHub 搜索。
- 不调用 `preventDefault()`；中英文、IME、Tab、复制粘贴和其他输入默认行为保持正常，浮窗外网页快捷键不受影响。
- 不新增存储 key、权限或依赖，不修改收藏、分类、分项、偏好、回收站、快照、Drive、旧 Supabase、Chrome storage 或 seed。
- 专项真实扩展测试已覆盖宿主页面捕获/冒泡监听、大小写、IME、多个输入框、复制粘贴、Tab、浮窗外快捷键与控制台零错误。
- 应用提交 `8af01d34bc5d095d7961e658558e8fa7c5c16ff0`；main CI `29842309751` 与 Release workflow `29842892835` 均成功。官方 zip 为单一资产，`17,056,539` bytes，SHA-256 `abccc041f9e32c87535a6d38fa8072edb011477af6eea3da8442eda87a59e084`。
- 现有主 Chrome Profile 原位重载到 V1.4.1 后，在用户报告的 GitHub 页面实测浮窗内输入不再触发页面搜索；取消浮窗后页面 `s` 快捷键仍正常，未保存收藏、未操作无关标签。
- 实施与发布证据：`docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`。

## 2026-07-21 V1.4.0 Google Drive 迁移正式发布入口

- 当前正式发布身份：`V1.4.0 / 2026年7月21日`；tag `webcollect-2026-07-21-v1.4.0`；资产 `WebCollect-Chrome-Extension-v1.4.0-2026-07-21.zip`。
- 实施、迁移与发布证据：`docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`。
- 所有业务写入仍先落 IndexedDB。Google Drive 只在用户主动连接后启用，并只申请 `drive.appdata`，每位用户使用自己的隐藏应用目录；无 Google 账号、拒绝授权或离线时继续完整使用本地版。
- 正式运行时不再调用 Supabase；旧 Supabase 项目、数据、会话 key、SQL 和迁移档案原样保留 30 天，未经再次明确授权不得暂停或删除。
- 完整 JSON 支持导出、SHA-256/结构/数量校验、预览、导入前安全版本和确认恢复；不包含访问令牌、设备身份 key、dirty sets、临时状态或派生知识缓存。
- Rocky 的真实迁移按执行时数据完成：7 个分项、135 个分类/分组、372 个网页、15 个回收站条目和 69 个云端版本均已上传并逐文件回读；迁移后手动同步、新标签页重启和完整 JSON 再备份通过。
- 完整门禁已通过 395 Vitest、31 legacy、44 Playwright、Web/扩展生产构建、17.2 MiB 大小、无 Supabase 正式运行时扫描和 200 个生产依赖零漏洞审计；main CI、Release workflow、官方 zip 与真实主 Chrome 只读验收均完成。

## 2026-07-19 V1.3.1 顶栏 UI 统一入口

- 实施收口：`docs/audit/webcollect-v1.3.1-header-ui-closeout-2026-07-19.md`。
- Google / 百度 / Bing 默认使用中性灰；保存、刷新、壁纸、分组、分类、回收站、仓库统一为 38px × 14px 圆角轻框，`+ 网页` 是唯一蓝色主操作。
- 同步成功、同步中和失败只给图标着色，容器保持中性；账户与经典/导图切换和同排控件对齐。
- 1181–1799px 保留独立工具栏行，390px 使用 36px 紧凑控件；Web 与扩展视觉参数保持一致。
- 不新增存储 key，不改变搜索、业务操作、IndexedDB、Supabase、Chrome storage、dirty sets、快照、同步、权限、扩展 ID 或 seed。
- 完整发布门禁：372 Vitest、31 legacy、44 Playwright、Web/扩展构建、17.4 MiB 扩展体积与 208 个生产依赖零漏洞审计通过；main CI、Release workflow、官方 zip 审计和真实主 Chrome 只读验收完成；seed SHA 保持不变。

## 2026-07-19 V1.3.0 本地智能搜索与个人知识库入口

- 实施收口：`docs/audit/webcollect-v1.3.0-smart-search-closeout-2026-07-18.md`。
- 现有 Google / 百度 / Bing 普通搜索不变；输入时完全在浏览器本地检索，不调用 OpenAI、DeepSeek 或其他 AI API，也不捆绑或下载本地语言模型。
- 本地检索覆盖网页、分类、分组和分项，支持中文二元词组、拼音全拼/首字母、英文前缀/编辑距离、意图别名、BM25 加权、路径权重、完整匹配置顶、键盘/IME/读屏和经典/导图定位。
- 本地派生知识缓存只在 `WebCollectSearch/knowledge_index`；不写入业务 IndexedDB、Chrome storage、快照、dirty sets 或同步。
- 公开网页正文建库仅在用户主动确认后执行，最多保存 6000 字符派生文本；不带 Cookie、不读取登录态或私网内容，失败时回退已有标题/简介。
- 历史 Supabase 向量迁移与 Edge Function 仅作审计档案保留，不在 V1.3.0 搜索运行路径中；不得把它们重新接回 UI，也不得为了清理而破坏性删除外部表或迁移历史。
- 当前验证：348 Vitest、31 legacy、44 Playwright、Web/扩展生产构建、17.4 MiB 体积门禁和 208 个生产依赖零漏洞审计通过；扩展产物不含 AI 端点、模型名或云端语义函数名。

## 2026-07-17 V1.2.2 顶栏响应式修复入口

- 实施收口：`docs/audit/webcollect-v1.2.2-header-layout-closeout-2026-07-17.md`。
- Google 登录按钮及账户容器不可压缩、文字强制单行；1181–1799px 桌面宽度把工具栏放入独立第二行，1800px 起保留原单行桌面布局。
- 自动化以真实同步状态胶囊尺寸覆盖 1366、1536、1728、1800、2048px，确保搜索区、搜索引擎选择器、同步状态和登录入口不重叠；390px 继续无文档横向溢出。
- V1.2.2 不新增存储 key，不改变收藏、分类、分项、偏好、回收站、快照、同步协议、Chrome 扩展 ID、权限或 Supabase Schema。

## 2026-07-17 V1.2.1 导图打磨与验收入口

- 独立审查：`docs/audit/claude-fable-mindmap-review-2026-07-17.md`；审查确认 V1.2.0 无阻断性或数据安全故障，并提出 P2-1、P3-1、P3-2、P3-3 与焦点闭环打磨项。
- 实施收口：`docs/audit/webcollect-v1.2.1-mindmap-polish-closeout-2026-07-17.md`。
- 新增当前分项×当前布局的“重置布局”，只清该布局 offsets，并用零偏移布局重新计算 bounds 与相机；其他布局、折叠和分项状态不变。
- 卡片 favicon 与悬停预览始终先显示字母兜底；双侧脑图的分支侧向从顶级分类传播到真实后代；后代计数改为一次性索引；添加对话框关闭后焦点回到原“+”按钮。
- 模式记忆只使用 localStorage `webcollect_collection_view_mode`，合法值仅为 `classic | mindmap`。它不属于 IndexedDB、Chrome storage、快照、dirty sets、Supabase 或同步偏好；损坏值不删除，只在内存回退经典。
- V1.2.1 不改变收藏、分类、分项、偏好、回收站、快照、同步协议、Chrome 扩展 ID 或 Supabase Schema。

## 2026-07-16 V1.2.0 导图模式设计与验收入口

- **2026-07-17 Fable 独立验收结论：通过**。见 `docs/audit/claude-fable-mindmap-review-2026-07-17.md`（150 单测 + 31 项独立真实浏览器断言全绿；数据隔离逐字节验证；待办打磨项已在 V1.2.1 实施）。
- 实施规范：`docs/design/mindmap-mode/claude-fable-mindmap-ui-spec-2026-07-15.md`。
- 可交互大样：`docs/design/mindmap-mode/mindmap-mockup.html`；桌面像素基准见 `docs/design/mockups/2026-07-15-mindmap-*.png`。
- M0→M7 实施与本地/真实 Chrome 验收证据见 `docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`。
- 导图是现有 Zustand 收藏树的另一种视图，不复制业务数据，不进入 dirty sets、快照或云同步，也不得修改 `db.ts`、`sync.ts`、seed、Chrome storage 或 Supabase Schema。

## 2026-07-15 项目工作流退役

- 当前生效规则见 `AGENTS.md`。本仓库不再调用、安装、启用或模仿 Superpowers、`goal-zzx` / `zzx-goal`、`andrej-karpathy-coding`。
- 计划、原生 goal、测试、Review、子代理和 worktree 均按任务复杂度与风险自适应选择，不设置通用强制仪式。
- `tasks/todo.md`、`tasks/lessons.md`、`CODEX_GO_MODE_STATUS.md` 和 `docs/superpowers/` 是历史档案，不再作为当前指令、必读文件或重复进度账本。

## 2026-07-16 V1.1.2 正式发布收口

- 本轮不改用户 seed、收藏名称或分类内容；远程备份分支、私有 Supabase 归档和本地安全快照均已确认。
- 修复干净 Web 环境缺少私有 env 时 Google 登录不可用的问题，Web 与扩展改用同一个 RLS 保护的公开 anon 配置。
- 修复新 Profile 在读取云端前把 `cat-inbox` 随机 UUID 化、从而重复上传空收集箱的问题；只对明确 bootstrap ID 和同分项映射做无歧义复用。
- 修复 OAuth 回调残留 `?code=`、自定义 Next 服务器漏接 HMR WebSocket，以及浮窗队列并发 drain 重复创建目标的问题。
- 修复同一页面重复创建 Supabase `GoTrueClient` 的认证竞态；正常登出/登录保留 Supabase 官方的浏览器前后台刷新管理。
- Release 发布不再依赖本机 `gh` 登录或读取 Git 凭据；本地脚本只做前置检查、构建、打包和推 tag，GitHub Actions 是唯一 Release 发布器，并在云端复跑扩展构建、产物和体积检查。
- npm 旧 Audit API 在 2026-07-16 返回 410 后，CI 与 Release 改为共用 `scripts/audit-production.mjs`，直接向 npm 官方 Bulk Advisory API 提交已安装生产依赖的精确版本并对 High/Critical 失败闭合；正式版实测 207 个包、各等级 0 条已知漏洞。
- RC7 已发布为 GitHub Prerelease 并复核：Release `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-15-v1.1.2-rc.7`；zip 直链 `https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-15-v1.1.2-rc.7/WebCollect-Chrome-Extension-v1.1.2-rc.7-2026-07-15.zip`；`16,942,028` bytes；SHA-256 `747dcdcf62134f42352d281521460116fd89b3d87ba8509f1a2f5ddfc3e8da9d`。
- RC7 的 GitHub 下载件已复核并解压到 `/Users/rockyx/Downloads/WebCollect-v1.1.2-rc.7/unpacked`，清单为 WebCollect `1.1.2` / Manifest V3。用户确认加载后，为保留稳定扩展 ID 和 IndexedDB，RC7 文件树被精确同步到 Chrome 原有的 `~/Downloads/WebCollect-v1.1.2-rc.6/unpacked` 加载路径并原位重新加载；`diff -qr` 确认两目录完全一致。Chrome 详情页仍显示旧文件夹名，但运行内容是 RC7，ID 仍为 `immpcmhmabobllnopedaoflcjneigbko`。
- 收藏墙顶部“壁纸”入口现拆成一个融合式快捷控件：左侧进入当前壁纸页，右侧 `开/关` switch 只控制下次新标签页先显示壁纸还是直接进入主页；与壁纸设置弹窗共用同一 `defaultMode` 偏好。RC7 进一步把启动模式同步镜像到 localStorage，并在 React 首次挂载前读取；关闭时不创建壁纸图片、不预加载壁纸、也不允许壁纸 stage 短暂挂载。
- 小松鼠浮窗收起时现在只露约半张脸并朝网页轻微侧头，鼠标悬停、键盘聚焦、拖动或打开面板时完整展开；隔离 Chromium 实测右侧可见 `50.07%`、左侧 `50.00%`，悬停后完整显示且点击可打开面板，控制台零错误。
- 2026-07-14 主 Chrome 中的旧扩展再次上传了一个同分项空收集箱，使云端分类从 129 增至 130；V1.1.2 现按“同分项卡片数优先、创建时间与 ID 稳定排序”选择 canonical 收集箱，阻止数据库返回顺序把新收藏落到空重复项。现有两条空记录均保留，不自动删除。
- 当前验证：138 条 Vitest、31 组历史脚本、14 条 Playwright、TypeScript、ESLint、Web/扩展生产构建、扩展产物/大小、隔离 MV3 runtime 和 GitHub CI 已通过；生产依赖审计通过 npm Bulk Advisory API 确认 207 个包无已知漏洞。
- Profile A 的真实 Google 登录、退出、重登和云同步已通过。RC7 已在主账号 Chrome profile 的副屏辅助窗口中原位重新加载；`X rocky`、`云端已同步`、原有分类与卡片均保留。启动壁纸开关关闭时连续 4 个真实 `chrome://newtab` 都直接显示主页/收藏卡片，页面状态中无壁纸舞台或壁纸文案；该结果与零挂载 MutationObserver E2E 相互印证。独立 Profile B 仅保留为历史尝试，用户已明确取消该发布门槛。
- 后续真实扩展/OAuth 验收使用用户现有、已登录的主 Chrome profile，不再为了模拟第二会话另建本机 Chrome 账号或 Profile。双屏时继续把同一 profile 的专用辅助窗口放在副屏，避免触碰主屏个人标签。
- 最近核对的云端为 `364 cards / 130 categories / 24 preferences / 60 snapshots / 0 tombstones / 1 workspace version`；130 个分类中包含两条本轮修复前由旧客户端产生的空收集箱，其中一条仍有分项偏好引用。未经用户明确批准不删除，也不把它们计作数据丢失。

## 2026-07-12 V1.1.1 全项目审计结论

- 最新且优先读取：`docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`；数据库与全项目细节继续见 `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`。
- PM 已迁往独立 Supabase `erzblrpfqjjwmlkxkkkb`；原项目 `qxlkigwadvgkoeqdojxx` 只保留 WebCollect。
- 找到并清理了旧 PM 角色 `alphalens_app` 对 WebCollect 的残留授权；角色已禁用登录。
- WebCollect 同步 revision/tombstone/workspace-version SQL 已在备份后执行；原五表数据计数保持 `1 / 128 / 364 / 22 / 57`。
- 本轮修复旧 Coze 子进程取配置、service-role 静默回退、短屏壁纸设置裁切，并扩大搜索、分项、壁纸、扩展目标队列的真实浏览器验收。
- V1.1.1 追加修复 GitHub 冷启动下 E2E 过早按键、缺失 tag 的误导性 fatal 日志，以及 tag 工作流重复上传第二个 zip。
- 当前自动验证：117 条 Vitest、31 条历史脚本、12 条 Playwright、TypeScript、ESLint、Web/扩展构建和隔离扩展运行时通过。
- 历史文档中“Supabase 迁移待执行”“PM 仍与 WebCollect 共库”等说法已过期，以本节和 V1.1.1 closeout 为准。

## 2026-07-07 Fable 整改执行状态

- 已导入并按步执行 Fable 方案：`docs/audit/claude-fable-remediation-plan-2026-07-07.md`。
- 执行日志：`docs/audit/remediation-execution-log-2026-07-07.md`。
- 已完成 Phase 1 同步正确性、Phase 2 启动/性能减负、Phase 3 壁纸远程/同步/状态可见。
- Phase 4.0 已准备 `docs/design/mockups/`；用户已确认此前 Image2 要求属于误提，UI 还原度任务（Phase 4.1、4.2、4.5）本轮暂缓，不再阻塞合并/发版。
- Phase 4.3 已清除 `src` 与 `extension/src` 的系统 `prompt/confirm/alert` 残留。
- Phase 4.4 已按 Fable 方案拆分原 `sortable-grid.tsx`：DnD shell、分类块、分组块、未分类块、卡片块和布局数学已分离，并新增 `scripts/test-grid-layout.ts` 防回归；已补 Playwright 浏览器验收，覆盖编辑模式、误删防护、resize 收缩/恢复和分组拖拽排序。
- Phase 5.1 已新增 GitHub Actions CI。
- Fable 第二轮 R1 已完成：启动新鲜度 marker、Wikimedia 缩略图降级、wallpaperPrefs 稳定设置同步瘦身。
- 2026-07-08 补充：R1.2 真实 Chrome headless 验收发现 Wikimedia `2560px-*` 仍返回 400，已把展示缩略图钳制到 Wikimedia 可用的 `1920px-*` 标准尺寸；5 张远程样本浏览器加载均为 HTTP 200。
- 2026-07-08 补充：搜索框新增搜索引擎选择（默认 Google，可选百度/Bing），Enter 和外部搜索结果会按当前选择打开；壁纸设置新增“启动壁纸模式”开关，关闭后下次打开新页面直接进入主页。
- 本节最后一条旧 gate 已于 2026-07-12 解除：Supabase SQL 已在新备份后执行；发布身份升级为 `V1.1.0`。真实账号双设备仍作为观察项，不再冒充代码或迁移未完成。

## 先读这个

这个文件是 WebCollect 的“全身体检交接入口”。后续 agent 不需要让用户重新复述需求，先读：

0. `docs/audit/webcollect-v1.5.3-adaptive-viewport-closeout-2026-07-23.md`（**当前候选代码最新**：动态视口适配与候选验证）
0.1 `docs/audit/webcollect-v1.5.2-github-capture-metadata-closeout-2026-07-23.md`（当前稳定回退发布：GitHub 收藏信息修复与发布证据）
0.2 `docs/audit/webcollect-v1.5.1-next-security-closeout-2026-07-23.md`（Next.js 安全补丁与完整发布证据）
0.3 `docs/audit/webcollect-v1.5.0-tab-packs-favicon-closeout-2026-07-22.md`（标签组、favicon 与完整发布证据）
0.4 `docs/audit/webcollect-v1.4.1-floating-capture-keyboard-closeout-2026-07-21.md`（浮窗快捷键修复与完整发布证据）
0.5 `docs/audit/webcollect-v1.4.0-google-drive-migration-closeout-2026-07-21.md`（Google Drive、完整 JSON、真实迁移与发布证据）
0.6 `docs/audit/webcollect-v1.3.1-header-ui-closeout-2026-07-19.md`（顶栏统一、数据边界与完整发布证据）
0.7 `docs/audit/webcollect-v1.3.0-smart-search-closeout-2026-07-18.md`（本地智能搜索、知识库与数据边界）
0.8 `docs/audit/webcollect-v1.2.2-header-layout-closeout-2026-07-17.md`（顶栏响应式修复与正式发布证据）
0.9 `docs/audit/webcollect-v1.2.1-mindmap-polish-closeout-2026-07-17.md`（Fable 审查打磨与模式记忆）
0.10 `docs/audit/webcollect-v1.2.0-mindmap-closeout-2026-07-16.md`（M0→M7 导图实现与发布）
0.11 `docs/audit/webcollect-v1.1.2-account-sync-closeout-2026-07-13.md`（真实 OAuth、并发收集、RC7 主 Chrome 验收及 Profile B 门槛豁免）
0.12 `docs/audit/webcollect-v1.1.1-ci-closeout-2026-07-12.md`（CI 冷启动与单一 Release 发布链路收口）
0.13 `docs/audit/webcollect-v1.1.0-closeout-2026-07-12.md`（PM 分库核验、WebCollect 云端迁移、备份校验和全项目审计）
0.14 `docs/audit/gpt56-full-audit-execution-2026-07-10.md`（V1.1 测试先行执行日志与历史红绿证据）
0.15 `docs/audit/claude-fable-followup-plan-2026-07-07.md`（Fable 第二轮审查结论 + R1-R4 历史方案）
0.16 `docs/audit/claude-fable-code-review-2026-07-07.md`（Claude Fable 5 第一轮全量代码审查结论）
0.17 `docs/audit/claude-fable-remediation-plan-2026-07-07.md`（第一轮整改执行方案）
0.18 `docs/audit/remediation-execution-log-2026-07-07.md`（第一轮 Codex 执行日志）
1. `AGD.md`
2. `docs/audit/claude-code-review-handoff-2026-07-07.md`
3. `docs/audit/webcollect-full-audit-brief-2026-07-07.md`
4. `docs/audit/user-screenshot-index-2026-07-07.md`
5. `PROJECT_SUMMARY.md`
6. `HANDOFF.md`
7. `AGENTS.md`

如果这些文件和旧文档冲突，以 `AGD.md`、当前 V1.5.3 closeout、V1.5.2 回退版本 closeout、V1.5.0 功能 closeout 和作为数据基线的 V1.4.0 closeout 为准；旧文档中的独立 Profile B 发布门槛已经退役。

## 产品一句话

WebCollect 是个人网页收藏工作台：用户可以用 Web 页面和 Chrome 扩展，把网页按“分项 / 分类 / 分组 / 网页”整理成可视化收藏墙，并支持浮窗收集、拖拽排序、搜索、云同步、版本回滚和扩展发布。

## 最高优先级

- 绝不清空、覆盖、重置用户 IndexedDB / Supabase / Chrome 扩展本地数据。
- 不要用默认 `seed.ts` 覆盖用户真实数据；默认数据只能作为首次空数据示例。
- 普通 Web 验收优先用 in-app Browser；需要真实登录态、Chrome 扩展或新标签页时，使用用户现有的主 Chrome profile，不另建测试账号/Profile。双屏时使用同一 profile 的副屏辅助窗口或 `Codex Workbench`，禁止触碰无关个人标签。
- 每次涉及 Chrome 扩展可测试版本，都要构建、打包、发布 GitHub Release，并给出 zip 直链。
- 每次推送功能版本都要更新版本号和日期；`V1.1.1` 之后的小修从 `V1.1.2` 起。
- 小松鼠头是 WebCollect 统一品牌图标，Chrome 顶栏、右键菜单、默认图标、浮窗 UI 都应优先使用它。

## 已完成的重要需求

### 1. 固定工作区和交接

- 新固定目录：`/Users/rockyx/vibe coding/Web Collect 0628`。
- 旧目录只作历史参考，不再开发：`/Users/rockyx/Documents/webcollect`、`/Users/rockyx/Documents/Codex/2026-06-14/webcollect-main-clean`。
- 已把 `PROJECT_SUMMARY.md`、`HANDOFF.md`、`NEXT_THREAD_PROMPT.md` 作为长期交接入口。

### 2. Chrome 扩展发布和版本展示

- 已有 Release：
  - `webcollect-2026-07-01-v1.0.2`
  - `webcollect-2026-07-02-v1.0.3`
  - `webcollect-2026-07-12-v1.1.0`
  - `webcollect-2026-07-12-v1.1.1`
- 当前 UI 显示版本和日期：`src/lib/app-version.ts`。
- 版本一致性测试：`scripts/test-extension-branding.ts`。
- 扩展构建命令：`corepack pnpm@9.0.0 build:ext`。
- V1.1.1 发布源只允许使用 `extension/manifest.json` 和当次新构建的 `extension/dist`；不得恢复旧的 `public/extension-dist` 副本。

### 3. 小松鼠品牌统一

- 目标：所有可控图标都换成小松鼠头像，不再用默认拼图图标。
- 作用面：Chrome 工具栏图标、右键菜单、扩展 manifest、浮窗组件、页面内品牌视觉。
- 验证脚本：`scripts/test-extension-branding.ts`。
- 注意：如果后续发现某处仍显示 Chrome 默认拼图图标，优先查 manifest icons、contextMenus icon 支持边界、构建输出 `extension/dist/icons/`。

### 4. 浮窗收集和目标落点

- 修复重点：浮窗选择的分项/分类/分组必须准确落库，不能静默掉到主页或“节流 / 收集箱”。
- 已实现目标保留：draft 保存目标 id/name/path，队列回放时严格解析。
- 显式目标找不到时应失败并保留错误，不得随意兜底到其他收集箱。
- 已错放历史卡片只做有证据修复；只能用队列中的 URL + draft.destination 证明后再搬。
- 相关脚本：
  - `scripts/test-floating-capture-targets.ts`
  - `scripts/test-floating-capture-drain.ts`
  - `scripts/test-floating-capture-health.ts`

### 5. 顶部分项编辑和排序

- 顶部分项行已支持编辑按钮。
- 进入编辑后：`主页` 固定不可拖，其他分项可横向拖拽排序。
- 分项改名改为原地编辑，不再用 `window.prompt`。
- 新增分项改为行内输入，不再用系统弹窗。
- 删除分项只允许在明确菜单入口触发，使用项目内 AlertDialog。
- 相关 store 动作：`reorderSections(orderedIds)`。

### 6. 分类轻量编辑

- 分类/分组普通编辑入口先进入轻量编辑状态。
- 轻量编辑用于：拖网页、改网页名、改简介、改分类/分组名称。
- 图标和主题色属于“高级设置”，需要额外点击高级入口才打开原来的大弹窗。
- 危险操作必须留在明确菜单项里，不得由普通点击触发。

### 7. 去弹窗化和误删防护

- 顶部分项新增/重命名不再用 Chrome 系统 prompt。
- 编辑模式下点击 AI / HODL / 其他 tab 不应弹删除确认。
- 删除确认只属于明确的删除按钮或菜单项。
- Hover 状态下非 active tab 文字必须保持可读，不能变白消失。

### 8. 描述翻译和元数据提取

- 已加浮窗简介翻译按钮，使用本地规则/免费底层逻辑，不依赖私有 API。
- 英文简介会被规则化成中文摘要。
- 已修复 docu.md 从 X/Twitter 打开时，简介被误识别成“X/Twitter 社交平台”的问题。
- `docu.md — AI writes it. docu.md does the rest.` 应提取为：
  - 名称：`Docu.md`
  - 简介：`AI 负责写作，Docu.md 完成其余工作。`
- 相关文件：
  - `src/lib/description-translation.ts`
  - `extension/src/content/floating-capture.ts`
  - `extension/background.js`
  - `src/app/api/fetch-meta/route.ts`
- 相关脚本：
  - `scripts/test-description-translation.ts`
  - `scripts/test-floating-capture-metadata.ts`

### 9. 蓝玻璃 UI、布局和拖拽

- 当前视觉方向：蓝白玻璃、轻量卡片、收藏墙工作台，而不是传统书签列表。
- 分类、分组、网页卡片多轮修过右侧留白、拖拽裁剪、固定列数和跨分辨率布局。
- 高风险文件：
  - `src/components/layout/sortable-grid/index.tsx`
  - `src/components/layout/sortable-grid/category-block.tsx`
  - `src/components/layout/sortable-grid/sub-group-block.tsx`
  - `src/components/layout/sortable-grid/ungrouped-block.tsx`
  - `src/components/layout/sortable-grid/sortable-card.tsx`
  - `src/components/layout/sortable-grid/layout-math.ts`
  - `src/app/globals.css`
  - `extension/src/extension.css`
- 每次 UI 改动都要做真实视觉检查，至少桌面宽屏和较窄桌面各一次。

### 10. 云同步、回滚和数据安全

- 本地 IndexedDB 优先，云同步在后台做。
- 启动不能等云同步才能显示页面。
- 云同步不能让默认首页覆盖用户真实云端布局。
- 多标签和多设备同步必须有 snapshot fence。
- 删除、清空、回滚、云推送前应有安全快照。

## 明确要求保持现状的部分

- 不要重做整体信息架构，除非用户明确要求。
- 不要启发式重分类历史错放网页；没有证据的只生成待整理清单。
- `主页` 分项固定第一位，不可拖动、不可删除。
- 当前小松鼠头像样子不要变；如果精修，只能提高清晰度，不能改形象。
- 不要重新引入大面积营销页、英雄区、说明型 UI；第一屏必须是可用工作台。
- 不要把系统 prompt/confirm 弹窗带回编辑流程。
- 不要让普通点击触发删除类危险行为。

## 当前不满意和待体检问题

- 真实 Chrome 主环境仍需长期验证：右键菜单图标、工具栏图标、小松鼠清晰度、浮窗注入稳定性。
- 元数据提取仍是规则驱动，需继续检测“文不对题”的简介，尤其是从 X/Twitter、重定向链接、社交卡片跳转来的网页。
- 翻译目前是本地规则/短语表，不是完整机器翻译；未来可考虑浏览器翻译 API 或后端代理。
- 云同步跨 Windows/Mac 的真实端到端仍需用户环境确认。
- 拖拽、resize、编辑状态曾反复互相影响；体检时要重点看事件边界。
- UI 还有可能存在按钮反馈弱、hover 状态不清楚、编辑入口层级不够直觉的问题。
- 旧文档很多，时间线长，后续应避免让过期文档重新成为事实来源。

## Claude 体检建议顺序

1. 先不改代码，读 `AGD.md` 和 audit brief。
2. 跑基础检查：`git status -sb`、`git log --oneline --decorate -8`、版本文件。
3. 检查数据安全路径：`src/lib/store.ts`、`src/lib/sync.ts`、`src/lib/db.ts`。
4. 检查扩展收集闭环：content script -> background queue -> store drain -> add card。
5. 检查元数据提取：网页 title/description/OG/visible text 的优先级和错配保护。
6. 检查顶部分项、分类、分组、网页编辑状态是否有误触危险。
7. 检查 Web CSS 与扩展 CSS 是否同步。
8. 做本地浏览器验证和扩展构建验证。
9. 最后输出执行方案，不要直接做大规模重构。

## 必跑验证命令

```bash
node --import tsx scripts/test-floating-capture-targets.ts
node --import tsx scripts/test-floating-capture-drain.ts
node --import tsx scripts/test-floating-capture-health.ts
node --import tsx scripts/test-floating-capture-metadata.ts
node --import tsx scripts/test-description-translation.ts
node --import tsx scripts/test-extension-branding.ts
corepack pnpm@9.0.0 ts-check
corepack pnpm@9.0.0 lint
corepack pnpm@9.0.0 build:ext
git diff --check
```

## 最近发布信息

- 最新稳定 Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-23-v1.5.2`
- 最新稳定 zip：`https://github.com/RockyXuan/webcollect/releases/download/webcollect-2026-07-23-v1.5.2/WebCollect-Chrome-Extension-v1.5.2-2026-07-23.zip`
- 最新稳定 SHA-256：`cc76c1c06bb707d3edceb974cc1d5a7d7b81b51d9dfee704bad2d7364c81a3e9`
- 历史 RC7 Release：`https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-07-15-v1.1.2-rc.7`
- 历史 RC7 SHA-256：`747dcdcf62134f42352d281521460116fd89b3d87ba8509f1a2f5ddfc3e8da9d`

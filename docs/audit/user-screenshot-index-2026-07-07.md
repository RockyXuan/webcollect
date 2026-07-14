# WebCollect 用户截图索引

更新时间：2026-07-14

说明：以下截图来自用户在对话中贴出的 UI 标注。2026-07-07 检查时，原始 `/var/folders/.../T/codex-clipboard-*.png` 临时文件已经过期，不再能复制进仓库。因此本文件保存截图名称、用户标注、对应需求和当前状态。后续新截图必须落到 `docs/audit/screenshots/`，不要只依赖对话临时文件。

## 截图清单

| 截图文件名 | 用户标注/画面 | 对应需求 | 当前状态 |
|---|---|---|---|
| `codex-clipboard-34f386d2-bf73-4147-8650-e2e411c3a395.png` | 交接说明，固定目录为 `/Users/rockyx/vibe coding/Web Collect 0628`，GitHub main clean | 固定主开发目录，避免旧目录污染 | 已记录到 `PROJECT_SUMMARY.md`、`HANDOFF.md`、`AGD.md` |
| `codex-clipboard-e27a74a9-75a6-43e3-85a7-b13d7950424d.png` | 新线程直接打开固定目录，首次运行可能需重新安装依赖 | 交接路径和依赖提示 | 已纳入交接规则 |
| `codex-clipboard-85334df7-ac96-4d83-92ad-bfdeac2991ac.png` | 浮窗收集表单的“简介”区域，希望加翻译按钮 | 简介翻译按钮，先用免费/底层翻译 | 已实现本地规则翻译和按钮，需继续评估翻译质量 |
| `codex-clipboard-d47732e0-90dd-480d-a7b7-45566e7e1389.png` | 账号/设置页，希望浅灰显示日期和版本号 | 版本号和日期展示 | 当前为 `V1.1.1 / 2026年7月12日`，后续小修从 `V1.1.2` 起 |
| `codex-clipboard-72ad0316-2aa0-4349-ae9b-437f14b5e3c2.png` | Chrome 右键菜单“收集到 WebCollect”显示默认拼图图标 | 右键菜单图标统一为小松鼠 | 已做资源统一，仍需真实 Chrome 菜单位置复验 |
| `codex-clipboard-c515590a-d23b-4634-835a-9b6f984cf0cd.png` | Chrome 顶栏扩展图标显示默认拼图 | 工具栏图标统一为小松鼠 | 已更新 manifest/icons，仍需安装包实测 |
| `codex-clipboard-4ffa005f-777e-4864-9a44-b64545c6cfb9.png` | 用户指定的小松鼠头像 | WebCollect 统一品牌图 | 作为品牌资产保留；不可改形象，只能提高清晰度 |
| `codex-clipboard-044a23ef-ecf4-485a-8ed5-394d1e8f54fb.png` | 顶部分项 `AI` hover 后文字变白看不见 | tab hover 可读性 bug | 已修 hover/active/editing 样式，仍需视觉巡检 |
| `codex-clipboard-f4790793-f528-4a3a-b8ef-5f283c8fbd50.png` | 修改分项名字出现 Chrome 系统 prompt | 去系统弹窗，原地编辑 | 已改为行内编辑 |
| `codex-clipboard-ffacdad8-3e8f-4ef7-bb76-73eb8b13a64a.png` | 点分类编辑直接弹“编辑分类”大框 | 分类轻量编辑优先，高级设置再弹框 | 已拆分轻量编辑和高级设置 |
| `codex-clipboard-f29b32e1-9a6d-40da-b675-70b24e290f40.png` | 编辑模式顶部固定栏有勾选/拖拽，顶部分项也要类似排序 | 顶部分项编辑、拖拽排序、主页固定 | 已实现；Playwright 覆盖快速新增与选择分项 |
| `codex-clipboard-0edbb090-f3a3-476e-9299-761088b19a8b.png` | 编辑模式随便点 AI/HODL 却弹删除 HODL 确认 | 误删防护，删除必须明确触发 | 已修；Browser 与 Playwright 证明普通点击无系统/项目删除弹窗 |
| `codex-clipboard-60aa9ec0-81a2-4344-a03b-49076b94c326.png` | 搜索 `taste` 后显示结果路径为 `主页 / 节流 / 收集箱` | 扩展收集目标落点错误 | 已修队列 target drain，历史无证据不自动搬 |
| `codex-clipboard-77459e7f-5a42-4652-907f-4cc60078122a.png` | 新增内容都落到主页“节流/收集箱”，分类错乱 | P0：扩展保存目标必须准确 | 已修；隔离 MV3 runtime 实际入队并落到 `Runtime Audit / Runtime Inbox` |
| `codex-clipboard-8ff07294-c0e0-4a3b-b2b8-32f4497c2108.png` | X/Twitter 博主发 `docu.md`，页面文案是“AI 负责写作，Docu.md 完成其余工作” | 元数据应提取目标网页，不应取 Twitter 简介 | 已由共享结构化提取器修复；24 组样本覆盖 X 外链、GitHub、文档站、文章、产品和异常页 |
| `codex-clipboard-ce29b5f2-b06c-4a0e-ae0b-800135e90a0d.png` | 浮窗表单名称/简介识别错误，简介变成 X/Twitter 社交平台 | 名称为 `Docu.md`，简介为目标页 slogan | 已修；Web API、扩展源码与最终 service worker 使用同一提取器 |
| `webcollect-v1.1-extension-runtime-2026-07-12.png` | 隔离 Chromium 加载 `extension/dist` 后进入网页墙 | Manifest V3 服务工作线程、扩展新标签页、基础检查与元数据消息运行时验收 | 运行通过；控制台零错误，1440px 无横向溢出 |
| `webcollect-v1.1-wallpaper-before-ui-fix-2026-07-12.png` | 扩展默认壁纸页的引言、译文、来源和操作提示集中在底部 | UI-02 壁纸文字层级和间距修复前证据 | 已复现并修复 |
| `webcollect-v1.1-wallpaper-after-ui-fix-1440x900-2026-07-12.png` | 隔离 Chromium 扩展壁纸页，操作提示位于顶部安全区，引用与控制条分离 | UI-02 桌面修复后证据 | 通过几何断言和肉眼复核 |
| `webcollect-v1.1-wallpaper-after-ui-fix-390x844-2026-07-12.png` | 隔离 Chromium 扩展壁纸页手机视口，提示换行且无横向溢出 | UI-02 移动端修复后证据 | 通过几何断言和肉眼复核 |
| `webcollect-v1.1-extension-runtime-after-phase4-2026-07-12.png` | 压缩壁纸与渐进推荐接入后的扩展网页墙 | Phase 4 扩展运行时回归 | 服务工作线程正常，控制台零错误，1440px 无溢出 |
| `webcollect-v1.1-wallpaper-settings-short-screen-1280x720-2026-07-12.png` | 1280x720 短屏壁纸设置，内容区滚动且底部操作栏固定 | UI-03 设置弹窗顶部/底部被裁切 | 已修；完成按钮位于视口内，关闭壁纸后刷新直达主页 |
| `webcollect-v1.1.2-extension-wallpaper-1440x900-2026-07-13.png` | V1.1.2 最终候选扩展的 1440x900 壁纸页 | 桌面壁纸文字层、提示、控制条和横向溢出回归 | 几何断言通过，零控制台错误 |
| `webcollect-v1.1.2-extension-wallpaper-390x844-2026-07-13.png` | V1.1.2 最终候选扩展的 390x844 壁纸页 | 移动视口引用、提示与控制条回归 | 几何断言通过，无横向溢出 |
| `webcollect-v1.1.2-extension-collection-1440x900-2026-07-13.png` | V1.1.2 隔离 MV3 收藏墙，浮窗队列落到 `Runtime Audit / Runtime Inbox` | 服务工作线程、目标分类、并发唯一性与收藏墙渲染 | 单分项、单分组、单卡片，零控制台错误 |
| `webcollect-main-chrome-old-extension-signed-in-2026-07-14.png` | 用户主 Chrome 中旧版扩展已登录并显示完整收藏墙、云端同步中 | 证明主 Chrome 具备真实账号状态，但安装版本尚待 RC 替换后核对 | 用户已明确授权在 `Codex Workbench` 中替换扩展；截图同时对应旧客户端新增空收集箱的云端时间窗 |
| `user-wallpaper-toolbar-toggle-request-2026-07-14.png` | 用户标出收藏墙顶部“壁纸”按钮，希望就近增加启动模式开关 | 顶部快速开启/关闭新标签页壁纸入口 | 已实现融合式 `壁纸 | 开/关` 控件；左侧进入壁纸，右侧只改下次启动模式 |
| `user-wallpaper-settings-toggle-reference-2026-07-14.png` | 壁纸设置弹窗已有“启动壁纸模式”复选项 | 顶部快捷开关必须与现有设置共用同一状态 | 已共用 `WallpaperPrefs.defaultMode`，两处状态实时一致 |
| `webcollect-v1.1.2-rc3-wallpaper-toggle-2048x1152-2026-07-14.png` | RC3 宽屏收藏墙顶部完整显示“壁纸”和开关 | 宽屏视觉、标签、工具栏溢出验收 | 控件宽 `134px`、整页无横向溢出，肉眼复核通过 |
| `webcollect-v1.1.2-rc3-wallpaper-toggle-390x844-2026-07-14.png` | RC3 手机视口收起“壁纸”文字，保留图标和开关 | 移动端紧凑布局与可恢复横向滚动 | 整页无横向溢出；工具栏可横向滚动，开关尺寸稳定 |

## 后续截图管理规则

- 新截图复制到：`docs/audit/screenshots/`。
- 文件名建议：`YYYY-MM-DD-topic-short-name.png`。
- 每张截图都要在本文件补一行：截图、用户问题、对应需求、当前状态。
- 不要把临时路径当作长期证据。

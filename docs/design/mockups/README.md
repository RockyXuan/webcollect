# WebCollect 设计样板图放置说明

本目录用于放置用户重新导出的 Image2 / 目标 UI 样板图，供 Phase 4 UI 还原度工作使用。

## 命名规则

请按下面格式放置 PNG：

```text
YYYY-MM-DD-screen-name.png
```

示例：

```text
2026-07-07-home-collection-wall.png
2026-07-07-add-card-dialog.png
2026-07-07-account-panel.png
2026-07-07-wallpaper-settings.png
```

## 当前状态

- 目前仓库里还没有可作为客观基准的 Image2 样板图。
- 在样板图补齐前，不能准确执行 Fable Phase 4.1、4.2、4.5 中的 design token 抽取、双端截图对比和 >5% 偏差清单。
- 不依赖样板图的工程项，如系统弹窗清理、CI 护栏，可以继续推进。

## 使用方式

后续 agent 需要先读取本目录图片，再更新：

- `src/app/tokens.css`
- `src/styles/shared.css`
- Web 与 Chrome 扩展截图对照记录
- `docs/audit/screenshots/`

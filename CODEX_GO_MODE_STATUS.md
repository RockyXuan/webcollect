# Codex Go Mode Status

## Final Goal

修复 WebCollect 锁定交互、分类留白和壁纸 quote 语义匹配；完成证据包括相关脚本测试、类型检查、lint、扩展构建、真实浏览器双视口/壁纸验证、提交推送和扩展发布。

## Completed

- 锁定交互不再使用强制 `window.alert`，改为鼠标附近的轻量提示气泡，自动消失。
- 分类锁定按钮改成清晰的锁住/解锁两态图标，提高尺寸和对比度，并保留 tooltip/aria 状态。
- 子分组历史百分比宽度不再作为 flex 换行依据，只用于推导稳定列数；实际宽度按卡片列数、固定卡片宽度、gap 和 padding 计算。
- 父分类宽度按内部实际分组行宽贴合，右侧只保留少量呼吸空间，避免历史 `widthPercent` 撑出大空白。
- 壁纸默认 quote 不再展示 WebCollect 自造来源；山、岩石、峡谷、峭壁等图优先匹配山川/行路/高处/坚韧相关双语 quote。
- 壁纸展示层会在普通模式中规避旧缓存里的自造 quote，必要时按当前壁纸重新挑选真实来源 quote。

## Unfinished

- 无已知未完成核心项。
- 用户仍需安装最新扩展包，在自己的主 Chrome/跨设备真实数据里做最终肉眼确认。

## Current Blockers

- 无代码实现阻塞。

## Next Step

- 用户安装 Release `webcollect-2026-06-25-lock-layout-wallpaper` 的扩展包后，重点检查锁定提示、分类留白和壁纸 quote 是否符合预期。

## Latest Verification

- 2026-06-25 CST `node --import tsx scripts/test-layout-sizing.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-layout-preferences.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-resolution-layout.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-wallpaper-quotes.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-wallpaper-data.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-wallpaper-policy.ts` passed.
- 2026-06-25 CST `node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- 2026-06-25 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-25 CST `./node_modules/.bin/eslint` passed with 0 errors and 6 existing warnings.
- 2026-06-25 CST `node ./extension/build.mjs` passed.
- 2026-06-25 CST `git diff --check` passed.
- 2026-06-25 CST dedicated headless Chrome at `http://localhost:5010/` verified: `download` kept `YT TT INS X` at 2 columns and `其他` at 1 column in both 2048x1200 and 1440x1000 viewports; right blank was about 35px and 24px respectively.
- 2026-06-25 CST dedicated headless Chrome verified locked resize path: `alertCount = 0`, hint text shown as `布局已锁定，若需移动或调整，请先点击右上角解锁。`
- 2026-06-25 CST dedicated headless Chrome verified wallpaper quote: no `WebCollect original/原创` source and no water/tide quote on the checked mountain/nature wallpaper.
- 2026-06-25 CST prepared fix commit and release tag `webcollect-2026-06-25-lock-layout-wallpaper`.
- Browser evidence screenshots:
  - `/private/tmp/webcollect-layout-large-final.png`
  - `/private/tmp/webcollect-layout-small-final.png`
  - `/private/tmp/webcollect-lock-hint-final.png`
  - `/private/tmp/webcollect-wallpaper-quote-final.png`

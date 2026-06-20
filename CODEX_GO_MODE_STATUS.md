# Codex Go Mode Status

## Final Goal

修复 WebCollect 壁纸质量与刷新缓存问题：刷新按钮、滚轮和后台刷新必须能跳出旧本地小池，优先使用合格高质量图库；Auto Mix 不再反复显示 NASA、卫星、科研或旧重复图；通过专项测试、类型检查、扩展构建和浏览器新标签页验证证明可用。

## Completed

- 找到本轮根因：手动刷新在远程 provider 返回空或失败时不会可靠切换当前图，旧缓存仍写入 `webcollect-wallpapers-v1`，新标签页首屏还预载 NASA 图，本地 Auto Mix 打包图数量偏少。
- `refreshOnlineWallpapers({ force/selectFresh })` 现在会先乐观切到当前主题的本地合格图，并立即保存 prefs；远程返回合格新图时再替换，否则保留本地切换结果。
- 壁纸缓存升级为 `webcollect-wallpapers-v2`，刷新时删除 `webcollect-wallpapers-v1`，图片缓存请求改为 `cache: "reload"`，避免继续吃旧缓存。
- 默认首屏从 Auto Mix 的本地非科研图里选，不再用 `FALLBACK_WALLPAPERS[0]`；扩展 `newtab.html` 也不再预载 NASA Cosmic Cliffs。
- 新增 6 张 CC0/public-domain 4K 本地壁纸，Auto Mix 打包非科研图达到 10 张，离线/远程失败时也有足够可切换池。
- `pruneWallpaperLibrary` 优先保留打包本地图，防止远程图库或旧数据把本地兜底池挤掉。
- 保留并验证滚轮换壁纸功能，同时移除 passive wheel listener 下的 `preventDefault` 控制台错误。
- 更新壁纸数据、策略和 wiring 测试，锁定：默认非科研、旧缓存删除、首屏不 NASA、手动刷新先切本地图、远程无图时不退回旧图。
- GitHub CLI/Release 脚本改为只在代理端口可用时使用代理；代理未监听时自动直连，减少反复授权/代理卡住的问题。

## Unfinished

- 当前壁纸质量与刷新缓存修复目标已完成，并已发布新的 Chrome 扩展 zip。
- Pexels/Pixabay/TMDb 等需要 API key 或后端代理的 provider 仍保持关闭；这是后续增强，不属于本轮阻塞项。

## Current Blockers

- 无需要用户决策的代码阻塞。
- 外部图库 provider 需要后续明确 API key/后端代理方案，当前目标先用本地高质量池和合规 Wikimedia/curated provider 解决质量与刷新问题。

## Next Step

- 用户下载并重新加载 `webcollect-2026-06-21-wallpaper-refresh-cache` 扩展包，重点验证刷新按钮是否立刻换图、滚轮是否换图、是否不再总是旧壁纸/NASA/科研图。
- 若后续要继续扩充 Cinema/Art 外部图库，再单独接入安全后端代理 provider。

## Latest Verification

- 2026-06-21 CST `node --import tsx scripts/test-wallpaper-data.ts` passed.
- 2026-06-21 CST `node --import tsx scripts/test-wallpaper-policy.ts` passed.
- 2026-06-21 CST `node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- 2026-06-21 CST `./node_modules/.bin/tsc -p tsconfig.json` passed.
- 2026-06-21 CST `./node_modules/.bin/eslint` passed with 0 errors and 6 existing warnings.
- 2026-06-21 CST `node ./extension/build.mjs` passed; `extension/dist` contains all 6 new `zoom-cc0-*` wallpaper assets.
- 2026-06-21 CST local dev server `http://127.0.0.1:5010/` verified in an isolated headless Chrome via DevTools Protocol: initial Auto Mix showed Peter Ducai CC0 local art, clicking `立即更新壁纸` changed from `zoom-cc0-golden-church.jpg` to `zoom-cc0-water-lake.jpg`, and dispatching wheel on `.wc-wallpaper-stage` changed from `zoom-cc0-forest-path.jpg` to `zoom-featured-calanche-piana.jpg`.
- Dev server and temporary headless Chrome were stopped after verification.
- 2026-06-21 CST committed `d68ba0c` and pushed to `origin/main`.
- 2026-06-21 CST published release `webcollect-2026-06-21-wallpaper-refresh-cache`.
- Release URL: `https://github.com/RockyXuan/webcollect/releases/tag/webcollect-2026-06-21-wallpaper-refresh-cache`.
- Release asset: `WebCollect-Chrome-Extension-webcollect-2026-06-21-wallpaper-refresh-cache.zip`, size `58511169`, sha256 `db785f041b03f0fc38d72956c9a73df497835410cf79995fbb50313a6d4d58a6`.

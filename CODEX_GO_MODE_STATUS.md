# Codex Go Mode Status

## Final Goal

修复 WebCollect 壁纸系统：普通模式不再默认抓取 NASA、卫星、科研或技术图，改为高质量精选壁纸和合规来源优先；支持本地 fallback、后台刷新、质量过滤、模式切换、滚轮换壁纸、双语引用和来源署名，并用测试、构建和浏览器验证证明可用。

## Completed

- 默认壁纸偏好改为 `themeMode: auto`，默认启用自然/地标/动物/海洋类审美图库，不再默认启用 `space/aerial/weather`。
- NASA/ESA/USGS/NOAA 等科研来源从 Auto Mix 默认池剥离；NASA 仅允许在用户显式选择 Space 模式时进入远程抓取。
- 增加技术图负面关键词过滤，拒绝 satellite、map、heatmap、thermal、diagram、instrument、radar、chart、graph、mission、launch、Blue Marble 等明显科研/工具图。
- 壁纸评分取消对 NASA/ESA/USGS/NOAA 的奖励，并对科研来源和技术图进行降权/过滤。
- 增加 `WallpaperThemeMode`、`provider`、`tags`、`attribution`、`modes` 等兼容字段，保留现有数据结构和旧数据迁移路径。
- 壁纸缓存、当前选择、下一张切换、后台刷新都按当前模式过滤；远程失败时仍回落到本地精选库。
- 壁纸设置面板增加 Auto Mix / Nature / Cinema / Art / Space 模式入口。
- 新标签页角落保留刷新和设置按钮，壁纸说明增加来源/授权署名。
- 保留并验证滚轮换壁纸功能。
- 修复 3 个打包本地壁纸素材错配/重复问题：Madygen、Fusine Lake、Cosmic Cliffs 现在分别是正确图片，不再和 Blue Marble 或其他图片重复。
- 新增壁纸策略测试 `scripts/test-wallpaper-policy.ts`，覆盖默认抓取类别、技术图过滤、Auto Mix 排除科研来源、Space 可使用 NASA。
- 更新壁纸数据和 wiring 测试，覆盖默认图库数量、图片哈希唯一性、模式 UI、设置入口和署名渲染。

## Unfinished

- Pexels/Pixabay/TMDb 这类需要 API key 或后端代理的可选 provider 尚未接入；当前实现保持关闭，不在前端硬编码密钥。
- Cinema/Art 目前先作为模式策略入口和过滤路径存在，尚未接入专门的电影/艺术外部图库。没有 API key 时，功能仍以本地精选和合规 Wikimedia 图库兜底。
- GitHub Release 尚未发布为新的可下载版本。

## Current Blockers

- 无必须由用户决策的代码阻塞。
- 外部付费/授权 API provider 需要用户以后明确提供 key 或后端代理方案，当前阶段按计划不启用。
- `corepack pnpm build` 的顶层脚本会直接调用 `pnpm`，在当前 shell PATH 下报 `pnpm: command not found`；已拆分运行核心验证命令。
- `corepack pnpm exec next build` 在本机当前环境长时间停在 Turbopack production build，无错误输出，已作为环境/构建耗时风险记录。

## Next Step

- 若要发布给用户安装，下一步是按现有 release 脚本重新打包/发布扩展。
- 后续增强可以单独接入安全的后端代理 provider：Pexels/Pixabay/TMDb，并为 Cinema/Art 增补专门精选库。

## Latest Verification

- 2026-06-19 CST 完成壁纸默认策略、质量过滤、模式 UI、素材修复和浏览器验收。
- `node --import tsx scripts/test-wallpaper-data.ts` passed.
- `node --import tsx scripts/test-wallpaper-policy.ts` passed.
- `node --import tsx scripts/test-wallpaper-wiring.ts` passed.
- `corepack pnpm ts-check` passed.
- `corepack pnpm lint` passed with 6 existing warnings and 0 errors.
- `corepack pnpm build:ext` passed with existing Vite large-chunk/dynamic-import warnings.
- `corepack pnpm exec tsup src/server.ts --format esm --outDir dist --target node20 --external next --external react --external react-dom` passed.
- In-app Browser verified `http://127.0.0.1:5010/`: wallpaper stage loads; settings button opens the wallpaper settings dialog; Auto Mix/Nature/Cinema/Art/Space options are present; attribution renders; default visible wallpaper is a Wikimedia nature scene, not NASA/Blue Marble/satellite/science imagery.
- Packaged image hashes were checked and are unique after replacing the duplicated/mismapped local files.

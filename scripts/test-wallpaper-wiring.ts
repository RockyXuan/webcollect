import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync("src/app/page.tsx", "utf8");
const extensionSource = readFileSync("extension/src/newtab-app.tsx", "utf8");
const topNavSource = readFileSync("src/components/nav/top-nav.tsx", "utf8");
const shellSource = readFileSync("src/components/wallpaper/wallpaper-shell.tsx", "utf8");
const settingsSource = readFileSync("src/components/wallpaper/wallpaper-settings-dialog.tsx", "utf8");
const storeSource = readFileSync("src/lib/wallpaper-store.ts", "utf8");
const wallpaperSourcesSource = readFileSync("src/lib/wallpaper-sources.ts", "utf8");
const extensionHtmlSource = readFileSync("extension/src/newtab.html", "utf8");
const webCssSource = readFileSync("src/app/globals.css", "utf8");
const extensionCssSource = readFileSync("extension/src/extension.css", "utf8");
const sharedWallpaperCssSource = readFileSync("src/styles/zoom-wallpaper.css", "utf8");

for (const [label, source] of [
  ["web page", pageSource],
  ["extension newtab", extensionSource],
]) {
  assert.ok(source.includes("WallpaperShell"), `${label} should render the wallpaper shell`);
  assert.ok(source.includes("wallpaperMode"), `${label} should track wallpaper/collection mode`);
  assert.ok(source.includes("handleReturnToWallpaper"), `${label} should expose a way back to wallpaper mode`);
  assert.ok(source.indexOf("await loadData();") < source.indexOf("useAuthStore.getState().initialize()"), `${label} should keep local-first data loading`);
}

assert.ok(topNavSource.includes("onShowWallpaper"), "TopNav should accept a wallpaper button callback");
assert.ok(topNavSource.includes("壁纸"), "TopNav should show a visible wallpaper entry");

assert.ok(shellSource.includes("onEnterCollection"), "WallpaperShell should enter the bookmark wall");
assert.ok(shellSource.includes("handleWallpaperClick"), "WallpaperShell should enter the bookmark wall through an explicit click");
assert.equal(shellSource.includes("handleWallpaperMouseMove"), false, "WallpaperShell must not exit wallpaper mode from mouse movement");
assert.equal(shellSource.includes("onMouseMove="), false, "Wallpaper stage must not wire mouse movement gestures");
assert.equal(shellSource.includes("LONG_PRESS_MS"), false, "WallpaperShell must not use long-press entry because it feels like accidental mouse activity");
assert.equal(shellSource.includes("FLING_DISTANCE_PX"), false, "WallpaperShell must not keep fling gesture thresholds");
assert.ok(shellSource.includes("refreshOnlineWallpapers({ selectFresh: true })"), "WallpaperShell should opportunistically refresh online wallpapers in the background");
assert.ok(shellSource.includes("WALLPAPER_BACKGROUND_CHECK_MS"), "WallpaperShell should use the shared background refresh cadence");
assert.ok(shellSource.includes("<cite>{attribution}</cite>"), "WallpaperShell should show wallpaper attribution below the quote");
assert.ok(shellSource.includes("wc-wallpaper-source-badge"), "WallpaperShell should show a local/remote source badge for the current wallpaper");
assert.ok(shellSource.includes('wallpaper.source === "fallback"'), "WallpaperShell should distinguish local fallback wallpapers from remote wallpapers");
assert.ok(shellSource.includes("WallpaperSettingsDialog"), "WallpaperShell should mount the wallpaper settings dialog");
assert.ok(shellSource.includes("wc-wallpaper-controls"), "WallpaperShell should render wallpaper controls");
assert.ok(shellSource.includes("aria-label=\"壁纸设置\""), "WallpaperShell should expose a settings control");
assert.ok(shellSource.includes('window.addEventListener("online", refreshIfOnline)'), "WallpaperShell should retry wallpaper refresh when network returns");
assert.ok(shellSource.includes('window.addEventListener("focus", refreshIfOnline)'), "WallpaperShell should refresh-check when the wallpaper page regains focus");
assert.ok(settingsSource.includes("THEME_OPTIONS"), "Wallpaper settings should expose theme mode choices");
assert.ok(settingsSource.includes("启动壁纸模式"), "Wallpaper settings should expose a direct wallpaper-mode switch");
assert.ok(settingsSource.includes('checked={prefs.defaultMode === "wallpaper"}'), "Wallpaper mode switch should reflect the saved defaultMode");
assert.ok(settingsSource.includes('defaultMode: event.target.checked ? "wallpaper" : "collection"'), "Wallpaper mode switch should persist collection-first startup when off");
assert.ok(settingsSource.includes("Auto Mix"), "Wallpaper settings should include Auto Mix");
assert.ok(settingsSource.includes("TV"), "Wallpaper settings should include TV mode");
assert.ok(settingsSource.includes("Pets"), "Wallpaper settings should include Pets mode");
assert.ok(settingsSource.includes("Space"), "Wallpaper settings should include the opt-in Space mode");
assert.ok(settingsSource.includes("lastRemoteRefreshAt"), "Wallpaper settings should show the last remote refresh time");
assert.ok(settingsSource.includes("远程图") && settingsSource.includes("本地图"), "Wallpaper settings should show remote/local library counts");
assert.ok(settingsSource.includes("最近一次刷新错误"), "Wallpaper settings should expose the latest refresh error");
assert.ok(settingsSource.includes("formatRefreshTime"), "Wallpaper settings should format refresh status for users");
assert.equal(shellSource.includes("disabled={isRefreshing}"), false, "Wallpaper refresh control must remain clickable while background refresh is in flight");
assert.equal(settingsSource.includes("disabled={isRefreshing}"), false, "Wallpaper settings refresh action must remain clickable while background refresh is in flight");
assert.ok(shellSource.includes("prefs.currentQuoteId || wallpaper.quoteId"), "WallpaperShell should render the selected quote id from prefs before falling back to the asset quote id");
assert.ok(storeSource.includes("filterWallpapersForTheme"), "Wallpaper store should select wallpapers through the theme filter");
assert.ok(storeSource.includes("selectWallpaperQuote"), "Wallpaper store should select quotes through the quote engine");
assert.ok(storeSource.includes("recentQuoteIds"), "Wallpaper store should maintain recent quote history");
assert.ok(storeSource.includes("pickWallpaperAvoidingRecent"), "Wallpaper store should avoid recently viewed wallpaper assets during manual refresh and wheel rotation");
assert.ok(storeSource.includes("getVisibleWallpaperId"), "Wallpaper store should rotate from the actually visible wallpaper instead of a stale persisted id");
assert.ok(storeSource.includes("getWallpaperFetchCategories"), "Wallpaper refresh should use theme-aware fetch categories");
assert.ok(storeSource.includes("INITIAL_WALLPAPER"), "Wallpaper store should avoid a science-image first paint before async preferences load");
assert.ok(storeSource.includes("const fallbackCurrent = shouldSelectFresh"), "Wallpaper store should optimistically rotate to a local fallback during manual refresh");
assert.ok(storeSource.includes("set({ prefs: optimisticPrefs, isRefreshing: true, error: null })"), "Wallpaper store should render the optimistic local refresh before remote providers finish");
assert.ok(storeSource.includes("if (state.isRefreshing)") && storeSource.includes("options?.force || options?.selectFresh"), "Manual refresh should still perform a visible local rotation while a background refresh is already in flight");
assert.ok(storeSource.includes("applyWallpaperDisplay(optimisticPrefs, refreshedCurrent)"), "Wallpaper store should apply quote/display history when remote refresh selects a fresh wallpaper");
assert.ok(storeSource.includes("...optimisticPrefs"), "Wallpaper store should keep the local refresh result when remote providers return no usable wallpaper");
assert.equal(storeSource.includes("currentWallpaperId: FALLBACK_WALLPAPERS[0]"), false, "Wallpaper store must not default first paint to the first curated item");
assert.ok(wallpaperSourcesSource.includes("WALLPAPER_CACHE_NAME"), "Wallpaper cache should use a named versioned cache");
assert.ok(wallpaperSourcesSource.includes("WALLPAPER_LEGACY_CACHE_NAMES"), "Wallpaper cache should delete legacy wallpaper caches");
assert.equal(wallpaperSourcesSource.includes('caches.open("webcollect-wallpapers-v1")'), false, "Wallpaper cache must not keep writing the stale v1 cache");
assert.equal(extensionHtmlSource.includes("zoom-nasa-cosmic-cliffs"), false, "Extension newtab must not preload a NASA wallpaper in Auto Mix");
assert.ok(pageSource.includes("onShowWallpaper={handleReturnToWallpaper}"), "Web page should expose the top-nav wallpaper button");
assert.ok(extensionSource.includes("onShowWallpaper={handleReturnToWallpaper}"), "Extension newtab should expose the top-nav wallpaper button");
assert.equal(shellSource.includes("handleCollectionMouseMove"), false, "Collection mode must not wire mouse fling gestures");
assert.equal(shellSource.includes("onReturnToWallpaper"), false, "WallpaperShell must not provide collection-to-Zoom gesture/button entry points");
assert.equal(shellSource.includes("长按进入 Zoom 模式"), false, "Collection mode must not show a long-press Zoom hint");
assert.equal(shellSource.includes("wc-zoom-idle-hint-collection"), false, "Collection mode must not show Zoom-entry idle hints");
assert.equal(shellSource.includes("wc-wallpaper-floating-return"), false, "Collection mode must not render an extra floating wallpaper button");
assert.ok(shellSource.includes("Space") && shellSource.includes("Enter"), "WallpaperShell should support keyboard entry");
assert.ok(webCssSource.includes("@import '../styles/zoom-wallpaper.css';"), "Web should load the shared wallpaper styles");
assert.ok(extensionCssSource.includes("@import '../../src/styles/zoom-wallpaper.css';"), "Extension should load the shared wallpaper styles");
assert.equal(webCssSource.includes(".wc-wallpaper-stage {"), false, "Web globals must not duplicate the shared wallpaper styles");
assert.ok(sharedWallpaperCssSource.includes("top: max(1rem, env(safe-area-inset-top));"), "Idle hint should stay in the safe top area");
assert.ok(sharedWallpaperCssSource.includes("grid-template-columns: minmax(0, 1fr) auto;"), "Idle hint text and action should use stable grid columns");
assert.ok(sharedWallpaperCssSource.includes("@media (max-width: 640px)"), "Shared wallpaper styles should include mobile-safe positioning");

console.log("wallpaper wiring tests passed");

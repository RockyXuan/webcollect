import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync("src/app/page.tsx", "utf8");
const extensionSource = readFileSync("extension/src/newtab-app.tsx", "utf8");
const topNavSource = readFileSync("src/components/nav/top-nav.tsx", "utf8");
const shellSource = readFileSync("src/components/wallpaper/wallpaper-shell.tsx", "utf8");

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

assert.ok(shellSource.includes("LONG_PRESS_MS = 700"), "WallpaperShell should use the planned 700ms long press");
assert.ok(shellSource.includes("onEnterCollection"), "WallpaperShell should enter the bookmark wall");
assert.ok(shellSource.includes("refreshOnlineWallpapers({ selectFresh: true })"), "WallpaperShell should opportunistically refresh online wallpapers in the background");
assert.ok(shellSource.includes("WALLPAPER_BACKGROUND_CHECK_MS"), "WallpaperShell should use the shared background refresh cadence");
assert.ok(shellSource.includes('window.addEventListener("online", refreshIfOnline)'), "WallpaperShell should retry wallpaper refresh when network returns");
assert.ok(shellSource.includes('window.addEventListener("focus", refreshIfOnline)'), "WallpaperShell should refresh-check when the wallpaper page regains focus");
assert.ok(pageSource.includes("onShowWallpaper={handleReturnToWallpaper}"), "Web page should expose the top-nav wallpaper button");
assert.ok(extensionSource.includes("onShowWallpaper={handleReturnToWallpaper}"), "Extension newtab should expose the top-nav wallpaper button");
assert.equal(shellSource.includes("handleCollectionMouseMove"), false, "Collection mode must not wire mouse fling gestures");
assert.equal(shellSource.includes("onReturnToWallpaper"), false, "WallpaperShell must not provide collection-to-Zoom gesture/button entry points");
assert.equal(shellSource.includes("长按进入 Zoom 模式"), false, "Collection mode must not show a long-press Zoom hint");
assert.equal(shellSource.includes("wc-zoom-idle-hint-collection"), false, "Collection mode must not show Zoom-entry idle hints");
assert.equal(shellSource.includes("wc-wallpaper-floating-return"), false, "Collection mode must not render an extra floating wallpaper button");
assert.ok(shellSource.includes("Space") && shellSource.includes("Enter"), "WallpaperShell should support keyboard entry");

console.log("wallpaper wiring tests passed");

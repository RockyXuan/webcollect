import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync("src/app/page.tsx", "utf8");
const extensionSource = readFileSync("extension/src/newtab-app.tsx", "utf8");
const topNavSource = readFileSync("src/components/nav/top-nav.tsx", "utf8");
const shellSource = readFileSync("src/components/wallpaper/wallpaper-shell.tsx", "utf8");
const sharedZoomCss = readFileSync("src/styles/zoom-wallpaper.css", "utf8");
const extensionCss = readFileSync("extension/src/extension.css", "utf8");
const manifestSource = readFileSync("extension/manifest.json", "utf8");

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
assert.ok(shellSource.includes("onReturnToWallpaper"), "WallpaperShell should support long-press return from the wall");
assert.ok(shellSource.includes("mousemove"), "WallpaperShell should wire mouse movement gestures");
assert.ok(shellSource.includes("Space") && shellSource.includes("Enter"), "WallpaperShell should support keyboard entry");
assert.ok(shellSource.includes("wc-zoom-loading"), "WallpaperShell should render a non-blocking Zoom loading overlay");
assert.ok(shellSource.includes("wc-zoom-quote"), "WallpaperShell should render the bilingual Zoom quote");

for (const selector of [
  ".wc-wallpaper-preview",
  ".wc-wallpaper-image-loaded",
  ".wc-zoom-quote",
  ".wc-zoom-idle-hint",
  ".wc-zoom-loading",
]) {
  assert.ok(sharedZoomCss.includes(selector), `shared Zoom CSS should define ${selector}`);
}

assert.ok(
  extensionCss.includes("@import '../../src/styles/zoom-wallpaper.css';"),
  "extension CSS should import the shared Zoom wallpaper stylesheet"
);
assert.equal(manifestSource.includes('"key"'), false, "extension manifest should not change the user's existing OAuth extension ID");

console.log("wallpaper wiring tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeWallpaperPrefsByUpdatedAt } from "../src/lib/sync";
import { DEFAULT_WALLPAPER_PREFS } from "../src/lib/wallpaper-sources";

const localPrefs = {
  ...DEFAULT_WALLPAPER_PREFS,
  themeMode: "nature" as const,
  currentWallpaperId: "local-wallpaper",
  updatedAt: 200,
};

const olderCloudPrefs = {
  ...DEFAULT_WALLPAPER_PREFS,
  themeMode: "art" as const,
  currentWallpaperId: "older-cloud-wallpaper",
  updatedAt: 100,
};

const newerCloudPrefs = {
  ...DEFAULT_WALLPAPER_PREFS,
  themeMode: "cinema" as const,
  currentWallpaperId: "newer-cloud-wallpaper",
  updatedAt: 300,
};

const keepLocal = mergeWallpaperPrefsByUpdatedAt(localPrefs, olderCloudPrefs);
assert.equal(keepLocal.shouldApplyCloud, false);
assert.equal(keepLocal.prefs.currentWallpaperId, "local-wallpaper");
assert.equal(keepLocal.prefs.themeMode, "nature");

const pullCloud = mergeWallpaperPrefsByUpdatedAt(localPrefs, newerCloudPrefs);
assert.equal(pullCloud.shouldApplyCloud, true);
assert.equal(pullCloud.prefs.currentWallpaperId, "newer-cloud-wallpaper");
assert.equal(pullCloud.prefs.themeMode, "cinema");

const syncSource = readFileSync("src/lib/sync.ts", "utf8");
const wallpaperDbSource = readFileSync("src/lib/wallpaper-db.ts", "utf8");

assert.ok(syncSource.includes("getWallpaperPrefs"), "sync should load local wallpaper prefs");
assert.ok(syncSource.includes("saveSyncedWallpaperPrefs"), "sync should save newer cloud wallpaper prefs locally");
assert.ok(syncSource.includes("useWallpaperStore.setState({ isReady: false })"), "sync should force wallpaper store reinitialization after cloud pull");
assert.ok(syncSource.includes("wallpaperPrefs: mergedWallpaperPrefs"), "regular sync should write merged wallpaper prefs");
assert.ok(syncSource.includes("wallpaperPrefs: localWallpaperPrefs"), "snapshot push should include local wallpaper prefs");
assert.equal(syncSource.includes("wallpaperLibrary"), false, "sync must not write wallpaper library to cloud preferences");
assert.equal(syncSource.includes("saveWallpaperLibrary"), false, "sync must not sync wallpaper library");
assert.ok(wallpaperDbSource.includes("saveSyncedWallpaperPrefs"), "wallpaper db should expose a timestamp-preserving sync save");

console.log("wallpaper sync tests passed");

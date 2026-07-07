import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeWallpaperPrefsByUpdatedAt } from "../src/lib/sync";
import { prepareWallpaperPrefsForSave, toWallpaperSyncedSettings } from "../src/lib/wallpaper-db";
import { DEFAULT_WALLPAPER_PREFS } from "../src/lib/wallpaper-sources";

const localPrefs = {
  ...DEFAULT_WALLPAPER_PREFS,
  themeMode: "nature" as const,
  currentWallpaperId: "local-wallpaper",
  settingsUpdatedAt: 200,
  updatedAt: 200,
};

const olderCloudPrefs = {
  ...DEFAULT_WALLPAPER_PREFS,
  themeMode: "art" as const,
  currentWallpaperId: "older-cloud-wallpaper",
  settingsUpdatedAt: 100,
  updatedAt: 100,
};

const newerCloudPrefs = {
  ...DEFAULT_WALLPAPER_PREFS,
  themeMode: "cinema" as const,
  currentWallpaperId: "newer-cloud-wallpaper",
  settingsUpdatedAt: 300,
  updatedAt: 300,
};

const rotatedPrefs = prepareWallpaperPrefsForSave(
  localPrefs,
  {
    ...localPrefs,
    currentWallpaperId: "rotated-local-wallpaper",
    currentQuoteId: "rotated-quote",
    recentAssetIds: ["rotated-local-wallpaper", ...localPrefs.recentAssetIds],
  },
  500
);
assert.equal(rotatedPrefs.settingsUpdatedAt, 200, "wallpaper rotation should not bump synced settings timestamp");

const themeChangedPrefs = prepareWallpaperPrefsForSave(
  localPrefs,
  {
    ...localPrefs,
    themeMode: "art",
  },
  600
);
assert.equal(themeChangedPrefs.settingsUpdatedAt, 600, "theme changes should bump synced settings timestamp");

const keepLocal = mergeWallpaperPrefsByUpdatedAt(localPrefs, olderCloudPrefs);
assert.equal(keepLocal.shouldApplyCloud, false);
assert.equal(keepLocal.prefs.currentWallpaperId, "local-wallpaper");
assert.equal(keepLocal.prefs.themeMode, "nature");

const pullCloud = mergeWallpaperPrefsByUpdatedAt(localPrefs, toWallpaperSyncedSettings(newerCloudPrefs));
assert.equal(pullCloud.shouldApplyCloud, true);
assert.equal(pullCloud.prefs.currentWallpaperId, "local-wallpaper");
assert.equal(pullCloud.prefs.themeMode, "cinema");
assert.equal(pullCloud.prefs.settingsUpdatedAt, 300);

const syncSource = readFileSync("src/lib/sync.ts", "utf8");
const wallpaperDbSource = readFileSync("src/lib/wallpaper-db.ts", "utf8");

assert.ok(syncSource.includes("getWallpaperPrefs"), "sync should load local wallpaper prefs");
assert.ok(syncSource.includes("saveSyncedWallpaperPrefs"), "sync should save newer cloud wallpaper prefs locally");
assert.ok(syncSource.includes("useWallpaperStore.setState({ isReady: false })"), "sync should force wallpaper store reinitialization after cloud pull");
assert.ok(syncSource.includes("wallpaperPrefs: toWallpaperSyncedSettings(mergedWallpaperPrefs)"), "regular sync should only write synced wallpaper settings");
assert.ok(syncSource.includes("wallpaperPrefs: toWallpaperSyncedSettings(localWallpaperPrefs)"), "snapshot push should only include synced wallpaper settings");
assert.equal(syncSource.includes("wallpaperLibrary"), false, "sync must not write wallpaper library to cloud preferences");
assert.equal(syncSource.includes("saveWallpaperLibrary"), false, "sync must not sync wallpaper library");
assert.ok(wallpaperDbSource.includes("saveSyncedWallpaperPrefs"), "wallpaper db should expose a timestamp-preserving sync save");
assert.ok(wallpaperDbSource.includes("prepareWallpaperPrefsForSave"), "wallpaper db should compare stable settings before bumping settingsUpdatedAt");

console.log("wallpaper sync tests passed");

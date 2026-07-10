import localforage from "localforage";
import {
  WALLPAPER_CATEGORIES,
  type WallpaperCategory,
  type WallpaperItem,
  type WallpaperPrefs,
  type WallpaperSyncedSettings,
  type WallpaperThemeMode,
} from "./wallpaper-types";
import { DEFAULT_WALLPAPER_PREFS, FALLBACK_WALLPAPERS, filterUsableWallpapers, mergeWallpaperLibrary, pruneWallpaperLibrary } from "./wallpaper-sources";
import { markLocalSnapshotChanged, markSyncPreferenceChanged } from "./db";

const wallpaperDb = localforage.createInstance({
  name: "WebCollect",
  storeName: "webcollect_wallpaper",
});

const WALLPAPER_PREFS_KEY = "wallpaperPrefs";
const WALLPAPER_LIBRARY_KEY = "wallpaperLibrary";
const WALLPAPER_THEME_MODES: WallpaperThemeMode[] = ["auto", "nature", "cinema", "tv", "pets", "art", "space"];

function normalizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, limit);
}

export function normalizeWallpaperPrefs(value: Partial<WallpaperPrefs> | null | undefined): WallpaperPrefs {
  const enabledCategories = Array.isArray(value?.enabledCategories)
    ? value.enabledCategories.filter((category): category is WallpaperCategory =>
      WALLPAPER_CATEGORIES.includes(category as WallpaperCategory)
    )
    : [];
  const safeEnabledCategories = enabledCategories.length > 0
    ? enabledCategories
    : DEFAULT_WALLPAPER_PREFS.enabledCategories;
  const settingsUpdatedAt = typeof value?.settingsUpdatedAt === "number"
    ? value.settingsUpdatedAt
    : typeof value?.updatedAt === "number" ? value.updatedAt : 0;

  return {
    ...DEFAULT_WALLPAPER_PREFS,
    ...value,
    themeMode: WALLPAPER_THEME_MODES.includes(value?.themeMode as WallpaperThemeMode)
      ? value!.themeMode as WallpaperThemeMode
      : DEFAULT_WALLPAPER_PREFS.themeMode,
    enabledCategories: safeEnabledCategories,
    showZoomHints: typeof value?.showZoomHints === "boolean" ? value.showZoomHints : true,
    lastRemoteRefreshAt: typeof value?.lastRemoteRefreshAt === "number" ? value.lastRemoteRefreshAt : 0,
    currentWallpaperId: typeof value?.currentWallpaperId === "string" ? value.currentWallpaperId : null,
    currentQuoteId: typeof value?.currentQuoteId === "string" ? value.currentQuoteId : null,
    recentQuoteIds: normalizeStringArray(value?.recentQuoteIds, 50),
    recentAssetIds: normalizeStringArray(value?.recentAssetIds, 30),
    recentMediaIds: normalizeStringArray(value?.recentMediaIds, 20),
    settingsUpdatedAt,
    updatedAt: settingsUpdatedAt,
  };
}

export function toWallpaperSyncedSettings(value: Partial<WallpaperPrefs> | WallpaperSyncedSettings): WallpaperSyncedSettings {
  const prefs = normalizeWallpaperPrefs(value as Partial<WallpaperPrefs>);
  return {
    defaultMode: prefs.defaultMode,
    themeMode: prefs.themeMode,
    rotationInterval: prefs.rotationInterval,
    enabledCategories: [...prefs.enabledCategories],
    autoUpdate: prefs.autoUpdate,
    showZoomHints: prefs.showZoomHints,
    settingsUpdatedAt: prefs.settingsUpdatedAt,
  };
}

export function applyWallpaperSyncedSettings(
  localPrefs: WallpaperPrefs,
  settings: WallpaperSyncedSettings
): WallpaperPrefs {
  return normalizeWallpaperPrefs({
    ...localPrefs,
    defaultMode: settings.defaultMode,
    themeMode: settings.themeMode,
    rotationInterval: settings.rotationInterval,
    enabledCategories: settings.enabledCategories,
    autoUpdate: settings.autoUpdate,
    showZoomHints: settings.showZoomHints,
    settingsUpdatedAt: settings.settingsUpdatedAt,
    updatedAt: settings.settingsUpdatedAt,
  });
}

function sameSyncedSettings(left: WallpaperSyncedSettings, right: WallpaperSyncedSettings): boolean {
  return left.defaultMode === right.defaultMode
    && left.themeMode === right.themeMode
    && left.rotationInterval === right.rotationInterval
    && left.autoUpdate === right.autoUpdate
    && left.showZoomHints === right.showZoomHints
    && JSON.stringify(left.enabledCategories) === JSON.stringify(right.enabledCategories);
}

export function prepareWallpaperPrefsForSave(
  previous: Partial<WallpaperPrefs> | null | undefined,
  next: Partial<WallpaperPrefs>,
  now = Date.now()
): WallpaperPrefs {
  const previousPrefs = normalizeWallpaperPrefs(previous);
  const nextPrefs = normalizeWallpaperPrefs(next);
  const previousSettings = toWallpaperSyncedSettings(previousPrefs);
  const nextSettings = toWallpaperSyncedSettings(nextPrefs);
  const settingsUpdatedAt = sameSyncedSettings(previousSettings, nextSettings)
    ? previousPrefs.settingsUpdatedAt
    : now;
  return {
    ...nextPrefs,
    settingsUpdatedAt,
    updatedAt: settingsUpdatedAt,
  };
}

export async function getWallpaperPrefs(): Promise<WallpaperPrefs> {
  const stored = await wallpaperDb.getItem<Partial<WallpaperPrefs>>(WALLPAPER_PREFS_KEY);
  return normalizeWallpaperPrefs(stored);
}

export async function saveWallpaperPrefs(prefs: Partial<WallpaperPrefs>): Promise<void> {
  const previous = await wallpaperDb.getItem<Partial<WallpaperPrefs>>(WALLPAPER_PREFS_KEY);
  const prepared = prepareWallpaperPrefsForSave(previous, prefs);
  await wallpaperDb.setItem(WALLPAPER_PREFS_KEY, prepared);
  if (!sameSyncedSettings(toWallpaperSyncedSettings(previous || {}), toWallpaperSyncedSettings(prepared))) {
    await markSyncPreferenceChanged("wallpaperPrefs");
    await markLocalSnapshotChanged();
  }
}

export async function saveSyncedWallpaperPrefs(prefs: Partial<WallpaperPrefs>): Promise<void> {
  const previous = await wallpaperDb.getItem<Partial<WallpaperPrefs>>(WALLPAPER_PREFS_KEY);
  const prepared = normalizeWallpaperPrefs(prefs);
  await wallpaperDb.setItem(WALLPAPER_PREFS_KEY, prepared);
  if (!sameSyncedSettings(toWallpaperSyncedSettings(previous || {}), toWallpaperSyncedSettings(prepared))) {
    await markSyncPreferenceChanged("wallpaperPrefs");
    await markLocalSnapshotChanged();
  }
}

export async function getWallpaperLibrary(): Promise<WallpaperItem[]> {
  const stored = await wallpaperDb.getItem<WallpaperItem[]>(WALLPAPER_LIBRARY_KEY);
  const library = filterUsableWallpapers(Array.isArray(stored) ? stored : []);
  return pruneWallpaperLibrary(mergeWallpaperLibrary(FALLBACK_WALLPAPERS, library));
}

export async function saveWallpaperLibrary(items: WallpaperItem[]): Promise<void> {
  const library = pruneWallpaperLibrary(filterUsableWallpapers(items));
  await wallpaperDb.setItem(WALLPAPER_LIBRARY_KEY, library);
}

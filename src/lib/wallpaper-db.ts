import localforage from "localforage";
import { WALLPAPER_CATEGORIES, type WallpaperCategory, type WallpaperItem, type WallpaperPrefs } from "./wallpaper-types";
import { DEFAULT_WALLPAPER_PREFS, FALLBACK_WALLPAPERS, filterUsableWallpapers, mergeWallpaperLibrary, pruneWallpaperLibrary } from "./wallpaper-sources";

const wallpaperDb = localforage.createInstance({
  name: "WebCollect",
  storeName: "webcollect_wallpaper",
});

const WALLPAPER_PREFS_KEY = "wallpaperPrefs";
const WALLPAPER_LIBRARY_KEY = "wallpaperLibrary";

function normalizePrefs(value: Partial<WallpaperPrefs> | null | undefined): WallpaperPrefs {
  const enabledCategories = Array.isArray(value?.enabledCategories)
    ? value.enabledCategories.filter((category): category is WallpaperCategory =>
      WALLPAPER_CATEGORIES.includes(category as WallpaperCategory)
    )
    : [];
  const safeEnabledCategories = enabledCategories.length > 0
    ? enabledCategories
    : DEFAULT_WALLPAPER_PREFS.enabledCategories;

  return {
    ...DEFAULT_WALLPAPER_PREFS,
    ...value,
    enabledCategories: safeEnabledCategories,
    showZoomHints: typeof value?.showZoomHints === "boolean" ? value.showZoomHints : true,
    updatedAt: typeof value?.updatedAt === "number" ? value.updatedAt : 0,
    lastRemoteRefreshAt: typeof value?.lastRemoteRefreshAt === "number" ? value.lastRemoteRefreshAt : 0,
    currentWallpaperId: typeof value?.currentWallpaperId === "string" ? value.currentWallpaperId : null,
  };
}

export async function getWallpaperPrefs(): Promise<WallpaperPrefs> {
  const stored = await wallpaperDb.getItem<Partial<WallpaperPrefs>>(WALLPAPER_PREFS_KEY);
  return normalizePrefs(stored);
}

export async function saveWallpaperPrefs(prefs: WallpaperPrefs): Promise<void> {
  await wallpaperDb.setItem(WALLPAPER_PREFS_KEY, {
    ...normalizePrefs(prefs),
    updatedAt: Date.now(),
  });
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

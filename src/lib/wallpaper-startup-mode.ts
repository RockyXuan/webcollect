import type { WallpaperMode } from "./wallpaper-types";

export const WALLPAPER_STARTUP_MODE_KEY = "webcollect_wallpaper_startup_mode";

export function readWallpaperStartupMode(): WallpaperMode | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(WALLPAPER_STARTUP_MODE_KEY);
    return value === "wallpaper" || value === "collection" ? value : null;
  } catch {
    return null;
  }
}

export function writeWallpaperStartupMode(mode: WallpaperMode): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WALLPAPER_STARTUP_MODE_KEY, mode);
  } catch {
    // IndexedDB remains the source of truth when synchronous storage is unavailable.
  }
}

import { describe, expect, it } from "vitest";
import {
  mergeWallpaperRuntimePrefs,
  prepareWallpaperPrefsForSave,
} from "@/lib/wallpaper-db";
import { DEFAULT_WALLPAPER_PREFS } from "@/lib/wallpaper-sources";

describe("wallpaper preference persistence", () => {
  it("keeps a newer startup-mode change when a stale background refresh finishes", () => {
    const initial = {
      ...DEFAULT_WALLPAPER_PREFS,
      defaultMode: "wallpaper" as const,
      currentWallpaperId: "wallpaper-before-refresh",
      settingsUpdatedAt: 100,
      updatedAt: 100,
    };
    const disabled = prepareWallpaperPrefsForSave(
      initial,
      { ...initial, defaultMode: "collection" },
      200
    );
    const staleRefreshResult = {
      ...initial,
      currentWallpaperId: "wallpaper-from-late-refresh",
      lastRemoteRefreshAt: 300,
    };

    const merged = mergeWallpaperRuntimePrefs(disabled, staleRefreshResult);

    expect(merged.defaultMode).toBe("collection");
    expect(merged.settingsUpdatedAt).toBe(200);
    expect(merged.currentWallpaperId).toBe("wallpaper-from-late-refresh");
    expect(merged.lastRemoteRefreshAt).toBe(300);
  });

  it("preserves all current synced settings while accepting runtime-only fields", () => {
    const stored = {
      ...DEFAULT_WALLPAPER_PREFS,
      defaultMode: "collection" as const,
      themeMode: "pets" as const,
      rotationInterval: "1h" as const,
      autoUpdate: false,
      showZoomHints: false,
      settingsUpdatedAt: 500,
      updatedAt: 500,
    };
    const staleRuntime = {
      ...DEFAULT_WALLPAPER_PREFS,
      defaultMode: "wallpaper" as const,
      themeMode: "space" as const,
      rotationInterval: "5m" as const,
      autoUpdate: true,
      showZoomHints: true,
      currentWallpaperId: "new-runtime-wallpaper",
      currentQuoteId: "new-runtime-quote",
      settingsUpdatedAt: 100,
      updatedAt: 100,
    };

    const merged = mergeWallpaperRuntimePrefs(stored, staleRuntime);

    expect(merged).toMatchObject({
      defaultMode: "collection",
      themeMode: "pets",
      rotationInterval: "1h",
      autoUpdate: false,
      showZoomHints: false,
      settingsUpdatedAt: 500,
      updatedAt: 500,
      currentWallpaperId: "new-runtime-wallpaper",
      currentQuoteId: "new-runtime-quote",
    });
  });
});

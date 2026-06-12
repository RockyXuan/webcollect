"use client";

import { create } from "zustand";
import { getWallpaperLibrary, getWallpaperPrefs, saveWallpaperLibrary, saveWallpaperPrefs } from "./wallpaper-db";
import {
  DEFAULT_WALLPAPER_PREFS,
  FALLBACK_WALLPAPERS,
  cacheWallpaperImages,
  fetchRemoteWallpapers,
  getRandomWallpaper,
  getRotationMs,
  isPackagedWallpaper,
  mergeWallpaperLibrary,
  pruneWallpaperLibrary,
  shouldRefreshWallpapers,
} from "./wallpaper-sources";
import type { WallpaperItem, WallpaperMode, WallpaperPrefs } from "./wallpaper-types";

interface WallpaperState {
  mode: WallpaperMode;
  prefs: WallpaperPrefs;
  wallpapers: WallpaperItem[];
  isReady: boolean;
  isRefreshing: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  enterCollection: () => void;
  returnToWallpaper: () => void;
  nextWallpaper: () => Promise<void>;
  togglePaused: () => Promise<void>;
  updatePrefs: (prefs: Partial<WallpaperPrefs>) => Promise<void>;
  refreshOnlineWallpapers: (options?: { force?: boolean }) => Promise<void>;
  cacheCurrentAndNext: () => Promise<void>;
}

function getCurrentWallpaper(items: WallpaperItem[], currentId: string | null): WallpaperItem {
  return items.find((item) => item.id === currentId) || items[0] || FALLBACK_WALLPAPERS[0];
}

export const useWallpaperStore = create<WallpaperState>((set, get) => ({
  mode: "wallpaper",
  prefs: {
    ...DEFAULT_WALLPAPER_PREFS,
    currentWallpaperId: FALLBACK_WALLPAPERS[0]?.id || null,
  },
  wallpapers: FALLBACK_WALLPAPERS,
  isReady: false,
  isRefreshing: false,
  error: null,

  initialize: async () => {
    if (get().isReady) return;

    const [prefs, storedLibrary] = await Promise.all([
      getWallpaperPrefs(),
      getWallpaperLibrary(),
    ]);
    const wallpapers = pruneWallpaperLibrary(mergeWallpaperLibrary(FALLBACK_WALLPAPERS, storedLibrary));
    const preferredCurrent = getRandomWallpaper(wallpapers, prefs.currentWallpaperId)
      || getCurrentWallpaper(wallpapers, prefs.currentWallpaperId);
    const current = preferredCurrent && isPackagedWallpaper(preferredCurrent)
      ? preferredCurrent
      : FALLBACK_WALLPAPERS.find(isPackagedWallpaper) || FALLBACK_WALLPAPERS[0];
    const nextPrefs = {
      ...prefs,
      currentWallpaperId: current?.id || FALLBACK_WALLPAPERS[0]?.id || null,
    };

    set({
      prefs: nextPrefs,
      wallpapers,
      mode: nextPrefs.defaultMode,
      isReady: true,
      error: null,
    });
    await saveWallpaperPrefs(nextPrefs);
    void get().cacheCurrentAndNext();
    if (shouldRefreshWallpapers(nextPrefs)) {
      void get().refreshOnlineWallpapers();
    }
  },

  enterCollection: () => {
    set({ mode: "collection" });
  },

  returnToWallpaper: () => {
    set({ mode: "wallpaper" });
  },

  nextWallpaper: async () => {
    const state = get();
    const next = getRandomWallpaper(state.wallpapers, state.prefs.currentWallpaperId);
    if (!next) return;
    const prefs = { ...state.prefs, currentWallpaperId: next.id };
    set({ prefs });
    await saveWallpaperPrefs(prefs);
    void get().cacheCurrentAndNext();
  },

  togglePaused: async () => {
    const prefs = { ...get().prefs, paused: !get().prefs.paused };
    set({ prefs });
    await saveWallpaperPrefs(prefs);
  },

  updatePrefs: async (updates) => {
    const prefs = {
      ...get().prefs,
      ...updates,
      enabledCategories: updates.enabledCategories && updates.enabledCategories.length > 0
        ? updates.enabledCategories
        : get().prefs.enabledCategories,
    };
    set({ prefs });
    await saveWallpaperPrefs(prefs);
  },

  refreshOnlineWallpapers: async (options) => {
    const state = get();
    if (!options?.force && !shouldRefreshWallpapers(state.prefs)) return;
    if (!state.prefs.autoUpdate && !options?.force) return;

    set({ isRefreshing: true, error: null });
    try {
      const remote = await fetchRemoteWallpapers(state.prefs.enabledCategories);
      const wallpapers = pruneWallpaperLibrary(mergeWallpaperLibrary(state.wallpapers, remote));
      const prefs = { ...state.prefs, lastRemoteRefreshAt: Date.now() };
      set({ wallpapers, prefs, isRefreshing: false, error: null });
      await Promise.all([
        saveWallpaperLibrary(wallpapers),
        saveWallpaperPrefs(prefs),
      ]);
      void get().cacheCurrentAndNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : "壁纸更新失败";
      set({ isRefreshing: false, error: message });
    }
  },

  cacheCurrentAndNext: async () => {
    const state = get();
    const current = getCurrentWallpaper(state.wallpapers, state.prefs.currentWallpaperId);
    const next = getRandomWallpaper(state.wallpapers, current.id);
    await cacheWallpaperImages(next ? [current, next] : [current]);
  },
}));

export function selectCurrentWallpaper(state: WallpaperState): WallpaperItem {
  return getCurrentWallpaper(state.wallpapers, state.prefs.currentWallpaperId);
}

export { getRotationMs };

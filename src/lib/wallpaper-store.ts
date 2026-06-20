"use client";

import { create } from "zustand";
import { getWallpaperLibrary, getWallpaperPrefs, saveWallpaperLibrary, saveWallpaperPrefs } from "./wallpaper-db";
import {
  DEFAULT_WALLPAPER_PREFS,
  FALLBACK_WALLPAPERS,
  cacheWallpaperImages,
  fetchRemoteWallpapers,
  filterWallpapersForTheme,
  getWallpaperFetchCategories,
  getWallpaperCacheBatch,
  getRandomWallpaper,
  getRotationMs,
  mergeWallpaperLibrary,
  pickWallpaperAfterRefresh,
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
  refreshOnlineWallpapers: (options?: { force?: boolean; selectFresh?: boolean }) => Promise<void>;
  cacheCurrentAndNext: () => Promise<void>;
}

function getWallpaperPool(items: WallpaperItem[], prefs: WallpaperPrefs): WallpaperItem[] {
  return filterWallpapersForTheme(items, prefs.themeMode);
}

const INITIAL_WALLPAPER = filterWallpapersForTheme(FALLBACK_WALLPAPERS, DEFAULT_WALLPAPER_PREFS.themeMode)
  .find((item) => item.imageUrl.startsWith("/assets/wallpapers/"))
  || filterWallpapersForTheme(FALLBACK_WALLPAPERS, DEFAULT_WALLPAPER_PREFS.themeMode)[0]
  || FALLBACK_WALLPAPERS[0];

function getCurrentWallpaper(items: WallpaperItem[], currentId: string | null, prefs: WallpaperPrefs): WallpaperItem {
  const pool = getWallpaperPool(items, prefs);
  return pool.find((item) => item.id === currentId) || pool[0] || INITIAL_WALLPAPER || FALLBACK_WALLPAPERS[0];
}

export const useWallpaperStore = create<WallpaperState>((set, get) => ({
  mode: "wallpaper",
  prefs: {
    ...DEFAULT_WALLPAPER_PREFS,
    currentWallpaperId: INITIAL_WALLPAPER?.id || null,
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
    const pool = getWallpaperPool(wallpapers, prefs);
    const preferredCurrent = getRandomWallpaper(pool, prefs.currentWallpaperId)
      || getCurrentWallpaper(wallpapers, prefs.currentWallpaperId, prefs);
    const nextPrefs = {
      ...prefs,
      currentWallpaperId: preferredCurrent?.id || FALLBACK_WALLPAPERS[0]?.id || null,
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
    const next = getRandomWallpaper(getWallpaperPool(state.wallpapers, state.prefs), state.prefs.currentWallpaperId);
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
    const current = get();
    const prefs = {
      ...get().prefs,
      ...updates,
      enabledCategories: updates.enabledCategories && updates.enabledCategories.length > 0
        ? updates.enabledCategories
        : get().prefs.enabledCategories,
    };
    const pool = getWallpaperPool(current.wallpapers, prefs);
    if (!pool.some((item) => item.id === prefs.currentWallpaperId)) {
      prefs.currentWallpaperId = getRandomWallpaper(pool, prefs.currentWallpaperId)?.id || pool[0]?.id || FALLBACK_WALLPAPERS[0]?.id || null;
    }
    set({ prefs });
    await saveWallpaperPrefs(prefs);
    void get().cacheCurrentAndNext();
  },

  refreshOnlineWallpapers: async (options) => {
    const state = get();
    if (state.isRefreshing) return;
    if (!options?.force && !shouldRefreshWallpapers(state.prefs)) return;
    if (!state.prefs.autoUpdate && !options?.force) return;

    const shouldSelectFresh = Boolean(options?.force || options?.selectFresh || state.mode === "wallpaper");
    const fallbackCurrent = shouldSelectFresh
      ? getRandomWallpaper(getWallpaperPool(state.wallpapers, state.prefs), state.prefs.currentWallpaperId)
      : null;
    const optimisticPrefs = fallbackCurrent
      ? { ...state.prefs, currentWallpaperId: fallbackCurrent.id }
      : state.prefs;

    set({ prefs: optimisticPrefs, isRefreshing: true, error: null });
    if (fallbackCurrent) {
      void saveWallpaperPrefs(optimisticPrefs);
      void get().cacheCurrentAndNext();
    }

    try {
      const remote = await fetchRemoteWallpapers(getWallpaperFetchCategories(state.prefs));
      const wallpapers = pruneWallpaperLibrary(mergeWallpaperLibrary(state.wallpapers, remote));
      const pool = getWallpaperPool(wallpapers, state.prefs);
      const themeRemote = filterWallpapersForTheme(remote, state.prefs.themeMode);
      const refreshedCurrent = themeRemote.length > 0 && shouldSelectFresh
        ? pickWallpaperAfterRefresh(pool, state.prefs.currentWallpaperId, themeRemote)
        : null;
      const prefs = {
        ...optimisticPrefs,
        currentWallpaperId: refreshedCurrent?.id || optimisticPrefs.currentWallpaperId,
        lastRemoteRefreshAt: Date.now(),
      };
      set({ wallpapers, prefs, isRefreshing: false, error: null });
      await Promise.all([
        saveWallpaperLibrary(wallpapers),
        saveWallpaperPrefs(prefs),
      ]);
      void get().cacheCurrentAndNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : "壁纸更新失败";
      set({ prefs: optimisticPrefs, isRefreshing: false, error: message });
      if (fallbackCurrent) {
        await saveWallpaperPrefs(optimisticPrefs);
      }
    }
  },

  cacheCurrentAndNext: async () => {
    const state = get();
    await cacheWallpaperImages(getWallpaperCacheBatch(getWallpaperPool(state.wallpapers, state.prefs), state.prefs.currentWallpaperId));
  },
}));

export function selectCurrentWallpaper(state: WallpaperState): WallpaperItem {
  return getCurrentWallpaper(state.wallpapers, state.prefs.currentWallpaperId, state.prefs);
}

export { getRotationMs };

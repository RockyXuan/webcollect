"use client";

import { create } from "zustand";
import {
  getWallpaperLibrary,
  getWallpaperPrefs,
  saveWallpaperLibrary,
  saveWallpaperPrefs,
  saveWallpaperRuntimePrefs,
} from "./wallpaper-db";
import {
  DEFAULT_WALLPAPER_PREFS,
  FALLBACK_WALLPAPERS,
  cacheWallpaperImages,
  fetchRemoteWallpapers,
  filterWallpapersForTheme,
  getWallpaperFetchCategories,
  getWallpaperCacheBatch,
  getRotationMs,
  mergeWallpaperLibrary,
  pickWallpaperAvoidingRecent,
  pickWallpaperAfterRefresh,
  pruneWallpaperLibrary,
  shouldRefreshWallpapers,
} from "./wallpaper-sources";
import { selectWallpaperQuote } from "./wallpaper-quotes";
import { readWallpaperStartupMode, writeWallpaperStartupMode } from "./wallpaper-startup-mode";
import type { WallpaperItem, WallpaperMode, WallpaperPrefs } from "./wallpaper-types";

const RECENT_QUOTE_LIMIT = 50;
const RECENT_ASSET_LIMIT = 30;
const RECENT_MEDIA_LIMIT = 20;
let wallpaperInitializationPromise: Promise<void> | null = null;

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

function getVisibleWallpaperId(items: WallpaperItem[], prefs: WallpaperPrefs): string | null {
  return getCurrentWallpaper(items, prefs.currentWallpaperId, prefs)?.id || prefs.currentWallpaperId;
}

function addRecent(value: string | null | undefined, existing: string[], limit: number): string[] {
  if (!value) return existing.slice(0, limit);
  return [value, ...existing.filter((item) => item !== value)].slice(0, limit);
}

function getWallpaperMediaKey(wallpaper: WallpaperItem): string | null {
  const mediaTag = wallpaper.tags?.find((tag) =>
    tag.startsWith("tmdb:")
    || tag.startsWith("tmdb-tv:")
    || tag.startsWith("tvdb:")
    || tag.startsWith("media:")
  );
  if (mediaTag) return mediaTag;
  return null;
}

function applyWallpaperDisplay(prefs: WallpaperPrefs, wallpaper: WallpaperItem): WallpaperPrefs {
  const selection = selectWallpaperQuote({
    wallpaper,
    themeMode: prefs.themeMode,
    recentQuoteIds: prefs.recentQuoteIds,
  });
  return {
    ...prefs,
    currentWallpaperId: wallpaper.id,
    currentQuoteId: selection.quote.id,
    recentQuoteIds: addRecent(selection.quote.id, prefs.recentQuoteIds, RECENT_QUOTE_LIMIT),
    recentAssetIds: addRecent(wallpaper.id, prefs.recentAssetIds, RECENT_ASSET_LIMIT),
    recentMediaIds: addRecent(getWallpaperMediaKey(wallpaper), prefs.recentMediaIds, RECENT_MEDIA_LIMIT),
  };
}

export const useWallpaperStore = create<WallpaperState>((set, get) => ({
  mode: "collection",
  prefs: {
    ...DEFAULT_WALLPAPER_PREFS,
    defaultMode: "collection",
    currentWallpaperId: INITIAL_WALLPAPER?.id || null,
    currentQuoteId: INITIAL_WALLPAPER?.quoteId || null,
  },
  wallpapers: FALLBACK_WALLPAPERS,
  isReady: false,
  isRefreshing: false,
  error: null,

  initialize: async () => {
    if (get().isReady) return;
    if (!wallpaperInitializationPromise) {
      wallpaperInitializationPromise = (async () => {
        const [prefs, storedLibrary] = await Promise.all([
          getWallpaperPrefs(),
          getWallpaperLibrary(),
        ]);
        const wallpapers = pruneWallpaperLibrary(mergeWallpaperLibrary(FALLBACK_WALLPAPERS, storedLibrary));
        const pool = getWallpaperPool(wallpapers, prefs);
        const preferredCurrent = prefs.rotationInterval === "open"
          ? pickWallpaperAvoidingRecent(pool, prefs.currentWallpaperId, prefs.recentAssetIds)
            || getCurrentWallpaper(wallpapers, null, prefs)
          : pool.find((item) => item.id === prefs.currentWallpaperId)
            || pickWallpaperAvoidingRecent(pool, prefs.currentWallpaperId, prefs.recentAssetIds)
            || getCurrentWallpaper(wallpapers, prefs.currentWallpaperId, prefs);
        const nextPrefs = applyWallpaperDisplay(prefs, preferredCurrent || getCurrentWallpaper(wallpapers, prefs.currentWallpaperId, prefs));

        const persistedPrefs = await saveWallpaperRuntimePrefs(nextPrefs);
        set({
          prefs: persistedPrefs,
          wallpapers,
          mode: persistedPrefs.defaultMode,
          isReady: true,
          error: null,
        });
        void get().cacheCurrentAndNext();
        if (shouldRefreshWallpapers(persistedPrefs)) {
          void get().refreshOnlineWallpapers();
        }
      })().finally(() => {
        wallpaperInitializationPromise = null;
      });
    }
    await wallpaperInitializationPromise;
  },

  enterCollection: () => {
    set({ mode: "collection" });
  },

  returnToWallpaper: () => {
    set({ mode: "wallpaper" });
  },

  nextWallpaper: async () => {
    const state = get();
    const currentId = getVisibleWallpaperId(state.wallpapers, state.prefs);
    const next = pickWallpaperAvoidingRecent(
      getWallpaperPool(state.wallpapers, state.prefs),
      currentId,
      state.prefs.recentAssetIds
    );
    if (!next) return;
    const prefs = applyWallpaperDisplay(state.prefs, next);
    set({ prefs });
    const persistedPrefs = await saveWallpaperRuntimePrefs(prefs);
    set({ prefs: persistedPrefs });
    void get().cacheCurrentAndNext();
  },

  togglePaused: async () => {
    const prefs = { ...get().prefs, paused: !get().prefs.paused };
    set({ prefs });
    const persistedPrefs = await saveWallpaperRuntimePrefs(prefs);
    set({ prefs: persistedPrefs });
  },

  updatePrefs: async (updates) => {
    const current = get();
    if (updates.defaultMode) {
      writeWallpaperStartupMode(updates.defaultMode);
    }
    const prefs = {
      ...get().prefs,
      ...updates,
      enabledCategories: updates.enabledCategories && updates.enabledCategories.length > 0
        ? updates.enabledCategories
        : get().prefs.enabledCategories,
    };
    const pool = getWallpaperPool(current.wallpapers, prefs);
    const selectedWallpaper = pool.find((item) => item.id === prefs.currentWallpaperId)
      || pickWallpaperAvoidingRecent(pool, prefs.currentWallpaperId, prefs.recentAssetIds)
      || pool[0]
      || FALLBACK_WALLPAPERS[0];
    const nextPrefs = selectedWallpaper ? applyWallpaperDisplay(prefs, selectedWallpaper) : prefs;
    set({ prefs: nextPrefs });
    await saveWallpaperPrefs(nextPrefs);
    void get().cacheCurrentAndNext();
  },

  refreshOnlineWallpapers: async (options) => {
    const state = get();
    if (state.isRefreshing) {
      if (options?.force || options?.selectFresh) {
        const currentId = getVisibleWallpaperId(state.wallpapers, state.prefs);
        const fallbackCurrent = pickWallpaperAvoidingRecent(
          getWallpaperPool(state.wallpapers, state.prefs),
          currentId,
          state.prefs.recentAssetIds
        );
        if (fallbackCurrent) {
          const prefs = applyWallpaperDisplay(state.prefs, fallbackCurrent);
          const persistedPrefs = await saveWallpaperRuntimePrefs(prefs);
          set({ prefs: persistedPrefs });
          void get().cacheCurrentAndNext();
        }
      }
      return;
    }
    if (!options?.force && !shouldRefreshWallpapers(state.prefs)) return;
    if (!state.prefs.autoUpdate && !options?.force) return;

    const shouldSelectFresh = Boolean(options?.force || options?.selectFresh || state.mode === "wallpaper");
    const currentId = getVisibleWallpaperId(state.wallpapers, state.prefs);
    const fallbackCurrent = shouldSelectFresh
      ? pickWallpaperAvoidingRecent(
        getWallpaperPool(state.wallpapers, state.prefs),
        currentId,
        state.prefs.recentAssetIds
      )
      : null;
    const optimisticPrefs = fallbackCurrent
      ? applyWallpaperDisplay(state.prefs, fallbackCurrent)
      : state.prefs;

    set({ prefs: optimisticPrefs, isRefreshing: true, error: null });
    if (fallbackCurrent) {
      const persistedPrefs = await saveWallpaperRuntimePrefs(optimisticPrefs);
      set({ prefs: persistedPrefs });
      void get().cacheCurrentAndNext();
    }

    try {
      const remote = await fetchRemoteWallpapers(getWallpaperFetchCategories(state.prefs));
      const wallpapers = pruneWallpaperLibrary(mergeWallpaperLibrary(state.wallpapers, remote));
      const pool = getWallpaperPool(wallpapers, state.prefs);
      const themeRemote = filterWallpapersForTheme(remote, state.prefs.themeMode);
      const refreshedCurrent = themeRemote.length > 0 && shouldSelectFresh
        ? pickWallpaperAfterRefresh(pool, optimisticPrefs.currentWallpaperId, themeRemote, optimisticPrefs.recentAssetIds)
        : null;
      const prefs = refreshedCurrent
        ? {
          ...applyWallpaperDisplay(optimisticPrefs, refreshedCurrent),
          lastRemoteRefreshAt: Date.now(),
        }
        : {
          ...optimisticPrefs,
          lastRemoteRefreshAt: Date.now(),
        };
      const [, persistedPrefs] = await Promise.all([
        saveWallpaperLibrary(wallpapers),
        saveWallpaperRuntimePrefs(prefs),
      ]);
      set({ wallpapers, prefs: persistedPrefs, isRefreshing: false, error: null });
      void get().cacheCurrentAndNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : "壁纸更新失败";
      if (fallbackCurrent) {
        const persistedPrefs = await saveWallpaperRuntimePrefs(optimisticPrefs);
        set({ prefs: persistedPrefs, isRefreshing: false, error: message });
      } else {
        set({ isRefreshing: false, error: message });
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

export function primeWallpaperStartupMode(): WallpaperMode {
  const mode = readWallpaperStartupMode() || "collection";
  useWallpaperStore.setState((state) => ({
    mode,
    prefs: {
      ...state.prefs,
      defaultMode: mode,
    },
  }));
  return mode;
}

export { getRotationMs };

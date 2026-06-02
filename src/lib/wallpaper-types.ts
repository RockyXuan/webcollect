export const WALLPAPER_CATEGORIES = [
  "landscape",
  "aerial",
  "landmark",
  "space",
  "animals",
  "ocean",
  "weather",
] as const;

export type WallpaperCategory = typeof WALLPAPER_CATEGORIES[number];

export type WallpaperSource = "fallback" | "nasa" | "wikimedia" | "esa" | "usgs" | "noaa";

export type WallpaperQuality = "curated" | "award" | "featured" | "remote";

export type WallpaperMode = "wallpaper" | "collection";

export type WallpaperRotationInterval = "off" | "5m" | "15m" | "1h" | "open";

export interface WallpaperItem {
  id: string;
  title: string;
  author: string;
  source: WallpaperSource;
  sourceUrl: string;
  imageUrl: string;
  thumbnailUrl: string;
  license: string;
  width: number;
  height: number;
  category: WallpaperCategory;
  quality: WallpaperQuality;
  sourceCollection: string;
  quoteId: string;
  fetchedAt: number;
}

export interface WallpaperPrefs {
  defaultMode: WallpaperMode;
  rotationInterval: WallpaperRotationInterval;
  enabledCategories: WallpaperCategory[];
  autoUpdate: boolean;
  paused: boolean;
  showZoomHints: boolean;
  currentWallpaperId: string | null;
  lastRemoteRefreshAt: number;
  updatedAt: number;
}

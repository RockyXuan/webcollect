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

export type WallpaperProvider =
  | "curated"
  | "fallback"
  | "wikimedia"
  | "nasa"
  | "esa"
  | "usgs"
  | "noaa"
  | "pexels"
  | "pixabay"
  | "tmdb"
  | "met"
  | "artic"
  | "smithsonian";

export type WallpaperQuality = "curated" | "award" | "featured" | "remote";

export type WallpaperMode = "wallpaper" | "collection";

export type WallpaperThemeMode = "auto" | "nature" | "cinema" | "tv" | "pets" | "art" | "space";

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
  provider?: WallpaperProvider;
  tags?: string[];
  attribution?: string;
  modes?: WallpaperThemeMode[];
}

export interface WallpaperPrefs {
  defaultMode: WallpaperMode;
  themeMode: WallpaperThemeMode;
  rotationInterval: WallpaperRotationInterval;
  enabledCategories: WallpaperCategory[];
  autoUpdate: boolean;
  paused: boolean;
  showZoomHints: boolean;
  currentWallpaperId: string | null;
  currentQuoteId: string | null;
  recentQuoteIds: string[];
  recentAssetIds: string[];
  recentMediaIds: string[];
  lastRemoteRefreshAt: number;
  updatedAt: number;
}

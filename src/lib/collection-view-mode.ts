import type { CollectionViewMode } from "@/components/mindmap/types";

export const COLLECTION_VIEW_MODE_KEY = "webcollect_collection_view_mode";

export function readCollectionViewMode(): CollectionViewMode {
  if (typeof window === "undefined") return "classic";

  try {
    const value = window.localStorage.getItem(COLLECTION_VIEW_MODE_KEY);
    return value === "classic" || value === "mindmap" ? value : "classic";
  } catch {
    return "classic";
  }
}

export function writeCollectionViewMode(mode: CollectionViewMode): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COLLECTION_VIEW_MODE_KEY, mode);
  } catch {
    // This preference is only a local UI convenience. The app remains usable
    // in classic mode when synchronous browser storage is unavailable.
  }
}

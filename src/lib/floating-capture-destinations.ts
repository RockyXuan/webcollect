import type { Category, CollectionSection } from "./types";
import { isChromeExtension } from "./platform";

export const CAPTURE_DESTINATIONS_KEY = "webcollect.capture.destinations";

export interface CaptureDestinationCache {
  updatedAt: number;
  activeSectionId?: string;
  sections: Array<Pick<CollectionSection, "id" | "name" | "order">>;
  categories: Array<Pick<Category, "id" | "name" | "icon" | "color" | "order" | "parentId" | "sectionId" | "isParent">>;
}

type DestinationCategory = CaptureDestinationCache["categories"][number];
type DestinationSection = CaptureDestinationCache["sections"][number];

function hasExtensionStorage(): boolean {
  return isChromeExtension()
    && typeof chrome !== "undefined"
    && !!chrome.storage?.local;
}

function setChromeStorage(items: Record<string, unknown>): Promise<void> {
  if (!hasExtensionStorage()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function categorySort(a: DestinationCategory, b: DestinationCategory): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

function sectionSort(a: DestinationSection, b: DestinationSection): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

export function buildCaptureDestinationCache(
  sections: CollectionSection[],
  categories: Category[],
  activeSectionId: string,
  now = Date.now()
): CaptureDestinationCache {
  const sectionItems = sections
    .map((section) => ({ id: section.id, name: section.name, order: section.order }))
    .sort(sectionSort);
  const resolvedActiveSectionId = sectionItems.some((section) => section.id === activeSectionId)
    ? activeSectionId
    : sectionItems[0]?.id || activeSectionId || "section-default";

  return {
    updatedAt: now,
    activeSectionId: resolvedActiveSectionId,
    sections: [...sectionItems].sort((a, b) => {
      if (a.id === resolvedActiveSectionId) return -1;
      if (b.id === resolvedActiveSectionId) return 1;
      return sectionSort(a, b);
    }),
    categories: categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        order: category.order,
        parentId: category.parentId,
        sectionId: category.sectionId,
        isParent: category.isParent,
      }))
      .sort(categorySort),
  };
}

export async function publishCaptureDestinationCacheForWorkspace(
  sections: CollectionSection[],
  categories: Category[],
  activeSectionId: string
): Promise<void> {
  if (!hasExtensionStorage()) return;
  await setChromeStorage({
    [CAPTURE_DESTINATIONS_KEY]: buildCaptureDestinationCache(sections, categories, activeSectionId),
  });
}

import type { Category, CollectionSection, WebCard } from "./types";
import { isChromeExtension } from "./platform";
import { useAppStore } from "./store";

export const CAPTURE_QUEUE_KEY = "webcollect.capture.queue";
export const CAPTURE_PREFS_KEY = "webcollect.capture.prefs";
export const CAPTURE_DESTINATIONS_KEY = "webcollect.capture.destinations";

export type CaptureSourceType = "floating-button" | "hover-link" | "selection" | "current-page" | "context-menu";
export type CaptureQueueStatus = "pending" | "imported" | "failed";
export type FloatingCaptureMascot = "chipmunk" | "otter";

export interface CaptureDestination {
  sectionId?: string;
  parentCategoryId?: string;
  groupId?: string;
  sectionName?: string;
  parentCategoryName?: string;
  groupName?: string;
}

export interface CaptureDraft {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  favicon?: string;
  sourceType: CaptureSourceType;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  destination?: CaptureDestination;
}

export interface CaptureQueueItem {
  id: string;
  draft: CaptureDraft;
  createdAt: number;
  updatedAt: number;
  status: CaptureQueueStatus;
  error?: string;
}

export interface FloatingCapturePrefs {
  enabled: boolean;
  buttonEnabled: boolean;
  hoverEnabled: boolean;
  allLinksHoverEnabled: boolean;
  contextMenuEnabled: boolean;
  mascot: FloatingCaptureMascot;
  pauseUntil: number | null;
  disabledHosts: string[];
}

export interface CaptureDestinationCache {
  updatedAt: number;
  activeSectionId?: string;
  sections: Array<Pick<CollectionSection, "id" | "name" | "order">>;
  categories: Array<Pick<Category, "id" | "name" | "icon" | "color" | "order" | "parentId" | "sectionId" | "isParent">>;
}

type DestinationCategory = CaptureDestinationCache["categories"][number];
type DestinationSection = CaptureDestinationCache["sections"][number];

export const DEFAULT_FLOATING_CAPTURE_PREFS: FloatingCapturePrefs = {
  enabled: true,
  buttonEnabled: true,
  hoverEnabled: true,
  allLinksHoverEnabled: false,
  contextMenuEnabled: true,
  mascot: "chipmunk",
  pauseUntil: null,
  disabledHosts: [],
};

function hasExtensionStorage(): boolean {
  return isChromeExtension()
    && typeof chrome !== "undefined"
    && !!chrome.storage?.local;
}

function getChromeStorage<T>(key: string, fallback: T): Promise<T> {
  if (!hasExtensionStorage()) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        resolve(fallback);
        return;
      }
      resolve((result[key] as T | undefined) ?? fallback);
    });
  });
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

export function normalizeCaptureUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^(https?:\/\/|chrome:\/\/|edge:\/\/|about:)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

export function getFallbackFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return "";
  }
}

export async function getFloatingCapturePrefs(): Promise<FloatingCapturePrefs> {
  const stored = await getChromeStorage<Partial<FloatingCapturePrefs>>(CAPTURE_PREFS_KEY, {});
  return {
    ...DEFAULT_FLOATING_CAPTURE_PREFS,
    ...stored,
    mascot: stored.mascot === "otter" ? "otter" : "chipmunk",
    disabledHosts: Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [],
  };
}

export async function saveFloatingCapturePrefs(prefs: FloatingCapturePrefs): Promise<void> {
  await setChromeStorage({ [CAPTURE_PREFS_KEY]: prefs });
}

function normalizeDestinationName(value?: string): string {
  return value?.trim().toLocaleLowerCase() || "";
}

function buildChildCount(categories: DestinationCategory[]): Map<string, number> {
  const childCount = new Map<string, number>();
  for (const category of categories) {
    if (category.parentId) {
      childCount.set(category.parentId, (childCount.get(category.parentId) || 0) + 1);
    }
  }
  return childCount;
}

function categorySort(a: DestinationCategory, b: DestinationCategory): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

function sectionSort(a: DestinationSection, b: DestinationSection): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

function isParentCategory(category: DestinationCategory, childCount: Map<string, number>): boolean {
  return !category.parentId && (category.isParent === true || childCount.has(category.id));
}

function isGroupCategory(category: DestinationCategory, childCount: Map<string, number>): boolean {
  return !!category.parentId || (!category.isParent && !childCount.has(category.id));
}

function categorySectionId(category: DestinationCategory, categories: DestinationCategory[]): string {
  if (category.sectionId) return category.sectionId;
  if (category.parentId) {
    return categories.find((item) => item.id === category.parentId)?.sectionId || "section-default";
  }
  return "section-default";
}

function findSectionIdByName(sections: DestinationSection[], name?: string): string | undefined {
  const normalized = normalizeDestinationName(name);
  if (!normalized) return undefined;
  return sections.find((section) => normalizeDestinationName(section.name) === normalized)?.id;
}

function pickCategoryInSection(
  candidates: DestinationCategory[],
  categories: DestinationCategory[],
  sectionId?: string
): DestinationCategory | undefined {
  const sorted = [...candidates].sort(categorySort);
  if (!sectionId) return sorted[0];
  return sorted.find((category) => categorySectionId(category, categories) === sectionId) || sorted[0];
}

function findParentByName(
  categories: DestinationCategory[],
  parentName?: string,
  sectionId?: string
): DestinationCategory | undefined {
  const normalizedParent = normalizeDestinationName(parentName);
  if (!normalizedParent) return undefined;
  const childCount = buildChildCount(categories);
  return pickCategoryInSection(
    categories.filter(
      (category) =>
        isParentCategory(category, childCount) && normalizeDestinationName(category.name) === normalizedParent
    ),
    categories,
    sectionId
  );
}

function findGroupByName(
  categories: DestinationCategory[],
  groupName?: string,
  parentName?: string,
  sectionId?: string
): DestinationCategory | undefined {
  const normalizedGroup = normalizeDestinationName(groupName);
  if (!normalizedGroup) return undefined;
  const normalizedParent = normalizeDestinationName(parentName);
  const childCount = buildChildCount(categories);
  const candidates = categories.filter((category) => {
    if (!isGroupCategory(category, childCount)) return false;
    if (normalizeDestinationName(category.name) !== normalizedGroup) return false;
    if (sectionId && categorySectionId(category, categories) !== sectionId) return false;
    if (!normalizedParent) return true;
    const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : undefined;
    return normalizeDestinationName(parent?.name) === normalizedParent;
  });
  return [...candidates].sort(categorySort)[0];
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

export async function publishCaptureDestinationCache(): Promise<void> {
  if (!hasExtensionStorage()) return;
  const { sections, categories, activeSectionId } = useAppStore.getState();
  await setChromeStorage({
    [CAPTURE_DESTINATIONS_KEY]: buildCaptureDestinationCache(sections, categories, activeSectionId),
  });
}

export function resolveCaptureTargetCategoryId(
  draft: CaptureDraft,
  categories: Category[],
  sections: CollectionSection[],
  activeSectionId: string
): string | null {
  const destination = draft.destination;
  const childCount = buildChildCount(categories);
  const sectionItems = sections.map((section) => ({ id: section.id, name: section.name, order: section.order }));
  const knownSectionIds = new Set(sectionItems.map((section) => section.id));
  const fallbackSectionId = knownSectionIds.has(activeSectionId)
    ? activeSectionId
    : sectionItems.sort(sectionSort)[0]?.id || activeSectionId || "section-default";

  const groupById = destination?.groupId
    ? categories.find((category) => category.id === destination.groupId)
    : undefined;
  if (groupById && isGroupCategory(groupById, childCount)) {
    return groupById.id;
  }

  const parentById = destination?.parentCategoryId
    ? categories.find((category) => category.id === destination.parentCategoryId)
    : undefined;

  let targetSectionId = destination?.sectionId && knownSectionIds.has(destination.sectionId)
    ? destination.sectionId
    : undefined;
  targetSectionId ||= findSectionIdByName(sectionItems, destination?.sectionName);
  targetSectionId ||= groupById ? categorySectionId(groupById, categories) : undefined;
  targetSectionId ||= parentById ? categorySectionId(parentById, categories) : undefined;

  const namedParentForSection = !targetSectionId
    ? findParentByName(categories, destination?.parentCategoryName)
    : undefined;
  targetSectionId ||= namedParentForSection ? categorySectionId(namedParentForSection, categories) : undefined;

  const namedGroupForSection = !targetSectionId
    ? findGroupByName(categories, destination?.groupName, destination?.parentCategoryName)
    : undefined;
  targetSectionId ||= namedGroupForSection ? categorySectionId(namedGroupForSection, categories) : undefined;
  targetSectionId ||= fallbackSectionId;

  const namedGroup = findGroupByName(
    categories,
    destination?.groupName,
    destination?.parentCategoryName,
    targetSectionId
  );
  if (namedGroup) return namedGroup.id;

  const parentTarget = parentById && categorySectionId(parentById, categories) === targetSectionId
    ? parentById
    : findParentByName(categories, destination?.parentCategoryName, targetSectionId);
  if (parentTarget) {
    const children = categories
      .filter((category) => category.parentId === parentTarget.id)
      .sort(categorySort);
    if (children[0]) return children[0].id;
  }

  const sectionInbox = categories.find(
    (category) =>
      categorySectionId(category, categories) === targetSectionId &&
      normalizeDestinationName(category.name) === "收集箱"
  );
  if (sectionInbox) return sectionInbox.id;

  const defaultInbox = categories.find((category) => category.id === "cat-inbox");
  if (defaultInbox) return defaultInbox.id;

  return categories
    .filter((category) => !category.isParent)
    .sort(categorySort)[0]?.id || null;
}

export async function drainFloatingCaptureQueue(): Promise<{ imported: number; skipped: number; failed: number }> {
  if (!hasExtensionStorage()) return { imported: 0, skipped: 0, failed: 0 };

  const queue = await getChromeStorage<CaptureQueueItem[]>(CAPTURE_QUEUE_KEY, []);
  const pending = queue.filter((item) => item.status === "pending");
  if (pending.length === 0) return { imported: 0, skipped: 0, failed: 0 };

  const app = useAppStore.getState();
  if (app.isLoading || app.categories.length === 0) {
    return { imported: 0, skipped: 0, failed: 0 };
  }
  const cards = [...app.cards];
  const categories = [...app.categories];
  const sections = [...app.sections];
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const now = Date.now();

  for (const item of pending) {
    const normalizedUrl = normalizeCaptureUrl(item.draft.url);
    const title = item.draft.title.trim();
    if (!normalizedUrl || !title) {
      item.status = "failed";
      item.error = "Missing required title or URL";
      item.updatedAt = Date.now();
      failed += 1;
      continue;
    }

    const alreadyExists = cards.some((card) => normalizeCaptureUrl(card.url) === normalizedUrl);
    if (alreadyExists) {
      item.status = "imported";
      item.error = "Duplicate URL skipped";
      item.updatedAt = Date.now();
      skipped += 1;
      continue;
    }

    const categoryId = resolveCaptureTargetCategoryId(item.draft, categories, sections, app.activeSectionId);
    if (!categoryId) {
      item.status = "failed";
      item.error = "No available target category";
      item.updatedAt = Date.now();
      failed += 1;
      continue;
    }

    const categoryCards = cards.filter((card) => card.categoryId === categoryId);
    const description = item.draft.description?.trim() || "";
    const nextCard: WebCard = {
      id: `card-${now}-${Math.random().toString(36).slice(2, 9)}`,
      url: normalizedUrl,
      title,
      shortDesc: description.slice(0, 48),
      fullDesc: description,
      note: "",
      abbreviation: "",
      imageUrl: item.draft.favicon || item.draft.imageUrl || getFallbackFavicon(normalizedUrl),
      categoryId,
      order: categoryCards.length > 0 ? Math.max(...categoryCards.map((card) => card.order)) + 1 : 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await useAppStore.getState().addCard(nextCard);
    cards.push(nextCard);
    item.status = "imported";
    item.error = undefined;
    item.updatedAt = Date.now();
    imported += 1;
  }

  await setChromeStorage({ [CAPTURE_QUEUE_KEY]: queue });
  if (imported > 0) {
    await publishCaptureDestinationCache();
  }
  return { imported, skipped, failed };
}

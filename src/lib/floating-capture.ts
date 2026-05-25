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
  sections: Array<Pick<CollectionSection, "id" | "name" | "order">>;
  categories: Array<Pick<Category, "id" | "name" | "icon" | "color" | "order" | "parentId" | "sectionId" | "isParent">>;
}

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

export async function publishCaptureDestinationCache(): Promise<void> {
  if (!hasExtensionStorage()) return;
  const { sections, categories } = useAppStore.getState();
  const cache: CaptureDestinationCache = {
    updatedAt: Date.now(),
    sections: sections
      .map((section) => ({ id: section.id, name: section.name, order: section.order }))
      .sort((a, b) => a.order - b.order),
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
      .sort((a, b) => a.order - b.order),
  };
  await setChromeStorage({ [CAPTURE_DESTINATIONS_KEY]: cache });
}

function resolveCaptureTargetCategoryId(
  draft: CaptureDraft,
  categories: Category[],
  sections: CollectionSection[],
  activeSectionId: string
): string | null {
  const destination = draft.destination;
  if (destination?.groupId && categories.some((category) => category.id === destination.groupId)) {
    return destination.groupId;
  }

  const targetSectionId = destination?.sectionId && sections.some((section) => section.id === destination.sectionId)
    ? destination.sectionId
    : activeSectionId;

  if (destination?.parentCategoryId) {
    const children = categories
      .filter((category) => category.parentId === destination.parentCategoryId)
      .sort((a, b) => a.order - b.order);
    if (children[0]) return children[0].id;
  }

  const sectionInbox = categories.find(
    (category) =>
      (category.sectionId || "section-default") === targetSectionId &&
      category.name.trim() === "收集箱"
  );
  if (sectionInbox) return sectionInbox.id;

  const defaultInbox = categories.find((category) => category.id === "cat-inbox");
  if (defaultInbox) return defaultInbox.id;

  return categories
    .filter((category) => !category.isParent)
    .sort((a, b) => a.order - b.order)[0]?.id || null;
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

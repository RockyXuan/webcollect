import type { Category, CollectionSection, WebCard } from "./types";
import { saveCards, saveCategories, saveSections } from "./db";
import { localizeDescriptionText } from "./description-translation";
import { createLocalDataSnapshot } from "./local-snapshots";
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
  createSectionName?: string;
  createParentCategoryName?: string;
  createGroupName?: string;
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
  resolvedDestinationPath?: string;
  destinationError?: string;
}

export interface FloatingCapturePrefs {
  enabled: boolean;
  buttonEnabled: boolean;
  hoverEnabled: boolean;
  allLinksHoverEnabled: boolean;
  contextMenuEnabled: boolean;
  mascot: FloatingCaptureMascot;
  sizeScale: number;
  pauseUntil: number | null;
  disabledHosts: string[];
  hiddenByUserAt?: number | null;
  recoveredAt?: number | null;
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
  sizeScale: 0.67,
  pauseUntil: null,
  disabledHosts: [],
  hiddenByUserAt: null,
  recoveredAt: null,
};

export function normalizeFloatingCapturePrefs(
  stored: Partial<FloatingCapturePrefs> | null | undefined,
  now = Date.now()
): FloatingCapturePrefs {
  const raw = stored || {};
  const legacyGlobalHidden = (
    raw.enabled === false || raw.buttonEnabled === false
  ) && typeof raw.hiddenByUserAt !== "number";
  const pauseUntil = typeof raw.pauseUntil === "number" && raw.pauseUntil > now
    ? raw.pauseUntil
    : null;
  const disabledHosts = Array.isArray(raw.disabledHosts)
    ? Array.from(new Set(raw.disabledHosts.filter((host): host is string => typeof host === "string" && host.trim().length > 0)))
    : [];
  const sizeScale = typeof raw.sizeScale === "number" && Number.isFinite(raw.sizeScale)
    ? Math.min(1.15, Math.max(0.55, raw.sizeScale))
    : DEFAULT_FLOATING_CAPTURE_PREFS.sizeScale;

  return {
    ...DEFAULT_FLOATING_CAPTURE_PREFS,
    ...raw,
    enabled: legacyGlobalHidden ? true : raw.enabled !== false,
    buttonEnabled: legacyGlobalHidden ? true : raw.buttonEnabled !== false,
    hoverEnabled: raw.hoverEnabled !== false,
    allLinksHoverEnabled: raw.allLinksHoverEnabled === true,
    contextMenuEnabled: raw.contextMenuEnabled !== false,
    mascot: raw.mascot === "otter" ? "otter" : "chipmunk",
    sizeScale,
    pauseUntil,
    disabledHosts,
    hiddenByUserAt: typeof raw.hiddenByUserAt === "number" ? raw.hiddenByUserAt : null,
    recoveredAt: legacyGlobalHidden ? now : (typeof raw.recoveredAt === "number" ? raw.recoveredAt : null),
  };
}

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

export function mergeCaptureQueueReplacement(
  currentQueue: CaptureQueueItem[],
  previouslyReadIds: string[],
  replacementQueue: CaptureQueueItem[]
): CaptureQueueItem[] {
  const previousIds = new Set(previouslyReadIds);
  const replacementIds = new Set(replacementQueue.map((item) => item.id));
  return [
    ...replacementQueue,
    ...currentQueue.filter((item) => !previousIds.has(item.id) && !replacementIds.has(item.id)),
  ];
}

function replaceCaptureQueueThroughBackground(
  previouslyReadQueue: CaptureQueueItem[],
  replacementQueue: CaptureQueueItem[]
): Promise<void> {
  if (!hasExtensionStorage() || !chrome.runtime?.sendMessage) {
    return setChromeStorage({ [CAPTURE_QUEUE_KEY]: replacementQueue });
  }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: "CAPTURE_QUEUE_REPLACE",
      previouslyReadIds: previouslyReadQueue.map((item) => item.id),
      queue: replacementQueue,
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.error || "Failed to replace capture queue"));
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
  return normalizeFloatingCapturePrefs(stored);
}

export async function saveFloatingCapturePrefs(prefs: FloatingCapturePrefs): Promise<void> {
  const next = normalizeFloatingCapturePrefs({
    ...prefs,
    hiddenByUserAt: (prefs.enabled === false || prefs.buttonEnabled === false)
      ? prefs.hiddenByUserAt ?? Date.now()
      : prefs.hiddenByUserAt ?? null,
  });
  await setChromeStorage({ [CAPTURE_PREFS_KEY]: next });
}

function normalizeDestinationName(value?: string): string {
  return value?.trim().toLocaleLowerCase() || "";
}

function trimDestinationName(value?: string): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function hasExplicitGroupDestination(destination?: CaptureDestination): boolean {
  return Boolean(destination?.groupId || trimDestinationName(destination?.groupName));
}

function hasExplicitParentDestination(destination?: CaptureDestination): boolean {
  return Boolean(destination?.parentCategoryId || trimDestinationName(destination?.parentCategoryName));
}

function describeDestinationPath(
  categoryId: string,
  categories: DestinationCategory[],
  sections: DestinationSection[]
): string {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return categoryId;
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : undefined;
  const sectionId = categorySectionId(category, categories);
  const section = sections.find((item) => item.id === sectionId);
  return [section?.name, parent?.name, category.name].filter(Boolean).join(" / ") || category.name;
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

function nextOrder(items: Array<{ order: number }>): number {
  return items.length > 0 ? Math.max(...items.map((item) => item.order)) + 1 : 0;
}

function makeCaptureId(prefix: string, now: number, index: number): string {
  return `${prefix}-capture-${now}-${index}`;
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

function findSectionByName(sections: CollectionSection[], name?: string): CollectionSection | undefined {
  const normalized = normalizeDestinationName(name);
  if (!normalized) return undefined;
  return sections.find((section) => normalizeDestinationName(section.name) === normalized);
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

  if (hasExplicitGroupDestination(destination)) {
    return null;
  }

  const parentTarget = parentById && categorySectionId(parentById, categories) === targetSectionId
    ? parentById
    : findParentByName(categories, destination?.parentCategoryName, targetSectionId);
  if (parentTarget) {
    const children = categories
      .filter((category) => category.parentId === parentTarget.id)
      .sort(categorySort);
    if (children[0]) return children[0].id;
  }

  if (hasExplicitParentDestination(destination)) {
    return null;
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

export interface CaptureTargetResolution {
  categoryId: string | null;
  categories: Category[];
  sections: CollectionSection[];
  changed: boolean;
}

export interface CaptureQueueWorkspace {
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
  activeSectionId: string;
}

export interface CaptureQueueDrainOptions {
  now?: () => number;
  randomId?: () => string;
}

export interface CaptureQueueDrainResult extends CaptureQueueWorkspace {
  queue: CaptureQueueItem[];
  imported: number;
  skipped: number;
  failed: number;
  changed: boolean;
}

export interface CaptureQueueRepairResult extends CaptureQueueWorkspace {
  queue: CaptureQueueItem[];
  repaired: number;
  changed: boolean;
}

function hasCreateDestination(destination?: CaptureDestination): boolean {
  return Boolean(
    trimDestinationName(destination?.createSectionName) ||
    trimDestinationName(destination?.createParentCategoryName) ||
    trimDestinationName(destination?.createGroupName)
  );
}

function categorySectionMatches(
  category: DestinationCategory,
  categories: DestinationCategory[],
  sectionId: string
): boolean {
  return categorySectionId(category, categories) === sectionId;
}

function findParentByIdOrName(
  categories: Category[],
  sectionId: string,
  parentId?: string,
  parentName?: string
): Category | undefined {
  const childCount = buildChildCount(categories);
  const byId = parentId
    ? categories.find((category) =>
      category.id === parentId &&
      isParentCategory(category, childCount) &&
      categorySectionMatches(category, categories, sectionId)
    )
    : undefined;
  if (byId) return byId;
  return findParentByName(categories, parentName, sectionId) as Category | undefined;
}

function findGroupByIdOrName(
  categories: Category[],
  sectionId: string,
  groupId?: string,
  groupName?: string,
  parentName?: string
): Category | undefined {
  const childCount = buildChildCount(categories);
  const byId = groupId
    ? categories.find((category) =>
      category.id === groupId &&
      isGroupCategory(category, childCount) &&
      categorySectionMatches(category, categories, sectionId)
    )
    : undefined;
  if (byId) return byId;
  return findGroupByName(categories, groupName, parentName, sectionId) as Category | undefined;
}

export function resolveOrCreateCaptureTargetCategory(
  draft: CaptureDraft,
  categories: Category[],
  sections: CollectionSection[],
  activeSectionId: string,
  now = Date.now()
): CaptureTargetResolution {
  const destination = draft.destination;
  if (!hasCreateDestination(destination)) {
    return {
      categoryId: resolveCaptureTargetCategoryId(draft, categories, sections, activeSectionId),
      categories,
      sections,
      changed: false,
    };
  }

  let nextCategories = categories.map((category) => ({ ...category }));
  let nextSections = sections.map((section) => ({ ...section }));
  let changed = false;
  let createIndex = 0;
  const sectionIds = new Set(nextSections.map((section) => section.id));
  const fallbackSectionId = sectionIds.has(activeSectionId)
    ? activeSectionId
    : [...nextSections].sort(sectionSort)[0]?.id || activeSectionId || "section-default";

  const createSectionName = trimDestinationName(destination?.createSectionName);
  let targetSection = createSectionName ? findSectionByName(nextSections, createSectionName) : undefined;
  if (!targetSection && createSectionName) {
    targetSection = {
      id: makeCaptureId("section", now, createIndex++),
      name: createSectionName,
      order: nextOrder(nextSections),
      createdAt: now,
      updatedAt: now,
    };
    nextSections = [...nextSections, targetSection];
    changed = true;
  }

  if (!targetSection && destination?.sectionId && sectionIds.has(destination.sectionId)) {
    targetSection = nextSections.find((section) => section.id === destination.sectionId);
  }
  targetSection ||= findSectionByName(nextSections, destination?.sectionName);
  targetSection ||= nextSections.find((section) => section.id === fallbackSectionId);

  const targetSectionId = targetSection?.id || fallbackSectionId;
  const createParentName = trimDestinationName(destination?.createParentCategoryName);
  let parentTarget = createParentName
    ? findParentByName(nextCategories, createParentName, targetSectionId) as Category | undefined
    : findParentByIdOrName(nextCategories, targetSectionId, destination?.parentCategoryId, destination?.parentCategoryName);

  if (!parentTarget && createParentName) {
    parentTarget = {
      id: makeCaptureId("cat", now, createIndex++),
      name: createParentName,
      icon: "folder",
      color: "#64748b",
      order: nextOrder(nextCategories.filter((category) => !category.parentId && categorySectionId(category, nextCategories) === targetSectionId)),
      createdAt: now,
      updatedAt: now,
      sectionId: targetSectionId,
      isParent: true,
    };
    nextCategories = [...nextCategories, parentTarget];
    changed = true;
  } else if (parentTarget && createParentName && !parentTarget.isParent) {
    nextCategories = nextCategories.map((category) =>
      category.id === parentTarget!.id ? { ...category, isParent: true, updatedAt: now } : category
    );
    parentTarget = nextCategories.find((category) => category.id === parentTarget!.id);
    changed = true;
  }

  const createGroupName = trimDestinationName(destination?.createGroupName);
  let groupTarget = createGroupName
    ? findGroupByName(nextCategories, createGroupName, parentTarget?.name, targetSectionId) as Category | undefined
    : findGroupByIdOrName(
      nextCategories,
      targetSectionId,
      destination?.groupId,
      destination?.groupName,
      destination?.parentCategoryName
    );

  if (!groupTarget && createGroupName) {
    groupTarget = {
      id: makeCaptureId("cat", now, createIndex++),
      name: createGroupName,
      icon: "bookmark",
      color: "#3b82f6",
      order: nextOrder(nextCategories.filter((category) =>
        parentTarget
          ? category.parentId === parentTarget.id
          : !category.parentId && categorySectionId(category, nextCategories) === targetSectionId
      )),
      createdAt: now,
      updatedAt: now,
      sectionId: targetSectionId,
      parentId: parentTarget?.id,
    };
    nextCategories = [...nextCategories, groupTarget];
    changed = true;
  }

  if (groupTarget) {
    return { categoryId: groupTarget.id, categories: nextCategories, sections: nextSections, changed };
  }

  if (parentTarget) {
    let parentInbox = nextCategories
      .filter((category) => category.parentId === parentTarget!.id)
      .sort(categorySort)[0];
    if (!parentInbox) {
      parentInbox = {
        id: makeCaptureId("cat", now, createIndex++),
        name: "收集箱",
        icon: "inbox",
        color: "#888888",
        order: 0,
        createdAt: now,
        updatedAt: now,
        sectionId: targetSectionId,
        parentId: parentTarget.id,
      };
      nextCategories = [...nextCategories, parentInbox];
      changed = true;
    }
    return { categoryId: parentInbox.id, categories: nextCategories, sections: nextSections, changed };
  }

  let sectionInbox = nextCategories.find(
    (category) =>
      !category.parentId &&
      categorySectionId(category, nextCategories) === targetSectionId &&
      normalizeDestinationName(category.name) === "收集箱"
  );
  if (!sectionInbox) {
    sectionInbox = {
      id: targetSectionId === "section-default" ? "cat-inbox" : makeCaptureId("cat", now, createIndex++),
      name: "收集箱",
      icon: "inbox",
      color: "#888888",
      order: 99,
      createdAt: now,
      updatedAt: now,
      sectionId: targetSectionId,
    };
    nextCategories = [...nextCategories, sectionInbox];
    changed = true;
  }

  return { categoryId: sectionInbox.id, categories: nextCategories, sections: nextSections, changed };
}

function cloneCaptureQueue(queue: CaptureQueueItem[]): CaptureQueueItem[] {
  return queue.map((item) => ({
    ...item,
    draft: {
      ...item.draft,
      destination: item.draft.destination ? { ...item.draft.destination } : undefined,
    },
  }));
}

function nextCaptureTimestamp(options?: CaptureQueueDrainOptions): number {
  return options?.now?.() ?? Date.now();
}

function nextCaptureRandomId(options?: CaptureQueueDrainOptions): string {
  return options?.randomId?.() ?? Math.random().toString(36).slice(2, 9);
}

function isInboxLikeCategory(categoryId: string, categories: Category[]): boolean {
  const category = categories.find((item) => item.id === categoryId);
  return normalizeDestinationName(category?.name) === "收集箱";
}

export function drainCaptureQueueItemsForWorkspace(
  inputQueue: CaptureQueueItem[],
  workspace: CaptureQueueWorkspace,
  options?: CaptureQueueDrainOptions
): CaptureQueueDrainResult {
  const queue = cloneCaptureQueue(inputQueue);
  const cards = workspace.cards.map((card) => ({ ...card }));
  let categories = workspace.categories.map((category) => ({ ...category }));
  let sections = workspace.sections.map((section) => ({ ...section }));
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let changed = false;

  for (const item of queue.filter((queueItem) => queueItem.status === "pending")) {
    const normalizedUrl = normalizeCaptureUrl(item.draft.url);
    const title = item.draft.title.trim();
    if (!normalizedUrl || !title) {
      item.status = "failed";
      item.error = "Missing required title or URL";
      item.updatedAt = nextCaptureTimestamp(options);
      failed += 1;
      changed = true;
      continue;
    }

    const alreadyExists = cards.some((card) => normalizeCaptureUrl(card.url) === normalizedUrl);
    if (alreadyExists) {
      item.status = "imported";
      item.error = "Duplicate URL skipped";
      item.updatedAt = nextCaptureTimestamp(options);
      skipped += 1;
      changed = true;
      continue;
    }

    const target = resolveOrCreateCaptureTargetCategory(
      item.draft,
      categories,
      sections,
      workspace.activeSectionId,
      nextCaptureTimestamp(options)
    );
    const categoryId = target.categoryId;
    if (!categoryId) {
      item.status = "failed";
      item.error = "Selected WebCollect destination was not found";
      item.destinationError = item.error;
      item.updatedAt = nextCaptureTimestamp(options);
      failed += 1;
      changed = true;
      continue;
    }

    if (target.changed) {
      categories = target.categories;
      sections = target.sections;
      changed = true;
    }

    const categoryCards = cards.filter((card) => card.categoryId === categoryId);
    const description = localizeDescriptionText(item.draft.description?.trim() || "", {
      title,
      url: normalizedUrl,
    });
    const createdAt = nextCaptureTimestamp(options);
    const nextCard: WebCard = {
      id: `card-${createdAt}-${nextCaptureRandomId(options)}`,
      url: normalizedUrl,
      title,
      shortDesc: description.slice(0, 48),
      fullDesc: description,
      note: "",
      abbreviation: "",
      imageUrl: item.draft.favicon || item.draft.imageUrl || getFallbackFavicon(normalizedUrl),
      categoryId,
      order: categoryCards.length > 0 ? Math.max(...categoryCards.map((card) => card.order)) + 1 : 0,
      createdAt,
      updatedAt: createdAt,
    };

    cards.push(nextCard);
    item.status = "imported";
    item.error = undefined;
    item.destinationError = undefined;
    item.resolvedDestinationPath = describeDestinationPath(categoryId, categories, sections);
    item.updatedAt = nextCaptureTimestamp(options);
    imported += 1;
    changed = true;
  }

  return {
    cards,
    categories,
    sections,
    activeSectionId: workspace.activeSectionId,
    queue,
    imported,
    skipped,
    failed,
    changed,
  };
}

export function repairVerifiedCaptureMisfiledCardsFromQueue(
  inputQueue: CaptureQueueItem[],
  workspace: CaptureQueueWorkspace,
  options?: Pick<CaptureQueueDrainOptions, "now">
): CaptureQueueRepairResult {
  const queue = cloneCaptureQueue(inputQueue);
  let cards = workspace.cards.map((card) => ({ ...card }));
  let categories = workspace.categories.map((category) => ({ ...category }));
  let sections = workspace.sections.map((section) => ({ ...section }));
  let repaired = 0;
  let changed = false;

  for (const item of queue) {
    if (item.status !== "imported" || item.destinationError || !item.draft.destination) continue;
    const normalizedUrl = normalizeCaptureUrl(item.draft.url);
    if (!normalizedUrl) continue;
    const hasMisfiledInboxCard = cards.some(
      (card) => normalizeCaptureUrl(card.url) === normalizedUrl && isInboxLikeCategory(card.categoryId, categories)
    );
    if (!hasMisfiledInboxCard) continue;

    const target = resolveOrCreateCaptureTargetCategory(
      item.draft,
      categories,
      sections,
      workspace.activeSectionId,
      options?.now?.() ?? Date.now()
    );
    if (!target.categoryId) continue;

    if (target.changed) {
      categories = target.categories;
      sections = target.sections;
      changed = true;
    }

    const targetCategoryId = target.categoryId;
    const targetCards = cards.filter((card) => card.categoryId === targetCategoryId);
    let nextOrder = targetCards.length > 0 ? Math.max(...targetCards.map((card) => card.order)) + 1 : 0;
    let itemRepaired = 0;
    cards = cards.map((card) => {
      if (normalizeCaptureUrl(card.url) !== normalizedUrl) return card;
      if (card.categoryId === targetCategoryId) return card;
      if (!isInboxLikeCategory(card.categoryId, categories)) return card;
      const next = {
        ...card,
        categoryId: targetCategoryId,
        order: nextOrder,
        updatedAt: options?.now?.() ?? Date.now(),
      };
      nextOrder += 1;
      repaired += 1;
      itemRepaired += 1;
      changed = true;
      return next;
    });

    if (itemRepaired > 0) {
      item.resolvedDestinationPath = describeDestinationPath(targetCategoryId, categories, sections);
      item.updatedAt = options?.now?.() ?? Date.now();
    }
  }

  return {
    cards,
    categories,
    sections,
    activeSectionId: workspace.activeSectionId,
    queue,
    repaired,
    changed,
  };
}

export async function drainFloatingCaptureQueue(): Promise<{ imported: number; skipped: number; failed: number; repaired: number }> {
  if (!hasExtensionStorage()) return { imported: 0, skipped: 0, failed: 0, repaired: 0 };

  const queue = await getChromeStorage<CaptureQueueItem[]>(CAPTURE_QUEUE_KEY, []);
  const app = useAppStore.getState();
  if (app.isLoading || app.categories.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, repaired: 0 };
  }

  const drained = drainCaptureQueueItemsForWorkspace(queue, {
    cards: app.cards,
    categories: app.categories,
    sections: app.sections,
    activeSectionId: app.activeSectionId,
  });

  const repaired = repairVerifiedCaptureMisfiledCardsFromQueue(drained.queue, {
    cards: drained.cards,
    categories: drained.categories,
    sections: drained.sections,
    activeSectionId: drained.activeSectionId,
  });

  if (repaired.repaired > 0) {
    await createLocalDataSnapshot(
      "before-floating-capture-target-repair",
      "扩展收集错放修复前本地版本",
      { force: true }
    );
  }

  if (drained.changed || repaired.changed) {
    await Promise.all([
      saveSections(repaired.sections),
      saveCategories(repaired.categories),
      saveCards(repaired.cards),
    ]);
    useAppStore.setState({
      sections: repaired.sections,
      categories: repaired.categories,
      cards: repaired.cards,
    });
    await replaceCaptureQueueThroughBackground(queue, repaired.queue);
  }

  if (drained.imported > 0 || repaired.repaired > 0 || repaired.changed) {
    await publishCaptureDestinationCache();
  }
  return {
    imported: drained.imported,
    skipped: drained.skipped,
    failed: drained.failed,
    repaired: repaired.repaired,
  };
}

import localforage from "localforage";
import type { WebCard, Category, HiddenSite, LinkOpenMode, RecycleBinItem, CollectionSection, PinnedBookmarkItem, CategoryLayoutPreference } from "./types";
import { DEFAULT_SEARCH_ENGINE_ID, isSearchEngineId, type SearchEngineId } from "./search-engines";
import {
  DEFAULT_VISUAL_SCALE,
  VISUAL_SCALE_BASELINE_MIGRATION_KEY,
  clampVisualScale,
  shouldMigrateLegacyNinetyScale,
} from "./visual-scale";

localforage.config({
  name: "WebCollect",
  storeName: "webcollect_data",
});

const CARDS_KEY = "cards";
const CATEGORIES_KEY = "categories";
const INIT_KEY = "initialized";
const HIDDEN_SITES_KEY = "hiddenSites";
const SECTIONS_KEY = "collectionSections";
const ACTIVE_SECTION_KEY = "activeCollectionSectionId";
const WORKSPACE_RESET_AT_KEY = "currentWorkspaceResetAt";
const LOCAL_UPDATED_AT_KEY = "localSnapshotUpdatedAt";
const LOCAL_SYNCED_AT_KEY = "localSnapshotSyncedAt";
const LAST_SEEN_CLOUD_SNAPSHOT_UPDATED_AT_KEY = "lastSeenCloudSnapshotUpdatedAt";
const LOCAL_UPDATED_SIGNAL_KEY = "webcollect_local_snapshot_updated_at";
const SYNC_DIRTY_SETS_KEY = "syncDirtySets";
const DATA_SCHEMA_VERSION_KEY = "localDataSchemaVersion";

let localChangeSilenceDepth = 0;

export interface SyncDirtySets {
  cards: string[];
  categories: string[];
}

type SyncDirtyKind = "card" | "category";

function emptySyncDirtySets(): SyncDirtySets {
  return { cards: [], categories: [] };
}

function normalizeSyncDirtySets(value: unknown): SyncDirtySets {
  if (!value || typeof value !== "object") return emptySyncDirtySets();
  const raw = value as Partial<Record<keyof SyncDirtySets, unknown>>;
  return {
    cards: Array.isArray(raw.cards) ? [...new Set(raw.cards.filter((id): id is string => typeof id === "string" && id.length > 0))] : [],
    categories: Array.isArray(raw.categories) ? [...new Set(raw.categories.filter((id): id is string => typeof id === "string" && id.length > 0))] : [],
  };
}

function dirtyKeyForKind(kind: SyncDirtyKind): keyof SyncDirtySets {
  return kind === "card" ? "cards" : "categories";
}

function stableSnapshot(value: unknown): string {
  return JSON.stringify(value);
}

function changedItemIds<T extends { id: string }>(previous: T[], next: T[]): string[] {
  const previousById = new Map(previous.map((item) => [item.id, stableSnapshot(item)]));
  return next
    .filter((item) => previousById.get(item.id) !== stableSnapshot(item))
    .map((item) => item.id);
}

export async function getSyncDirtySets(): Promise<SyncDirtySets> {
  return normalizeSyncDirtySets(await localforage.getItem<unknown>(SYNC_DIRTY_SETS_KEY));
}

async function saveSyncDirtySets(dirtySets: SyncDirtySets): Promise<void> {
  await localforage.setItem(SYNC_DIRTY_SETS_KEY, normalizeSyncDirtySets(dirtySets));
}

export async function markDirty(kind: SyncDirtyKind, id: string): Promise<void> {
  await markDirtyIds(kind, [id]);
}

export async function markDirtyIds(kind: SyncDirtyKind, ids: string[]): Promise<void> {
  if (localChangeSilenceDepth > 0) return;
  const cleanIds = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (cleanIds.length === 0) return;
  const dirtySets = await getSyncDirtySets();
  const key = dirtyKeyForKind(kind);
  dirtySets[key] = [...new Set([...dirtySets[key], ...cleanIds])];
  await saveSyncDirtySets(dirtySets);
}

export async function clearSyncDirtyIds(input: Partial<SyncDirtySets>): Promise<void> {
  const dirtySets = await getSyncDirtySets();
  const cardIds = new Set(input.cards || []);
  const categoryIds = new Set(input.categories || []);
  if (cardIds.size > 0) {
    dirtySets.cards = dirtySets.cards.filter((id) => !cardIds.has(id));
  }
  if (categoryIds.size > 0) {
    dirtySets.categories = dirtySets.categories.filter((id) => !categoryIds.has(id));
  }
  await saveSyncDirtySets(dirtySets);
}

export async function clearSyncDirtySets(): Promise<void> {
  await saveSyncDirtySets(emptySyncDirtySets());
}

export async function getDataSchemaVersion(): Promise<number> {
  const value = await localforage.getItem<number>(DATA_SCHEMA_VERSION_KEY);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function saveDataSchemaVersion(version: number): Promise<void> {
  await localforage.setItem(DATA_SCHEMA_VERSION_KEY, version);
}

async function touchLocalSnapshot(): Promise<void> {
  if (localChangeSilenceDepth > 0) return;
  const previous = await getLocalSnapshotUpdatedAt();
  const timestamp = Math.max(Date.now(), previous + 1);
  await localforage.setItem(LOCAL_UPDATED_AT_KEY, timestamp);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOCAL_UPDATED_SIGNAL_KEY, String(timestamp));
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("webcollect:local-change", { detail: { timestamp } }));
  }
}

export async function markLocalSnapshotChanged(): Promise<void> {
  await touchLocalSnapshot();
}

export async function getLocalSnapshotUpdatedAt(): Promise<number> {
  const value = await localforage.getItem<number>(LOCAL_UPDATED_AT_KEY);
  return typeof value === "number" ? value : 0;
}

export async function getLocalSnapshotSyncedAt(): Promise<number> {
  const value = await localforage.getItem<number>(LOCAL_SYNCED_AT_KEY);
  return typeof value === "number" ? value : 0;
}

export async function saveLocalSnapshotSyncedAt(timestamp: number): Promise<void> {
  await localforage.setItem(LOCAL_SYNCED_AT_KEY, timestamp);
}

export async function getLastSeenCloudSnapshotUpdatedAt(): Promise<number> {
  const value = await localforage.getItem<number>(LAST_SEEN_CLOUD_SNAPSHOT_UPDATED_AT_KEY);
  return typeof value === "number" ? value : 0;
}

export async function saveLastSeenCloudSnapshotUpdatedAt(timestamp: number): Promise<void> {
  await localforage.setItem(LAST_SEEN_CLOUD_SNAPSHOT_UPDATED_AT_KEY, timestamp);
}

export async function getWorkspaceResetAt(): Promise<number> {
  const value = await localforage.getItem<number>(WORKSPACE_RESET_AT_KEY);
  return typeof value === "number" ? value : 0;
}

export async function saveWorkspaceResetAt(timestamp: number): Promise<void> {
  await localforage.setItem(WORKSPACE_RESET_AT_KEY, timestamp);
  await touchLocalSnapshot();
}

export async function withoutLocalChangeEvents<T>(fn: () => Promise<T>): Promise<T> {
  localChangeSilenceDepth += 1;
  try {
    return await fn();
  } finally {
    localChangeSilenceDepth -= 1;
  }
}

export async function getCards(): Promise<WebCard[]> {
  const cards = (await localforage.getItem<WebCard[]>(CARDS_KEY)) || [];
  return cards.sort((a, b) => a.order - b.order);
}

export async function saveCards(cards: WebCard[]): Promise<void> {
  const previous = (await localforage.getItem<WebCard[]>(CARDS_KEY)) || [];
  await localforage.setItem(CARDS_KEY, cards);
  await markDirtyIds("card", changedItemIds(previous, cards));
  await touchLocalSnapshot();
}

export async function addCard(card: WebCard): Promise<void> {
  const cards = await getCards();
  cards.push(card);
  await saveCards(cards);
}

export async function updateCard(updated: WebCard): Promise<void> {
  const cards = await getCards();
  const idx = cards.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cards[idx] = updated;
    await saveCards(cards);
  }
}

export async function deleteCard(id: string): Promise<void> {
  const cards = await getCards();
  await saveCards(cards.filter((c) => c.id !== id));
}

export async function getCategories(): Promise<Category[]> {
  const cats = (await localforage.getItem<Category[]>(CATEGORIES_KEY)) || [];
  return cats.sort((a, b) => a.order - b.order);
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const previous = (await localforage.getItem<Category[]>(CATEGORIES_KEY)) || [];
  await localforage.setItem(CATEGORIES_KEY, categories);
  await markDirtyIds("category", changedItemIds(previous, categories));
  await touchLocalSnapshot();
}

export async function addCategory(category: Category): Promise<void> {
  const cats = await getCategories();
  const now = Date.now();
  cats.push({
    ...category,
    createdAt: category.createdAt || now,
    updatedAt: category.updatedAt || now,
  });
  await saveCategories(cats);
}

export async function updateCategory(updated: Category): Promise<void> {
  const cats = await getCategories();
  const idx = cats.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cats[idx] = { ...updated, updatedAt: updated.updatedAt || Date.now() };
    await saveCategories(cats);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const cats = await getCategories();
  await saveCategories(cats.filter((c) => c.id !== id));
}

export async function isInitialized(): Promise<boolean> {
  const val = await localforage.getItem<boolean>(INIT_KEY);
  return val === true;
}

export async function setInitialized(): Promise<void> {
  await localforage.setItem(INIT_KEY, true);
}

export async function exportData(): Promise<{ cards: WebCard[]; categories: Category[] }> {
  const cards = await getCards();
  const categories = await getCategories();
  return { cards, categories };
}

export async function importData(data: { cards: WebCard[]; categories: Category[] }): Promise<void> {
  await saveCards(data.cards);
  await saveCategories(data.categories);
}

export async function getHiddenSites(): Promise<HiddenSite[]> {
  return (await localforage.getItem<HiddenSite[]>(HIDDEN_SITES_KEY)) || [];
}

export async function saveHiddenSites(sites: HiddenSite[]): Promise<void> {
  await localforage.setItem(HIDDEN_SITES_KEY, sites);
  await touchLocalSnapshot();
}

export async function getSections(): Promise<CollectionSection[]> {
  const sections = (await localforage.getItem<CollectionSection[]>(SECTIONS_KEY)) || [];
  return sections.sort((a, b) => a.order - b.order);
}

export async function saveSections(sections: CollectionSection[]): Promise<void> {
  await localforage.setItem(SECTIONS_KEY, sections);
  await touchLocalSnapshot();
}

export async function getActiveSectionId(): Promise<string | null> {
  return (await localforage.getItem<string>(ACTIVE_SECTION_KEY)) || null;
}

export async function saveActiveSectionId(sectionId: string): Promise<void> {
  await localforage.setItem(ACTIVE_SECTION_KEY, sectionId);
  await touchLocalSnapshot();
}

const PINNED_CATEGORIES_KEY = "pinnedCategoryIds";
const PINNED_BOOKMARK_ITEMS_KEY = "pinnedBookmarkItems";
const PINNED_BOOKMARK_ITEMS_UPDATED_AT_KEY = "pinnedBookmarkItemsUpdatedAt";

export async function getPinnedCategoryIds(): Promise<string[]> {
  return (await localforage.getItem<string[]>(PINNED_CATEGORIES_KEY)) || [];
}

export async function savePinnedCategoryIds(ids: string[]): Promise<void> {
  await localforage.setItem(PINNED_CATEGORIES_KEY, ids);
  await touchLocalSnapshot();
}

export async function getPinnedBookmarkItems(): Promise<PinnedBookmarkItem[]> {
  return (await localforage.getItem<PinnedBookmarkItem[]>(PINNED_BOOKMARK_ITEMS_KEY)) || [];
}

export async function getPinnedBookmarkItemsUpdatedAt(): Promise<number> {
  return (await localforage.getItem<number>(PINNED_BOOKMARK_ITEMS_UPDATED_AT_KEY)) || 0;
}

export async function savePinnedBookmarkItems(items: PinnedBookmarkItem[], updatedAt = Date.now()): Promise<void> {
  await localforage.setItem(PINNED_BOOKMARK_ITEMS_KEY, items);
  await localforage.setItem(PINNED_BOOKMARK_ITEMS_UPDATED_AT_KEY, updatedAt);
  await touchLocalSnapshot();
}

const CATEGORY_WIDTHS_KEY = "categoryWidths";
const CATEGORY_LAYOUTS_KEY = "categoryLayouts";
const VISUAL_SCALE_KEY = "visualScale";
const LINK_OPEN_MODE_KEY = "linkOpenMode";
const SEARCH_ENGINE_KEY = "searchEngine";

export async function getCategoryWidths(): Promise<Record<string, number>> {
  return (await localforage.getItem<Record<string, number>>(CATEGORY_WIDTHS_KEY)) || {};
}

export async function saveCategoryWidths(widths: Record<string, number>): Promise<void> {
  await localforage.setItem(CATEGORY_WIDTHS_KEY, widths);
  await touchLocalSnapshot();
}

function normalizeCategoryLayout(value: unknown): CategoryLayoutPreference | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const widthPercent = typeof raw.widthPercent === "number" && Number.isFinite(raw.widthPercent)
    ? Math.max(8, Math.min(100, raw.widthPercent))
    : undefined;
  const columns = typeof raw.columns === "number" && Number.isFinite(raw.columns)
    ? Math.max(1, Math.min(8, Math.round(raw.columns)))
    : undefined;
  const locked = typeof raw.locked === "boolean" ? raw.locked : undefined;
  const updatedAt = typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
    ? raw.updatedAt
    : 0;
  if (widthPercent === undefined && columns === undefined && locked === undefined) return null;
  return { widthPercent, columns, locked, updatedAt };
}

export async function getCategoryLayouts(): Promise<Record<string, CategoryLayoutPreference>> {
  const stored = await localforage.getItem<Record<string, unknown>>(CATEGORY_LAYOUTS_KEY);
  const layouts: Record<string, CategoryLayoutPreference> = {};
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const [categoryId, raw] of Object.entries(stored)) {
      const layout = normalizeCategoryLayout(raw);
      if (layout) layouts[categoryId] = layout;
    }
  }

  const widths = await getCategoryWidths();
  for (const [categoryId, widthPercent] of Object.entries(widths)) {
    if (!layouts[categoryId] && typeof widthPercent === "number" && Number.isFinite(widthPercent)) {
      layouts[categoryId] = { widthPercent, updatedAt: 0 };
    }
  }
  return layouts;
}

export async function saveCategoryLayouts(layouts: Record<string, CategoryLayoutPreference>): Promise<void> {
  await localforage.setItem(CATEGORY_LAYOUTS_KEY, layouts);
  await touchLocalSnapshot();
}

export async function getVisualScale(): Promise<number> {
  const scale = await localforage.getItem<number>(VISUAL_SCALE_KEY);
  if (typeof scale !== "number" || Number.isNaN(scale)) return DEFAULT_VISUAL_SCALE;
  const migrationDone = (await localforage.getItem<boolean>(VISUAL_SCALE_BASELINE_MIGRATION_KEY)) === true;
  if (shouldMigrateLegacyNinetyScale(scale, migrationDone)) {
    await localforage.setItem(VISUAL_SCALE_KEY, DEFAULT_VISUAL_SCALE);
    await localforage.setItem(VISUAL_SCALE_BASELINE_MIGRATION_KEY, true);
    return DEFAULT_VISUAL_SCALE;
  }
  return clampVisualScale(scale);
}

export async function saveVisualScale(scale: number): Promise<void> {
  await localforage.setItem(VISUAL_SCALE_KEY, clampVisualScale(scale));
  await touchLocalSnapshot();
}

export async function getLinkOpenMode(): Promise<LinkOpenMode> {
  const mode = await localforage.getItem<LinkOpenMode>(LINK_OPEN_MODE_KEY);
  if (mode === "new-background-tab" || mode === "new-active-tab" || mode === "current-tab") {
    return mode;
  }
  return "new-background-tab";
}

export async function saveLinkOpenMode(mode: LinkOpenMode): Promise<void> {
  await localforage.setItem(LINK_OPEN_MODE_KEY, mode);
  await touchLocalSnapshot();
}

export async function getSearchEngine(): Promise<SearchEngineId> {
  const engine = await localforage.getItem<unknown>(SEARCH_ENGINE_KEY);
  return isSearchEngineId(engine) ? engine : DEFAULT_SEARCH_ENGINE_ID;
}

export async function saveSearchEngine(engine: SearchEngineId): Promise<void> {
  await localforage.setItem(SEARCH_ENGINE_KEY, isSearchEngineId(engine) ? engine : DEFAULT_SEARCH_ENGINE_ID);
  await touchLocalSnapshot();
}

// ============ Recycle Bin ============

const RECYCLE_BIN_KEY = "recycleBin";

export async function getRecycleBin(): Promise<RecycleBinItem[]> {
  return (await localforage.getItem<RecycleBinItem[]>(RECYCLE_BIN_KEY)) || [];
}

export async function saveRecycleBin(items: RecycleBinItem[]): Promise<void> {
  await localforage.setItem(RECYCLE_BIN_KEY, items);
  await touchLocalSnapshot();
}

export async function getRecycleBinItem(id: string): Promise<RecycleBinItem | null> {
  const items = await getRecycleBin();
  return items.find((item) => item.id === id) || null;
}

export async function addToRecycleBin(items: RecycleBinItem[]): Promise<void> {
  const existing = await getRecycleBin();
  await saveRecycleBin([...existing, ...items]);
}

export async function removeFromRecycleBin(ids: string[]): Promise<void> {
  const existing = await getRecycleBin();
  await saveRecycleBin(existing.filter((item) => !ids.includes(item.id)));
}

export async function clearRecycleBin(): Promise<void> {
  await saveRecycleBin([]);
}

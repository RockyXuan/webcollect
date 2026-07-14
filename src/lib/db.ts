import localforage from "localforage";
import type { WebCard, Category, HiddenSite, LinkOpenMode, RecycleBinItem, CollectionSection, PinnedBookmarkItem, CategoryLayoutPreference, SyncEntityType, SyncTombstone, SyncPreferenceRevisions, SyncVersionStamp } from "./types";
import { DEFAULT_SEARCH_ENGINE_ID, isSearchEngineId, type SearchEngineId } from "./search-engines";
import {
  DEFAULT_VISUAL_SCALE,
  VISUAL_SCALE_BASELINE_MIGRATION_KEY,
  clampVisualScale,
  shouldMigrateLegacyNinetyScale,
} from "./visual-scale";
import { withStorageLock } from "./storage-lock";
import { normalizeSyncRevision } from "./sync-revisions";

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
const LAST_SEEN_CLOUD_WORKSPACE_VERSION_KEY = "lastSeenCloudWorkspaceVersion";
const LOCAL_UPDATED_SIGNAL_KEY = "webcollect_local_snapshot_updated_at";
const SYNC_DIRTY_SETS_KEY = "syncDirtySets";
const DATA_SCHEMA_VERSION_KEY = "localDataSchemaVersion";
const SYNC_DEVICE_ID_KEY = "syncDeviceId";
const SYNC_LAMPORT_COUNTER_KEY = "syncLamportCounter";
const SYNC_TOMBSTONES_KEY = "syncTombstones";
const SYNC_PREFERENCE_REVISIONS_KEY = "syncPreferenceRevisions";
const SYNC_METADATA_VERSION_KEY = "syncMetadataVersion";

export const CURRENT_SYNC_METADATA_VERSION = 1;

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
  if (!value || typeof value !== "object" || Array.isArray(value)) return JSON.stringify(value);
  const rest = { ...(value as Record<string, unknown>) };
  delete rest.syncRevision;
  delete rest.syncDeviceId;
  return JSON.stringify(rest);
}

function changedItemIds<T extends { id: string }>(previous: T[], next: T[]): string[] {
  const previousById = new Map(previous.map((item) => [item.id, stableSnapshot(item)]));
  const nextById = new Map(next.map((item) => [item.id, stableSnapshot(item)]));
  return [...new Set([
    ...next.filter((item) => previousById.get(item.id) !== stableSnapshot(item)).map((item) => item.id),
    ...previous.filter((item) => !nextById.has(item.id)).map((item) => item.id),
  ])];
}

function rebaseEntitySnapshot<T extends { id: string }>(baseline: T[], desired: T[], current: T[]): T[] {
  const baselineById = new Map(baseline.map((item) => [item.id, item]));
  const desiredById = new Map(desired.map((item) => [item.id, item]));
  const currentById = new Map(current.map((item) => [item.id, item]));

  for (const item of baseline) {
    if (!desiredById.has(item.id)) currentById.delete(item.id);
  }
  for (const item of desired) {
    const baselineItem = baselineById.get(item.id);
    if (!baselineItem || stableSnapshot(baselineItem) !== stableSnapshot(item)) {
      currentById.set(item.id, item);
    }
  }

  const desiredOrder = new Map(desired.map((item, index) => [item.id, index]));
  const currentOrder = new Map(current.map((item, index) => [item.id, index]));
  return [...currentById.values()].sort((left, right) => {
    const leftDesired = desiredOrder.get(left.id);
    const rightDesired = desiredOrder.get(right.id);
    if (leftDesired !== undefined && rightDesired !== undefined) return leftDesired - rightDesired;
    if (leftDesired !== undefined) return -1;
    if (rightDesired !== undefined) return 1;
    return (currentOrder.get(left.id) || 0) - (currentOrder.get(right.id) || 0);
  });
}

function createSyncDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSyncPreferenceRevisions(value: unknown): SyncPreferenceRevisions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const revisions: SyncPreferenceRevisions = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const candidate = raw as Partial<SyncVersionStamp>;
    const syncRevision = normalizeSyncRevision(candidate.syncRevision);
    if (syncRevision === 0 || typeof candidate.syncDeviceId !== "string") continue;
    revisions[key] = { syncRevision, syncDeviceId: candidate.syncDeviceId };
  }
  return revisions;
}

export async function getSyncPreferenceRevisions(): Promise<SyncPreferenceRevisions> {
  return normalizeSyncPreferenceRevisions(
    await localforage.getItem<unknown>(SYNC_PREFERENCE_REVISIONS_KEY)
  );
}

export async function saveSyncPreferenceRevisions(revisions: SyncPreferenceRevisions): Promise<void> {
  await withStorageLock("sync-revisions", () =>
    localforage
      .setItem(SYNC_PREFERENCE_REVISIONS_KEY, normalizeSyncPreferenceRevisions(revisions))
      .then(() => undefined)
  );
}

export async function markSyncPreferenceChanged(key: string): Promise<SyncVersionStamp | null> {
  if (localChangeSilenceDepth > 0) return null;
  return withStorageLock("sync-revisions", async () => {
    let deviceId = await localforage.getItem<string>(SYNC_DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = createSyncDeviceId();
      await localforage.setItem(SYNC_DEVICE_ID_KEY, deviceId);
    }
    const revisions = normalizeSyncPreferenceRevisions(
      await localforage.getItem<unknown>(SYNC_PREFERENCE_REVISIONS_KEY)
    );
    const counter = Math.max(
      normalizeSyncRevision(await localforage.getItem<number>(SYNC_LAMPORT_COUNTER_KEY) || 0),
      normalizeSyncRevision(revisions[key]?.syncRevision)
    ) + 1;
    const version = { syncRevision: counter, syncDeviceId: deviceId };
    revisions[key] = version;
    await Promise.all([
      localforage.setItem(SYNC_LAMPORT_COUNTER_KEY, counter),
      localforage.setItem(SYNC_PREFERENCE_REVISIONS_KEY, revisions),
    ]);
    return version;
  });
}

async function saveTrackedPreference<T>(storageKey: string, syncKey: string, value: T): Promise<boolean> {
  const changed = await withStorageLock(`preference:${storageKey}`, async () => {
    const previous = await localforage.getItem<unknown>(storageKey);
    if (stableSnapshot(previous) === stableSnapshot(value)) return false;
    await localforage.setItem(storageKey, value);
    await markSyncPreferenceChanged(syncKey);
    return true;
  });
  if (changed) await touchLocalSnapshot();
  return changed;
}

function normalizeSyncTombstones(value: unknown): SyncTombstone[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SyncTombstone => {
    if (!item || typeof item !== "object") return false;
    const raw = item as Partial<SyncTombstone>;
    return (raw.entityType === "card" || raw.entityType === "category")
      && typeof raw.entityId === "string"
      && typeof raw.deletedAt === "number"
      && normalizeSyncRevision(raw.syncRevision) > 0
      && typeof raw.syncDeviceId === "string";
  });
}

export async function getSyncTombstones(): Promise<SyncTombstone[]> {
  return normalizeSyncTombstones(await localforage.getItem<unknown>(SYNC_TOMBSTONES_KEY));
}

export async function saveSyncTombstones(tombstones: SyncTombstone[]): Promise<void> {
  await withStorageLock("sync-revisions", () =>
    localforage.setItem(SYNC_TOMBSTONES_KEY, normalizeSyncTombstones(tombstones)).then(() => undefined)
  );
}

type SyncableEntity = { id: string; syncRevision?: number; syncDeviceId?: string };

async function prepareSyncEntitiesForLocalSave<T extends SyncableEntity>(
  entityType: SyncEntityType,
  previous: T[],
  next: T[]
): Promise<T[]> {
  if (localChangeSilenceDepth > 0) return next;

  return withStorageLock("sync-revisions", async () => {
    let deviceId = await localforage.getItem<string>(SYNC_DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = createSyncDeviceId();
      await localforage.setItem(SYNC_DEVICE_ID_KEY, deviceId);
    }
    let counter = normalizeSyncRevision(await localforage.getItem<number>(SYNC_LAMPORT_COUNTER_KEY) || 0);
    const tombstones = normalizeSyncTombstones(await localforage.getItem<unknown>(SYNC_TOMBSTONES_KEY));
    const tombstoneById = new Map(
      tombstones.filter((item) => item.entityType === entityType).map((item) => [item.entityId, item])
    );
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const nextIds = new Set(next.map((item) => item.id));

    function nextVersion(observed = 0): { syncRevision: number; syncDeviceId: string } {
      counter = Math.max(counter, normalizeSyncRevision(observed)) + 1;
      return { syncRevision: counter, syncDeviceId: deviceId as string };
    }

    const prepared = next.map((item) => {
      const prior = previousById.get(item.id);
      if (prior && stableSnapshot(prior) === stableSnapshot(item)) {
        return {
          ...item,
          syncRevision: item.syncRevision ?? prior.syncRevision,
          syncDeviceId: item.syncDeviceId ?? prior.syncDeviceId,
        };
      }
      const tombstone = tombstoneById.get(item.id);
      const observed = Math.max(
        normalizeSyncRevision(item.syncRevision),
        normalizeSyncRevision(prior?.syncRevision),
        normalizeSyncRevision(tombstone?.syncRevision)
      );
      return { ...item, ...nextVersion(observed) };
    });

    for (const prior of previous) {
      if (nextIds.has(prior.id)) continue;
      const currentTombstone = tombstoneById.get(prior.id);
      const version = nextVersion(Math.max(
        normalizeSyncRevision(prior.syncRevision),
        normalizeSyncRevision(currentTombstone?.syncRevision)
      ));
      tombstoneById.set(prior.id, {
        entityType,
        entityId: prior.id,
        deletedAt: Date.now(),
        ...version,
      });
    }

    const otherTombstones = tombstones.filter((item) => item.entityType !== entityType);
    await Promise.all([
      localforage.setItem(SYNC_LAMPORT_COUNTER_KEY, counter),
      localforage.setItem(SYNC_TOMBSTONES_KEY, [...otherTombstones, ...tombstoneById.values()]),
    ]);
    return prepared;
  });
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
  await withStorageLock("sync-dirty-sets", async () => {
    const dirtySets = await getSyncDirtySets();
    const key = dirtyKeyForKind(kind);
    dirtySets[key] = [...new Set([...dirtySets[key], ...cleanIds])];
    await saveSyncDirtySets(dirtySets);
  });
}

export async function clearSyncDirtyIds(input: Partial<SyncDirtySets>): Promise<void> {
  await withStorageLock("sync-dirty-sets", async () => {
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
  });
}

export async function clearSyncDirtySets(): Promise<void> {
  await withStorageLock("sync-dirty-sets", () => saveSyncDirtySets(emptySyncDirtySets()));
}

export async function getSyncMetadataVersion(userId: string): Promise<number> {
  const value = await localforage.getItem<unknown>(SYNC_METADATA_VERSION_KEY);
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const metadata = value as { userId?: unknown; version?: unknown };
  if (metadata.userId !== userId || typeof metadata.version !== "number" || !Number.isFinite(metadata.version)) {
    return 0;
  }
  return Math.max(0, Math.floor(metadata.version));
}

export async function saveSyncMetadataVersion(version: number, userId: string): Promise<void> {
  await localforage.setItem(SYNC_METADATA_VERSION_KEY, {
    userId,
    version: Math.max(0, Math.floor(version)),
  });
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

export async function getLastSeenCloudWorkspaceVersion(): Promise<number | null> {
  const value = await localforage.getItem<number>(LAST_SEEN_CLOUD_WORKSPACE_VERSION_KEY);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function saveLastSeenCloudWorkspaceVersion(version: number): Promise<void> {
  if (!Number.isSafeInteger(version) || version < 0) return;
  await localforage.setItem(LAST_SEEN_CLOUD_WORKSPACE_VERSION_KEY, version);
}

export async function getWorkspaceResetAt(): Promise<number> {
  const value = await localforage.getItem<number>(WORKSPACE_RESET_AT_KEY);
  return typeof value === "number" ? value : 0;
}

export async function saveWorkspaceResetAt(timestamp: number): Promise<void> {
  await saveTrackedPreference(WORKSPACE_RESET_AT_KEY, "currentWorkspaceResetAt", timestamp);
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
  return [...cards].sort((a, b) => a.order - b.order);
}

export async function saveCards(cards: WebCard[]): Promise<void> {
  const previous = (await localforage.getItem<WebCard[]>(CARDS_KEY)) || [];
  const prepared = await prepareSyncEntitiesForLocalSave("card", previous, cards);
  await localforage.setItem(CARDS_KEY, prepared);
  await markDirtyIds("card", changedItemIds(previous, cards));
  await touchLocalSnapshot();
}

export async function saveCardsRebased(baseline: WebCard[], desired: WebCard[]): Promise<WebCard[]> {
  return withStorageLock("cards-rmw", async () => {
    const current = await getCards();
    await saveCards(rebaseEntitySnapshot(baseline, desired, current));
    return getCards();
  });
}

export async function addCard(card: WebCard): Promise<void> {
  await withStorageLock("cards-rmw", async () => {
    const cards = await getCards();
    cards.push(card);
    await saveCards(cards);
  });
}

export async function updateCard(updated: WebCard): Promise<void> {
  await withStorageLock("cards-rmw", async () => {
    const cards = await getCards();
    const idx = cards.findIndex((c) => c.id === updated.id);
    if (idx >= 0) {
      cards[idx] = updated;
      await saveCards(cards);
    }
  });
}

export async function deleteCard(id: string): Promise<void> {
  await withStorageLock("cards-rmw", async () => {
    const cards = await getCards();
    await saveCards(cards.filter((c) => c.id !== id));
  });
}

export async function getCategories(): Promise<Category[]> {
  const cats = (await localforage.getItem<Category[]>(CATEGORIES_KEY)) || [];
  return [...cats].sort((a, b) => a.order - b.order);
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const previous = (await localforage.getItem<Category[]>(CATEGORIES_KEY)) || [];
  const prepared = await prepareSyncEntitiesForLocalSave("category", previous, categories);
  await localforage.setItem(CATEGORIES_KEY, prepared);
  const previousSections = Object.fromEntries(previous.map((category) => [category.id, category.sectionId || "section-default"]));
  const nextSections = Object.fromEntries(categories.map((category) => [category.id, category.sectionId || "section-default"]));
  if (stableSnapshot(previousSections) !== stableSnapshot(nextSections)) {
    await markSyncPreferenceChanged("categorySectionIds");
  }
  await markDirtyIds("category", changedItemIds(previous, categories));
  await touchLocalSnapshot();
}

export async function saveCategoriesRebased(baseline: Category[], desired: Category[]): Promise<Category[]> {
  return withStorageLock("categories-rmw", async () => {
    const current = await getCategories();
    await saveCategories(rebaseEntitySnapshot(baseline, desired, current));
    return getCategories();
  });
}

export async function addCategory(category: Category): Promise<void> {
  await withStorageLock("categories-rmw", async () => {
    const cats = await getCategories();
    const now = Date.now();
    cats.push({
      ...category,
      createdAt: category.createdAt || now,
      updatedAt: category.updatedAt || now,
    });
    await saveCategories(cats);
  });
}

export async function updateCategory(updated: Category): Promise<void> {
  await withStorageLock("categories-rmw", async () => {
    const cats = await getCategories();
    const idx = cats.findIndex((c) => c.id === updated.id);
    if (idx >= 0) {
      cats[idx] = { ...updated, updatedAt: updated.updatedAt || Date.now() };
      await saveCategories(cats);
    }
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await withStorageLock("categories-rmw", async () => {
    const cats = await getCategories();
    await saveCategories(cats.filter((c) => c.id !== id));
  });
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
  await saveTrackedPreference(HIDDEN_SITES_KEY, "hiddenSites", sites);
}

export async function getSections(): Promise<CollectionSection[]> {
  const sections = (await localforage.getItem<CollectionSection[]>(SECTIONS_KEY)) || [];
  return [...sections].sort((a, b) => a.order - b.order);
}

export async function saveSections(sections: CollectionSection[]): Promise<void> {
  await saveTrackedPreference(SECTIONS_KEY, "collectionSections", sections);
}

export async function saveSectionsRebased(
  baseline: CollectionSection[],
  desired: CollectionSection[]
): Promise<CollectionSection[]> {
  return withStorageLock("sections-rmw", async () => {
    const current = await getSections();
    await saveSections(rebaseEntitySnapshot(baseline, desired, current));
    return getSections();
  });
}

export async function getActiveSectionId(): Promise<string | null> {
  return (await localforage.getItem<string>(ACTIVE_SECTION_KEY)) || null;
}

export async function saveActiveSectionId(sectionId: string): Promise<void> {
  await saveTrackedPreference(ACTIVE_SECTION_KEY, "activeCollectionSectionId", sectionId);
}

const PINNED_CATEGORIES_KEY = "pinnedCategoryIds";
const PINNED_BOOKMARK_ITEMS_KEY = "pinnedBookmarkItems";
const PINNED_BOOKMARK_ITEMS_UPDATED_AT_KEY = "pinnedBookmarkItemsUpdatedAt";

export async function getPinnedCategoryIds(): Promise<string[]> {
  return (await localforage.getItem<string[]>(PINNED_CATEGORIES_KEY)) || [];
}

export async function savePinnedCategoryIds(ids: string[]): Promise<void> {
  await saveTrackedPreference(PINNED_CATEGORIES_KEY, "pinnedCategoryIds", ids);
}

export async function getPinnedBookmarkItems(): Promise<PinnedBookmarkItem[]> {
  return (await localforage.getItem<PinnedBookmarkItem[]>(PINNED_BOOKMARK_ITEMS_KEY)) || [];
}

export async function getPinnedBookmarkItemsUpdatedAt(): Promise<number> {
  return (await localforage.getItem<number>(PINNED_BOOKMARK_ITEMS_UPDATED_AT_KEY)) || 0;
}

export async function savePinnedBookmarkItems(items: PinnedBookmarkItem[], updatedAt = Date.now()): Promise<void> {
  await Promise.all([
    saveTrackedPreference(PINNED_BOOKMARK_ITEMS_KEY, "pinnedBookmarkItems", items),
    saveTrackedPreference(PINNED_BOOKMARK_ITEMS_UPDATED_AT_KEY, "pinnedBookmarkItemsUpdatedAt", updatedAt),
  ]);
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
  await saveTrackedPreference(CATEGORY_WIDTHS_KEY, "categoryWidths", widths);
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
  await saveTrackedPreference(CATEGORY_LAYOUTS_KEY, "categoryLayouts", layouts);
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
  await saveTrackedPreference(VISUAL_SCALE_KEY, "visualScale", clampVisualScale(scale));
}

export async function getLinkOpenMode(): Promise<LinkOpenMode> {
  const mode = await localforage.getItem<LinkOpenMode>(LINK_OPEN_MODE_KEY);
  if (mode === "new-background-tab" || mode === "new-active-tab" || mode === "current-tab") {
    return mode;
  }
  return "new-background-tab";
}

export async function saveLinkOpenMode(mode: LinkOpenMode): Promise<void> {
  await saveTrackedPreference(LINK_OPEN_MODE_KEY, "linkOpenMode", mode);
}

export async function getSearchEngine(): Promise<SearchEngineId> {
  const engine = await localforage.getItem<unknown>(SEARCH_ENGINE_KEY);
  return isSearchEngineId(engine) ? engine : DEFAULT_SEARCH_ENGINE_ID;
}

export async function saveSearchEngine(engine: SearchEngineId): Promise<void> {
  await saveTrackedPreference(
    SEARCH_ENGINE_KEY,
    "searchEngine",
    isSearchEngineId(engine) ? engine : DEFAULT_SEARCH_ENGINE_ID
  );
}

// ============ Recycle Bin ============

const RECYCLE_BIN_KEY = "recycleBin";

export async function getRecycleBin(): Promise<RecycleBinItem[]> {
  return (await localforage.getItem<RecycleBinItem[]>(RECYCLE_BIN_KEY)) || [];
}

export async function saveRecycleBin(items: RecycleBinItem[]): Promise<void> {
  await saveTrackedPreference(RECYCLE_BIN_KEY, "recycleBin", items);
}

export async function getRecycleBinItem(id: string): Promise<RecycleBinItem | null> {
  const items = await getRecycleBin();
  return items.find((item) => item.id === id) || null;
}

export async function addToRecycleBin(items: RecycleBinItem[]): Promise<void> {
  await withStorageLock("recycle-bin-rmw", async () => {
    const existing = await getRecycleBin();
    await saveRecycleBin([...existing, ...items]);
  });
}

export async function removeFromRecycleBin(ids: string[]): Promise<void> {
  await withStorageLock("recycle-bin-rmw", async () => {
    const existing = await getRecycleBin();
    await saveRecycleBin(existing.filter((item) => !ids.includes(item.id)));
  });
}

export async function clearRecycleBin(): Promise<void> {
  await withStorageLock("recycle-bin-rmw", () => saveRecycleBin([]));
}

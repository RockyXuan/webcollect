/**
 * Sync service for local IndexedDB and Supabase.
 *
 * The service syncs whole local snapshots, but cloud writes are narrowed to
 * dirty/local-only/newer rows. Card/category conflicts use deterministic
 * Lamport revisions and device IDs, with timestamps only for legacy rows.
 */

import { getBrowserSupabaseClient, initBrowserSupabase } from "@/lib/supabase-browser";
import { DEFAULT_VISUAL_SCALE } from "@/lib/visual-scale";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCards,
  saveCards,
  getCategories,
  saveCategories,
  getHiddenSites,
  saveHiddenSites,
  getPinnedCategoryIds,
  savePinnedCategoryIds,
  getPinnedBookmarkItems,
  getPinnedBookmarkItemsUpdatedAt,
  savePinnedBookmarkItems,
  getCategoryWidths,
  saveCategoryWidths,
  getCategoryLayouts,
  saveCategoryLayouts,
  getVisualScale,
  saveVisualScale,
  getLinkOpenMode,
  saveLinkOpenMode,
  getSections,
  saveSections,
  getActiveSectionId,
  saveActiveSectionId,
  getRecycleBin,
  saveRecycleBin,
  saveLastSeenCloudSnapshotUpdatedAt,
  getLocalSnapshotUpdatedAt,
  saveLocalSnapshotSyncedAt,
  getWorkspaceResetAt,
  saveWorkspaceResetAt,
  withoutLocalChangeEvents,
  getSyncDirtySets,
  clearSyncDirtyIds,
  getSyncTombstones,
  saveSyncTombstones,
  getSyncPreferenceRevisions,
  saveSyncPreferenceRevisions,
  getSearchEngine,
  saveSearchEngine,
} from "@/lib/db";
import {
  getWarehouseCards,
  saveWarehouseCards,
  getWarehouseCategories,
  saveWarehouseCategories,
  getImportBatches,
  saveImportBatches,
  getWarehouseUpdatedAt,
  type WarehouseCard,
  type WarehouseCategory,
  type ImportBatch,
} from "@/lib/db-warehouse";
import {
  applyWallpaperSyncedSettings,
  getWallpaperPrefs,
  saveSyncedWallpaperPrefs,
  toWallpaperSyncedSettings,
} from "@/lib/wallpaper-db";
import { useWallpaperStore } from "@/lib/wallpaper-store";
import { createLocalDataSnapshot, getLocalDataSnapshots } from "@/lib/local-snapshots";
import { normalizePinnedBookmarkItems } from "@/lib/pinned-bookmarks";
import { allDefaultCategories } from "@/lib/seed";
import type { WebCard, Category, HiddenSite, LinkOpenMode, CollectionSection, RecycleBinItem, PinnedBookmarkItem, CategoryLayoutPreference, SyncEntityType, SyncTombstone, SyncPreferenceRevisions, SyncVersionStamp } from "@/lib/types";
import type { WallpaperPrefs, WallpaperSyncedSettings } from "@/lib/wallpaper-types";
import { compareSyncVersions } from "@/lib/sync-revisions";
import { resolvePreferenceByRevision } from "@/lib/preference-sync";
import { DEFAULT_SEARCH_ENGINE_ID, isSearchEngineId, type SearchEngineId } from "@/lib/search-engines";

// Types

interface CloudCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  is_parent: boolean | null;
  order: number | null;
  updated_at: string;
  created_at: string;
  sync_revision?: number | null;
  sync_device_id?: string | null;
}

interface CloudCard {
  id: string;
  user_id: string;
  category_id: string;
  url: string;
  title: string | null;
  short_desc: string | null;
  full_desc: string | null;
  note: string | null;
  abbreviation: string | null;
  image_url: string | null;
  order: number | null;
  updated_at: string;
  created_at: string;
  sync_revision?: number | null;
  sync_device_id?: string | null;
}

interface CloudPreference {
  id: string;
  user_id: string;
  key: string;
  value: unknown;
  updated_at: string;
  sync_revision?: number | null;
  sync_device_id?: string | null;
}

interface CloudTombstone {
  id?: string;
  user_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  deleted_at: string;
  sync_revision: number;
  sync_device_id: string;
  updated_at?: string;
}

interface SyncBackup {
  id: string;
  createdAt: number;
  reason: string;
  categoryCount: number;
  cardCount: number;
  preferenceKeys: string[];
  sampleCategoryNames: string[];
  sampleCardTitles: string[];
}

interface WallpaperPrefsMergeResult {
  prefs: WallpaperPrefs;
  shouldApplyCloud: boolean;
}

type CloudPreferenceMap = Record<string, {
  value: unknown;
  updatedAt: string;
  syncRevision: number;
  syncDeviceId: string;
}>;

const MAX_SYNC_RECURSION_DEPTH = 2;

let syncInFlight: Promise<void> | null = null;

function runWithSyncGate(task: () => Promise<void>, depth: number, label: string): Promise<void> {
  if (depth > MAX_SYNC_RECURSION_DEPTH) {
    console.warn(`[Sync] ${label} skipped after reaching recursion depth ${depth}.`);
    return Promise.resolve();
  }

  if (depth > 0) {
    return task();
  }

  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = task().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

// Mapping helpers

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return !!value && UUID_PATTERN.test(value);
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ Math.random() * 16 >> Number(c) / 4).toString(16)
  );
}

async function normalizeLocalIdsForCloud(
  categories: Category[],
  cards: WebCard[]
): Promise<{ categories: Category[]; cards: WebCard[] }> {
  const idMap = new Map<string, string>();
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const defaultCategoriesById = new Map(allDefaultCategories.map((category) => [category.id, category]));
  const missingCategoryIds = new Set<string>();

  function ensureCategory(categoryId: string): void {
    if (!categoryId || categoriesById.has(categoryId)) return;

    const defaultCategory = defaultCategoriesById.get(categoryId);
    if (!defaultCategory) {
      missingCategoryIds.add(categoryId);
      return;
    }

    const categoryToAdd: Category = { ...defaultCategory };

    if (categoryToAdd.parentId) {
      ensureCategory(categoryToAdd.parentId);
    }

    categoriesById.set(categoryToAdd.id, categoryToAdd);
    categories.push(categoryToAdd);
  }

  for (const card of cards) {
    ensureCategory(card.categoryId);
  }

  const syncableCards = missingCategoryIds.size === 0
    ? cards
    : cards.map((card) => {
      if (!missingCategoryIds.has(card.categoryId)) return card;
      const fallbackCategory = ensureFallbackInboxCategory(categories, categoriesById);
      return { ...card, categoryId: fallbackCategory.id, updatedAt: Date.now() };
    });

  for (const category of categories) {
    if (!isUuid(category.id)) {
      idMap.set(category.id, createUuid());
    }
  }

  for (const card of syncableCards) {
    if (!isUuid(card.id)) {
      idMap.set(card.id, createUuid());
    }
  }

  if (idMap.size === 0) {
    return { categories, cards: syncableCards };
  }

  const normalizedCategories = categories.map((category) => ({
    ...category,
    id: idMap.get(category.id) || category.id,
    parentId: category.parentId ? (idMap.get(category.parentId) || category.parentId) : undefined,
  }));

  const normalizedCards = syncableCards.map((card) => ({
    ...card,
    id: idMap.get(card.id) || card.id,
    categoryId: idMap.get(card.categoryId) || card.categoryId,
    updatedAt: card.updatedAt || Date.now(),
  }));

  await withoutLocalChangeEvents(async () => {
    await saveCategories(normalizedCategories);
    await saveCards(normalizedCards);
  });

  return { categories: normalizedCategories, cards: normalizedCards };
}

function ensureFallbackInboxCategory(
  categories: Category[],
  categoriesById: Map<string, Category>
): Category {
  const existingInbox =
    categories.find((category) => category.name.trim() === "\u6536\u96c6\u7bb1" && !category.parentId)
    || categoriesById.get("cat-inbox");
  if (existingInbox) return existingInbox;

  const now = Date.now();
  const inboxCategory: Category = {
    id: "cat-inbox",
    name: "\u6536\u96c6\u7bb1",
    icon: "inbox",
    color: "#888888",
    order: 99,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-default",
  };
  categories.push(inboxCategory);
  categoriesById.set(inboxCategory.id, inboxCategory);
  return inboxCategory;
}

function cloudToLocalCategory(c: CloudCategory): Category {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon || "Folder",
    color: c.color || "#888888",
    order: c.order ?? 0,
    createdAt: new Date(c.created_at).getTime(),
    updatedAt: new Date(c.updated_at).getTime(),
    parentId: c.parent_id ?? undefined,
    isParent: c.is_parent ?? undefined,
    syncRevision: c.sync_revision ?? undefined,
    syncDeviceId: c.sync_device_id ?? undefined,
  };
}

function toCloudUpdatedAt(input: { createdAt?: number; updatedAt?: number }): string {
  return new Date(input.updatedAt || input.createdAt || Date.now()).toISOString();
}

function localToCloudCategory(c: Category, userId: string): Omit<CloudCategory, "created_at"> {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    icon: c.icon || null,
    color: c.color || null,
    parent_id: c.parentId ?? null,
    is_parent: c.isParent ?? null,
    order: c.order,
    updated_at: toCloudUpdatedAt(c),
    sync_revision: c.syncRevision || 0,
    sync_device_id: c.syncDeviceId || "legacy",
  };
}

function getCategoryParentDepth(
  category: Category,
  categoryById: Map<string, Category>,
  seen = new Set<string>()
): number {
  if (!category.parentId) return 0;
  if (seen.has(category.id)) return 0;
  const parent = categoryById.get(category.parentId);
  if (!parent) return 0;
  seen.add(category.id);
  return 1 + getCategoryParentDepth(parent, categoryById, seen);
}

function groupCategoriesByParentDepth(categories: Category[]): Category[][] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const layers = new Map<number, Category[]>();
  for (const category of categories) {
    const depth = getCategoryParentDepth(category, categoryById);
    const layer = layers.get(depth) || [];
    layer.push(category);
    layers.set(depth, layer);
  }
  return [...layers.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, layer]) => layer.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
}

async function upsertCategoriesWithParents(
  client: SupabaseClient,
  categories: Category[],
  userId: string
): Promise<void> {
  const layers = groupCategoriesByParentDepth(categories);

  for (const layer of layers) {
    if (layer.length === 0) continue;
    const cloudCategories = layer.map((cat) => ({
      ...localToCloudCategory(cat, userId),
      parent_id: cat.parentId ?? null,
    }));
    const { error } = await client
      .from("categories")
      .upsert(cloudCategories, { onConflict: "id" });
    if (error) {
      console.error("[Sync] Failed to upsert category layer:", error.message);
      throw new Error(`Failed to update category layer: ${error.message}`);
    }
  }
}

function cloudToLocalCard(c: CloudCard): WebCard {
  return {
    id: c.id,
    url: c.url,
    title: c.title || "",
    shortDesc: c.short_desc || "",
    fullDesc: c.full_desc || "",
    note: c.note || "",
    abbreviation: c.abbreviation || "",
    imageUrl: c.image_url || "",
    categoryId: c.category_id,
    order: c.order ?? 0,
    createdAt: new Date(c.created_at).getTime(),
    updatedAt: new Date(c.updated_at).getTime(),
    syncRevision: c.sync_revision ?? undefined,
    syncDeviceId: c.sync_device_id ?? undefined,
  };
}

function localToCloudCard(c: WebCard, userId: string): Omit<CloudCard, "created_at"> {
  return {
    id: c.id,
    user_id: userId,
    category_id: c.categoryId,
    url: c.url,
    title: c.title || null,
    short_desc: c.shortDesc || null,
    full_desc: c.fullDesc || null,
    note: c.note || null,
    abbreviation: c.abbreviation || null,
    image_url: c.imageUrl || null,
    order: c.order,
    updated_at: toCloudUpdatedAt(c),
    sync_revision: c.syncRevision || 0,
    sync_device_id: c.syncDeviceId || "legacy",
  };
}

// Merge logic

async function upsertCardsInChunks(
  client: SupabaseClient,
  cards: WebCard[],
  userId: string
): Promise<void> {
  const chunkSize = 100;
  for (let index = 0; index < cards.length; index += chunkSize) {
    const chunk = cards.slice(index, index + chunkSize).map((card) => localToCloudCard(card, userId));
    const { error } = await client
      .from("cards")
      .upsert(chunk, { onConflict: "id" });
    if (error) {
      throw new Error(`Failed to push card batch ${Math.floor(index / chunkSize) + 1}: ${error.message}`);
    }
  }
}

async function deleteRowsByIdsInChunks(
  client: SupabaseClient,
  table: "cards" | "categories",
  ids: string[],
  userId: string
): Promise<void> {
  const uniqueIds = [...new Set(ids)].filter(isUuid);
  const chunkSize = 100;
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;
    const { error } = await client
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", chunk);
    if (error) {
      throw new Error(`Failed to remove duplicated ${table}: ${error.message}`);
    }
  }
}

interface MergeResult<T extends { id: string }> {
  merged: T[];
  cloudToPull: T[];   // items that are newer on cloud, update local
  localToPush: T[];   // items that are newer locally, push to cloud
  localOnly: T[];     // items only in local, push to cloud
  cloudOnly: T[];     // items only in cloud, add to local
}

function mergeBySyncVersion<T extends { id: string; syncRevision?: number; syncDeviceId?: string; updatedAt?: number; createdAt?: number }>(
  localItems: T[],
  cloudItems: T[]
): MergeResult<T> {
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const cloudMap = new Map(cloudItems.map((item) => [item.id, item]));

  const merged: T[] = [];
  const cloudToPull: T[] = [];
  const localToPush: T[] = [];
  const localOnly: T[] = [];
  const cloudOnly: T[] = [];

  // Process all items present in both
  for (const [id, localItem] of localMap) {
    const cloudItem = cloudMap.get(id);
    if (cloudItem) {
      const comparison = compareSyncVersions(cloudItem, localItem);
      if (comparison > 0) {
        // Cloud is newer
        merged.push(cloudItem);
        cloudToPull.push(cloudItem);
      } else {
        // Local is newer, or equal. Equal timestamps intentionally keep the
        // local row so a no-op cloud sync cannot roll back the current tab.
        merged.push(localItem);
        if (comparison < 0) {
          localToPush.push(localItem);
        }
      }
    } else {
      // Only in local
      merged.push(localItem);
      localOnly.push(localItem);
    }
  }

  // Items only in cloud
  for (const [id, cloudItem] of cloudMap) {
    if (!localMap.has(id)) {
      merged.push(cloudItem);
      cloudOnly.push(cloudItem);
    }
  }

  return { merged, cloudToPull, localToPush, localOnly, cloudOnly };
}

function cloudToLocalTombstone(row: CloudTombstone): SyncTombstone {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    deletedAt: new Date(row.deleted_at).getTime(),
    syncRevision: row.sync_revision,
    syncDeviceId: row.sync_device_id,
  };
}

function mergeSyncTombstones(local: SyncTombstone[], cloud: SyncTombstone[]): SyncTombstone[] {
  const merged = new Map<string, SyncTombstone>();
  for (const tombstone of [...cloud, ...local]) {
    const key = `${tombstone.entityType}:${tombstone.entityId}`;
    const current = merged.get(key);
    if (!current || compareSyncVersions(tombstone, current) > 0) {
      merged.set(key, tombstone);
    }
  }
  return [...merged.values()];
}

function tombstoneMapForType(
  tombstones: SyncTombstone[],
  entityType: SyncEntityType
): Map<string, SyncTombstone> {
  return new Map(
    tombstones
      .filter((tombstone) => tombstone.entityType === entityType)
      .map((tombstone) => [tombstone.entityId, tombstone])
  );
}

function filterEntitiesSupersededByTombstones<
  T extends { id: string; syncRevision?: number; syncDeviceId?: string; updatedAt?: number; createdAt?: number }
>(entities: T[], tombstones: Map<string, SyncTombstone>): T[] {
  return entities.filter((entity) => {
    const tombstone = tombstones.get(entity.id);
    return !tombstone || compareSyncVersions(entity, tombstone) > 0;
  });
}

async function upsertSyncTombstones(
  client: SupabaseClient,
  userId: string,
  tombstones: SyncTombstone[],
  cloudTombstones: SyncTombstone[] = []
): Promise<void> {
  const cloudByKey = new Map(
    cloudTombstones.map((tombstone) => [`${tombstone.entityType}:${tombstone.entityId}`, tombstone])
  );
  const rows = tombstones.filter((tombstone) => {
    const cloud = cloudByKey.get(`${tombstone.entityType}:${tombstone.entityId}`);
    if (!cloud) return true;
    const comparison = compareSyncVersions(tombstone, cloud);
    return comparison > 0 || (
      comparison === 0
      && (tombstone.deletedAt !== cloud.deletedAt || tombstone.syncDeviceId !== cloud.syncDeviceId)
    );
  }).map((tombstone) => ({
    user_id: userId,
    entity_type: tombstone.entityType,
    entity_id: tombstone.entityId,
    deleted_at: new Date(tombstone.deletedAt).toISOString(),
    sync_revision: tombstone.syncRevision,
    sync_device_id: tombstone.syncDeviceId,
  }));
  if (rows.length === 0) return;
  const { error } = await client
    .from("workspace_tombstones")
    .upsert(rows, { onConflict: "user_id,entity_type,entity_id" });
  if (error) throw formatCloudLoadError("删除记录", error.message);
}

function mergePushCandidateIds<T extends { id: string }>(
  mergeResult: Pick<MergeResult<T>, "localOnly" | "localToPush">
): string[] {
  return [
    ...mergeResult.localOnly.map((item) => item.id),
    ...mergeResult.localToPush.map((item) => item.id),
  ];
}

function includeParentCategoryIds(ids: Set<string>, categories: Category[]): Set<string> {
  const result = new Set(ids);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  for (const id of [...ids]) {
    let category = categoryById.get(id);
    const seen = new Set<string>();
    while (category?.parentId && !seen.has(category.id)) {
      seen.add(category.id);
      result.add(category.parentId);
      category = categoryById.get(category.parentId);
    }
  }

  return result;
}

function selectChangedRowsForCloud<T extends { id: string }, CloudRow>(
  rows: T[],
  candidateIds: Set<string>,
  cloudById: Map<string, CloudRow>,
  rowMatchesCloud: (row: T, cloudRow: CloudRow | undefined) => boolean
): { rowsToUpsert: T[]; resolvedIds: string[] } {
  const rowsToUpsert: T[] = [];
  const resolvedIds: string[] = [];

  for (const row of rows) {
    if (!candidateIds.has(row.id)) continue;
    resolvedIds.push(row.id);
    if (!rowMatchesCloud(row, cloudById.get(row.id))) {
      rowsToUpsert.push(row);
    }
  }

  return { rowsToUpsert, resolvedIds };
}

function cloudCategoryMatchesLocal(category: Category, cloudCategory: CloudCategory | undefined, userId: string): boolean {
  if (!cloudCategory) return false;
  const local = localToCloudCategory(category, userId);
  return (
    cloudCategory.id === local.id &&
    cloudCategory.user_id === local.user_id &&
    cloudCategory.name === local.name &&
    (cloudCategory.icon ?? null) === local.icon &&
    (cloudCategory.color ?? null) === local.color &&
    (cloudCategory.parent_id ?? null) === local.parent_id &&
    (cloudCategory.is_parent ?? null) === local.is_parent &&
    (cloudCategory.order ?? 0) === (local.order ?? 0) &&
    (cloudCategory.sync_revision ?? 0) === (local.sync_revision ?? 0) &&
    (cloudCategory.sync_device_id || "legacy") === (local.sync_device_id || "legacy")
  );
}

function cloudCardMatchesLocal(card: WebCard, cloudCard: CloudCard | undefined, userId: string): boolean {
  if (!cloudCard) return false;
  const local = localToCloudCard(card, userId);
  return (
    cloudCard.id === local.id &&
    cloudCard.user_id === local.user_id &&
    cloudCard.category_id === local.category_id &&
    cloudCard.url === local.url &&
    (cloudCard.title ?? null) === local.title &&
    (cloudCard.short_desc ?? null) === local.short_desc &&
    (cloudCard.full_desc ?? null) === local.full_desc &&
    (cloudCard.note ?? null) === local.note &&
    (cloudCard.abbreviation ?? null) === local.abbreviation &&
    (cloudCard.image_url ?? null) === local.image_url &&
    (cloudCard.order ?? 0) === (local.order ?? 0) &&
    (cloudCard.sync_revision ?? 0) === (local.sync_revision ?? 0) &&
    (cloudCard.sync_device_id || "legacy") === (local.sync_device_id || "legacy")
  );
}

function collectLocalSnapshotPushIds<
  T extends { id: string; createdAt: number; updatedAt?: number; syncRevision?: number; syncDeviceId?: string },
  CloudRow extends { updated_at: string; sync_revision?: number | null; sync_device_id?: string | null }
>(
  localRows: T[],
  cloudById: Map<string, CloudRow>,
  dirtyIds: Set<string>
): Set<string> {
  const candidateIds = new Set<string>();
  for (const row of localRows) {
    const cloudRow = cloudById.get(row.id);
    const localWins = cloudRow && compareSyncVersions(row, {
      syncRevision: cloudRow.sync_revision ?? undefined,
      syncDeviceId: cloudRow.sync_device_id ?? undefined,
      updatedAt: new Date(cloudRow.updated_at).getTime(),
    }) > 0;
    if (dirtyIds.has(row.id) || !cloudRow || localWins) {
      candidateIds.add(row.id);
    }
  }
  return candidateIds;
}

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function isLinkOpenMode(value: unknown): value is LinkOpenMode {
  return value === "new-background-tab" || value === "new-active-tab" || value === "current-tab";
}

function mergePinnedBookmarkPreferences(
  cloudItems: PinnedBookmarkItem[],
  localItems: PinnedBookmarkItem[]
): PinnedBookmarkItem[] {
  const byCardId = new Map<string, PinnedBookmarkItem>();
  for (const item of [...cloudItems, ...localItems]) {
    if (!item.cardId) continue;
    const existing = byCardId.get(item.cardId);
    if (!existing || item.updatedAt > existing.updatedAt) {
      byCardId.set(item.cardId, item);
    }
  }

  return normalizePinnedBookmarkItems([...byCardId.values()]);
}

function preferencesToMap(cloudPrefs: CloudPreference[]): CloudPreferenceMap {
  const cloudPrefsMap: CloudPreferenceMap = {};
  for (const pref of cloudPrefs) {
    cloudPrefsMap[pref.key] = {
      value: pref.value,
      updatedAt: pref.updated_at,
      syncRevision: pref.sync_revision || 0,
      syncDeviceId: pref.sync_device_id || "legacy",
    };
  }
  return cloudPrefsMap;
}

const WORKSPACE_RESET_PREF_KEY = "currentWorkspaceResetAt";

function getPreferenceUpdatedAt(cloudPrefsMap: CloudPreferenceMap, key: string): number {
  const updatedAt = cloudPrefsMap[key]?.updatedAt;
  return updatedAt ? new Date(updatedAt).getTime() : 0;
}

function shouldIgnoreCloudPreference(cloudPrefsMap: CloudPreferenceMap, key: string, workspaceResetAt: number): boolean {
  return workspaceResetAt > 0 && getPreferenceUpdatedAt(cloudPrefsMap, key) < workspaceResetAt;
}

function getResetAwareCategorySections(
  cloudPrefsMap: CloudPreferenceMap,
  workspaceResetAt: number
): Record<string, string> {
  return shouldIgnoreCloudPreference(cloudPrefsMap, "categorySectionIds", workspaceResetAt)
    ? {}
    : getCategorySectionsFromPrefs(cloudPrefsMap);
}

function getResetAwareSections(
  cloudPrefsMap: CloudPreferenceMap,
  workspaceResetAt: number
): CollectionSection[] {
  if (shouldIgnoreCloudPreference(cloudPrefsMap, "collectionSections", workspaceResetAt)) {
    return [];
  }
  return isCollectionSectionArray(cloudPrefsMap.collectionSections?.value)
    ? cloudPrefsMap.collectionSections.value
    : [];
}

function cloudRowUpdatedAt(row: { updated_at: string; created_at: string }): number {
  return Math.max(new Date(row.updated_at).getTime(), new Date(row.created_at).getTime());
}

function filterCloudRowsAfterReset<T extends { updated_at: string; created_at: string }>(
  rows: T[],
  workspaceResetAt: number
): T[] {
  if (workspaceResetAt <= 0) return rows;
  return rows.filter((row) => cloudRowUpdatedAt(row) >= workspaceResetAt);
}

function summarizeRemoteError(message: string): string {
  if (/<html[\s>]|<!doctype html/i.test(message)) {
    const code = message.match(/error code\s*(\d+)/i)?.[1] || message.match(/\b5\d{2}\b/)?.[0];
    return code
      ? `Supabase 暂时返回 ${code} 服务端错误。本地数据已保留，稍后会自动重试。`
      : "Supabase 暂时返回服务端错误页面。本地数据已保留，稍后会自动重试。";
  }
  return message.length > 260 ? `${message.slice(0, 260)}...` : message;
}

function localSnapshotContentScore(input: {
  categories: Category[];
  cards: WebCard[];
  recycleBin: RecycleBinItem[];
  warehouseCategories: WarehouseCategory[];
  warehouseCards: WarehouseCard[];
  warehouseBatches: ImportBatch[];
}): number {
  return input.cards.length
    + input.warehouseCards.length
    + input.recycleBin.length
    + input.warehouseBatches.length
    + input.categories.filter((category) => category.name.trim() !== "\u6536\u96c6\u7bb1").length
    + input.warehouseCategories.length;
}

function cloudSnapshotContentScore(
  cloudCategories: CloudCategory[],
  cloudCards: CloudCard[],
  cloudPrefsMap: CloudPreferenceMap,
  workspaceResetAt = 0
): number {
  const warehouseCards = !shouldIgnoreCloudPreference(cloudPrefsMap, "warehouseCards", workspaceResetAt)
    && Array.isArray(cloudPrefsMap.warehouseCards?.value)
    ? cloudPrefsMap.warehouseCards.value as WarehouseCard[]
    : [];
  const warehouseCategories = !shouldIgnoreCloudPreference(cloudPrefsMap, "warehouseCategories", workspaceResetAt)
    && Array.isArray(cloudPrefsMap.warehouseCategories?.value)
    ? cloudPrefsMap.warehouseCategories.value as WarehouseCategory[]
    : [];
  const warehouseBatches = !shouldIgnoreCloudPreference(cloudPrefsMap, "warehouseImportBatches", workspaceResetAt)
    && Array.isArray(cloudPrefsMap.warehouseImportBatches?.value)
    ? cloudPrefsMap.warehouseImportBatches.value as ImportBatch[]
    : [];
  const recycleBin = !shouldIgnoreCloudPreference(cloudPrefsMap, "recycleBin", workspaceResetAt)
    && Array.isArray(cloudPrefsMap.recycleBin?.value)
    ? cloudPrefsMap.recycleBin.value as RecycleBinItem[]
    : [];
  return cloudCards.length
    + warehouseCards.length
    + recycleBin.length
    + warehouseBatches.length
    + cloudCategories.filter((category) => category.name.trim() !== "\u6536\u96c6\u7bb1").length
    + warehouseCategories.length;
}

function localSnapshotLooksMuchSmallerThanCloud(localScore: number, cloudScore: number): boolean {
  if (cloudScore < 20) return false;
  return localScore + 5 < cloudScore * 0.75;
}

function mainDataScore(categories: Category[], cards: WebCard[]): number {
  return cards.length + categories.filter((category) => category.name.trim() !== "\u6536\u96c6\u7bb1").length;
}

function cloudMainDataScore(cloudCategories: CloudCategory[], cloudCards: CloudCard[]): number {
  return cloudCards.length + cloudCategories.filter((category) => category.name.trim() !== "\u6536\u96c6\u7bb1").length;
}

function localMainDataLooksMuchSmallerThanCloud(
  categories: Category[],
  cards: WebCard[],
  cloudCategories: CloudCategory[],
  cloudCards: CloudCard[]
): boolean {
  const cloudScore = cloudMainDataScore(cloudCategories, cloudCards);
  if (cloudScore < 20) return false;
  const localScore = mainDataScore(categories, cards);
  return localScore + 5 < cloudScore * 0.75;
}

function hierarchyLinkCount(categories: Category[]): number {
  const ids = new Set(categories.map((category) => category.id));
  return categories.filter((category) => category.parentId && ids.has(category.parentId)).length;
}

function hierarchyStructureScore(
  categories: Category[],
  cards: WebCard[],
  sections: CollectionSection[]
): number {
  const cardCountByCategory = new Map<string, number>();
  for (const card of cards) {
    cardCountByCategory.set(card.categoryId, (cardCountByCategory.get(card.categoryId) || 0) + 1);
  }
  const parentCount = categories.filter((category) =>
    !category.parentId && (category.isParent || categories.some((child) => child.parentId === category.id))
  ).length;
  const standaloneWithCards = categories.filter((category) =>
    !category.parentId &&
    !category.isParent &&
    (cardCountByCategory.get(category.id) || 0) > 0
  ).length;
  const sectionIds = new Set([
    ...sections.map((section) => section.id),
    ...categories.map((category) => category.sectionId || "section-default"),
  ]);
  return hierarchyLinkCount(categories) * 30 + parentCount * 10 + sectionIds.size * 8 - standaloneWithCards * 8;
}

async function localHasRicherStructureSnapshot(
  categories: Category[],
  cards: WebCard[],
  sections: CollectionSection[]
): Promise<boolean> {
  if (categories.length < 8 || cards.length < 8) return false;
  const currentLinks = hierarchyLinkCount(categories);
  const currentSectionIds = new Set([
    ...sections.map((section) => section.id),
    ...categories.map((category) => category.sectionId || "section-default"),
  ]);
  if (currentSectionIds.size > 1 || currentLinks > 1) return false;
  const currentScore = hierarchyStructureScore(categories, cards, sections);
  const snapshots = await getLocalDataSnapshots();
  const best = snapshots
    .filter((snapshot) => snapshot.counts.categories >= Math.max(5, Math.floor(categories.length * 0.35)))
    .map((snapshot) => ({
      links: hierarchyLinkCount(snapshot.data.categories),
      score: hierarchyStructureScore(snapshot.data.categories, snapshot.data.cards, snapshot.data.sections),
    }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.links < 3) return false;
  return best.links >= currentLinks + 3 && best.score > currentScore + 40;
}

function getFlattenedHierarchyGuardMessage(): string {
  return "当前分类结构像是被异常打平，已暂停这次同步以保护数据。请先打开版本回档检查当前页面，确认后再手动同步。";
}

async function writeSyncBackup(
  client: SupabaseClient,
  userId: string,
  reason: string,
  cloudCategories: CloudCategory[],
  cloudCards: CloudCard[],
  cloudPrefs: CloudPreference[]
): Promise<void> {
  const nextBackup: SyncBackup = {
    id: `backup-${Date.now()}`,
    createdAt: Date.now(),
    reason,
    categoryCount: cloudCategories.length,
    cardCount: cloudCards.length,
    preferenceKeys: cloudPrefs
      .map((pref) => pref.key)
      .filter((key) => key !== "syncBackups" && key !== "syncBackupLatest")
      .sort(),
    sampleCategoryNames: cloudCategories.slice(0, 12).map((category) => category.name),
    sampleCardTitles: cloudCards.slice(0, 12).map((card) => card.title || card.url),
  };
  try {
    await writePreferences(client, userId, {
      syncBackups: [nextBackup],
      syncBackupLatest: nextBackup,
    });
  } catch (error) {
    console.warn("[Sync] Skipped cloud backup metadata:", error);
  }
}

function getCategorySectionsFromPrefs(
  cloudPrefsMap: CloudPreferenceMap
): Record<string, string> {
  const value = cloudPrefsMap.categorySectionIds?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function isCollectionSectionArray(value: unknown): value is CollectionSection[] {
  return Array.isArray(value) && value.every((item) => (
    item &&
    typeof item === "object" &&
    typeof (item as CollectionSection).id === "string" &&
    typeof (item as CollectionSection).name === "string"
  ));
}

function mergeSections(localSections: CollectionSection[], cloudSections: CollectionSection[]): CollectionSection[] {
  const byId = new Map<string, CollectionSection>();
  for (const section of [...cloudSections, ...localSections].map(normalizeSection)) {
    const current = byId.get(section.id);
    if (!current || (section.updatedAt || 0) >= (current.updatedAt || 0)) {
      byId.set(section.id, section);
    }
  }
  if (byId.size === 0) {
    const now = Date.now();
    byId.set("section-default", {
      id: "section-default",
      name: "\u4e3b\u9875",
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

function normalizeSection(section: CollectionSection): CollectionSection {
  if (section.id === "section-default" && ["\u6d93\u5a5a", "\u6ed1\u5a5a", "\u6350\u5a5a", "\u4e3b\u9875"].includes(section.name.trim())) {
    return { ...section, name: "\u4e3b\u9875", updatedAt: Math.max(section.updatedAt || 0, Date.now()) };
  }
  return section;
}

function hasLocalWarehouseData(
  categories: WarehouseCategory[],
  cards: WarehouseCard[],
  batches: ImportBatch[]
): boolean {
  return categories.length > 0 || cards.length > 0 || batches.length > 0;
}

function getNumberPreference(
  cloudPrefsMap: CloudPreferenceMap,
  key: string
): number {
  const value = cloudPrefsMap[key]?.value;
  return typeof value === "number" ? value : 0;
}

function isDefaultOnlySections(sections: CollectionSection[]): boolean {
  return sections.length === 0 || sections.every((section) => section.id === "section-default");
}

function categorySectionsAreDefaultOnly(sectionIds: Record<string, string>): boolean {
  const values = Object.values(sectionIds).filter(Boolean);
  return values.length === 0 || values.every((sectionId) => sectionId === "section-default");
}

function hasMultiSectionLayout(
  sections: CollectionSection[],
  categorySectionIds: Record<string, string>
): boolean {
  const sectionIds = new Set([
    ...sections.map((section) => section.id),
    ...Object.values(categorySectionIds),
  ].filter(Boolean));
  sectionIds.delete("section-default");
  return sectionIds.size > 0;
}

function localLayoutLooksCollapsed(
  sections: CollectionSection[],
  categorySectionIds: Record<string, string>
): boolean {
  if (!categorySectionsAreDefaultOnly(categorySectionIds)) return false;
  if (isDefaultOnlySections(sections)) return true;

  // A bad restore can keep the tab list (FOM/HODL/etc.) but lose every
  // category-to-tab assignment. That is still a collapsed layout and must not
  // be allowed to overwrite richer cloud section preferences.
  return sections.some((section) => section.id !== "section-default");
}

function mergeHiddenSites(localHiddenSites: HiddenSite[], cloudHiddenSites: HiddenSite[]): HiddenSite[] {
  const bySiteId = new Map<string, HiddenSite>();
  for (const site of [...cloudHiddenSites, ...localHiddenSites]) {
    const current = bySiteId.get(site.siteId);
    if (!current || site.hiddenAt >= current.hiddenAt) {
      bySiteId.set(site.siteId, site);
    }
  }
  return [...bySiteId.values()];
}

function mergeRecycleBin(localItems: RecycleBinItem[], cloudItems: RecycleBinItem[]): RecycleBinItem[] {
  const byId = new Map<string, RecycleBinItem>();
  for (const item of [...cloudItems, ...localItems]) {
    const current = byId.get(item.id);
    if (!current || item.deletedAt >= current.deletedAt) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => b.deletedAt - a.deletedAt);
}

// Main sync function

function isMissingTableError(message: string): boolean {
  return /Could not find the table 'public\.[^']+' in the schema cache/i.test(message)
    || /relation "public\.[^"]+" does not exist/i.test(message);
}

function formatCloudLoadError(resourceName: string, message: string): Error {
  if (isMissingTableError(message)) {
    return new Error(
      `Supabase \u6570\u636e\u5e93\u8868\u8fd8\u6ca1\u6709\u521d\u59cb\u5316\uff0c\u7f3a\u5c11 ${resourceName} \u76f8\u5173\u8868\u3002\u8bf7\u5728\u5f53\u524d Supabase \u9879\u76ee\u7684 SQL Editor \u8fd0\u884c src/storage/database/supabase-init.sql \u540e\u91cd\u65b0\u767b\u5f55\u540c\u6b65\u3002\u539f\u59cb\u9519\u8bef\uff1a${message}`
    );
  }
  return new Error(`\u52a0\u8f7d\u4e91\u7aef${resourceName}\u5931\u8d25: ${message}`);
}

export function syncData(userId: string, depth = 0): Promise<void> {
  return runWithSyncGate(() => syncDataUnsafe(userId, depth), depth, "syncData");
}

async function syncDataUnsafe(userId: string, depth: number): Promise<void> {
  console.log("[Sync] Starting sync for user:", userId);

  // Ensure Supabase is configured
  await initBrowserSupabase();

  // 1. Load local data
  const [
    rawLocalCards,
    rawLocalCategories,
    localHiddenSites,
    localPinnedIds,
    localPinnedBookmarkItems,
    localPinnedBookmarkItemsUpdatedAt,
    localWidths,
    localLayouts,
    localVisualScale,
    localLinkOpenMode,
    localSections,
    localActiveSectionId,
    localRecycleBin,
    localWarehouseCards,
    localWarehouseCategories,
    localImportBatches,
    localWarehouseUpdatedAt,
    localWallpaperPrefs,
    localWorkspaceResetAt,
    localSnapshotUpdatedAt,
    localTombstones,
    localPreferenceRevisions,
    localSearchEngine,
  ] = await Promise.all([
    getCards(),
    getCategories(),
    getHiddenSites(),
    getPinnedCategoryIds(),
    getPinnedBookmarkItems(),
    getPinnedBookmarkItemsUpdatedAt(),
    getCategoryWidths(),
    getCategoryLayouts(),
    getVisualScale(),
    getLinkOpenMode(),
    getSections(),
    getActiveSectionId(),
    getRecycleBin(),
    getWarehouseCards(),
    getWarehouseCategories(),
    getImportBatches(),
    getWarehouseUpdatedAt(),
    getWallpaperPrefs(),
    getWorkspaceResetAt(),
    getLocalSnapshotUpdatedAt(),
    getSyncTombstones(),
    getSyncPreferenceRevisions(),
    getSearchEngine(),
  ]);

  await createLocalDataSnapshot("before-cloud-sync", "\u4e91\u7aef\u540c\u6b65\u524d\u672c\u5730\u7248\u672c");
  const normalizedLocal = await normalizeLocalIdsForCloud(rawLocalCategories, rawLocalCards);
  let localCategories = normalizedLocal.categories;
  let localCards = normalizedLocal.cards;
  const syncStartLocalUpdatedAt = localSnapshotUpdatedAt;
  const dirtySets = await getSyncDirtySets();

  // 2. Load cloud data
  const client = getBrowserSupabaseClient();

  const [cloudCatResult, cloudCardResult, cloudPrefResult, cloudTombstoneResult] = await Promise.all([
    client.from("categories").select("*").eq("user_id", userId),
    client.from("cards").select("*").eq("user_id", userId),
    client.from("user_preferences").select("*").eq("user_id", userId),
    client.from("workspace_tombstones").select("*").eq("user_id", userId),
  ]);

  if (cloudCatResult.error) throw formatCloudLoadError("\u5206\u7c7b", cloudCatResult.error.message);
  if (cloudCardResult.error) throw formatCloudLoadError("\u5361\u7247", cloudCardResult.error.message);
  if (cloudPrefResult.error) throw formatCloudLoadError("\u504f\u597d", cloudPrefResult.error.message);
  if (cloudTombstoneResult.error) throw formatCloudLoadError("删除记录", cloudTombstoneResult.error.message);

  const cloudPrefs = (cloudPrefResult.data || []) as CloudPreference[];
  const cloudTombstones = ((cloudTombstoneResult.data || []) as CloudTombstone[]).map(cloudToLocalTombstone);
  const mergedTombstones = mergeSyncTombstones(localTombstones, cloudTombstones);
  const categoryTombstones = tombstoneMapForType(mergedTombstones, "category");
  const cardTombstones = tombstoneMapForType(mergedTombstones, "card");
  localCategories = filterEntitiesSupersededByTombstones(localCategories, categoryTombstones);
  localCards = filterEntitiesSupersededByTombstones(localCards, cardTombstones);
  const cloudPrefsMap = preferencesToMap(cloudPrefs);
  const cloudWorkspaceResetAt = getNumberPreference(cloudPrefsMap, WORKSPACE_RESET_PREF_KEY);
  const cloudWorkspaceResetRow = cloudPrefsMap[WORKSPACE_RESET_PREF_KEY];
  const workspaceResetResolution = resolvePreferenceByRevision({
    localValue: localWorkspaceResetAt,
    localVersion: localPreferenceRevisions[WORKSPACE_RESET_PREF_KEY],
    cloud: cloudWorkspaceResetRow ? {
      value: cloudWorkspaceResetAt,
      syncRevision: cloudWorkspaceResetRow.syncRevision,
      syncDeviceId: cloudWorkspaceResetRow.syncDeviceId,
      updatedAt: getPreferenceUpdatedAt(cloudPrefsMap, WORKSPACE_RESET_PREF_KEY),
    } : null,
    legacyValue: Math.max(localWorkspaceResetAt, cloudWorkspaceResetAt),
  });
  const workspaceResetAt = workspaceResetResolution.value;
  if (workspaceResetResolution.source === "cloud" && workspaceResetAt > localWorkspaceResetAt) {
    localCategories = [];
    localCards = [];
  }
  const cloudCategories = filterCloudRowsAfterReset(
    (cloudCatResult.data || []) as CloudCategory[],
    workspaceResetAt
  ).filter((row) => {
    const tombstone = categoryTombstones.get(row.id);
    return !tombstone || compareSyncVersions(cloudToLocalCategory(row), tombstone) > 0;
  });
  const activeCategoryIds = new Set([
    ...cloudCategories.map((category) => category.id),
    ...localCategories.map((category) => category.id),
  ]);
  const cloudCards = filterCloudRowsAfterReset(
    (cloudCardResult.data || []) as CloudCard[],
    workspaceResetAt
  ).filter((row) => {
    const tombstone = cardTombstones.get(row.id);
    return (!tombstone || compareSyncVersions(cloudToLocalCard(row), tombstone) > 0)
      && activeCategoryIds.has(row.category_id);
  });
  const prefCategorySections = getResetAwareCategorySections(cloudPrefsMap, workspaceResetAt);
  const prefSections = getResetAwareSections(cloudPrefsMap, workspaceResetAt);
  const localCategorySections = Object.fromEntries(
    localCategories.filter((category) => category.sectionId).map((category) => [category.id, category.sectionId as string])
  );
  const cloudSnapshotUpdatedAt = Math.max(getNumberPreference(cloudPrefsMap, "localSnapshotUpdatedAt"), cloudWorkspaceResetAt);
  const localResetWins = localWorkspaceResetAt > 0 && localWorkspaceResetAt >= cloudSnapshotUpdatedAt;
  if (workspaceResetAt !== localWorkspaceResetAt) {
    await withoutLocalChangeEvents(async () => {
      await saveWorkspaceResetAt(workspaceResetAt);
    });
  }
  const localSnapshotUpdatedAtAfterCloudLoad = await getLocalSnapshotUpdatedAt();
  const localChangedDuringCloudLoad = localSnapshotUpdatedAtAfterCloudLoad > localSnapshotUpdatedAt;
  if (localChangedDuringCloudLoad) {
    console.warn("[Sync] Local data changed while cloud was loading; aborting restore merge and pushing latest local snapshot instead.");
    await pushLocalSnapshotToCloud(userId, {}, depth + 1);
    return;
  }
  const localScore = localSnapshotContentScore({
    categories: localCategories,
    cards: localCards,
    recycleBin: localRecycleBin,
    warehouseCategories: localWarehouseCategories,
    warehouseCards: localWarehouseCards,
    warehouseBatches: localImportBatches,
  });
  const cloudScore = cloudSnapshotContentScore(cloudCategories, cloudCards, cloudPrefsMap, workspaceResetAt);
  const localLooksEmptyAgainstCloud = !localResetWins && cloudScore > 0 && localScore === 0;
  const localLooksMuchSmallerAgainstCloud = !localResetWins && (
    localSnapshotLooksMuchSmallerThanCloud(localScore, cloudScore)
    || localMainDataLooksMuchSmallerThanCloud(
      localCategories,
      localCards,
      cloudCategories,
      cloudCards
    )
  );
  const cloudHasRealLayout = prefSections.length > 0 || Object.keys(prefCategorySections).length > 0;
  const shouldProtectCloudLayout =
    !localResetWins
    &&
    hasMultiSectionLayout(prefSections, prefCategorySections)
    && localLayoutLooksCollapsed(localSections, localCategorySections);
  const shouldPreferCloudLayout =
    cloudHasRealLayout
    && (cloudSnapshotUpdatedAt > localSnapshotUpdatedAt || localLooksEmptyAgainstCloud || localLooksMuchSmallerAgainstCloud || shouldProtectCloudLayout);
  const shouldPreferLocalSnapshot =
    localResetWins
    || (
      localSnapshotUpdatedAt > cloudSnapshotUpdatedAt
      && !localLooksEmptyAgainstCloud
      && !localLooksMuchSmallerAgainstCloud
      && !shouldProtectCloudLayout
    );
  const categorySections = shouldPreferCloudLayout
    ? { ...localCategorySections, ...prefCategorySections }
    : { ...prefCategorySections, ...localCategorySections };
  const defaultSectionId = localSections.some((section) => section.id === "section-default")
    ? "section-default"
    : localSections[0]?.id || "section-default";

  // 3. Merge categories
  const localCatsForMerge = localCategories;

  const localCategoryIdSet = new Set(localCategories.map((category) => category.id));
  const localCardIdSet = new Set(localCards.map((card) => card.id));
  const cloudCategoriesForMerge = shouldPreferLocalSnapshot
    ? cloudCategories.filter((category) => localCategoryIdSet.has(category.id))
    : cloudCategories;
  const cloudCardsForMergeSource = shouldPreferLocalSnapshot
    ? cloudCards.filter((card) => localCardIdSet.has(card.id))
    : cloudCards;

  const cloudCatsForMerge = cloudCategoriesForMerge.map((c) => {
    const cloudCategory = cloudToLocalCategory(c);
    return {
      ...cloudCategory,
      sectionId: categorySections[c.id] || prefCategorySections[c.id],
    };
  });

  const catMerge = mergeBySyncVersion(localCatsForMerge, cloudCatsForMerge);

  // 4. Merge cards
  const localCardsForMerge = localCards;

  const cloudCardsForMerge = cloudCardsForMergeSource.map(cloudToLocalCard);

  const cardMerge = mergeBySyncVersion(localCardsForMerge, cloudCardsForMerge);

  console.log(`[Sync] Categories: ${catMerge.cloudToPull.length} pull, ${catMerge.localToPush.length + catMerge.localOnly.length} push, ${catMerge.cloudOnly.length} new from cloud`);
  console.log(`[Sync] Cards: ${cardMerge.cloudToPull.length} pull, ${cardMerge.localToPush.length + cardMerge.localOnly.length} push, ${cardMerge.cloudOnly.length} new from cloud`);

  // 5. Update local DB with merged data
  const mergedCategoriesBeforeDedupe = catMerge.merged;
  const mergedCardsBeforeDedupe = cardMerge.merged;

  const mergedCategories = mergedCategoriesBeforeDedupe.map((category) => {
    const preferredSectionId = categorySections[category.id];
    return {
      ...category,
      sectionId: shouldPreferCloudLayout && preferredSectionId
        ? preferredSectionId
        : category.sectionId || preferredSectionId || defaultSectionId,
    };
  });
  const mergedCards = mergedCardsBeforeDedupe;
  const mergedSectionsForGuard = shouldPreferCloudLayout
    ? mergeSections(localSections, prefSections)
    : mergeSections(prefSections, localSections);

  if (
    !localResetWins &&
    await localHasRicherStructureSnapshot(mergedCategories, mergedCards, mergedSectionsForGuard)
  ) {
    console.warn("[Sync] Refusing to write a flattened hierarchy while a richer local snapshot exists.");
    throw new Error(getFlattenedHierarchyGuardMessage());
  }

  await withoutLocalChangeEvents(async () => {
    await saveCategories(mergedCategories);
    await saveCards(mergedCards);
  });
  await saveSyncTombstones(mergedTombstones);

  // 6. Push only rows that are dirty, local-only, or newer locally. Clean rows
  // that already match cloud content are intentionally skipped.
  const cloudCategoryById = new Map(cloudCategories.map((category) => [category.id, category]));
  const cloudCardById = new Map(cloudCards.map((card) => [card.id, card]));
  const categoryCandidateIds = includeParentCategoryIds(
    new Set([...mergePushCandidateIds(catMerge), ...dirtySets.categories]),
    mergedCategories
  );
  const cardCandidateIds = new Set([...mergePushCandidateIds(cardMerge), ...dirtySets.cards]);
  const categorySyncSelection = selectChangedRowsForCloud(
    mergedCategories,
    categoryCandidateIds,
    cloudCategoryById,
    (category, cloudCategory) => cloudCategoryMatchesLocal(category, cloudCategory, userId)
  );
  const cardSyncSelection = selectChangedRowsForCloud(
    mergedCards,
    cardCandidateIds,
    cloudCardById,
    (card, cloudCard) => cloudCardMatchesLocal(card, cloudCard, userId)
  );

  await upsertSyncTombstones(client, userId, mergedTombstones, cloudTombstones);
  const rawCloudCards = (cloudCardResult.data || []) as CloudCard[];
  const rawCloudCategories = (cloudCatResult.data || []) as CloudCategory[];
  const tombstonedCloudCardIds = rawCloudCards
    .filter((row) => {
      const tombstone = cardTombstones.get(row.id);
      return tombstone && compareSyncVersions(tombstone, cloudToLocalCard(row)) >= 0;
    })
    .map((row) => row.id);
  const tombstonedCloudCategoryIds = rawCloudCategories
    .filter((row) => {
      const tombstone = categoryTombstones.get(row.id);
      return tombstone && compareSyncVersions(tombstone, cloudToLocalCategory(row)) >= 0;
    })
    .map((row) => row.id);
  await deleteRowsByIdsInChunks(client, "cards", tombstonedCloudCardIds, userId);
  await deleteRowsByIdsInChunks(client, "categories", tombstonedCloudCategoryIds, userId);
  await upsertCategoriesWithParents(client, categorySyncSelection.rowsToUpsert, userId);
  await upsertCardsInChunks(client, cardSyncSelection.rowsToUpsert, userId);

  // 7. Sync preferences. Login/restore sync intentionally does not delete
  // cloud-only rows; destructive cloud replacement is guarded in
  // pushLocalSnapshotToCloud only.
  const syncedCloudSnapshotUpdatedAt = await syncPreferences(
    client,
    userId,
    localHiddenSites,
    localPinnedIds,
    localPinnedBookmarkItems,
    localPinnedBookmarkItemsUpdatedAt,
    localWidths,
    localLayouts,
    localVisualScale,
    localLinkOpenMode,
    localSections,
    localActiveSectionId,
    Object.fromEntries(mergedCategories.map((category) => [category.id, category.sectionId || defaultSectionId])),
    localRecycleBin,
    localWarehouseCards,
    localWarehouseCategories,
    localImportBatches,
    localWarehouseUpdatedAt,
    localWallpaperPrefs,
    localWorkspaceResetAt,
    localLooksEmptyAgainstCloud || localLooksMuchSmallerAgainstCloud || shouldProtectCloudLayout ? 0 : localSnapshotUpdatedAt,
    cloudPrefs,
    localPreferenceRevisions,
    localSearchEngine
  );
  await clearSyncDirtyIds({
    categories: [...categorySyncSelection.resolvedIds, ...mergedTombstones.filter((item) => item.entityType === "category").map((item) => item.entityId)],
    cards: [...cardSyncSelection.resolvedIds, ...mergedTombstones.filter((item) => item.entityType === "card").map((item) => item.entityId)],
  });
  await saveLocalSnapshotSyncedAt(syncStartLocalUpdatedAt);
  await saveLastSeenCloudSnapshotUpdatedAt(syncedCloudSnapshotUpdatedAt);

  console.log("[Sync] Sync completed successfully");
}

export function pushLocalSnapshotToCloud(
  userId: string,
  options: { allowDestructiveClear?: boolean; skipStructureGuard?: boolean } = {},
  depth = 0
): Promise<void> {
  return runWithSyncGate(() => pushLocalSnapshotToCloudUnsafe(userId, options, depth), depth, "pushLocalSnapshotToCloud");
}

async function pushLocalSnapshotToCloudUnsafe(
  userId: string,
  options: { allowDestructiveClear?: boolean; skipStructureGuard?: boolean },
  depth: number
): Promise<void> {
  console.log("[Sync] Pushing local snapshot for user:", userId);

  await initBrowserSupabase();

  const [
    rawLocalCards,
    rawLocalCategories,
    localHiddenSites,
    localPinnedIds,
    localPinnedBookmarkItems,
    localPinnedBookmarkItemsUpdatedAt,
    localWidths,
    localLayouts,
    localVisualScale,
    localLinkOpenMode,
    localSections,
    localActiveSectionId,
    localRecycleBin,
    localWarehouseCards,
    localWarehouseCategories,
    localImportBatches,
    localWarehouseUpdatedAt,
    localWallpaperPrefs,
    localWorkspaceResetAt,
    localSnapshotUpdatedAt,
    localTombstones,
    localPreferenceRevisions,
    localSearchEngine,
  ] = await Promise.all([
    getCards(),
    getCategories(),
    getHiddenSites(),
    getPinnedCategoryIds(),
    getPinnedBookmarkItems(),
    getPinnedBookmarkItemsUpdatedAt(),
    getCategoryWidths(),
    getCategoryLayouts(),
    getVisualScale(),
    getLinkOpenMode(),
    getSections(),
    getActiveSectionId(),
    getRecycleBin(),
    getWarehouseCards(),
    getWarehouseCategories(),
    getImportBatches(),
    getWarehouseUpdatedAt(),
    getWallpaperPrefs(),
    getWorkspaceResetAt(),
    getLocalSnapshotUpdatedAt(),
    getSyncTombstones(),
    getSyncPreferenceRevisions(),
    getSearchEngine(),
  ]);

  await createLocalDataSnapshot("before-cloud-push", "\u63a8\u9001\u4e91\u7aef\u524d\u672c\u5730\u7248\u672c");
  const { categories: normalizedLocalCategories, cards: normalizedLocalCards } =
    await normalizeLocalIdsForCloud(rawLocalCategories, rawLocalCards);
  const syncStartLocalUpdatedAt = localSnapshotUpdatedAt;
  const dirtySets = await getSyncDirtySets();

  let localCategories = normalizedLocalCategories;
  let localCards = normalizedLocalCards;
  const snapshotUpdatedAt = Math.max(localSnapshotUpdatedAt, Date.now());
  const workspaceResetAt = localWorkspaceResetAt || (options.allowDestructiveClear ? snapshotUpdatedAt : 0);

  const client = getBrowserSupabaseClient();
  const [cloudCatResult, cloudCardResult, cloudPrefResult, cloudTombstoneResult] = await Promise.all([
    client.from("categories").select("*").eq("user_id", userId),
    client.from("cards").select("*").eq("user_id", userId),
    client.from("user_preferences").select("*").eq("user_id", userId),
    client.from("workspace_tombstones").select("*").eq("user_id", userId),
  ]);

  if (cloudCatResult.error) throw formatCloudLoadError("\u5206\u7c7b", cloudCatResult.error.message);
  if (cloudCardResult.error) throw formatCloudLoadError("\u5361\u7247", cloudCardResult.error.message);

  if (cloudPrefResult.error) throw formatCloudLoadError("\u504f\u597d", cloudPrefResult.error.message);
  if (cloudTombstoneResult.error) throw formatCloudLoadError("删除记录", cloudTombstoneResult.error.message);
  const cloudTombstones = ((cloudTombstoneResult.data || []) as CloudTombstone[]).map(cloudToLocalTombstone);
  const mergedTombstones = mergeSyncTombstones(localTombstones, cloudTombstones);
  const categoryTombstones = tombstoneMapForType(mergedTombstones, "category");
  const cardTombstones = tombstoneMapForType(mergedTombstones, "card");
  localCategories = filterEntitiesSupersededByTombstones(localCategories, categoryTombstones);
  localCards = filterEntitiesSupersededByTombstones(localCards, cardTombstones);
  const cloudCategories = ((cloudCatResult.data || []) as CloudCategory[]).filter((row) => {
    const tombstone = categoryTombstones.get(row.id);
    return !tombstone || compareSyncVersions(cloudToLocalCategory(row), tombstone) > 0;
  });
  const activeCategoryIds = new Set([
    ...cloudCategories.map((category) => category.id),
    ...localCategories.map((category) => category.id),
  ]);
  const cloudCards = ((cloudCardResult.data || []) as CloudCard[]).filter((row) => {
    const tombstone = cardTombstones.get(row.id);
    return (!tombstone || compareSyncVersions(cloudToLocalCard(row), tombstone) > 0)
      && activeCategoryIds.has(row.category_id);
  });
  await withoutLocalChangeEvents(async () => {
    await saveCategories(localCategories);
    await saveCards(localCards);
  });
  await saveSyncTombstones(mergedTombstones);
  const cloudPrefs = (cloudPrefResult.data || []) as CloudPreference[];
  const cloudPrefsMap = preferencesToMap(cloudPrefs);
  const cloudWorkspaceResetAt = getNumberPreference(cloudPrefsMap, WORKSPACE_RESET_PREF_KEY);
  const cloudWorkspaceResetRow = cloudPrefsMap[WORKSPACE_RESET_PREF_KEY];
  const resetResolution = resolvePreferenceByRevision({
    localValue: localWorkspaceResetAt,
    localVersion: localPreferenceRevisions[WORKSPACE_RESET_PREF_KEY],
    cloud: cloudWorkspaceResetRow ? {
      value: cloudWorkspaceResetAt,
      syncRevision: cloudWorkspaceResetRow.syncRevision,
      syncDeviceId: cloudWorkspaceResetRow.syncDeviceId,
      updatedAt: getPreferenceUpdatedAt(cloudPrefsMap, WORKSPACE_RESET_PREF_KEY),
    } : null,
    legacyValue: Math.max(localWorkspaceResetAt, cloudWorkspaceResetAt),
  });
  const cloudResetWins = resetResolution.source === "cloud"
    || (resetResolution.source === "legacy" && cloudWorkspaceResetAt > localWorkspaceResetAt);
  if (!options.allowDestructiveClear && cloudResetWins) {
    console.warn("[Sync] Cloud workspace reset is newer than this tab; pulling before push.");
    await syncData(userId, depth + 1);
    return;
  }
  const cloudSnapshotUpdatedAt = Math.max(getNumberPreference(cloudPrefsMap, "localSnapshotUpdatedAt"), cloudWorkspaceResetAt);
  const resetReplacement = workspaceResetAt > 0 && workspaceResetAt >= cloudSnapshotUpdatedAt;
  const cloudSections = getResetAwareSections(cloudPrefsMap, workspaceResetAt);
  const cloudCategorySectionIds = getResetAwareCategorySections(cloudPrefsMap, workspaceResetAt);
  const localCategorySectionIds = Object.fromEntries(
    localCategories.map((category) => [category.id, category.sectionId || localActiveSectionId || "section-default"])
  );
  if (options.allowDestructiveClear) {
    await writePreferences(client, userId, {
      currentWorkspaceResetAt: workspaceResetAt,
      collectionSections: localSections,
      activeCollectionSectionId: localActiveSectionId,
      categorySectionIds: localCategorySectionIds,
      recycleBin: localRecycleBin,
      warehouseCards: localWarehouseCards,
      warehouseCategories: localWarehouseCategories,
      warehouseImportBatches: localImportBatches,
      warehouseUpdatedAt: localWarehouseUpdatedAt,
      wallpaperPrefs: toWallpaperSyncedSettings(localWallpaperPrefs),
      searchEngine: localSearchEngine,
      localSnapshotUpdatedAt: snapshotUpdatedAt,
    }, { revisions: localPreferenceRevisions, cloudPrefsMap });
  }
  if (
    !options.allowDestructiveClear &&
    !resetReplacement &&
    hasMultiSectionLayout(cloudSections, cloudCategorySectionIds)
    && localLayoutLooksCollapsed(localSections, localCategorySectionIds)
  ) {
    console.warn("[Sync] Refusing to push a default-only local section layout over a multi-section cloud layout.");
    await syncData(userId, depth + 1);
    return;
  }
  if (!options.allowDestructiveClear && !resetReplacement && cloudSnapshotUpdatedAt > localSnapshotUpdatedAt) {
    console.warn("[Sync] Cloud snapshot is newer than local; pulling/merging before push.");
    await syncData(userId, depth + 1);
    return;
  }
  const localScore = localSnapshotContentScore({
    categories: localCategories,
    cards: localCards,
    recycleBin: localRecycleBin,
    warehouseCategories: localWarehouseCategories,
    warehouseCards: localWarehouseCards,
    warehouseBatches: localImportBatches,
  });
  const cloudScore = cloudSnapshotContentScore(cloudCategories, cloudCards, cloudPrefsMap, workspaceResetAt);
  if (!options.allowDestructiveClear && !resetReplacement && cloudScore > 0 && localScore === 0) {
    console.warn("[Sync] Refusing to push an empty local snapshot over non-empty cloud data.");
    await syncData(userId, depth + 1);
    return;
  }
  if (
    !options.allowDestructiveClear &&
    !resetReplacement &&
    !options.skipStructureGuard &&
    await localHasRicherStructureSnapshot(localCategories, localCards, localSections)
  ) {
    console.warn("[Sync] Refusing to push a flattened local hierarchy while a richer local snapshot exists.");
    throw new Error(getFlattenedHierarchyGuardMessage());
  }
  if (
    !options.allowDestructiveClear &&
    !resetReplacement &&
    (
      localSnapshotLooksMuchSmallerThanCloud(localScore, cloudScore)
      || localMainDataLooksMuchSmallerThanCloud(localCategories, localCards, cloudCategories, cloudCards)
    )
  ) {
    console.warn("[Sync] Refusing to push a much smaller local snapshot over richer cloud data.");
    await syncData(userId, depth + 1);
    return;
  }

  const rawCloudCards = (cloudCardResult.data || []) as CloudCard[];
  const rawCloudCategories = (cloudCatResult.data || []) as CloudCategory[];
  const tombstonedCloudCardIds = rawCloudCards
    .filter((row) => {
      const tombstone = cardTombstones.get(row.id);
      return tombstone && compareSyncVersions(tombstone, cloudToLocalCard(row)) >= 0;
    })
    .map((row) => row.id);
  const tombstonedCloudCategoryIds = rawCloudCategories
    .filter((row) => {
      const tombstone = categoryTombstones.get(row.id);
      return tombstone && compareSyncVersions(tombstone, cloudToLocalCategory(row)) >= 0;
    })
    .map((row) => row.id);
  const willDeleteCloudRows = tombstonedCloudCardIds.length > 0 || tombstonedCloudCategoryIds.length > 0;
  if (willDeleteCloudRows) {
    await createLocalDataSnapshot("before-cloud-row-delete", "\u5220\u9664\u4e91\u7aef\u884c\u524d\u672c\u5730\u7248\u672c", { force: true });
    await writeSyncBackup(client, userId, "before-local-snapshot-replace", cloudCategories, cloudCards, cloudPrefs);
  }
  const cloudCategoryById = new Map(cloudCategories.map((category) => [category.id, category]));
  const cloudCardById = new Map(cloudCards.map((card) => [card.id, card]));
  const categoryCandidateIds = includeParentCategoryIds(
    collectLocalSnapshotPushIds(localCategories, cloudCategoryById, new Set(dirtySets.categories)),
    localCategories
  );
  const cardCandidateIds = collectLocalSnapshotPushIds(localCards, cloudCardById, new Set(dirtySets.cards));
  const categorySyncSelection = selectChangedRowsForCloud(
    localCategories,
    categoryCandidateIds,
    cloudCategoryById,
    (category, cloudCategory) => cloudCategoryMatchesLocal(category, cloudCategory, userId)
  );
  const cardSyncSelection = selectChangedRowsForCloud(
    localCards,
    cardCandidateIds,
    cloudCardById,
    (card, cloudCard) => cloudCardMatchesLocal(card, cloudCard, userId)
  );

  await upsertSyncTombstones(client, userId, mergedTombstones, cloudTombstones);
  await deleteRowsByIdsInChunks(client, "cards", tombstonedCloudCardIds, userId);
  await deleteRowsByIdsInChunks(client, "categories", tombstonedCloudCategoryIds, userId);
  await upsertCategoriesWithParents(client, categorySyncSelection.rowsToUpsert, userId);
  await upsertCardsInChunks(client, cardSyncSelection.rowsToUpsert, userId);

  await writePreferences(client, userId, {
    currentWorkspaceResetAt: workspaceResetAt,
    hiddenSites: localHiddenSites,
    pinnedCategoryIds: localPinnedIds,
    pinnedBookmarkItems: localPinnedBookmarkItems,
    pinnedBookmarkItemsUpdatedAt: localPinnedBookmarkItemsUpdatedAt,
    categoryWidths: localWidths,
    categoryLayouts: localLayouts,
    visualScale: localVisualScale,
    linkOpenMode: localLinkOpenMode,
    collectionSections: localSections,
    activeCollectionSectionId: localActiveSectionId,
    categorySectionIds: localCategorySectionIds,
    recycleBin: localRecycleBin,
    warehouseCards: localWarehouseCards,
    warehouseCategories: localWarehouseCategories,
    warehouseImportBatches: localImportBatches,
    warehouseUpdatedAt: localWarehouseUpdatedAt,
    wallpaperPrefs: toWallpaperSyncedSettings(localWallpaperPrefs),
    searchEngine: localSearchEngine,
    localSnapshotUpdatedAt: snapshotUpdatedAt,
  }, { revisions: localPreferenceRevisions, cloudPrefsMap });
  await clearSyncDirtyIds({
    categories: [...categorySyncSelection.resolvedIds, ...mergedTombstones.filter((item) => item.entityType === "category").map((item) => item.entityId)],
    cards: [...cardSyncSelection.resolvedIds, ...mergedTombstones.filter((item) => item.entityType === "card").map((item) => item.entityId)],
  });
  await saveLocalSnapshotSyncedAt(syncStartLocalUpdatedAt);
  await saveLastSeenCloudSnapshotUpdatedAt(snapshotUpdatedAt);

  console.log("[Sync] Local snapshot pushed successfully");
}

// Sync preferences

function isCategoryLayoutPreference(value: unknown): value is CategoryLayoutPreference {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  const hasWidth = typeof raw.widthPercent === "number" && Number.isFinite(raw.widthPercent);
  const hasColumns = typeof raw.columns === "number" && Number.isFinite(raw.columns);
  const hasLocked = typeof raw.locked === "boolean";
  const hasUpdatedAt = typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt);
  return (hasWidth || hasColumns || hasLocked) && hasUpdatedAt;
}

function normalizeCategoryLayouts(value: unknown): Record<string, CategoryLayoutPreference> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const layouts: Record<string, CategoryLayoutPreference> = {};
  for (const [categoryId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isCategoryLayoutPreference(raw)) continue;
    layouts[categoryId] = {
      widthPercent: typeof raw.widthPercent === "number" ? Math.max(8, Math.min(100, raw.widthPercent)) : undefined,
      columns: typeof raw.columns === "number" ? Math.max(1, Math.min(8, Math.round(raw.columns))) : undefined,
      locked: typeof raw.locked === "boolean" ? raw.locked : undefined,
      updatedAt: raw.updatedAt,
    };
  }
  return layouts;
}

export function mergeCategoryLayouts(
  localLayouts: Record<string, CategoryLayoutPreference>,
  cloudLayouts: Record<string, CategoryLayoutPreference>
): Record<string, CategoryLayoutPreference> {
  const merged: Record<string, CategoryLayoutPreference> = { ...cloudLayouts };
  for (const [categoryId, localLayout] of Object.entries(localLayouts)) {
    const cloudLayout = merged[categoryId];
    if (!cloudLayout || (localLayout.updatedAt || 0) >= (cloudLayout.updatedAt || 0)) {
      merged[categoryId] = localLayout;
    }
  }
  return merged;
}

function getWallpaperPrefsUpdatedAt(prefs: Partial<WallpaperPrefs> | WallpaperSyncedSettings | null | undefined): number {
  if (!prefs) return 0;
  if (typeof prefs.settingsUpdatedAt === "number" && Number.isFinite(prefs.settingsUpdatedAt)) {
    return prefs.settingsUpdatedAt;
  }
  return "updatedAt" in prefs && typeof prefs.updatedAt === "number" && Number.isFinite(prefs.updatedAt) ? prefs.updatedAt : 0;
}

function getCloudWallpaperSettings(cloudPrefsMap: CloudPreferenceMap): WallpaperSyncedSettings | null {
  const value = cloudPrefsMap.wallpaperPrefs?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return toWallpaperSyncedSettings(value as Partial<WallpaperPrefs>);
}

export function mergeWallpaperPrefsByUpdatedAt(
  localWallpaperPrefs: WallpaperPrefs,
  cloudWallpaperPrefs: Partial<WallpaperPrefs> | WallpaperSyncedSettings | null
): WallpaperPrefsMergeResult {
  if (!cloudWallpaperPrefs) {
    return {
      prefs: localWallpaperPrefs,
      shouldApplyCloud: false,
    };
  }

  const localUpdatedAt = getWallpaperPrefsUpdatedAt(localWallpaperPrefs);
  const cloudSettings = toWallpaperSyncedSettings(cloudWallpaperPrefs);
  const cloudUpdatedAt = getWallpaperPrefsUpdatedAt(cloudSettings);
  if (cloudUpdatedAt > localUpdatedAt) {
    return {
      prefs: applyWallpaperSyncedSettings(localWallpaperPrefs, cloudSettings),
      shouldApplyCloud: true,
    };
  }

  return {
    prefs: localWallpaperPrefs,
    shouldApplyCloud: false,
  };
}

async function applySyncedWallpaperPrefsIfNeeded(
  mergedWallpaperPrefs: WallpaperPrefs,
  shouldApplyCloud: boolean
): Promise<void> {
  if (!shouldApplyCloud) return;

  await withoutLocalChangeEvents(async () => {
    await saveSyncedWallpaperPrefs(mergedWallpaperPrefs);
  });
  useWallpaperStore.setState({ isReady: false });
  await useWallpaperStore.getState().initialize();
}

async function syncPreferences(
  client: SupabaseClient,
  userId: string,
  localHiddenSites: HiddenSite[],
  localPinnedIds: string[],
  localPinnedBookmarkItems: PinnedBookmarkItem[],
  localPinnedBookmarkItemsUpdatedAt: number,
  localWidths: Record<string, number>,
  localLayouts: Record<string, CategoryLayoutPreference>,
  localVisualScale: number,
  localLinkOpenMode: LinkOpenMode,
  localSections: CollectionSection[],
  localActiveSectionId: string | null,
  localCategorySectionIds: Record<string, string>,
  localRecycleBin: RecycleBinItem[],
  localWarehouseCards: WarehouseCard[],
  localWarehouseCategories: WarehouseCategory[],
  localImportBatches: ImportBatch[],
  localWarehouseUpdatedAt: number,
  localWallpaperPrefs: WallpaperPrefs,
  localWorkspaceResetAt: number,
  localSnapshotUpdatedAt: number,
  cloudPrefs: CloudPreference[],
  localPreferenceRevisions: SyncPreferenceRevisions,
  localSearchEngine: SearchEngineId
): Promise<number> {
  const cloudPrefsMap = preferencesToMap(cloudPrefs);
  const resolvedPreferenceRevisions: SyncPreferenceRevisions = { ...localPreferenceRevisions };

  function resolvePreference<T>(key: string, localValue: T, legacyValue: T) {
    const cloudRow = cloudPrefsMap[key];
    const result = resolvePreferenceByRevision({
      localValue,
      localVersion: localPreferenceRevisions[key],
      cloud: cloudRow ? {
        value: cloudRow.value as T,
        syncRevision: cloudRow.syncRevision,
        syncDeviceId: cloudRow.syncDeviceId,
        updatedAt: getPreferenceUpdatedAt(cloudPrefsMap, key),
      } : null,
      legacyValue,
    });
    if (result.version) resolvedPreferenceRevisions[key] = result.version;
    return result;
  }

  const cloudWorkspaceResetAt = getNumberPreference(cloudPrefsMap, WORKSPACE_RESET_PREF_KEY);
  const workspaceResetResolution = resolvePreference(
    WORKSPACE_RESET_PREF_KEY,
    localWorkspaceResetAt,
    Math.max(localWorkspaceResetAt, cloudWorkspaceResetAt)
  );
  const workspaceResetAt = typeof workspaceResetResolution.value === "number"
    ? workspaceResetResolution.value
    : 0;
  const cloudResetIsNewerThanLocal = workspaceResetResolution.source === "cloud"
    ? workspaceResetAt > localSnapshotUpdatedAt
    : cloudWorkspaceResetAt > localWorkspaceResetAt && cloudWorkspaceResetAt > localSnapshotUpdatedAt;
  if (workspaceResetAt !== localWorkspaceResetAt) {
    await withoutLocalChangeEvents(async () => {
      await saveWorkspaceResetAt(workspaceResetAt);
    });
  }

  const cloudHiddenSites = shouldIgnoreCloudPreference(cloudPrefsMap, "hiddenSites", workspaceResetAt)
    ? []
    : Array.isArray(cloudPrefsMap.hiddenSites?.value) ? cloudPrefsMap.hiddenSites.value as HiddenSite[] : [];
  const legacyMergedHiddenSites = mergeHiddenSites(
    cloudResetIsNewerThanLocal ? [] : localHiddenSites,
    cloudHiddenSites
  );
  const mergedHiddenSites = resolvePreference("hiddenSites", localHiddenSites, legacyMergedHiddenSites).value;
  if (JSON.stringify(mergedHiddenSites) !== JSON.stringify(localHiddenSites)) {
    await withoutLocalChangeEvents(async () => {
      await saveHiddenSites(mergedHiddenSites);
    });
  }

  const cloudPinnedIds = !shouldIgnoreCloudPreference(cloudPrefsMap, "pinnedCategoryIds", workspaceResetAt) && Array.isArray(cloudPrefsMap.pinnedCategoryIds?.value)
    ? cloudPrefsMap.pinnedCategoryIds.value as string[]
    : [];
  const legacyMergedPinnedIds = [...new Set([...cloudPinnedIds, ...(cloudResetIsNewerThanLocal ? [] : localPinnedIds)])];
  const mergedPinnedIds = resolvePreference("pinnedCategoryIds", localPinnedIds, legacyMergedPinnedIds).value;
  if (JSON.stringify(mergedPinnedIds) !== JSON.stringify(localPinnedIds)) {
    await withoutLocalChangeEvents(async () => {
      await savePinnedCategoryIds(mergedPinnedIds);
    });
  }

  const cloudPinnedBookmarkItems = !shouldIgnoreCloudPreference(cloudPrefsMap, "pinnedBookmarkItems", workspaceResetAt)
    && Array.isArray(cloudPrefsMap.pinnedBookmarkItems?.value)
    ? cloudPrefsMap.pinnedBookmarkItems.value as PinnedBookmarkItem[]
    : [];
  const cloudPinnedBookmarkItemsUpdatedAt = shouldIgnoreCloudPreference(cloudPrefsMap, "pinnedBookmarkItemsUpdatedAt", workspaceResetAt)
    ? 0
    : Math.max(
        getNumberPreference(cloudPrefsMap, "pinnedBookmarkItemsUpdatedAt"),
        getPreferenceUpdatedAt(cloudPrefsMap, "pinnedBookmarkItems")
      );
  const localPinnedBookmarkItemsForMerge = cloudResetIsNewerThanLocal ? [] : localPinnedBookmarkItems;
  const localPinnedBookmarkItemsUpdatedAtForMerge = cloudResetIsNewerThanLocal ? 0 : localPinnedBookmarkItemsUpdatedAt;
  const legacyMergedPinnedBookmarkUpdatedAt = Math.max(
    localPinnedBookmarkItemsUpdatedAtForMerge,
    cloudPinnedBookmarkItemsUpdatedAt
  );
  const legacyMergedPinnedBookmarkItems = cloudResetIsNewerThanLocal || cloudPinnedBookmarkItemsUpdatedAt > localPinnedBookmarkItemsUpdatedAtForMerge
    ? normalizePinnedBookmarkItems(cloudPinnedBookmarkItems)
    : localPinnedBookmarkItemsUpdatedAtForMerge > cloudPinnedBookmarkItemsUpdatedAt
      ? normalizePinnedBookmarkItems(localPinnedBookmarkItemsForMerge)
      : mergePinnedBookmarkPreferences(cloudPinnedBookmarkItems, localPinnedBookmarkItemsForMerge);
  const mergedPinnedBookmarkItems = resolvePreference(
    "pinnedBookmarkItems",
    localPinnedBookmarkItems,
    legacyMergedPinnedBookmarkItems
  ).value;
  const mergedPinnedBookmarkUpdatedAt = resolvePreference(
    "pinnedBookmarkItemsUpdatedAt",
    localPinnedBookmarkItemsUpdatedAt,
    legacyMergedPinnedBookmarkUpdatedAt
  ).value;
  if (JSON.stringify(mergedPinnedBookmarkItems) !== JSON.stringify(localPinnedBookmarkItems)) {
    await withoutLocalChangeEvents(async () => {
      await savePinnedBookmarkItems(mergedPinnedBookmarkItems, mergedPinnedBookmarkUpdatedAt || Date.now());
    });
  }

  const cloudWidths = shouldIgnoreCloudPreference(cloudPrefsMap, "categoryWidths", workspaceResetAt)
    ? null
    : cloudPrefsMap.categoryWidths?.value;
  const localWidthsForMerge = cloudResetIsNewerThanLocal ? {} : localWidths;
  const legacyMergedWidths = Object.keys(localWidthsForMerge).length > 0 || !cloudWidths || Array.isArray(cloudWidths)
    ? localWidthsForMerge
    : cloudWidths as Record<string, number>;
  const mergedWidths = resolvePreference("categoryWidths", localWidths, legacyMergedWidths).value;
  if (JSON.stringify(mergedWidths) !== JSON.stringify(localWidths)) {
    await withoutLocalChangeEvents(async () => {
      await saveCategoryWidths(mergedWidths);
    });
  }

  const cloudLayouts = shouldIgnoreCloudPreference(cloudPrefsMap, "categoryLayouts", workspaceResetAt)
    ? {}
    : normalizeCategoryLayouts(cloudPrefsMap.categoryLayouts?.value);
  const localLayoutsForMerge = cloudResetIsNewerThanLocal ? {} : localLayouts;
  const legacyMergedLayouts = mergeCategoryLayouts(localLayoutsForMerge, cloudLayouts);
  const mergedLayouts = resolvePreference("categoryLayouts", localLayouts, legacyMergedLayouts).value;
  if (JSON.stringify(mergedLayouts) !== JSON.stringify(localLayouts)) {
    await withoutLocalChangeEvents(async () => {
      await saveCategoryLayouts(mergedLayouts);
    });
  }

  const cloudVisualScale = shouldIgnoreCloudPreference(cloudPrefsMap, "visualScale", workspaceResetAt)
    ? null
    : cloudPrefsMap.visualScale?.value;
  const localVisualScaleForMerge = cloudResetIsNewerThanLocal ? DEFAULT_VISUAL_SCALE : localVisualScale;
  const cloudVisualScaleForMerge =
    cloudVisualScale === 90 && localVisualScaleForMerge === DEFAULT_VISUAL_SCALE
      ? DEFAULT_VISUAL_SCALE
      : cloudVisualScale;
  const legacyMergedVisualScale = typeof cloudVisualScaleForMerge === "number" && localVisualScaleForMerge === DEFAULT_VISUAL_SCALE
    ? cloudVisualScaleForMerge
    : localVisualScaleForMerge;
  const mergedVisualScale = resolvePreference("visualScale", localVisualScale, legacyMergedVisualScale).value;
  if (mergedVisualScale !== localVisualScale) {
    await withoutLocalChangeEvents(async () => {
      await saveVisualScale(mergedVisualScale);
    });
  }

  const cloudLinkOpenMode = shouldIgnoreCloudPreference(cloudPrefsMap, "linkOpenMode", workspaceResetAt)
    ? null
    : cloudPrefsMap.linkOpenMode?.value;
  const localLinkOpenModeForMerge = cloudResetIsNewerThanLocal ? "new-background-tab" : localLinkOpenMode;
  const legacyMergedLinkOpenMode = isLinkOpenMode(cloudLinkOpenMode) && localLinkOpenModeForMerge === "new-background-tab"
    ? cloudLinkOpenMode
    : localLinkOpenModeForMerge;
  const mergedLinkOpenMode = resolvePreference("linkOpenMode", localLinkOpenMode, legacyMergedLinkOpenMode).value;
  if (mergedLinkOpenMode !== localLinkOpenMode) {
    await withoutLocalChangeEvents(async () => {
      await saveLinkOpenMode(mergedLinkOpenMode);
    });
  }

  const cloudSections = getResetAwareSections(cloudPrefsMap, workspaceResetAt);
  const cloudSnapshotUpdatedAt = Math.max(getNumberPreference(cloudPrefsMap, "localSnapshotUpdatedAt"), cloudWorkspaceResetAt);
  const cloudCategorySectionIds = getResetAwareCategorySections(cloudPrefsMap, workspaceResetAt);
  const localSectionsForMerge = cloudResetIsNewerThanLocal ? [] : localSections;
  const localCategorySectionIdsForMerge = cloudResetIsNewerThanLocal ? {} : localCategorySectionIds;
  const cloudHasRealLayout = cloudSections.length > 0 || Object.keys(cloudCategorySectionIds).length > 0;
  const shouldProtectCloudLayout =
    hasMultiSectionLayout(cloudSections, cloudCategorySectionIds)
    && localLayoutLooksCollapsed(localSectionsForMerge, localCategorySectionIdsForMerge);
  const localLayoutWasMarkedUnsafe = cloudHasRealLayout && localSnapshotUpdatedAt === 0;
  const shouldPreferCloudLayout =
    cloudHasRealLayout && (cloudSnapshotUpdatedAt > localSnapshotUpdatedAt || shouldProtectCloudLayout || localLayoutWasMarkedUnsafe);
  const shouldPreferLocalLayout = localSnapshotUpdatedAt > 0 && localSnapshotUpdatedAt > cloudSnapshotUpdatedAt && !shouldPreferCloudLayout;

  const legacyMergedSections = shouldPreferCloudLayout
    ? mergeSections([], cloudSections)
    : shouldPreferLocalLayout
      ? mergeSections(localSectionsForMerge, [])
      : mergeSections(localSectionsForMerge, cloudSections);
  const resolvedSections = resolvePreference("collectionSections", localSections, legacyMergedSections).value;
  const mergedSections = mergeSections(resolvedSections, []);
  if (JSON.stringify(mergedSections) !== JSON.stringify(localSections)) {
    await withoutLocalChangeEvents(async () => {
      await saveSections(mergedSections);
    });
  }

  const cloudActiveSectionId = !shouldIgnoreCloudPreference(cloudPrefsMap, "activeCollectionSectionId", workspaceResetAt)
    && typeof cloudPrefsMap.activeCollectionSectionId?.value === "string"
    ? cloudPrefsMap.activeCollectionSectionId.value
    : null;
  const legacyMergedActiveSectionId = shouldPreferCloudLayout
    ? cloudActiveSectionId || localActiveSectionId || mergedSections[0]?.id || "section-default"
    : localActiveSectionId || cloudActiveSectionId || mergedSections[0]?.id || "section-default";
  const mergedActiveSectionId = resolvePreference(
    "activeCollectionSectionId",
    localActiveSectionId || "section-default",
    legacyMergedActiveSectionId
  ).value;
  if (mergedActiveSectionId !== localActiveSectionId) {
    await withoutLocalChangeEvents(async () => {
      await saveActiveSectionId(mergedActiveSectionId);
    });
  }

  const legacyMergedCategorySectionIds = {
    ...(shouldPreferCloudLayout ? localCategorySectionIdsForMerge : shouldPreferLocalLayout ? {} : cloudCategorySectionIds),
    ...(shouldPreferCloudLayout ? cloudCategorySectionIds : localCategorySectionIdsForMerge),
  };
  const mergedCategorySectionIds = resolvePreference(
    "categorySectionIds",
    localCategorySectionIds,
    legacyMergedCategorySectionIds
  ).value;

  const cloudRecycleBin = !shouldIgnoreCloudPreference(cloudPrefsMap, "recycleBin", workspaceResetAt)
    && Array.isArray(cloudPrefsMap.recycleBin?.value)
    ? cloudPrefsMap.recycleBin.value as RecycleBinItem[]
    : [];
  const localRecycleBinForMerge = cloudResetIsNewerThanLocal ? [] : localRecycleBin;
  const legacyMergedRecycleBin = shouldPreferCloudLayout
    ? cloudRecycleBin
    : shouldPreferLocalLayout
      ? localRecycleBinForMerge
      : mergeRecycleBin(localRecycleBinForMerge, cloudRecycleBin);
  const mergedRecycleBin = resolvePreference("recycleBin", localRecycleBin, legacyMergedRecycleBin).value;
  if (JSON.stringify(mergedRecycleBin) !== JSON.stringify(localRecycleBin)) {
    await withoutLocalChangeEvents(async () => {
      await saveRecycleBin(mergedRecycleBin);
    });
  }

  const cloudWarehouseCards = !shouldIgnoreCloudPreference(cloudPrefsMap, "warehouseCards", workspaceResetAt)
    && isNonEmptyArray(cloudPrefsMap.warehouseCards?.value)
    ? cloudPrefsMap.warehouseCards.value as WarehouseCard[]
    : [];
  const cloudWarehouseCategories = !shouldIgnoreCloudPreference(cloudPrefsMap, "warehouseCategories", workspaceResetAt)
    && isNonEmptyArray(cloudPrefsMap.warehouseCategories?.value)
    ? cloudPrefsMap.warehouseCategories.value as WarehouseCategory[]
    : [];
  const cloudImportBatches = !shouldIgnoreCloudPreference(cloudPrefsMap, "warehouseImportBatches", workspaceResetAt)
    && isNonEmptyArray(cloudPrefsMap.warehouseImportBatches?.value)
    ? cloudPrefsMap.warehouseImportBatches.value as ImportBatch[]
    : [];
  const cloudHasWarehouse = hasLocalWarehouseData(cloudWarehouseCategories, cloudWarehouseCards, cloudImportBatches);
  const cloudWarehouseUpdatedAt = shouldIgnoreCloudPreference(cloudPrefsMap, "warehouseUpdatedAt", workspaceResetAt)
    ? 0
    : getNumberPreference(cloudPrefsMap, "warehouseUpdatedAt");
  const shouldPullCloudWarehouse = !cloudResetIsNewerThanLocal && cloudHasWarehouse && cloudWarehouseUpdatedAt > localWarehouseUpdatedAt;
  const localWarehouseCardsForMerge = cloudResetIsNewerThanLocal ? [] : localWarehouseCards;
  const localWarehouseCategoriesForMerge = cloudResetIsNewerThanLocal ? [] : localWarehouseCategories;
  const localImportBatchesForMerge = cloudResetIsNewerThanLocal ? [] : localImportBatches;
  const localWarehouseUpdatedAtForMerge = cloudResetIsNewerThanLocal ? 0 : localWarehouseUpdatedAt;

  const legacyWarehouseCards = shouldPullCloudWarehouse ? cloudWarehouseCards : localWarehouseCardsForMerge;
  const legacyWarehouseCategories = shouldPullCloudWarehouse ? cloudWarehouseCategories : localWarehouseCategoriesForMerge;
  const legacyWarehouseImportBatches = shouldPullCloudWarehouse ? cloudImportBatches : localImportBatchesForMerge;
  const legacyWarehouseUpdatedAt = shouldPullCloudWarehouse ? cloudWarehouseUpdatedAt : localWarehouseUpdatedAtForMerge;
  const warehouseCards = resolvePreference("warehouseCards", localWarehouseCards, legacyWarehouseCards).value;
  const warehouseCategories = resolvePreference("warehouseCategories", localWarehouseCategories, legacyWarehouseCategories).value;
  const warehouseImportBatches = resolvePreference("warehouseImportBatches", localImportBatches, legacyWarehouseImportBatches).value;
  const warehouseUpdatedAt = resolvePreference("warehouseUpdatedAt", localWarehouseUpdatedAt, legacyWarehouseUpdatedAt).value;

  if (
    JSON.stringify(warehouseCards) !== JSON.stringify(localWarehouseCards)
    || JSON.stringify(warehouseCategories) !== JSON.stringify(localWarehouseCategories)
    || JSON.stringify(warehouseImportBatches) !== JSON.stringify(localImportBatches)
  ) {
    await withoutLocalChangeEvents(async () => {
      await Promise.all([
        saveWarehouseCards(warehouseCards),
        saveWarehouseCategories(warehouseCategories),
        saveImportBatches(warehouseImportBatches),
      ]);
    });
  }

  const cloudWallpaperSettings = getCloudWallpaperSettings(cloudPrefsMap);
  const wallpaperPrefsMerge = mergeWallpaperPrefsByUpdatedAt(localWallpaperPrefs, cloudWallpaperSettings);
  const localWallpaperSettings = toWallpaperSyncedSettings(localWallpaperPrefs);
  const legacyWallpaperSettings = toWallpaperSyncedSettings(wallpaperPrefsMerge.prefs);
  const mergedWallpaperSettings = resolvePreference(
    "wallpaperPrefs",
    localWallpaperSettings,
    legacyWallpaperSettings
  ).value;
  const mergedWallpaperPrefs = applyWallpaperSyncedSettings(localWallpaperPrefs, mergedWallpaperSettings);
  await applySyncedWallpaperPrefsIfNeeded(
    mergedWallpaperPrefs,
    JSON.stringify(mergedWallpaperSettings) !== JSON.stringify(localWallpaperSettings)
  );

  const cloudSearchEngine = isSearchEngineId(cloudPrefsMap.searchEngine?.value)
    ? cloudPrefsMap.searchEngine.value
    : DEFAULT_SEARCH_ENGINE_ID;
  const legacySearchEngine = localSearchEngine === DEFAULT_SEARCH_ENGINE_ID
    ? cloudSearchEngine
    : localSearchEngine;
  const mergedSearchEngine = resolvePreference("searchEngine", localSearchEngine, legacySearchEngine).value;
  if (mergedSearchEngine !== localSearchEngine) {
    await withoutLocalChangeEvents(async () => {
      await saveSearchEngine(mergedSearchEngine);
    });
  }

  const syncedCloudSnapshotUpdatedAt = Math.max(localSnapshotUpdatedAt, cloudSnapshotUpdatedAt);
  await writePreferences(client, userId, {
    currentWorkspaceResetAt: workspaceResetAt,
    hiddenSites: mergedHiddenSites,
    pinnedCategoryIds: mergedPinnedIds,
    pinnedBookmarkItems: mergedPinnedBookmarkItems,
    pinnedBookmarkItemsUpdatedAt: mergedPinnedBookmarkUpdatedAt || Date.now(),
    categoryWidths: mergedWidths,
    categoryLayouts: mergedLayouts,
    visualScale: mergedVisualScale,
    linkOpenMode: mergedLinkOpenMode,
    collectionSections: mergedSections,
    activeCollectionSectionId: mergedActiveSectionId,
    categorySectionIds: mergedCategorySectionIds,
    recycleBin: mergedRecycleBin,
    warehouseCards,
    warehouseCategories,
    warehouseImportBatches,
    warehouseUpdatedAt,
    wallpaperPrefs: toWallpaperSyncedSettings(mergedWallpaperPrefs),
    searchEngine: mergedSearchEngine,
    localSnapshotUpdatedAt: syncedCloudSnapshotUpdatedAt,
  }, { revisions: resolvedPreferenceRevisions, cloudPrefsMap });
  await saveSyncPreferenceRevisions(resolvedPreferenceRevisions);
  return syncedCloudSnapshotUpdatedAt;
}

async function writePreferences(
  client: SupabaseClient,
  userId: string,
  preferences: Record<string, unknown>,
  options: {
    revisions?: SyncPreferenceRevisions;
    cloudPrefsMap?: CloudPreferenceMap;
  } = {}
): Promise<void> {
  const revisions = options.revisions || await getSyncPreferenceRevisions();
  const rows = Object.entries(preferences).flatMap(([key, value]) => {
    const version: SyncVersionStamp = revisions[key] || {
      syncRevision: 0,
      syncDeviceId: "legacy",
    };
    const cloud = options.cloudPrefsMap?.[key];
    if (cloud) {
      const comparison = compareSyncVersions(version, {
        syncRevision: cloud.syncRevision,
        syncDeviceId: cloud.syncDeviceId,
        updatedAt: new Date(cloud.updatedAt).getTime(),
      });
      const sameValue = JSON.stringify(value) === JSON.stringify(cloud.value);
      if (comparison < 0 || (comparison === 0 && sameValue)) return [];
    }
    return [{
      user_id: userId,
      key,
      value,
      sync_revision: version.syncRevision,
      sync_device_id: version.syncDeviceId,
    }];
  });
  if (rows.length === 0) return;

  const { error } = await client
    .from("user_preferences")
    .upsert(rows, { onConflict: "user_id,key" });

  if (error) {
    const message = summarizeRemoteError(error.message);
    console.error("[Sync] Failed to sync preferences:", message);
    throw new Error(`Failed to sync preferences: ${message}`);
  }

}

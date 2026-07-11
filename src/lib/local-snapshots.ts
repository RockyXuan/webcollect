import localforage from "localforage";
import {
  getActiveSectionId,
  getCards,
  getCategories,
  getCategoryLayouts,
  getCategoryWidths,
  getHiddenSites,
  getLinkOpenMode,
  getLocalSnapshotUpdatedAt,
  getPinnedBookmarkItems,
  getPinnedCategoryIds,
  getRecycleBin,
  getSearchEngine,
  getSections,
  getVisualScale,
  getWorkspaceResetAt,
  getSyncTombstones,
  getSyncPreferenceRevisions,
  markLocalSnapshotChanged,
  saveActiveSectionId,
  saveCards,
  saveCategories,
  saveCategoryLayouts,
  saveCategoryWidths,
  saveHiddenSites,
  saveLinkOpenMode,
  saveLocalSnapshotSyncedAt,
  savePinnedBookmarkItems,
  savePinnedCategoryIds,
  saveRecycleBin,
  saveSearchEngine,
  saveSections,
  saveVisualScale,
  saveWorkspaceResetAt,
  setInitialized,
} from "@/lib/db";
import {
  getImportBatches,
  getWarehouseCards,
  getWarehouseCategories,
  getWarehouseUpdatedAt,
  saveImportBatches,
  saveWarehouseCards,
  saveWarehouseCategories,
  type ImportBatch,
  type WarehouseCard,
  type WarehouseCategory,
} from "@/lib/db-warehouse";
import type { Category, CategoryLayoutPreference, CollectionSection, HiddenSite, LinkOpenMode, PinnedBookmarkItem, RecycleBinItem, SyncPreferenceRevisions, SyncTombstone, WebCard } from "@/lib/types";
import { DEFAULT_SEARCH_ENGINE_ID, isSearchEngineId, type SearchEngineId } from "@/lib/search-engines";
import type { WallpaperItem, WallpaperPrefs } from "@/lib/wallpaper-types";
import {
  getWallpaperLibrary,
  getWallpaperPrefs,
  saveWallpaperLibrary,
  saveWallpaperPrefs,
} from "@/lib/wallpaper-db";

localforage.config({
  name: "WebCollect",
  storeName: "webcollect_data",
});

const SNAPSHOT_HISTORY_KEY = "localSnapshotHistory";
const MAX_SYSTEM_SNAPSHOT_DAYS = 20;
const SAME_REASON_THROTTLE_MS = 90 * 1000;
const DEFAULT_SECTION_ID = "section-default";
const CAPTURE_QUEUE_KEY = "webcollect.capture.queue";
const CAPTURE_PREFS_KEY = "webcollect.capture.prefs";

export interface ExtensionCaptureSnapshot {
  prefs: unknown;
  queue: unknown[];
}

export interface LocalSnapshotCounts {
  sections: number;
  categories: number;
  cards: number;
  recycleBin: number;
  warehouseCategories: number;
  warehouseCards: number;
  warehouseBatches: number;
}

export interface LocalSnapshotData {
  cards: WebCard[];
  categories: Category[];
  hiddenSites: HiddenSite[];
  pinnedCategoryIds: string[];
  pinnedBookmarkItems: PinnedBookmarkItem[];
  categoryWidths: Record<string, number>;
  categoryLayouts?: Record<string, CategoryLayoutPreference>;
  visualScale: number;
  linkOpenMode: LinkOpenMode;
  searchEngine?: SearchEngineId;
  sections: CollectionSection[];
  activeSectionId: string | null;
  recycleBin: RecycleBinItem[];
  warehouseCards: WarehouseCard[];
  warehouseCategories: WarehouseCategory[];
  warehouseImportBatches: ImportBatch[];
  warehouseUpdatedAt: number;
  workspaceResetAt: number;
  localSnapshotUpdatedAt: number;
  wallpaperPrefs?: WallpaperPrefs;
  wallpaperLibrary?: WallpaperItem[];
  syncTombstones?: SyncTombstone[];
  syncPreferenceRevisions?: SyncPreferenceRevisions;
  extensionCapture?: ExtensionCaptureSnapshot | null;
}

export interface LocalSnapshotEntry {
  id: string;
  createdAt: number;
  reason: string;
  label: string;
  counts: LocalSnapshotCounts;
  sectionNames: string[];
  sampleCategoryNames: string[];
  sampleCardTitles: string[];
  data: LocalSnapshotData;
}

export interface StructureRestoreResult {
  snapshotId: string;
  snapshotCreatedAt: number;
  sectionsRestored: number;
  categoriesTouched: number;
  cardsMoved: number;
  newCardsKept: number;
}

export interface LocalSnapshotAssessment {
  recoverable: boolean;
  score: number;
  label: string;
  details: string;
  sectionCardCounts: Record<string, number>;
}

function createSnapshotId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `snapshot-${Date.now()}-${suffix}`;
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

async function readExtensionCaptureSnapshot(): Promise<ExtensionCaptureSnapshot | null> {
  if (!hasChromeStorage()) return null;
  return new Promise((resolve) => {
    chrome.storage.local.get([CAPTURE_PREFS_KEY, CAPTURE_QUEUE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.warn("[Snapshot] Unable to read extension capture state:", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve({
        prefs: result[CAPTURE_PREFS_KEY] ?? null,
        queue: Array.isArray(result[CAPTURE_QUEUE_KEY]) ? result[CAPTURE_QUEUE_KEY] : [],
      });
    });
  });
}

async function restoreExtensionCaptureSnapshot(snapshot: ExtensionCaptureSnapshot | null | undefined): Promise<void> {
  if (!snapshot || !hasChromeStorage()) return;
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [CAPTURE_PREFS_KEY]: snapshot.prefs }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
  const current = await readExtensionCaptureSnapshot();
  const readIds = (current?.queue || [])
    .map((item) => item && typeof item === "object" ? (item as { id?: unknown }).id : null)
    .filter((id): id is string => typeof id === "string");
  await new Promise<void>((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: "CAPTURE_QUEUE_REPLACE",
      readIds,
      replacementQueue: snapshot.queue,
    }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

async function readWallpaperSnapshot(): Promise<{
  wallpaperPrefs?: WallpaperPrefs;
  wallpaperLibrary?: WallpaperItem[];
}> {
  if (typeof indexedDB === "undefined") return {};
  try {
    const [wallpaperPrefs, wallpaperLibrary] = await Promise.all([
      getWallpaperPrefs(),
      getWallpaperLibrary(),
    ]);
    return { wallpaperPrefs, wallpaperLibrary };
  } catch (error) {
    console.warn("[Snapshot] Wallpaper storage is unavailable:", error);
    return {};
  }
}

async function restoreWallpaperSnapshot(data: LocalSnapshotData): Promise<void> {
  if (!data.wallpaperPrefs && !data.wallpaperLibrary) return;
  if (data.wallpaperPrefs) await saveWallpaperPrefs(data.wallpaperPrefs);
  if (data.wallpaperLibrary) await saveWallpaperLibrary(data.wallpaperLibrary);
}

function countSnapshotData(data: LocalSnapshotData): LocalSnapshotCounts {
  return {
    sections: data.sections.length,
    categories: data.categories.length,
    cards: data.cards.length,
    recycleBin: data.recycleBin.length,
    warehouseCategories: data.warehouseCategories.length,
    warehouseCards: data.warehouseCards.length,
    warehouseBatches: data.warehouseImportBatches.length,
  };
}

function snapshotScore(counts: LocalSnapshotCounts): number {
  return counts.cards
    + counts.categories
    + counts.recycleBin
    + counts.warehouseCards
    + counts.warehouseCategories
    + counts.warehouseBatches;
}

function makeSnapshotSignature(entry: LocalSnapshotEntry): string {
  const { data } = entry;
  return JSON.stringify({
    counts: entry.counts,
    sections: data.sections.map((section) => [section.id, section.name, section.order, section.updatedAt]),
    activeSectionId: data.activeSectionId,
    pinnedBookmarkItems: (data.pinnedBookmarkItems || []).map((item) => [
      item.id,
      item.cardId,
      item.order,
      item.displayMode,
      item.customLabel || "",
      item.updatedAt,
    ]),
    categories: data.categories.map((category) => [
      category.id,
      category.name,
      category.parentId || "",
      category.sectionId || "",
      category.isParent ? 1 : 0,
      category.order,
      category.updatedAt,
    ]),
    cards: data.cards.map((card) => [
      card.id,
      card.categoryId,
      card.order,
      card.updatedAt,
      card.title,
      card.url,
    ]),
    recycleBin: data.recycleBin.map((item) => [item.id, item.type, item.deletedAt]),
    warehouseCategories: data.warehouseCategories.map((category) => [
      category.id,
      category.name,
      category.parentId || "",
      category.importBatchId,
      category.order,
      category.updatedAt,
    ]),
    warehouseCards: data.warehouseCards.map((card) => [
      card.id,
      card.categoryId,
      card.importBatchId,
      card.order,
      card.updatedAt,
      card.title,
      card.url,
    ]),
    warehouseImportBatches: data.warehouseImportBatches.map((batch) => [
      batch.id,
      batch.importedAt,
      batch.categoryCount,
      batch.cardCount,
    ]),
    wallpaperPrefs: data.wallpaperPrefs || null,
    wallpaperLibrary: (data.wallpaperLibrary || []).map((item) => [
      item.id,
      item.source,
      item.fetchedAt,
    ]),
    syncTombstones: (data.syncTombstones || []).map((item) => [
      item.entityType,
      item.entityId,
      item.syncRevision,
      item.syncDeviceId,
    ]),
    syncPreferenceRevisions: data.syncPreferenceRevisions || {},
    extensionCapture: data.extensionCapture || null,
  });
}

function normalizeSnapshotText(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeSnapshotUrl(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("chrome://")) return raw.replace(/\/+$/, "").toLowerCase();
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

function structureScore(data: LocalSnapshotData): number {
  const categoryIds = new Set(data.categories.map((category) => category.id));
  const childCount = data.categories.filter((category) => category.parentId && categoryIds.has(category.parentId)).length;
  const parentCount = data.categories.filter((category) => {
    if (category.parentId) return false;
    return category.isParent || data.categories.some((child) => child.parentId === category.id);
  }).length;
  const sectionIds = new Set([
    ...data.sections.map((section) => section.id),
    ...data.categories.map((category) => category.sectionId || DEFAULT_SECTION_ID),
  ]);
  const cardCountByCategory = new Map<string, number>();
  for (const card of data.cards) {
    cardCountByCategory.set(card.categoryId, (cardCountByCategory.get(card.categoryId) || 0) + 1);
  }
  const standaloneWithCards = data.categories.filter((category) =>
    !category.parentId &&
    !category.isParent &&
    (cardCountByCategory.get(category.id) || 0) > 0
  ).length;

  return childCount * 25 + parentCount * 10 + sectionIds.size * 8 + data.sections.length * 4 - standaloneWithCards * 8;
}

function countCardsBySection(data: Pick<LocalSnapshotData, "cards" | "categories" | "sections">): Record<string, number> {
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const counts: Record<string, number> = {};
  for (const card of data.cards) {
    const category = categoryById.get(card.categoryId);
    const sectionId = category?.sectionId || DEFAULT_SECTION_ID;
    counts[sectionId] = (counts[sectionId] || 0) + 1;
  }
  for (const section of data.sections) {
    counts[section.id] = counts[section.id] || 0;
  }
  return counts;
}

function distributionStats(data: Pick<LocalSnapshotData, "cards" | "categories" | "sections">) {
  const counts = countCardsBySection(data);
  const totalCards = Math.max(1, data.cards.length);
  const sectionsWithCards = Object.values(counts).filter((count) => count > 0).length;
  const defaultShare = (counts[DEFAULT_SECTION_ID] || 0) / totalCards;
  const nonDefaultCards = Object.entries(counts)
    .filter(([sectionId]) => sectionId !== DEFAULT_SECTION_ID)
    .reduce((sum, [, count]) => sum + count, 0);
  return { counts, sectionsWithCards, defaultShare, nonDefaultCards };
}

export function assessLocalDataSnapshot(snapshot: LocalSnapshotEntry): LocalSnapshotAssessment {
  const data = snapshot.data;
  const stats = distributionStats(data);
  const sectionIds = new Set(data.sections.map((section) => section.id));
  const categoryIds = new Set(data.categories.map((category) => category.id));
  const duplicateSectionIds = data.sections.length - sectionIds.size;
  const duplicateCategoryIds = data.categories.length - categoryIds.size;
  const duplicateCardIds = data.cards.length - new Set(data.cards.map((card) => card.id)).size;
  const orphanedCategories = data.categories.filter((category) =>
    (category.parentId && !categoryIds.has(category.parentId))
    || !sectionIds.has(category.sectionId || DEFAULT_SECTION_ID)
  );
  const orphanedCards = data.cards.filter((card) => !categoryIds.has(card.categoryId));
  const score =
    structureScore(data)
    + data.cards.length
    + data.categories.length * 2
    + stats.sectionsWithCards * 8
    - orphanedCategories.length * 100
    - orphanedCards.length * 100;
  const issues: string[] = [];

  if (data.sections.length === 0) issues.push("缺少分项");
  if (data.cards.length === 0 && data.categories.length === 0) issues.push("快照为空");
  if (duplicateSectionIds > 0) issues.push("分项 ID 重复");
  if (duplicateCategoryIds > 0) issues.push("分类 ID 重复");
  if (duplicateCardIds > 0) issues.push("网页 ID 重复");
  if (orphanedCategories.length > 0) issues.push("分类引用了不存在的分项或父分类");
  if (orphanedCards.length > 0) issues.push("网页引用了不存在的分类");
  if (data.activeSectionId && !sectionIds.has(data.activeSectionId)) issues.push("当前分项不存在");

  const recoverable = issues.length === 0;
  return {
    recoverable,
    score,
    label: recoverable ? "结构正常候选" : "谨慎检查",
    details: recoverable ? "引用关系完整，可安全恢复" : issues.join(" / "),
    sectionCardCounts: stats.counts,
  };
}

async function readCurrentSnapshotData(): Promise<LocalSnapshotData> {
  const [wallpaper, syncTombstones, syncPreferenceRevisions, extensionCapture] = await Promise.all([
    readWallpaperSnapshot(),
    getSyncTombstones(),
    getSyncPreferenceRevisions(),
    readExtensionCaptureSnapshot(),
  ]);
  return {
    cards: await getCards(),
    categories: await getCategories(),
    hiddenSites: await getHiddenSites(),
    pinnedCategoryIds: await getPinnedCategoryIds(),
    pinnedBookmarkItems: await getPinnedBookmarkItems(),
    categoryWidths: await getCategoryWidths(),
    categoryLayouts: await getCategoryLayouts(),
    visualScale: await getVisualScale(),
    linkOpenMode: await getLinkOpenMode(),
    searchEngine: await getSearchEngine(),
    sections: await getSections(),
    activeSectionId: await getActiveSectionId(),
    recycleBin: await getRecycleBin(),
    warehouseCards: await getWarehouseCards(),
    warehouseCategories: await getWarehouseCategories(),
    warehouseImportBatches: await getImportBatches(),
    warehouseUpdatedAt: await getWarehouseUpdatedAt(),
    workspaceResetAt: await getWorkspaceResetAt(),
    localSnapshotUpdatedAt: await getLocalSnapshotUpdatedAt(),
    wallpaperPrefs: wallpaper.wallpaperPrefs,
    wallpaperLibrary: wallpaper.wallpaperLibrary,
    syncTombstones,
    syncPreferenceRevisions,
    extensionCapture,
  };
}

function urlsByCategory(cards: WebCard[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const card of cards) {
    const url = normalizeSnapshotUrl(card.url);
    if (!url) continue;
    const urls = result.get(card.categoryId) || new Set<string>();
    urls.add(url);
    result.set(card.categoryId, urls);
  }
  return result;
}

function urlOverlap(left: Set<string> | undefined, right: Set<string> | undefined): number {
  if (!left || !right) return 0;
  let count = 0;
  for (const url of left) {
    if (right.has(url)) count += 1;
  }
  return count;
}

function buildSnapshotCategoryMap(
  currentCategories: Category[],
  currentCards: WebCard[],
  snapshotCategories: Category[],
  snapshotCards: WebCard[]
): { snapshotToCurrent: Map<string, string>; currentToSnapshot: Map<string, string> } {
  const currentById = new Map(currentCategories.map((category) => [category.id, category]));
  const snapshotToCurrent = new Map<string, string>();
  const currentToSnapshot = new Map<string, string>();
  const usedCurrentIds = new Set<string>();
  const currentUrls = urlsByCategory(currentCards);
  const snapshotUrls = urlsByCategory(snapshotCards);

  function link(snapshotId: string, currentId: string) {
    if (snapshotToCurrent.has(snapshotId) || currentToSnapshot.has(currentId)) return;
    snapshotToCurrent.set(snapshotId, currentId);
    currentToSnapshot.set(currentId, snapshotId);
    usedCurrentIds.add(currentId);
  }

  for (const snapshotCategory of snapshotCategories) {
    if (currentById.has(snapshotCategory.id)) {
      link(snapshotCategory.id, snapshotCategory.id);
    }
  }

  for (const snapshotCategory of snapshotCategories) {
    if (snapshotToCurrent.has(snapshotCategory.id)) continue;
    const snapshotName = normalizeSnapshotText(snapshotCategory.name);
    if (!snapshotName) continue;
    const candidates = currentCategories
      .filter((category) => !usedCurrentIds.has(category.id) && normalizeSnapshotText(category.name) === snapshotName)
      .map((category) => ({
        category,
        overlap: urlOverlap(snapshotUrls.get(snapshotCategory.id), currentUrls.get(category.id)),
        sameSection: (category.sectionId || DEFAULT_SECTION_ID) === (snapshotCategory.sectionId || DEFAULT_SECTION_ID),
      }))
      .sort((a, b) => {
        if (b.overlap !== a.overlap) return b.overlap - a.overlap;
        if (b.sameSection !== a.sameSection) return Number(b.sameSection) - Number(a.sameSection);
        return (b.category.updatedAt || b.category.createdAt || 0) - (a.category.updatedAt || a.category.createdAt || 0);
      });
    if (candidates[0]) {
      link(snapshotCategory.id, candidates[0].category.id);
    }
  }

  return { snapshotToCurrent, currentToSnapshot };
}

function mergeStructureSections(
  currentSections: CollectionSection[],
  snapshotSections: CollectionSection[]
): CollectionSection[] {
  const byId = new Map<string, CollectionSection>();
  for (const section of currentSections) {
    byId.set(section.id, { ...section });
  }
  for (const section of snapshotSections) {
    byId.set(section.id, { ...section });
  }
  if (byId.size === 0) {
    const now = Date.now();
    byId.set(DEFAULT_SECTION_ID, {
      id: DEFAULT_SECTION_ID,
      name: "\u4e3b\u9875",
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

function ensureInboxCategory(categories: Category[], sectionId: string): Category {
  const existing = categories.find((category) =>
    (category.sectionId || DEFAULT_SECTION_ID) === sectionId &&
    normalizeSnapshotText(category.name) === normalizeSnapshotText("\u6536\u96c6\u7bb1") &&
    !category.parentId
  );
  if (existing) return existing;

  const now = Date.now();
  const inbox: Category = {
    id: sectionId === DEFAULT_SECTION_ID ? "cat-inbox" : `cat-inbox-${sectionId}`,
    name: "\u6536\u96c6\u7bb1",
    icon: "inbox",
    color: "#888888",
    order: 99,
    createdAt: now,
    updatedAt: now,
    sectionId,
  };
  categories.push(inbox);
  return inbox;
}

export async function getLocalDataSnapshots(): Promise<LocalSnapshotEntry[]> {
  const snapshots = (await localforage.getItem<LocalSnapshotEntry[]>(SNAPSHOT_HISTORY_KEY)) || [];
  const pruned = pruneLocalSnapshots(snapshots);
  if (
    pruned.length !== snapshots.length ||
    pruned.some((snapshot, index) => snapshot.id !== snapshots[index]?.id)
  ) {
    await localforage.setItem(SNAPSHOT_HISTORY_KEY, pruned);
  }
  return pruned;
}

export function isManualLocalDataSnapshot(snapshot: LocalSnapshotEntry): boolean {
  return snapshot.reason === "manual-snapshot";
}

export function isUserVisibleSnapshot(snapshot: LocalSnapshotEntry): boolean {
  return isManualLocalDataSnapshot(snapshot) || snapshot.reason === "before-clear-all-data";
}

export async function getUserVisibleLocalDataSnapshots(): Promise<LocalSnapshotEntry[]> {
  const snapshots = await getLocalDataSnapshots();
  return snapshots.filter(isUserVisibleSnapshot);
}

export async function getRecoverableLocalDataSnapshots(): Promise<LocalSnapshotEntry[]> {
  const snapshots = await getLocalDataSnapshots();
  return snapshots
    .filter((snapshot) => assessLocalDataSnapshot(snapshot).recoverable)
    .sort((a, b) => b.createdAt - a.createdAt || assessLocalDataSnapshot(b).score - assessLocalDataSnapshot(a).score);
}

function pruneLocalSnapshots(snapshots: LocalSnapshotEntry[]): LocalSnapshotEntry[] {
  const sorted = [...snapshots].sort((a, b) => b.createdAt - a.createdAt);
  const manual = sorted.filter(isManualLocalDataSnapshot);
  const systemByDay = new Map<string, LocalSnapshotEntry>();

  for (const snapshot of sorted.filter((item) => !isManualLocalDataSnapshot(item))) {
    const dayKey = getLocalSnapshotDayKey(snapshot.createdAt);
    if (!systemByDay.has(dayKey)) {
      systemByDay.set(dayKey, snapshot);
    }
    if (systemByDay.size >= MAX_SYSTEM_SNAPSHOT_DAYS) break;
  }

  const system = [...systemByDay.values()];
  return [...manual, ...system].sort((a, b) => b.createdAt - a.createdAt);
}

function getLocalSnapshotDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function createLocalDataSnapshot(
  reason: string,
  label = reason,
  options: { force?: boolean } = {}
): Promise<LocalSnapshotEntry | null> {
  const data = await readCurrentSnapshotData();
  const counts = countSnapshotData(data);
  if (!options.force && snapshotScore(counts) === 0) {
    return null;
  }

  const entry: LocalSnapshotEntry = {
    id: createSnapshotId(),
    createdAt: Date.now(),
    reason,
    label,
    counts,
    sectionNames: data.sections.map((section) => section.name).slice(0, 8),
    sampleCategoryNames: data.categories.map((category) => category.name).slice(0, 12),
    sampleCardTitles: data.cards.map((card) => card.title || card.url).slice(0, 12),
    data,
  };

  const snapshots = await getLocalDataSnapshots();
  const previous = snapshots[0];
  if (
    previous &&
    !options.force &&
    previous.reason === reason &&
    entry.createdAt - previous.createdAt < SAME_REASON_THROTTLE_MS &&
    makeSnapshotSignature(previous) === makeSnapshotSignature(entry)
  ) {
    return previous;
  }

  const nextSnapshots = pruneLocalSnapshots([entry, ...snapshots]);
  await localforage.setItem(SNAPSHOT_HISTORY_KEY, nextSnapshots);
  return entry;
}

export async function saveVersionAndClearLocalData(): Promise<LocalSnapshotEntry> {
  const snapshot = await createLocalDataSnapshot(
    "before-clear-all-data",
    "\u6e05\u7a7a\u524d\u4fdd\u5b58\u7248\u672c",
    { force: true }
  );
  if (!snapshot) {
    throw new Error("\u4fdd\u5b58\u6e05\u7a7a\u524d\u7248\u672c\u5931\u8d25\uff0c\u5df2\u53d6\u6d88\u6e05\u7a7a\u3002");
  }

  const now = Date.now();
  const defaultSection: CollectionSection = {
    id: DEFAULT_SECTION_ID,
    name: "\u4e3b\u9875",
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
  const inboxCategory: Category = {
    id: "cat-inbox",
    name: "\u6536\u96c6\u7bb1",
    icon: "inbox",
    color: "#888888",
    order: 99,
    createdAt: now,
    updatedAt: now,
    sectionId: DEFAULT_SECTION_ID,
  };

  await saveCards([]);
  await saveCategories([inboxCategory]);
  await saveHiddenSites([]);
  await savePinnedCategoryIds([]);
  await savePinnedBookmarkItems([]);
  await saveCategoryWidths({});
  await saveCategoryLayouts({});
  await saveVisualScale(100);
  await saveLinkOpenMode("new-background-tab");
  await saveSearchEngine(DEFAULT_SEARCH_ENGINE_ID);
  await saveSections([defaultSection]);
  await saveActiveSectionId(defaultSection.id);
  await saveRecycleBin([]);
  await saveWarehouseCards([]);
  await saveWarehouseCategories([]);
  await saveImportBatches([]);
  await saveWorkspaceResetAt(now);
  await setInitialized();

  await saveLocalSnapshotSyncedAt(0);
  await markLocalSnapshotChanged();
  return snapshot;
}

export async function restoreSnapshotData(data: LocalSnapshotData): Promise<void> {
  await saveCards(data.cards);
  await saveCategories(data.categories);
  await saveHiddenSites(data.hiddenSites);
  await savePinnedCategoryIds(data.pinnedCategoryIds);
  await savePinnedBookmarkItems(data.pinnedBookmarkItems || []);
  await saveCategoryWidths(data.categoryWidths);
  await saveCategoryLayouts(data.categoryLayouts || {});
  await saveVisualScale(data.visualScale);
  await saveLinkOpenMode(data.linkOpenMode);
  await saveSearchEngine(isSearchEngineId(data.searchEngine) ? data.searchEngine : DEFAULT_SEARCH_ENGINE_ID);
  await saveSections(data.sections);
  if (data.activeSectionId) {
    await saveActiveSectionId(data.activeSectionId);
  }
  await saveRecycleBin(data.recycleBin);
  await saveWarehouseCards(data.warehouseCards);
  await saveWarehouseCategories(data.warehouseCategories);
  await saveImportBatches(data.warehouseImportBatches);
  await saveWorkspaceResetAt(data.workspaceResetAt || 0);
  await restoreWallpaperSnapshot(data);
  await restoreExtensionCaptureSnapshot(data.extensionCapture);

  await saveLocalSnapshotSyncedAt(0);
  await markLocalSnapshotChanged();
}

export async function restoreLocalDataSnapshot(snapshotId: string): Promise<void> {
  const snapshots = await getLocalDataSnapshots();
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  await createLocalDataSnapshot("before-local-rollback", "\u56de\u6863\u524d\u81ea\u52a8\u5907\u4efd", { force: true });
  await restoreSnapshotData(snapshot.data);
}

export async function restoreStructureFromSnapshotEntry(snapshot: LocalSnapshotEntry): Promise<StructureRestoreResult> {
  const current = await readCurrentSnapshotData();
  const sectionList = mergeStructureSections(current.sections, snapshot.data.sections);
  const validSectionIds = new Set(sectionList.map((section) => section.id));
  const snapshotById = new Map(snapshot.data.categories.map((category) => [category.id, category]));
  const { snapshotToCurrent, currentToSnapshot } = buildSnapshotCategoryMap(
    current.categories,
    current.cards,
    snapshot.data.categories,
    snapshot.data.cards
  );

  const now = Date.now();
  let categoriesTouched = 0;
  const nextCategories = current.categories.map((category) => {
    const snapshotIdForCategory = currentToSnapshot.get(category.id);
    if (!snapshotIdForCategory) {
      const sectionId = category.sectionId && validSectionIds.has(category.sectionId)
        ? category.sectionId
        : DEFAULT_SECTION_ID;
      return sectionId === category.sectionId ? category : { ...category, sectionId, updatedAt: now };
    }

    const snapshotCategory = snapshotById.get(snapshotIdForCategory);
    if (!snapshotCategory) return category;

    const mappedParentId = snapshotCategory.parentId
      ? snapshotToCurrent.get(snapshotCategory.parentId)
      : undefined;
    const sectionId = snapshotCategory.sectionId && validSectionIds.has(snapshotCategory.sectionId)
      ? snapshotCategory.sectionId
      : category.sectionId && validSectionIds.has(category.sectionId)
        ? category.sectionId
        : DEFAULT_SECTION_ID;
    const nextCategory: Category = {
      ...category,
      sectionId,
      order: snapshotCategory.order,
    };

    if (mappedParentId && mappedParentId !== category.id) {
      nextCategory.parentId = mappedParentId;
      nextCategory.isParent = false;
    } else {
      delete nextCategory.parentId;
      if (typeof snapshotCategory.isParent === "boolean") {
        nextCategory.isParent = snapshotCategory.isParent;
      } else {
        delete nextCategory.isParent;
      }
    }

    const changed =
      nextCategory.sectionId !== category.sectionId ||
      nextCategory.order !== category.order ||
      nextCategory.parentId !== category.parentId ||
      nextCategory.isParent !== category.isParent;
    if (changed) {
      nextCategory.updatedAt = now;
      categoriesTouched += 1;
    }
    return nextCategory;
  });

  const nextCategoryById = new Map(nextCategories.map((category) => [category.id, category]));
  for (const category of nextCategories) {
    if (!category.parentId) continue;
    const parent = nextCategoryById.get(category.parentId);
    if (!parent) {
      delete category.parentId;
      category.updatedAt = now;
      categoriesTouched += 1;
      continue;
    }
    if (!parent.isParent) {
      parent.isParent = true;
      parent.updatedAt = now;
      categoriesTouched += 1;
    }
    if (!parent.sectionId) {
      parent.sectionId = category.sectionId || DEFAULT_SECTION_ID;
    }
  }

  const snapshotCardById = new Map(snapshot.data.cards.map((card) => [card.id, card]));
  const snapshotCardsByUrl = new Map<string, WebCard[]>();
  for (const card of snapshot.data.cards) {
    const url = normalizeSnapshotUrl(card.url);
    if (!url) continue;
    const cards = snapshotCardsByUrl.get(url) || [];
    cards.push(card);
    snapshotCardsByUrl.set(url, cards);
  }

  let cardsMoved = 0;
  let newCardsKept = 0;
  const nextCategoryIds = new Set(nextCategories.map((category) => category.id));
  const homeInbox = ensureInboxCategory(nextCategories, DEFAULT_SECTION_ID);
  const nextCards = current.cards.map((card) => {
    const snapshotCard = snapshotCardById.get(card.id)
      || snapshotCardsByUrl.get(normalizeSnapshotUrl(card.url))?.find((item) => snapshotToCurrent.has(item.categoryId));
    const targetCategoryId = snapshotCard ? snapshotToCurrent.get(snapshotCard.categoryId) : undefined;

    if (targetCategoryId && nextCategoryIds.has(targetCategoryId) && targetCategoryId !== card.categoryId) {
      cardsMoved += 1;
      return {
        ...card,
        categoryId: targetCategoryId,
        order: snapshotCard?.order ?? card.order,
        updatedAt: now,
      };
    }

    if (!nextCategoryIds.has(card.categoryId)) {
      cardsMoved += 1;
      return {
        ...card,
        categoryId: homeInbox.id,
        updatedAt: now,
      };
    }

    if (!snapshotCard) {
      newCardsKept += 1;
    }
    return card;
  });

  await saveSections(sectionList);
  await saveCategories(nextCategories);
  await saveCards(nextCards);
  if (current.activeSectionId && validSectionIds.has(current.activeSectionId)) {
    await saveActiveSectionId(current.activeSectionId);
  } else {
    await saveActiveSectionId(DEFAULT_SECTION_ID);
  }

  await saveLocalSnapshotSyncedAt(0);
  await markLocalSnapshotChanged();

  return {
    snapshotId: snapshot.id,
    snapshotCreatedAt: snapshot.createdAt,
    sectionsRestored: sectionList.length,
    categoriesTouched,
    cardsMoved,
    newCardsKept,
  };
}

export async function restoreStructureFromLocalSnapshot(snapshotId: string): Promise<StructureRestoreResult> {
  const snapshots = await getLocalDataSnapshots();
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  await createLocalDataSnapshot(
    "before-structure-only-restore",
    "\u53ea\u4fee\u590d\u7ed3\u6784\u524d\u81ea\u52a8\u5907\u4efd",
    { force: true }
  );

  return restoreStructureFromSnapshotEntry(snapshot);
}

export async function restoreStructureFromBestLocalSnapshot(): Promise<StructureRestoreResult> {
  const snapshots = await getLocalDataSnapshots();
  if (snapshots.length === 0) {
    throw new Error("\u6ca1\u6709\u627e\u5230\u53ef\u7528\u7684\u672c\u5730\u7248\u672c\uff0c\u65e0\u6cd5\u53ea\u4fee\u590d\u7ed3\u6784\u3002");
  }

  const current = await readCurrentSnapshotData();
  const minCardCount = Math.max(20, Math.floor(current.cards.length * 0.35));
  const candidates = snapshots
    .map((snapshot) => ({ snapshot, assessment: assessLocalDataSnapshot(snapshot) }))
    .filter(({ snapshot, assessment }) =>
      assessment.recoverable
      && snapshot.counts.categories > 0
      && snapshot.counts.cards >= minCardCount
    )
    .sort((a, b) => b.snapshot.createdAt - a.snapshot.createdAt || b.assessment.score - a.assessment.score);

  const best = candidates[0];
  if (!best) {
    throw new Error("\u6ca1\u6709\u627e\u5230\u7ed3\u6784\u6b63\u5e38\u7684 WebCollect \u672c\u5730\u5386\u53f2\u7248\u672c\u3002\u8bf7\u6253\u5f00\u201c\u7248\u672c\u56de\u6863\u201d\u67e5\u770b\u6240\u6709\u81ea\u52a8\u5907\u4efd\uff0c\u6216\u4ece Supabase/Chrome \u5386\u53f2\u5907\u4efd\u6062\u590d\u3002");
  }
  return restoreStructureFromLocalSnapshot(best.snapshot.id);
}

import localforage from "localforage";
import {
  getActiveSectionId,
  getCards,
  getCategories,
  getCategoryWidths,
  getHiddenSites,
  getLinkOpenMode,
  getLocalSnapshotUpdatedAt,
  getPinnedCategoryIds,
  getRecycleBin,
  getSections,
  getVisualScale,
  getWorkspaceResetAt,
  markLocalSnapshotChanged,
  saveActiveSectionId,
  saveCards,
  saveCategories,
  saveCategoryWidths,
  saveHiddenSites,
  saveLinkOpenMode,
  saveLocalSnapshotSyncedAt,
  savePinnedCategoryIds,
  saveRecycleBin,
  saveSections,
  saveVisualScale,
  saveWorkspaceResetAt,
  setInitialized,
  withoutLocalChangeEvents,
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
import type { Category, CollectionSection, HiddenSite, LinkOpenMode, RecycleBinItem, WebCard } from "@/lib/types";

localforage.config({
  name: "WebCollect",
  storeName: "webcollect_data",
});

const SNAPSHOT_HISTORY_KEY = "localSnapshotHistory";
const MAX_SNAPSHOTS = 25;
const SAME_REASON_THROTTLE_MS = 90 * 1000;
const DEFAULT_SECTION_ID = "section-default";

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
  categoryWidths: Record<string, number>;
  visualScale: number;
  linkOpenMode: LinkOpenMode;
  sections: CollectionSection[];
  activeSectionId: string | null;
  recycleBin: RecycleBinItem[];
  warehouseCards: WarehouseCard[];
  warehouseCategories: WarehouseCategory[];
  warehouseImportBatches: ImportBatch[];
  warehouseUpdatedAt: number;
  workspaceResetAt: number;
  localSnapshotUpdatedAt: number;
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

function createSnapshotId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `snapshot-${Date.now()}-${suffix}`;
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
  });
}

export async function getLocalDataSnapshots(): Promise<LocalSnapshotEntry[]> {
  const snapshots = (await localforage.getItem<LocalSnapshotEntry[]>(SNAPSHOT_HISTORY_KEY)) || [];
  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createLocalDataSnapshot(
  reason: string,
  label = reason,
  options: { force?: boolean } = {}
): Promise<LocalSnapshotEntry | null> {
  const data: LocalSnapshotData = {
    cards: await getCards(),
    categories: await getCategories(),
    hiddenSites: await getHiddenSites(),
    pinnedCategoryIds: await getPinnedCategoryIds(),
    categoryWidths: await getCategoryWidths(),
    visualScale: await getVisualScale(),
    linkOpenMode: await getLinkOpenMode(),
    sections: await getSections(),
    activeSectionId: await getActiveSectionId(),
    recycleBin: await getRecycleBin(),
    warehouseCards: await getWarehouseCards(),
    warehouseCategories: await getWarehouseCategories(),
    warehouseImportBatches: await getImportBatches(),
    warehouseUpdatedAt: await getWarehouseUpdatedAt(),
    workspaceResetAt: await getWorkspaceResetAt(),
    localSnapshotUpdatedAt: await getLocalSnapshotUpdatedAt(),
  };
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

  const nextSnapshots = [entry, ...snapshots].slice(0, MAX_SNAPSHOTS);
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

  await withoutLocalChangeEvents(async () => {
    await saveCards([]);
    await saveCategories([inboxCategory]);
    await saveHiddenSites([]);
    await savePinnedCategoryIds([]);
    await saveCategoryWidths({});
    await saveVisualScale(100);
    await saveLinkOpenMode("new-background-tab");
    await saveSections([defaultSection]);
    await saveActiveSectionId(defaultSection.id);
    await saveRecycleBin([]);
    await saveWarehouseCards([]);
    await saveWarehouseCategories([]);
    await saveImportBatches([]);
    await saveWorkspaceResetAt(now);
    await setInitialized();
  });

  await saveLocalSnapshotSyncedAt(0);
  await markLocalSnapshotChanged();
  return snapshot;
}

export async function restoreLocalDataSnapshot(snapshotId: string): Promise<void> {
  const snapshots = await getLocalDataSnapshots();
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  await createLocalDataSnapshot("before-local-rollback", "\u56de\u6863\u524d\u81ea\u52a8\u5907\u4efd", { force: true });

  await withoutLocalChangeEvents(async () => {
    await saveCards(snapshot.data.cards);
    await saveCategories(snapshot.data.categories);
    await saveHiddenSites(snapshot.data.hiddenSites);
    await savePinnedCategoryIds(snapshot.data.pinnedCategoryIds);
    await saveCategoryWidths(snapshot.data.categoryWidths);
    await saveVisualScale(snapshot.data.visualScale);
    await saveLinkOpenMode(snapshot.data.linkOpenMode);
    await saveSections(snapshot.data.sections);
    if (snapshot.data.activeSectionId) {
      await saveActiveSectionId(snapshot.data.activeSectionId);
    }
    await saveRecycleBin(snapshot.data.recycleBin);
    await saveWarehouseCards(snapshot.data.warehouseCards);
    await saveWarehouseCategories(snapshot.data.warehouseCategories);
    await saveImportBatches(snapshot.data.warehouseImportBatches);
    await saveWorkspaceResetAt(snapshot.data.workspaceResetAt || 0);
  });

  await saveLocalSnapshotSyncedAt(0);
  await markLocalSnapshotChanged();
}

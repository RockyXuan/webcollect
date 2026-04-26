/**
 * 仓库数据层 — 与主页数据完全隔离的独立 IndexedDB 命名空间
 *
 * 设计原则：
 * - 所有 key 前缀为 "wh_"，与主页数据（无前缀）完全隔离
 * - 每次导入生成一个 ImportBatch，记录来源、时间、数量
 * - Category 和 WebCard 通过 importBatchId 关联到具体批次
 */

import localforage from "localforage";
import type { WebCard, Category } from "./types";

localforage.config({
  name: "WebCollect",
  storeName: "webcollect_data",
});

/* ── Keys ── */
const WH_CARDS_KEY = "wh_cards";
const WH_CATEGORIES_KEY = "wh_categories";
const WH_BATCHES_KEY = "wh_import_batches";

/* ── Import Batch Type ── */
export interface ImportBatch {
  id: string;              // e.g. "batch-1706000000000"
  source: string;          // e.g. "homely", "bookmark", "generic"
  sourceFileName: string;  // 原始文件名
  importedAt: number;      // 导入时间戳
  categoryCount: number;   // 导入的分类数
  cardCount: number;       // 导入的卡片数
  note: string;            // 用户备注（可选）
}

/* ── Warehouse Card / Category 扩展 ── */
export interface WarehouseCard extends WebCard {
  importBatchId: string;   // 所属导入批次
}

export interface WarehouseCategory extends Category {
  importBatchId: string;   // 所属导入批次
}

/* ── Cards CRUD ── */

export async function getWarehouseCards(): Promise<WarehouseCard[]> {
  const cards = (await localforage.getItem<WarehouseCard[]>(WH_CARDS_KEY)) || [];
  return cards.sort((a, b) => a.order - b.order);
}

export async function saveWarehouseCards(cards: WarehouseCard[]): Promise<void> {
  await localforage.setItem(WH_CARDS_KEY, cards);
}

export async function addWarehouseCard(card: WarehouseCard): Promise<void> {
  const cards = await getWarehouseCards();
  cards.push(card);
  await saveWarehouseCards(cards);
}

export async function addWarehouseCards(newCards: WarehouseCard[]): Promise<void> {
  const cards = await getWarehouseCards();
  cards.push(...newCards);
  await saveWarehouseCards(cards);
}

export async function deleteWarehouseCard(id: string): Promise<void> {
  const cards = await getWarehouseCards();
  await saveWarehouseCards(cards.filter((c) => c.id !== id));
}

export async function deleteWarehouseCardsByBatch(batchId: string): Promise<void> {
  const cards = await getWarehouseCards();
  await saveWarehouseCards(cards.filter((c) => c.importBatchId !== batchId));
}

/* ── Categories CRUD ── */

export async function getWarehouseCategories(): Promise<WarehouseCategory[]> {
  const cats = (await localforage.getItem<WarehouseCategory[]>(WH_CATEGORIES_KEY)) || [];
  return cats.sort((a, b) => a.order - b.order);
}

export async function saveWarehouseCategories(categories: WarehouseCategory[]): Promise<void> {
  await localforage.setItem(WH_CATEGORIES_KEY, categories);
}

export async function addWarehouseCategory(cat: WarehouseCategory): Promise<void> {
  const cats = await getWarehouseCategories();
  cats.push(cat);
  await saveWarehouseCategories(cats);
}

export async function addWarehouseCategories(newCats: WarehouseCategory[]): Promise<void> {
  const cats = await getWarehouseCategories();
  cats.push(...newCats);
  await saveWarehouseCategories(cats);
}

export async function deleteWarehouseCategory(id: string): Promise<void> {
  const cats = await getWarehouseCategories();
  await saveWarehouseCategories(cats.filter((c) => c.id !== id));
  // Also delete cards in this category
  const cards = await getWarehouseCards();
  await saveWarehouseCards(cards.filter((c) => c.categoryId !== id));
}

export async function deleteWarehouseCategoriesByBatch(batchId: string): Promise<void> {
  const cats = await getWarehouseCategories();
  const batchCatIds = cats.filter((c) => c.importBatchId === batchId).map((c) => c.id);
  await saveWarehouseCategories(cats.filter((c) => c.importBatchId !== batchId));
  // Also delete cards belonging to these categories
  const cards = await getWarehouseCards();
  await saveWarehouseCards(cards.filter((c) => !batchCatIds.includes(c.categoryId)));
}

/* ── Import Batches CRUD ── */

export async function getImportBatches(): Promise<ImportBatch[]> {
  const batches = (await localforage.getItem<ImportBatch[]>(WH_BATCHES_KEY)) || [];
  return batches.sort((a, b) => b.importedAt - a.importedAt); // newest first
}

export async function saveImportBatches(batches: ImportBatch[]): Promise<void> {
  await localforage.setItem(WH_BATCHES_KEY, batches);
}

export async function addImportBatch(batch: ImportBatch): Promise<void> {
  const batches = await getImportBatches();
  batches.push(batch);
  await saveImportBatches(batches);
}

export async function deleteImportBatch(batchId: string): Promise<void> {
  // Delete all associated categories and cards first
  await deleteWarehouseCategoriesByBatch(batchId);
  // Then remove the batch record
  const batches = await getImportBatches();
  await saveImportBatches(batches.filter((b) => b.id !== batchId));
}

/* ── Bulk Operations ── */

/** Clear all warehouse data */
export async function clearWarehouse(): Promise<void> {
  await saveWarehouseCards([]);
  await saveWarehouseCategories([]);
  await saveImportBatches([]);
}

/** One-click overwrite: clear all warehouse data then import new */
export async function overwriteWarehouse(
  categories: WarehouseCategory[],
  cards: WarehouseCard[],
  batch: ImportBatch
): Promise<void> {
  await clearWarehouse();
  await saveWarehouseCategories(categories);
  await saveWarehouseCards(cards);
  await addImportBatch(batch);
}

/** Ship a category (and its cards) from warehouse to main page */
/** Generate a unique ID to avoid conflicts with warehouse or existing main page data */
function genId(prefix: string = "ship"): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export async function shipCategoryToMain(
  warehouseCategoryId: string,
  mainCategoryId: string
): Promise<{ categories: Category[]; cards: WebCard[] }> {
  const whCats = await getWarehouseCategories();
  const whCards = await getWarehouseCards();

  // Find the warehouse category and its children
  const whCat = whCats.find((c) => c.id === warehouseCategoryId);
  if (!whCat) throw new Error(`Warehouse category ${warehouseCategoryId} not found`);

  // Get all sub-categories if it's a parent
  const subCats = whCats.filter((c) => c.parentId === warehouseCategoryId);
  // Get all cards in this category and sub-categories
  const catIds = [warehouseCategoryId, ...subCats.map((c) => c.id)];
  const catCards = whCards.filter((c) => catIds.includes(c.categoryId));

  // Build ID mapping: warehouse ID → new main ID (to avoid conflicts)
  const idMap = new Map<string, string>();
  subCats.forEach((sc) => {
    idMap.set(sc.id, genId("cat"));
  });

  // Convert sub-categories with new IDs (skip parent — it already exists as mainCategoryId)
  const mainCats: Category[] = subCats.map((sc) => ({
    ...sc,
    id: idMap.get(sc.id)!,
    parentId: mainCategoryId,
    importBatchId: undefined,
  })) as Category[];

  // Convert cards with remapped categoryIds
  const mainCards: WebCard[] = catCards.map((c) => ({
    ...c,
    id: genId("card"),
    categoryId: c.categoryId === warehouseCategoryId
      ? mainCategoryId
      : idMap.get(c.categoryId) || c.categoryId,
    importBatchId: undefined,
  })) as WebCard[];

  // Remove shipped items from warehouse
  const remainingCats = whCats.filter((c) => !catIds.includes(c.id));
  const remainingCards = whCards.filter((c) => !catIds.includes(c.categoryId));
  await saveWarehouseCategories(remainingCats);
  await saveWarehouseCards(remainingCards);

  // Update batch counts
  const batches = await getImportBatches();
  const batch = batches.find((b) => b.id === whCat.importBatchId);
  if (batch) {
    batch.categoryCount = remainingCats.filter((c) => c.importBatchId === batch.id).length;
    batch.cardCount = remainingCards.filter((c) => c.importBatchId === batch.id).length;
    await saveImportBatches(batches);
  }

  return { categories: mainCats, cards: mainCards };
}

/** Get stats for a specific batch */
export async function getBatchStats(batchId: string): Promise<{
  categoryCount: number;
  cardCount: number;
  subCategoryCount: number;
  parentCategoryCount: number;
}> {
  const cats = await getWarehouseCategories();
  const cards = await getWarehouseCards();
  const batchCats = cats.filter((c) => c.importBatchId === batchId);
  const batchCards = cards.filter((c) => c.importBatchId === batchId);

  return {
    categoryCount: batchCats.length,
    cardCount: batchCards.length,
    subCategoryCount: batchCats.filter((c) => c.parentId).length,
    parentCategoryCount: batchCats.filter((c) => !c.parentId || c.isParent).length,
  };
}

/** Ship a single card from warehouse to main page */
export async function shipCardToMain(
  warehouseCardId: string,
  mainTargetCategoryId: string
): Promise<WebCard> {
  const whCards = await getWarehouseCards();
  const whCard = whCards.find((c) => c.id === warehouseCardId);
  if (!whCard) throw new Error(`Warehouse card ${warehouseCardId} not found`);

  // Convert to main card format — generate new ID to avoid conflicts
  const mainCard: WebCard = {
    ...whCard,
    id: genId("card"),
    categoryId: mainTargetCategoryId,
    importBatchId: undefined,
  } as WebCard;

  // Remove from warehouse
  const remainingCards = whCards.filter((c) => c.id !== warehouseCardId);
  await saveWarehouseCards(remainingCards);

  // Update batch count
  const batches = await getImportBatches();
  const batch = batches.find((b) => b.id === whCard.importBatchId);
  if (batch) {
    batch.cardCount = remainingCards.filter((c) => c.importBatchId === batch.id).length;
    await saveImportBatches(batches);
  }

  return mainCard;
}

/** Ship a sub-group (and its cards) from warehouse to main page under a parent category */
export async function shipSubGroupToMain(
  warehouseSubGroupId: string,
  mainTargetCategoryId: string
): Promise<{ category: Category; cards: WebCard[] }> {
  const whCats = await getWarehouseCategories();
  const whCards = await getWarehouseCards();

  const whSubCat = whCats.find((c) => c.id === warehouseSubGroupId);
  if (!whSubCat) throw new Error(`Warehouse sub-group ${warehouseSubGroupId} not found`);

  const subCards = whCards.filter((c) => c.categoryId === warehouseSubGroupId);

  // Create main sub-category with new ID under the target parent
  const newSubCatId = genId("cat");
  const mainSubCat: Category = {
    ...whSubCat,
    id: newSubCatId,
    parentId: mainTargetCategoryId,
    importBatchId: undefined,
  } as Category;

  const mainCards: WebCard[] = subCards.map((c) => ({
    ...c,
    id: genId("card"),
    categoryId: newSubCatId,
    importBatchId: undefined,
  })) as WebCard[];

  // Remove shipped items from warehouse
  const remainingCats = whCats.filter((c) => c.id !== warehouseSubGroupId);
  const remainingCards = whCards.filter((c) => c.categoryId !== warehouseSubGroupId);
  await saveWarehouseCategories(remainingCats);
  await saveWarehouseCards(remainingCards);

  // Update batch count
  const batches = await getImportBatches();
  const batch = batches.find((b) => b.id === whSubCat.importBatchId);
  if (batch) {
    batch.categoryCount = remainingCats.filter((c) => c.importBatchId === batch.id).length;
    batch.cardCount = remainingCards.filter((c) => c.importBatchId === batch.id).length;
    await saveImportBatches(batches);
  }

  return { category: mainSubCat, cards: mainCards };
}

/** Update a warehouse category's fields (for edit mode) */
export async function updateWarehouseCategory(updated: WarehouseCategory): Promise<void> {
  const cats = await getWarehouseCategories();
  const idx = cats.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cats[idx] = updated;
    await saveWarehouseCategories(cats);
  }
}

/** Promote a warehouse sub-group to parent category */
export async function promoteWarehouseCategory(categoryId: string): Promise<void> {
  const cats = await getWarehouseCategories();
  const cat = cats.find((c) => c.id === categoryId);
  if (!cat) return;
  cat.isParent = true;
  cat.parentId = undefined;
  await saveWarehouseCategories(cats);
}

/** Demote a warehouse parent category to sub-group */
export async function demoteWarehouseCategory(categoryId: string): Promise<void> {
  const cats = await getWarehouseCategories();
  const cat = cats.find((c) => c.id === categoryId);
  if (!cat) return;
  cat.isParent = false;
  // Detach all sub-groups
  for (const c of cats) {
    if (c.parentId === categoryId) {
      c.parentId = undefined;
    }
  }
  await saveWarehouseCategories(cats);
}

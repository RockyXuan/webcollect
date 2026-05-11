/**
 * 仓库 Zustand Store — 独立于主页 store，管理仓库页面的所有状态
 *
 * 设计原则：
 * - 完全独立的 store，不引用主页 useAppStore
 * - 导入、删除、发货等操作都在此 store 中
 * - 发货时通过 db-warehouse 的 shipCategoryToMain 传递数据到主页
 */

import { create } from "zustand";
import type { WebCard, Category } from "./types";
import { getCards } from "./db";
import type { WarehouseCard, WarehouseCategory, ImportBatch } from "./db-warehouse";
import {
  getWarehouseCards,
  getWarehouseCategories,
  getImportBatches,
  saveWarehouseCards,
  saveWarehouseCategories,
  saveImportBatches,
  addWarehouseCategories,
  addWarehouseCards,
  deleteImportBatch,
  clearWarehouse,
  overwriteWarehouse,
  deleteWarehouseCategory,
  deleteWarehouseCard,
  shipCardToMain as dbShipCardToMain,
  shipSubGroupToMain as dbShipSubGroupToMain,
  updateWarehouseCategory,
  updateWarehouseCard as dbUpdateWarehouseCard,
  promoteWarehouseCategory as dbPromoteWarehouseCategory,
  demoteWarehouseCategory as dbDemoteWarehouseCategory,
} from "./db-warehouse";

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function removeEmptyWarehouseShells(
  cards: WarehouseCard[],
  categories: WarehouseCategory[],
  batches: ImportBatch[]
): { cards: WarehouseCard[]; categories: WarehouseCategory[]; batches: ImportBatch[] } {
  const cardCategoryIds = new Set(cards.map((card) => card.categoryId));
  const nextCategories = categories.filter((category) => {
    if (cardCategoryIds.has(category.id)) return true;
    return categories.some((child) => child.parentId === category.id && cardCategoryIds.has(child.id));
  });
  const categoryIds = new Set(nextCategories.map((category) => category.id));
  const nextCards = cards.filter((card) => categoryIds.has(card.categoryId));
  const nextBatches = batches
    .map((batch) => ({
      ...batch,
      categoryCount: nextCategories.filter((category) => category.importBatchId === batch.id).length,
      cardCount: nextCards.filter((card) => card.importBatchId === batch.id).length,
    }))
    .filter((batch) => batch.categoryCount > 0 || batch.cardCount > 0);
  return { cards: nextCards, categories: nextCategories, batches: nextBatches };
}

interface WarehouseState {
  cards: WarehouseCard[];
  categories: WarehouseCategory[];
  batches: ImportBatch[];
  isLoading: boolean;
  searchQuery: string;
  selectedBatchId: string | null; // null = show all batches

  // Actions
  loadData: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSelectedBatch: (batchId: string | null) => void;

  // Import actions
  importToWarehouse: (
    categories: WarehouseCategory[],
    cards: WarehouseCard[],
    batch: ImportBatch,
    mode: "append" | "overwrite"
  ) => Promise<void>;

  // Delete actions
  deleteBatch: (batchId: string) => Promise<void>;
  clearAllWarehouse: () => Promise<void>;
  deleteExistingWarehouseItems: () => Promise<number>;
  deleteWarehouseCategory: (categoryId: string) => Promise<void>;

  // Ship actions
  shipToMain: (
    warehouseCategoryId: string,
    mainTargetCategoryId: string
  ) => Promise<{ categories: Category[]; cards: WebCard[] }>;

  shipCardToMain: (
    warehouseCardId: string,
    mainTargetCategoryId: string
  ) => Promise<WebCard>;

  shipSubGroupToMain: (
    warehouseSubGroupId: string,
    mainTargetCategoryId: string
  ) => Promise<{ category: Category; cards: WebCard[] }>;

  // Edit actions
  promoteWarehouseCategory: (categoryId: string) => Promise<void>;
  demoteWarehouseCategory: (categoryId: string) => Promise<void>;
  updateWarehouseCategory: (updated: WarehouseCategory) => Promise<void>;
  updateWarehouseCard: (updated: WarehouseCard) => Promise<void>;
  deleteWarehouseCard: (cardId: string) => Promise<void>;
}

export const useWarehouseStore = create<WarehouseState>((set) => ({
  cards: [],
  categories: [],
  batches: [],
  isLoading: true,
  searchQuery: "",
  selectedBatchId: null,

  loadData: async () => {
    set({ isLoading: true });
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches, isLoading: false });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedBatch: (batchId) => set({ selectedBatchId: batchId }),

  importToWarehouse: async (newCats, newCards, batch, mode) => {
    if (mode === "overwrite") {
      await overwriteWarehouse(newCats, newCards, batch);
    } else {
      // Append mode
      await addWarehouseCategories(newCats);
      await addWarehouseCards(newCards);
      const batches = await getImportBatches();
      batches.push(batch);
      const { saveImportBatches } = await import("./db-warehouse");
      await saveImportBatches(batches);
    }
    // Reload
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches });
  },

  deleteBatch: async (batchId) => {
    await deleteImportBatch(batchId);
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches, selectedBatchId: null });
  },

  clearAllWarehouse: async () => {
    await clearWarehouse();
    set({ cards: [], categories: [], batches: [], selectedBatchId: null });
  },

  deleteExistingWarehouseItems: async () => {
    const [mainCards, warehouseCards, warehouseCategories, importBatches] = await Promise.all([
      getCards(),
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    const mainUrls = new Set(mainCards.map((card) => normalizeUrl(card.url)).filter(Boolean));
    const seenWarehouseUrls = new Set<string>();
    let removedCount = 0;
    const nextCards = warehouseCards.filter((card) => {
      const key = normalizeUrl(card.url);
      const existsInMain = mainUrls.has(key);
      const repeatedInWarehouse = seenWarehouseUrls.has(key);
      if (!repeatedInWarehouse) {
        seenWarehouseUrls.add(key);
      }
      if (existsInMain || repeatedInWarehouse) {
        removedCount += 1;
        return false;
      }
      return true;
    });

    if (removedCount === 0) return 0;

    const cleaned = removeEmptyWarehouseShells(nextCards, warehouseCategories, importBatches);
    await Promise.all([
      saveWarehouseCards(cleaned.cards),
      saveWarehouseCategories(cleaned.categories),
      saveImportBatches(cleaned.batches),
    ]);
    set({
      cards: cleaned.cards,
      categories: cleaned.categories,
      batches: cleaned.batches,
      selectedBatchId: cleaned.batches.some((batch) => batch.id === useWarehouseStore.getState().selectedBatchId)
        ? useWarehouseStore.getState().selectedBatchId
        : null,
    });
    return removedCount;
  },

  deleteWarehouseCategory: async (categoryId) => {
    await deleteWarehouseCategory(categoryId);
    const [cards, categories] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
    ]);
    set({ cards, categories });
  },

  shipToMain: async (warehouseCategoryId, mainTargetCategoryId) => {
    const { shipCategoryToMain } = await import("./db-warehouse");
    const result = await shipCategoryToMain(warehouseCategoryId, mainTargetCategoryId);
    // Reload warehouse data
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches });
    return result;
  },

  shipCardToMain: async (warehouseCardId, mainTargetCategoryId) => {
    const mainCard = await dbShipCardToMain(warehouseCardId, mainTargetCategoryId);
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches });
    return mainCard;
  },

  shipSubGroupToMain: async (warehouseSubGroupId, mainTargetCategoryId) => {
    const result = await dbShipSubGroupToMain(warehouseSubGroupId, mainTargetCategoryId);
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches });
    return result;
  },

  promoteWarehouseCategory: async (categoryId) => {
    await dbPromoteWarehouseCategory(categoryId);
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches });
  },

  demoteWarehouseCategory: async (categoryId) => {
    await dbDemoteWarehouseCategory(categoryId);
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches });
  },

  updateWarehouseCategory: async (updated) => {
    await updateWarehouseCategory(updated);
    const categories = await getWarehouseCategories();
    set({ categories });
  },

  updateWarehouseCard: async (updated) => {
    await dbUpdateWarehouseCard(updated);
    const cards = await getWarehouseCards();
    set({ cards });
  },

  deleteWarehouseCard: async (cardId) => {
    await deleteWarehouseCard(cardId);
    const [cards, categories, batches] = await Promise.all([
      getWarehouseCards(),
      getWarehouseCategories(),
      getImportBatches(),
    ]);
    set({ cards, categories, batches });
  },
}));

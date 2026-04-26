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
import type { WarehouseCard, WarehouseCategory, ImportBatch } from "./db-warehouse";
import {
  getWarehouseCards,
  getWarehouseCategories,
  getImportBatches,
  addWarehouseCategories,
  addWarehouseCards,
  deleteImportBatch,
  clearWarehouse,
  overwriteWarehouse,
  deleteWarehouseCategory,
} from "./db-warehouse";

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
  deleteWarehouseCategory: (categoryId: string) => Promise<void>;

  // Ship actions
  shipToMain: (
    warehouseCategoryId: string,
    mainTargetCategoryId: string
  ) => Promise<{ categories: Category[]; cards: WebCard[] }>;
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
}));

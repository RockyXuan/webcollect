import { create } from "zustand";
import type { WebCard, Category, HiddenSite, HideDuration } from "./types";
import {
  getCards,
  saveCards,
  addCard as dbAddCard,
  updateCard as dbUpdateCard,
  deleteCard as dbDeleteCard,
  getCategories,
  saveCategories,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  isInitialized,
  getHiddenSites,
  saveHiddenSites,
  getPinnedCategoryIds,
  savePinnedCategoryIds,
  getCategoryWidths,
  saveCategoryWidths,
} from "./db";

interface AppState {
  cards: WebCard[];
  categories: Category[];
  hiddenSites: HiddenSite[];
  searchQuery: string;
  activeCategoryId: string;
  isLoading: boolean;
  initialized: boolean;
  editMode: boolean;

  // Actions
  loadData: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (id: string) => void;
  setEditMode: (v: boolean) => void;
  toggleEditMode: () => void;

  addCard: (card: WebCard) => Promise<void>;
  updateCard: (card: WebCard) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (cardId: string, targetCategoryId: string, newOrder: number) => Promise<void>;
  reorderCards: (cardId: string, targetCategoryId: string, newOrder: number) => Promise<void>;

  addCategory: (cat: Category) => Promise<void>;
  updateCategory: (cat: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
  moveCategoryToParent: (categoryId: string, parentId: string) => Promise<void>;
  detachCategoryFromParent: (categoryId: string) => Promise<void>;
  promoteToParent: (categoryId: string) => Promise<void>;
  demoteParentCategory: (categoryId: string) => Promise<void>;

  // Hidden sites
  hideSite: (siteId: string, siteUrl: string, duration: HideDuration) => Promise<void>;
  unhideSite: (siteId: string) => Promise<void>;
  isSiteHidden: (siteId: string) => boolean;

  // Settings
  defaultHideDuration: HideDuration;
  setDefaultHideDuration: (duration: HideDuration) => void;

  // Pinned categories
  pinnedCategoryIds: string[];
  togglePinCategory: (categoryId: string) => void;
  isCategoryPinned: (categoryId: string) => boolean;

  // Category widths
  categoryWidths: Record<string, number>;
  setCategoryWidth: (categoryId: string, widthPercent: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  cards: [],
  categories: [],
  hiddenSites: [],
  searchQuery: "",
  activeCategoryId: "all",
  isLoading: true,
  initialized: false,
  editMode: false,
  defaultHideDuration: "1w" as HideDuration,
  pinnedCategoryIds: [] as string[],
  categoryWidths: {} as Record<string, number>,

  loadData: async () => {
    set({ isLoading: true });
    const [cards, initCategories, init, hiddenSites, pinnedIds, widths] = await Promise.all([
      getCards(),
      getCategories(),
      isInitialized(),
      getHiddenSites(),
      getPinnedCategoryIds(),
      getCategoryWidths(),
    ]);
    let categories = initCategories;

    // Clean up expired hidden sites (non-permanent)
    const now = Date.now();
    const cleanedHidden = hiddenSites.filter((h) => {
      if (h.duration === "permanent") return true;
      const durationMs: Record<string, number> = {
        "1w": 7 * 24 * 60 * 60 * 1000,
        "2w": 14 * 24 * 60 * 60 * 1000,
        "1m": 30 * 24 * 60 * 60 * 1000,
      };
      return now - h.hiddenAt < (durationMs[h.duration] || 0);
    });
    if (cleanedHidden.length !== hiddenSites.length) {
      await saveHiddenSites(cleanedHidden);
    }

    set({
      cards,
      categories,
      hiddenSites: cleanedHidden,
      pinnedCategoryIds: pinnedIds,
      categoryWidths: widths,
      initialized: init,
      isLoading: false,
    });

    // Migration: fill missing imageUrl with Google Favicon API
    const needsMigration = cards.some(
      (c) => (!c.imageUrl || c.imageUrl === "") && c.url
    );
    if (needsMigration) {
      const updated = cards.map((c) => {
        if ((!c.imageUrl || c.imageUrl === "") && c.url) {
          try {
            const hostname = new URL(c.url).hostname;
            return {
              ...c,
              imageUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
            };
          } catch {
            return c;
          }
        }
        return c;
      });
      await saveCards(updated);
      set({ cards: updated });
    }

    // Migration: ensure inbox category exists
    const inboxExists = categories.some((c) => c.id === "cat-inbox");
    if (!inboxExists) {
      const inbox: Category = {
        id: "cat-inbox",
        name: "收集箱",
        icon: "inbox",
        color: "#888888",
        order: 99,
        createdAt: Date.now(),
      };
      categories = [...categories, inbox];
    }

    // Migration: add parent categories for 3-level hierarchy
    const parentCatExists = categories.some((c) => c.id === "cat-work");
    if (!parentCatExists) {
      const parentCats: Category[] = [
        { id: "cat-work", name: "工作", icon: "Briefcase", color: "#F59E0B", order: 0, createdAt: Date.now(), isParent: true },
        { id: "cat-ai", name: "AI", icon: "Brain", color: "#8B5CF6", order: 1, createdAt: Date.now(), isParent: true },
        { id: "cat-dev", name: "开发", icon: "Terminal", color: "#10B981", order: 2, createdAt: Date.now(), isParent: true },
      ];
      // Assign parentId to existing sub-categories
      const parentIdMap: Record<string, string> = {
        "cat-1": "cat-work",   // 常用 → 工作
        "cat-3": "cat-work",   // 设计灵感 → 工作
        "cat-5": "cat-work",   // 阅读 → 工作
        "cat-2": "cat-ai",     // AI工具 → AI
        "cat-4": "cat-dev",    // 开发者 → 开发
        // cat-inbox stays at top level (no parentId)
      };
      categories = [
        ...parentCats,
        ...categories.map((c) => ({
          ...c,
          parentId: parentIdMap[c.id] || c.parentId,
        })),
      ];
      await saveCategories(categories);
    }

    // Migration: set isParent for known parent categories that lack it
    const knownParentIds = ["cat-work", "cat-ai", "cat-dev", "cat-inbox"];
    const needsIsParentMigration = categories.some(
      (c) => !c.parentId && !c.isParent && (knownParentIds.includes(c.id) || categories.some((sg) => sg.parentId === c.id))
    );
    if (needsIsParentMigration) {
      categories = categories.map((c) => {
        if (!c.parentId && !c.isParent) {
          // Known seed parents or categories that already have sub-groups
          if (knownParentIds.includes(c.id) || categories.some((sg) => sg.parentId === c.id)) {
            return { ...c, isParent: true };
          }
        }
        return c;
      });
      await saveCategories(categories);
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveCategory: (id) => set({ activeCategoryId: id }),
  setEditMode: (v) => set({ editMode: v }),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  addCard: async (card) => {
    await dbAddCard(card);
    const cards = await getCards();
    set({ cards });
  },

  updateCard: async (card) => {
    await dbUpdateCard(card);
    const cards = await getCards();
    set({ cards });
  },

  deleteCard: async (id) => {
    await dbDeleteCard(id);
    const cards = await getCards();
    set({ cards });
  },

  moveCard: async (cardId, targetCategoryId, newOrder) => {
    const cards = await getCards();
    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx < 0) return;

    const updated = { ...cards[idx], categoryId: targetCategoryId, order: newOrder };

    // Reorder others in target category
    const others = cards.filter((c) => c.categoryId === targetCategoryId && c.id !== cardId);
    others.sort((a, b) => a.order - b.order);

    // Insert updated card at newOrder position
    others.splice(newOrder, 0, updated);
    others.forEach((c, i) => {
      c.order = i;
    });

    // Save all
    const allCards = cards.map((c) => {
      if (c.id === cardId) return updated;
      const reordered = others.find((o) => o.id === c.id);
      return reordered ? { ...c, order: reordered.order, categoryId: reordered.categoryId } : c;
    });

    await saveCards(allCards);
    set({ cards: await getCards() });
  },

  reorderCards: async (cardId, targetCategoryId, newOrder) => {
    const cards = await getCards();
    const cardIdx = cards.findIndex((c) => c.id === cardId);
    if (cardIdx < 0) return;

    // Update the card's category and order
    cards[cardIdx] = { ...cards[cardIdx], categoryId: targetCategoryId, order: newOrder };

    // Reindex all cards in the target category
    const targetCards = cards
      .filter((c) => c.categoryId === targetCategoryId)
      .sort((a, b) => a.order - b.order);

    targetCards.forEach((c, i) => {
      c.order = i;
    });

    await saveCards(cards);
    set({ cards: await getCards() });
  },

  addCategory: async (cat) => {
    await dbAddCategory(cat);
    const categories = await getCategories();
    set({ categories });
  },

  updateCategory: async (cat) => {
    await dbUpdateCategory(cat);
    const categories = await getCategories();
    set({ categories });
  },

  deleteCategory: async (id) => {
    await dbDeleteCategory(id);
    const [cards, categories] = await Promise.all([getCards(), getCategories()]);
    set({ cards, categories });
  },

  reorderCategories: async (orderedIds) => {
    const categories = await getCategories();
    orderedIds.forEach((id, order) => {
      const cat = categories.find((c) => c.id === id);
      if (cat) cat.order = order;
    });
    await saveCategories(categories);
    set({ categories: await getCategories() });
  },

  // Move a standalone category into a parent (demotion: 分类 → 分组)
  moveCategoryToParent: async (categoryId: string, parentId: string) => {
    const categories = await getCategories();
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.parentId = parentId;
    cat.isParent = false; // Demoted to sub-group
    // Re-order within the parent's sub-groups
    const siblings = categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.order - b.order);
    cat.order = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
    await saveCategories(categories);
    set({ categories: await getCategories() });
  },

  // Remove a sub-group from its parent (promotion: 分组 → 顶级分类)
  detachCategoryFromParent: async (categoryId: string) => {
    const categories = await getCategories();
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    delete cat.parentId;
    cat.isParent = true; // Promote to parent category
    // Place at the end of top-level categories
    const topLevel = categories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.order - b.order);
    cat.order = topLevel.length > 0 ? Math.max(...topLevel.map((t) => t.order)) + 1 : 0;
    await saveCategories(categories);
    set({ categories: await getCategories() });
  },

  // Promote an ungrouped item to a parent category
  promoteToParent: async (categoryId: string) => {
    const categories = await getCategories();
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.isParent = true;
    await saveCategories(categories);
    set({ categories: await getCategories() });
  },

  // Demote a parent category: remove isParent, detach all sub-groups
  demoteParentCategory: async (categoryId: string) => {
    const categories = await getCategories();
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.isParent = false;
    // Detach all sub-groups: remove their parentId
    for (const sub of categories) {
      if (sub.parentId === categoryId) {
        delete sub.parentId;
        delete sub.isParent;
      }
    }
    await saveCategories(categories);
    set({ categories: await getCategories() });
  },

  // Hidden sites management (per-user preferences)
  hideSite: async (siteId, siteUrl, duration) => {
    const hiddenSites = [...get().hiddenSites];
    // Remove existing entry for same siteId if present
    const idx = hiddenSites.findIndex((h) => h.siteId === siteId);
    if (idx >= 0) {
      hiddenSites[idx] = { siteId, siteUrl, hiddenAt: Date.now(), duration };
    } else {
      hiddenSites.push({ siteId, siteUrl, hiddenAt: Date.now(), duration });
    }
    await saveHiddenSites(hiddenSites);
    set({ hiddenSites });
  },

  unhideSite: async (siteId) => {
    const hiddenSites = get().hiddenSites.filter((h) => h.siteId !== siteId);
    await saveHiddenSites(hiddenSites);
    set({ hiddenSites });
  },

  isSiteHidden: (siteId) => {
    const hiddenSites = get().hiddenSites;
    const entry = hiddenSites.find((h) => h.siteId === siteId);
    if (!entry) return false;
    if (entry.duration === "permanent") return true;
    const now = Date.now();
    const durationMs: Record<string, number> = {
      "1w": 7 * 24 * 60 * 60 * 1000,
      "2w": 14 * 24 * 60 * 60 * 1000,
      "1m": 30 * 24 * 60 * 60 * 1000,
    };
    return now - entry.hiddenAt < (durationMs[entry.duration] || 0);
  },

  setDefaultHideDuration: (duration) => {
    set({ defaultHideDuration: duration });
  },

  togglePinCategory: async (categoryId) => {
    const pinned = [...get().pinnedCategoryIds];
    const idx = pinned.indexOf(categoryId);
    if (idx >= 0) {
      pinned.splice(idx, 1);
    } else {
      pinned.push(categoryId);
    }
    await savePinnedCategoryIds(pinned);
    set({ pinnedCategoryIds: pinned });
  },

  isCategoryPinned: (categoryId) => {
    return get().pinnedCategoryIds.includes(categoryId);
  },

  setCategoryWidth: (categoryId, widthPercent) => {
    const widths = { ...get().categoryWidths, [categoryId]: widthPercent };
    saveCategoryWidths(widths);
    set({ categoryWidths: widths });
  },
}));

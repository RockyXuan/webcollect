import { create } from "zustand";
import type { WebCard, Category, HiddenSite, HideDuration, LinkOpenMode, RecycleBinItem, CollectionSection, PinnedBookmarkItem, CategoryLayoutPreference } from "./types";
import type { SearchEngineId } from "./search-engines";
import {
  getCards,
  saveCardsRebased,
  addCard as dbAddCard,
  updateCard as dbUpdateCard,
  deleteCard as dbDeleteCard,
  getCategories,
  saveCategories,
  saveCategoriesRebased,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  isInitialized,
  getHiddenSites,
  saveHiddenSites,
  getPinnedCategoryIds,
  savePinnedCategoryIds,
  getPinnedBookmarkItems,
  savePinnedBookmarkItems,
  getCategoryWidths,
  saveCategoryWidths,
  getCategoryLayouts,
  saveCategoryLayouts,
  getVisualScale,
  saveVisualScale,
  getLinkOpenMode,
  saveLinkOpenMode,
  getSearchEngine,
  saveSearchEngine,
  getSections,
  saveSectionsRebased,
  getActiveSectionId,
  saveActiveSectionId,
  getRecycleBin,
  getRecycleBinItem,
  getWorkspaceResetAt,
  addToRecycleBin,
  removeFromRecycleBin,
  clearRecycleBin,
  withoutLocalChangeEvents,
} from "./db";
import { createLocalDataSnapshot } from "./local-snapshots";
import {
  ensureParentDirectCardsAreVisible,
  ensureSectionInboxes,
  getDefaultSectionId,
  runLocalMigrations,
} from "./migrations";
import {
  normalizePinnedBookmarkItems,
  reorderPinnedBookmarkItems,
  togglePinnedBookmarkItem,
  updatePinnedBookmarkItem,
} from "./pinned-bookmarks";

const DEFAULT_SECTION_ID = "section-default";

function cloneEntitySnapshot<T extends object>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}

interface LoadDataOptions {
  showLoading?: boolean;
  preserveOnCollapse?: boolean;
}

function countCardsInSection(cards: WebCard[], categories: Category[], sectionId: string): number {
  const categoryIds = new Set(
    categories
      .filter((category) => (category.sectionId || DEFAULT_SECTION_ID) === sectionId)
      .map((category) => category.id)
  );
  return cards.filter((card) => categoryIds.has(card.categoryId)).length;
}

function looksLikeRefreshCollapse(
  previous: Pick<AppState, "cards" | "categories" | "sections" | "activeSectionId">,
  next: Pick<AppState, "cards" | "categories" | "sections" | "activeSectionId">
): boolean {
  const previousHasWorkspace = previous.sections.length > 1 || previous.categories.length > 3 || previous.cards.length > 5;
  if (!previousHasWorkspace) return false;

  if (previous.sections.length > 1 && next.sections.length <= 1 && previous.categories.length > 3) {
    return true;
  }

  if (previous.categories.length >= 4 && next.categories.length <= 1) {
    return true;
  }

  if (previous.cards.length >= 8 && next.cards.length <= Math.max(1, Math.floor(previous.cards.length * 0.2))) {
    return true;
  }

  const previousActiveCards = countCardsInSection(previous.cards, previous.categories, previous.activeSectionId);
  const nextActiveCards = countCardsInSection(next.cards, next.categories, next.activeSectionId);
  return previousActiveCards >= 5 && nextActiveCards <= Math.max(1, Math.floor(previousActiveCards * 0.2));
}

function publishCaptureDestinationsSoon(): void {
  if (typeof window === "undefined") return;
  void import("./floating-capture")
    .then(({ publishCaptureDestinationCache }) => publishCaptureDestinationCache())
    .catch((error) => {
      console.warn("[WebCollect] Failed to publish floating capture destinations:", error);
    });
}

async function resolveCardDropCategoryId(
  categories: Category[],
  targetCategoryId: string,
  activeSectionId: string
): Promise<{ categoryId: string; categories: Category[] }> {
  const target = categories.find((category) => category.id === targetCategoryId);
  if (!target) return { categoryId: targetCategoryId, categories };

  const targetChildren = categories
    .filter((category) => category.parentId === target.id)
    .sort((a, b) => a.order - b.order);
  const isContainerOnly = target.isParent || targetChildren.length > 0;
  if (!isContainerOnly) return { categoryId: targetCategoryId, categories };
  if (targetChildren[0]) return { categoryId: targetChildren[0].id, categories };

  const now = Date.now();
  const inboxGroup: Category = {
    id: `cat-${now}`,
    name: "\u6536\u96c6\u7bb1",
    icon: "inbox",
    color: "#888888",
    order: 0,
    createdAt: now,
    updatedAt: now,
    parentId: target.id,
    sectionId: target.sectionId || activeSectionId,
  };
  await dbAddCategory(inboxGroup);
  return { categoryId: inboxGroup.id, categories: [...categories, inboxGroup] };
}

interface AppState {
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
  activeSectionId: string;
  hiddenSites: HiddenSite[];
  searchQuery: string;
  activeCategoryId: string;
  isLoading: boolean;
  initialized: boolean;
  editMode: boolean;

  // Actions
  loadData: (options?: LoadDataOptions) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (id: string) => void;
  setActiveSection: (id: string) => Promise<void>;
  addSection: (name: string) => Promise<void>;
  updateSection: (section: CollectionSection) => Promise<void>;
  reorderSections: (orderedIds: string[]) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
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
  moveCategoryToParent: (categoryId: string, parentId: string, insertIndex?: number) => Promise<void>;
  detachCategoryFromParent: (categoryId: string) => Promise<void>;
  promoteToParent: (categoryId: string) => Promise<void>;
  demoteParentCategory: (categoryId: string) => Promise<void>;
  moveCategoryToSection: (categoryId: string, targetSectionId: string) => Promise<void>;
  moveCardToSection: (cardId: string, targetSectionId: string, targetCategoryId?: string) => Promise<void>;

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

  // Global bookmark bar
  pinnedBookmarkItems: PinnedBookmarkItem[];
  togglePinBookmark: (cardId: string) => void;
  updatePinnedBookmark: (item: PinnedBookmarkItem) => void;
  reorderPinnedBookmarks: (orderedIds: string[]) => void;
  isBookmarkPinned: (cardId: string) => boolean;

  // Category widths and layout intent
  categoryWidths: Record<string, number>;
  categoryLayouts: Record<string, CategoryLayoutPreference>;
  setCategoryWidth: (categoryId: string, widthPercent: number, columns?: number) => void;
  setCategoryLayoutLocked: (categoryId: string, locked: boolean, widthPercent?: number, columns?: number) => void;
  visualScale: number;
  setVisualScale: (scale: number) => void;
  linkOpenMode: LinkOpenMode;
  setLinkOpenMode: (mode: LinkOpenMode) => void;
  searchEngine: SearchEngineId;
  setSearchEngine: (engine: SearchEngineId) => void;

  // Recycle bin
  recycleBin: RecycleBinItem[];
  softDeleteCategory: (id: string) => Promise<void>;
  softDeleteSubGroup: (id: string) => Promise<void>;
  softDeleteCard: (id: string) => Promise<void>;
  restoreFromBin: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  emptyBin: () => Promise<void>;
  loadRecycleBin: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  cards: [],
  categories: [],
  sections: [],
  activeSectionId: DEFAULT_SECTION_ID,
  hiddenSites: [],
  searchQuery: "",
  activeCategoryId: "all",
  isLoading: true,
  initialized: false,
  editMode: false,
  defaultHideDuration: "1w" as HideDuration,
  pinnedCategoryIds: [] as string[],
  pinnedBookmarkItems: [] as PinnedBookmarkItem[],
  categoryWidths: {} as Record<string, number>,
  categoryLayouts: {} as Record<string, CategoryLayoutPreference>,
  visualScale: 100,
  linkOpenMode: "new-background-tab",
  searchEngine: "google",

  loadData: async (options) => {
    const showLoading = options?.showLoading ?? true;
    const previousState = get();
    if (showLoading) set({ isLoading: true });
    const [storedCards, initCategories, init, hiddenSites, pinnedIds, pinnedBookmarkItems, widths, layouts, visualScale, linkOpenMode, searchEngine, storedSections, storedActiveSectionId, workspaceResetAt] = await Promise.all([
      getCards(),
      getCategories(),
      isInitialized(),
      getHiddenSites(),
      getPinnedCategoryIds(),
      getPinnedBookmarkItems(),
      getCategoryWidths(),
      getCategoryLayouts(),
      getVisualScale(),
      getLinkOpenMode(),
      getSearchEngine(),
      getSections(),
      getActiveSectionId(),
      getWorkspaceResetAt(),
    ]);
    const migrated = await runLocalMigrations({
      cards: storedCards,
      categories: initCategories,
      sections: storedSections,
      activeSectionId: storedActiveSectionId,
      workspaceResetAt,
    });
    const { cards, sections, activeSectionId } = migrated;
    let { categories } = migrated;

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
      await withoutLocalChangeEvents(() => saveHiddenSites(cleanedHidden));
    }

    const categoriesWithInboxes = ensureSectionInboxes(categories, sections);
    if (
      categoriesWithInboxes.length !== categories.length ||
      categoriesWithInboxes.some((category, index) => category !== categories[index])
    ) {
      categories = categoriesWithInboxes;
      await withoutLocalChangeEvents(() => saveCategories(categories));
    }

    const nextState = {
      cards,
      categories,
      sections,
      activeSectionId,
      hiddenSites: cleanedHidden,
      pinnedCategoryIds: pinnedIds,
      pinnedBookmarkItems: normalizePinnedBookmarkItems(pinnedBookmarkItems),
      categoryWidths: widths,
      categoryLayouts: layouts,
      visualScale,
      linkOpenMode,
      searchEngine,
      initialized: init,
      isLoading: false,
    };

    if (options?.preserveOnCollapse && looksLikeRefreshCollapse(previousState, nextState)) {
      set({ isLoading: false });
      throw new Error("刷新结果看起来不完整，已保留当前页面。请稍后再试，或先点云端同步。");
    }

    set(nextState);
    publishCaptureDestinationsSoon();

    // Load recycle bin in background (non-blocking)
    void get().loadRecycleBin();
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveCategory: (id) => set({ activeCategoryId: id }),
  setActiveSection: async (id) => {
    const section = get().sections.find((item) => item.id === id);
    if (!section) return;
    await saveActiveSectionId(id);
    set({ activeSectionId: id, activeCategoryId: "all", searchQuery: "" });
  },
  addSection: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const sections = await getSections();
    const now = Date.now();
    const nextSection: CollectionSection = {
      id: `section-${now}`,
      name: trimmed,
      order: sections.length > 0 ? Math.max(...sections.map((section) => section.order)) + 1 : 0,
      createdAt: now,
      updatedAt: now,
    };
    const nextSections = [...sections, nextSection];
    const existingCategories = await getCategories();
    const nextCategories = ensureSectionInboxes(existingCategories, nextSections);
    if (
      nextCategories.length !== existingCategories.length ||
      nextCategories.some((category, index) => category !== existingCategories[index])
    ) {
      const persistedCategories = await saveCategoriesRebased(existingCategories, nextCategories);
      set({ categories: persistedCategories });
    }
    const persistedSections = await saveSectionsRebased(sections, nextSections);
    await saveActiveSectionId(nextSection.id);
    set({ sections: persistedSections, activeSectionId: nextSection.id, activeCategoryId: "all", searchQuery: "" });
  },
  updateSection: async (section) => {
    const sections = await getSections();
    const nextSections = sections.map((item) =>
      item.id === section.id ? { ...section, updatedAt: Date.now() } : item
    );
    const persistedSections = await saveSectionsRebased(sections, nextSections);
    set({ sections: persistedSections });
  },
  reorderSections: async (orderedIds) => {
    const sections = await getSections();
    const byId = new Map(sections.map((section) => [section.id, section]));
    const defaultSection = byId.get(DEFAULT_SECTION_ID);
    const seen = new Set<string>();
    const orderedMovable = orderedIds
      .filter((id) => id !== DEFAULT_SECTION_ID && byId.has(id))
      .map((id) => {
        seen.add(id);
        return byId.get(id)!;
      });
    const remaining = sections
      .filter((section) => section.id !== DEFAULT_SECTION_ID && !seen.has(section.id))
      .sort((a, b) => a.order - b.order);
    const ordered = [
      ...(defaultSection ? [defaultSection] : []),
      ...orderedMovable,
      ...remaining,
    ];
    const now = Date.now();
    const nextSections = ordered.map((section, order) => (
      section.order === order ? section : { ...section, order, updatedAt: now }
    ));
    const persistedSections = await saveSectionsRebased(sections, nextSections);
    set({ sections: persistedSections });
  },
  deleteSection: async (id) => {
    if (id === DEFAULT_SECTION_ID) return;
    const [sections, categories, cards] = await Promise.all([getSections(), getCategories(), getCards()]);
    const targetSection = sections.find((section) => section.id === id);
    if (!targetSection) return;
    const nextSections = sections.filter((section) => section.id !== id);
    if (nextSections.length === 0) return;

    await createLocalDataSnapshot("before-delete-section", `删除分项“${targetSection.name}”前本地版本`, { force: true });

    const fallbackSectionId = getDefaultSectionId(nextSections);
    const now = Date.now();
    const cardCountByCategory = new Map<string, number>();
    for (const card of cards) {
      cardCountByCategory.set(card.categoryId, (cardCountByCategory.get(card.categoryId) || 0) + 1);
    }
    const childCountByCategory = new Map<string, number>();
    for (const category of categories) {
      if (category.parentId) {
        childCountByCategory.set(category.parentId, (childCountByCategory.get(category.parentId) || 0) + 1);
      }
    }

    const nextCategories = categories.flatMap((category) => {
      const categorySectionId = category.sectionId || DEFAULT_SECTION_ID;
      if (categorySectionId !== id) return [category];

      const isEmptyAutoInbox =
        category.id === `cat-inbox-${id}` &&
        category.name.trim() === "收集箱" &&
        (cardCountByCategory.get(category.id) || 0) === 0 &&
        (childCountByCategory.get(category.id) || 0) === 0;
      if (isEmptyAutoInbox) return [];

      return [{ ...category, sectionId: fallbackSectionId, updatedAt: now }];
    });
    const nextActiveSectionId = get().activeSectionId === id ? fallbackSectionId : get().activeSectionId;

    const persistedCategories = await saveCategoriesRebased(categories, nextCategories);
    const persistedSections = await saveSectionsRebased(sections, nextSections);
    if (nextActiveSectionId !== get().activeSectionId) {
      await saveActiveSectionId(nextActiveSectionId);
    }
    set({
      categories: persistedCategories,
      sections: persistedSections,
      activeSectionId: nextActiveSectionId,
      activeCategoryId: "all",
      searchQuery: "",
    });
  },
  setEditMode: (v) => set({ editMode: v }),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  addCard: async (card) => {
    await dbAddCard(card);
    set({ cards: [...get().cards, card].sort((a, b) => a.order - b.order) });
  },

  updateCard: async (card) => {
    const updated = { ...card, updatedAt: Date.now() };
    await dbUpdateCard(updated);
    set({ cards: get().cards.map((item) => item.id === updated.id ? updated : item) });
  },

  deleteCard: async (id) => {
    await dbDeleteCard(id);
    set({ cards: get().cards.filter((card) => card.id !== id) });
  },

  moveCard: async (cardId, targetCategoryId, newOrder) => {
    const cards = await getCards();
    const cardBaseline = cloneEntitySnapshot(cards);
    const categories = await getCategories();
    const resolved = await resolveCardDropCategoryId(categories, targetCategoryId, get().activeSectionId);
    const finalCategoryId = resolved.categoryId;
    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx < 0) return;

    const updated = { ...cards[idx], categoryId: finalCategoryId, order: newOrder, updatedAt: Date.now() };

    // Reorder others in target category
    const others = cards.filter((c) => c.categoryId === finalCategoryId && c.id !== cardId);
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

    const persistedCards = await saveCardsRebased(cardBaseline, allCards);
    set({ cards: persistedCards, categories: resolved.categories });
  },

  reorderCards: async (cardId, targetCategoryId, newOrder) => {
    const cards = await getCards();
    const cardBaseline = cloneEntitySnapshot(cards);
    const categories = await getCategories();
    const resolved = await resolveCardDropCategoryId(categories, targetCategoryId, get().activeSectionId);
    const finalCategoryId = resolved.categoryId;
    const cardIdx = cards.findIndex((c) => c.id === cardId);
    if (cardIdx < 0) return;

    // Update the card's category and order
    cards[cardIdx] = { ...cards[cardIdx], categoryId: finalCategoryId, order: newOrder, updatedAt: Date.now() };

    // Reindex all cards in the target category
    const targetCards = cards
      .filter((c) => c.categoryId === finalCategoryId)
      .sort((a, b) => a.order - b.order);

    targetCards.forEach((c, i) => {
      c.order = i;
    });

    const persistedCards = await saveCardsRebased(cardBaseline, cards);
    set({ cards: persistedCards, categories: resolved.categories });
  },

  addCategory: async (cat) => {
    const now = Date.now();
    const nextCategory = {
      ...cat,
      createdAt: cat.createdAt || now,
      updatedAt: now,
      sectionId: cat.sectionId || get().activeSectionId,
    };
    await dbAddCategory(nextCategory);
    set({ categories: [...get().categories, nextCategory].sort((a, b) => a.order - b.order) });
  },

  updateCategory: async (cat) => {
    const updated = { ...cat, updatedAt: Date.now(), sectionId: cat.sectionId || get().activeSectionId };
    await dbUpdateCategory(updated);
    set({ categories: get().categories.map((category) => category.id === updated.id ? updated : category) });
  },

  deleteCategory: async (id) => {
    await dbDeleteCategory(id);
    set({ categories: get().categories.filter((category) => category.id !== id) });
  },

  reorderCategories: async (orderedIds) => {
    const categories = await getCategories();
    const categoryBaseline = cloneEntitySnapshot(categories);
    const now = Date.now();
    orderedIds.forEach((id, order) => {
      const cat = categories.find((c) => c.id === id);
      if (cat && cat.order !== order) {
        cat.order = order;
        cat.updatedAt = now;
      }
    });
    const persistedCategories = await saveCategoriesRebased(categoryBaseline, categories);
    set({ categories: persistedCategories });
  },

  // Move a standalone category into a parent (demotion: 鍒嗙被 鈫?鍒嗙粍)
  moveCategoryToParent: async (categoryId: string, parentId: string, insertIndex?: number) => {
    const categories = await getCategories();
    const categoryBaseline = cloneEntitySnapshot(categories);
    const cat = categories.find((c) => c.id === categoryId);
    const parent = categories.find((c) => c.id === parentId);
    if (!cat) return;
    const now = Date.now();
    cat.parentId = parentId;
    cat.isParent = false; // Demoted to sub-group
    cat.sectionId = parent?.sectionId || cat.sectionId || get().activeSectionId;
    cat.updatedAt = now;
    if (parent) {
      parent.isParent = true;
      parent.updatedAt = now;
    }
    // Re-order within the parent's sub-groups
    const siblings = categories
      .filter((c) => c.parentId === parentId && c.id !== categoryId)
      .sort((a, b) => a.order - b.order);
    const targetIndex = typeof insertIndex === "number"
      ? Math.max(0, Math.min(insertIndex, siblings.length))
      : siblings.length;
    siblings.splice(targetIndex, 0, cat);
    siblings.forEach((sibling, order) => {
      sibling.order = order;
      sibling.sectionId = parent?.sectionId || sibling.sectionId || get().activeSectionId;
      sibling.updatedAt = now;
    });
    const persistedCategories = await saveCategoriesRebased(categoryBaseline, categories);
    set({ categories: persistedCategories });
  },

  // Remove a sub-group from its parent (promotion: 鍒嗙粍 鈫?椤剁骇鍒嗙被)
  detachCategoryFromParent: async (categoryId: string) => {
    const categories = await getCategories();
    const cards = await getCards();
    const categoryBaseline = cloneEntitySnapshot(categories);
    const cardBaseline = cloneEntitySnapshot(cards);
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    delete cat.parentId;
    cat.isParent = true; // Promote to parent category
    cat.sectionId = cat.sectionId || get().activeSectionId;
    cat.updatedAt = Date.now();
    // Place at the end of top-level categories
    const topLevel = categories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.order - b.order);
    cat.order = topLevel.length > 0 ? Math.max(...topLevel.map((t) => t.order)) + 1 : 0;
    const repaired = ensureParentDirectCardsAreVisible(categories, cards, get().activeSectionId);
    const persistedCategories = await saveCategoriesRebased(categoryBaseline, repaired.categories);
    let persistedCards = cards;
    if (repaired.changed) {
      persistedCards = await saveCardsRebased(cardBaseline, repaired.cards);
    }
    set({ cards: persistedCards, categories: persistedCategories });
  },

  // Promote an ungrouped item to a parent category
  promoteToParent: async (categoryId: string) => {
    const categories = await getCategories();
    const cards = await getCards();
    const categoryBaseline = cloneEntitySnapshot(categories);
    const cardBaseline = cloneEntitySnapshot(cards);
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.isParent = true;
    cat.sectionId = cat.sectionId || get().activeSectionId;
    cat.updatedAt = Date.now();
    const repaired = ensureParentDirectCardsAreVisible(categories, cards, get().activeSectionId);
    const persistedCategories = await saveCategoriesRebased(categoryBaseline, repaired.categories);
    let persistedCards = cards;
    if (repaired.changed) {
      persistedCards = await saveCardsRebased(cardBaseline, repaired.cards);
    }
    set({ cards: persistedCards, categories: persistedCategories });
  },

  // Demote a parent category: remove isParent, detach all sub-groups
  demoteParentCategory: async (categoryId: string) => {
    const categories = await getCategories();
    const categoryBaseline = cloneEntitySnapshot(categories);
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.isParent = false;
    cat.updatedAt = Date.now();
    // Detach all sub-groups: remove their parentId
    for (const sub of categories) {
      if (sub.parentId === categoryId) {
        delete sub.parentId;
        delete sub.isParent;
        sub.sectionId = sub.sectionId || cat.sectionId || get().activeSectionId;
        sub.updatedAt = Date.now();
      }
    }
    const persistedCategories = await saveCategoriesRebased(categoryBaseline, categories);
    set({ categories: persistedCategories });
  },

  moveCategoryToSection: async (categoryId: string, targetSectionId: string) => {
    const sections = await getSections();
    if (!sections.some((section) => section.id === targetSectionId)) return;
    const categories = await getCategories();
    const rootCategory = categories.find((c) => c.id === categoryId);
    if (!rootCategory) return;

    const categoryIds = new Set<string>([categoryId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories) {
        if (category.parentId && categoryIds.has(category.parentId) && !categoryIds.has(category.id)) {
          categoryIds.add(category.id);
          changed = true;
        }
      }
    }

    const targetTopLevel = categories.filter((category) => !category.parentId && category.sectionId === targetSectionId);
    const nextOrder = targetTopLevel.length > 0 ? Math.max(...targetTopLevel.map((category) => category.order)) + 1 : 0;

    const nextCategories = categories.map((category) => {
      if (!categoryIds.has(category.id)) return category;
      const moved = { ...category, sectionId: targetSectionId, updatedAt: Date.now() };
      if (category.id === categoryId) {
        delete moved.parentId;
        moved.order = nextOrder;
        if (rootCategory.parentId) {
          moved.isParent = false;
        }
      }
      return moved;
    });

    const persistedCategories = await saveCategoriesRebased(categories, nextCategories);
    set({ categories: persistedCategories });
  },

  moveCardToSection: async (cardId: string, targetSectionId: string, targetCategoryId?: string) => {
    const sections = await getSections();
    if (!sections.some((section) => section.id === targetSectionId)) return;
    const [cards, categories] = await Promise.all([getCards(), getCategories()]);
    const card = cards.find((item) => item.id === cardId);
    if (!card) return;

    let finalCategoryId = targetCategoryId;
    let nextCategories = categories;
    const targetCategory = finalCategoryId ? categories.find((category) => category.id === finalCategoryId) : null;
    if (!targetCategory || targetCategory.sectionId !== targetSectionId) {
      const inbox = categories.find(
        (category) => category.sectionId === targetSectionId && !category.parentId && !category.isParent && category.name === "\u6536\u96c6\u7bb1"
      );
      if (inbox) {
        finalCategoryId = inbox.id;
      } else {
        const now = Date.now();
        const newCategory: Category = {
          id: `cat-${now}`,
          name: "\u6536\u96c6\u7bb1",
          icon: "inbox",
          color: "#888888",
          order: categories.filter((category) => !category.parentId && category.sectionId === targetSectionId).length,
          createdAt: now,
          updatedAt: now,
          sectionId: targetSectionId,
        };
        await dbAddCategory(newCategory);
        finalCategoryId = newCategory.id;
        nextCategories = [...categories, newCategory];
      }
    }

    const nextCards = cards.map((item) =>
      item.id === cardId
        ? { ...item, categoryId: finalCategoryId as string, updatedAt: Date.now() }
        : item
    );
    const persistedCards = await saveCardsRebased(cards, nextCards);
    set({ cards: persistedCards, categories: nextCategories });
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

  togglePinBookmark: async (cardId) => {
    const next = togglePinnedBookmarkItem(get().pinnedBookmarkItems, cardId);
    await savePinnedBookmarkItems(next);
    set({ pinnedBookmarkItems: next });
  },

  updatePinnedBookmark: async (item) => {
    const next = updatePinnedBookmarkItem(get().pinnedBookmarkItems, item);
    await savePinnedBookmarkItems(next);
    set({ pinnedBookmarkItems: next });
  },

  reorderPinnedBookmarks: async (orderedIds) => {
    const next = reorderPinnedBookmarkItems(get().pinnedBookmarkItems, orderedIds);
    await savePinnedBookmarkItems(next);
    set({ pinnedBookmarkItems: next });
  },

  isBookmarkPinned: (cardId) => {
    return get().pinnedBookmarkItems.some((item) => item.cardId === cardId);
  },

  setCategoryWidth: (categoryId, widthPercent, columns) => {
    const now = Date.now();
    const safeWidth = Math.max(8, Math.min(100, widthPercent));
    const safeColumns = typeof columns === "number" && Number.isFinite(columns)
      ? Math.max(1, Math.min(8, Math.round(columns)))
      : get().categoryLayouts[categoryId]?.columns;
    const widths = { ...get().categoryWidths, [categoryId]: safeWidth };
    const layouts = {
      ...get().categoryLayouts,
      [categoryId]: {
        ...get().categoryLayouts[categoryId],
        widthPercent: safeWidth,
        columns: safeColumns,
        updatedAt: now,
      },
    };
    void saveCategoryWidths(widths);
    void saveCategoryLayouts(layouts);
    set({ categoryWidths: widths, categoryLayouts: layouts });
  },

  setCategoryLayoutLocked: (categoryId, locked, widthPercent, columns) => {
    const now = Date.now();
    const existing = get().categoryLayouts[categoryId];
    const safeWidth = typeof widthPercent === "number" && Number.isFinite(widthPercent)
      ? Math.max(8, Math.min(100, widthPercent))
      : existing?.widthPercent ?? get().categoryWidths[categoryId];
    const safeColumns = typeof columns === "number" && Number.isFinite(columns)
      ? Math.max(1, Math.min(8, Math.round(columns)))
      : existing?.columns;
    const nextLayout: CategoryLayoutPreference = {
      ...existing,
      widthPercent: safeWidth,
      columns: safeColumns,
      locked,
      updatedAt: now,
    };
    const layouts = {
      ...get().categoryLayouts,
      [categoryId]: nextLayout,
    };
    const widths = typeof safeWidth === "number" && Number.isFinite(safeWidth)
      ? { ...get().categoryWidths, [categoryId]: safeWidth }
      : get().categoryWidths;
    if (widths !== get().categoryWidths) void saveCategoryWidths(widths);
    void saveCategoryLayouts(layouts);
    set({ categoryWidths: widths, categoryLayouts: layouts });
  },

  setVisualScale: (scale) => {
    const clamped = Math.max(85, Math.min(125, scale));
    saveVisualScale(clamped);
    set({ visualScale: clamped });
  },

  setLinkOpenMode: (mode) => {
    saveLinkOpenMode(mode);
    set({ linkOpenMode: mode });
  },

  setSearchEngine: (engine) => {
    saveSearchEngine(engine);
    set({ searchEngine: engine });
  },

  // Recycle bin methods
  recycleBin: [],

  loadRecycleBin: async () => {
    const items = await getRecycleBin();
    set({ recycleBin: items });
  },

  softDeleteCategory: async (id) => {
    const [categories, cards] = await Promise.all([getCategories(), getCards()]);
    const category = categories.find(c => c.id === id);
    if (!category) return;
    await createLocalDataSnapshot("before-soft-delete-category", "\u5220\u9664\u5206\u7c7b\u524d\u672c\u5730\u7248\u672c", { force: true });

    // Find all child categories and their cards
    const childCategories = categories.filter(c => c.parentId === id);
    const categoryIds = [id, ...childCategories.map(c => c.id)];
    const affectedCards = cards.filter(c => categoryIds.includes(c.categoryId));

    // Create recycle bin entry
    const binItem: RecycleBinItem = {
      id: `bin-${Date.now()}-${id}`,
      type: category.isParent ? 'category' : 'group',
      name: category.name,
      deletedAt: Date.now(),
      categories: [category, ...childCategories],
      cards: affectedCards,
    };

    await addToRecycleBin([binItem]);

    // Remove from main data
    const newCategories = categories.filter(c => !categoryIds.includes(c.id));
    const newCards = cards.filter(c => !categoryIds.includes(c.categoryId));
    const [persistedCategories, persistedCards] = await Promise.all([
      saveCategoriesRebased(categories, newCategories),
      saveCardsRebased(cards, newCards),
    ]);
    set({ categories: persistedCategories, cards: persistedCards });
    await get().loadRecycleBin();
  },

  softDeleteSubGroup: async (id) => {
    const [categories, cards] = await Promise.all([getCategories(), getCards()]);
    const category = categories.find(c => c.id === id);
    if (!category) return;
    await createLocalDataSnapshot("before-soft-delete-group", "\u5220\u9664\u5206\u7ec4\u524d\u672c\u5730\u7248\u672c", { force: true });

    // Find all cards in this sub-group
    const affectedCards = cards.filter(c => c.categoryId === id);

    const binItem: RecycleBinItem = {
      id: `bin-${Date.now()}-${id}`,
      type: 'group',
      name: category.name,
      deletedAt: Date.now(),
      categories: [category],
      cards: affectedCards,
    };

    await addToRecycleBin([binItem]);

    const newCategories = categories.filter(c => c.id !== id);
    const newCards = cards.filter(c => c.categoryId !== id);
    const [persistedCategories, persistedCards] = await Promise.all([
      saveCategoriesRebased(categories, newCategories),
      saveCardsRebased(cards, newCards),
    ]);
    set({ categories: persistedCategories, cards: persistedCards });
    await get().loadRecycleBin();
  },

  softDeleteCard: async (id) => {
    const cards = await getCards();
    const card = cards.find(c => c.id === id);
    if (!card) return;
    await createLocalDataSnapshot("before-soft-delete-card", "\u5220\u9664\u7f51\u9875\u524d\u672c\u5730\u7248\u672c", { force: true });

    const binItem: RecycleBinItem = {
      id: `bin-${Date.now()}-${id}`,
      type: 'card',
      name: card.title || card.url,
      deletedAt: Date.now(),
      categories: [],
      cards: [card],
    };

    await addToRecycleBin([binItem]);

    const newCards = cards.filter(c => c.id !== id);
    const persistedCards = await saveCardsRebased(cards, newCards);
    set({ cards: persistedCards });
    await get().loadRecycleBin();
  },

  restoreFromBin: async (id) => {
    const item = await getRecycleBinItem(id);
    if (!item) return;

    const [categories, cards] = await Promise.all([getCategories(), getCards()]);
    await createLocalDataSnapshot("before-recycle-restore", "\u56de\u6536\u7ad9\u6062\u590d\u524d\u672c\u5730\u7248\u672c", { force: true });

    // Restore categories (avoid duplicates)
    const existingCatIds = new Set(categories.map(c => c.id));
    const restoredCategories = item.categories.filter(c => !existingCatIds.has(c.id));

    // Restore cards (avoid duplicates)
    const existingCardIds = new Set(cards.map(c => c.id));
    const restoredCards = item.cards.filter(c => !existingCardIds.has(c.id));

    const newCategories = [...categories, ...restoredCategories];
    const newCards = [...cards, ...restoredCards];

    const [persistedCategories, persistedCards] = await Promise.all([
      saveCategoriesRebased(categories, newCategories),
      saveCardsRebased(cards, newCards),
    ]);
    set({ categories: persistedCategories, cards: persistedCards });

    // Remove from bin
    await removeFromRecycleBin([id]);
    await get().loadRecycleBin();
  },

  permanentDelete: async (id) => {
    await createLocalDataSnapshot("before-permanent-delete", "\u6c38\u4e45\u5220\u9664\u524d\u672c\u5730\u7248\u672c", { force: true });
    await removeFromRecycleBin([id]);
    await get().loadRecycleBin();
  },

  emptyBin: async () => {
    await createLocalDataSnapshot("before-empty-bin", "\u6e05\u7a7a\u56de\u6536\u7ad9\u524d\u672c\u5730\u7248\u672c", { force: true });
    await clearRecycleBin();
    set({ recycleBin: [] });
  },
}));

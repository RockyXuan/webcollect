import { create } from "zustand";
import type { WebCard, Category, HiddenSite, HideDuration, LinkOpenMode, RecycleBinItem, CollectionSection, PinnedBookmarkItem } from "./types";
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
  getPinnedBookmarkItems,
  savePinnedBookmarkItems,
  getCategoryWidths,
  saveCategoryWidths,
  getVisualScale,
  saveVisualScale,
  getLinkOpenMode,
  saveLinkOpenMode,
  getSections,
  saveSections,
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
  normalizePinnedBookmarkItems,
  reorderPinnedBookmarkItems,
  togglePinnedBookmarkItem,
  updatePinnedBookmarkItem,
} from "./pinned-bookmarks";

const DEFAULT_SECTION_ID = "section-default";

function createDefaultSection(now = Date.now()): CollectionSection {
  return {
    id: DEFAULT_SECTION_ID,
    name: "主页",
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeSectionName(section: CollectionSection): CollectionSection {
  const corruptedHomeNames = new Set(["涓婚〉", "滑婚", "捐婚", "娑撳銆?", "婊戝", "鎹愬", "主页"]);
  if (section.id === DEFAULT_SECTION_ID && corruptedHomeNames.has(section.name.trim())) {
    return { ...section, name: "主页", updatedAt: Date.now() };
  }
  return section;
}

function getDefaultSectionId(sections: CollectionSection[]): string {
  return sections.some((section) => section.id === DEFAULT_SECTION_ID)
    ? DEFAULT_SECTION_ID
    : sections[0]?.id || DEFAULT_SECTION_ID;
}

function pruneEmptyDuplicateCategories(categories: Category[], cards: WebCard[]): Category[] {
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

  const bySemanticKey = new Map<string, Category[]>();
  for (const category of categories) {
    const sectionId = category.sectionId || DEFAULT_SECTION_ID;
    const parentName = category.parentId
      ? categories.find((item) => item.id === category.parentId)?.name || ""
      : "";
    const key = [
      sectionId,
      category.parentId ? `group:${parentName}` : category.isParent ? "parent" : "root",
      category.name.trim().toLowerCase(),
    ].join("|");
    const group = bySemanticKey.get(key) || [];
    group.push(category);
    bySemanticKey.set(key, group);
  }

  const removeIds = new Set<string>();
  for (const group of bySemanticKey.values()) {
    if (group.length < 2) continue;
    const nonEmpty = group.filter(
      (category) => (cardCountByCategory.get(category.id) || 0) > 0 || (childCountByCategory.get(category.id) || 0) > 0
    );
    if (nonEmpty.length === 0) continue;
    for (const category of group) {
      const isEmpty = (cardCountByCategory.get(category.id) || 0) === 0 && (childCountByCategory.get(category.id) || 0) === 0;
      if (isEmpty) removeIds.add(category.id);
    }
  }

  if (removeIds.size === 0) return categories;
  return categories.filter((category) => !removeIds.has(category.id));
}

function pruneEmptySeedTemplates(categories: Category[], cards: WebCard[]): Category[] {
  const seedTemplateIds = new Set(["cat-work", "cat-ai", "cat-dev", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5"]);
  const seedTemplateNames = new Set(["\u5de5\u4f5c", "AI", "\u5f00\u53d1", "\u5e38\u7528", "AI\u5de5\u5177", "\u8bbe\u8ba1\u7075\u611f", "\u5f00\u53d1\u8005", "\u9605\u8bfb"]);
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

  return categories.filter((category) => {
    const hasCards = (cardCountByCategory.get(category.id) || 0) > 0;
    const hasChildren = (childCountByCategory.get(category.id) || 0) > 0;
    const isSeedTemplate = seedTemplateIds.has(category.id) || seedTemplateNames.has(category.name.trim());
    return !isSeedTemplate || hasCards || hasChildren;
  });
}

function ensureParentDirectCardsAreVisible(
  categories: Category[],
  cards: WebCard[],
  activeSectionId: string
): { categories: Category[]; cards: WebCard[]; changed: boolean } {
  const nextCategories = categories.map((category) => ({ ...category }));
  const nextCards = cards.map((card) => ({ ...card }));
  let changed = false;
  let createdIndex = 0;
  const now = Date.now();

  for (const parent of nextCategories.filter((category) => !category.parentId)) {
    const directCards = nextCards.filter((card) => card.categoryId === parent.id);
    if (directCards.length === 0) continue;

    const childGroups = nextCategories
      .filter((category) => category.parentId === parent.id)
      .sort((a, b) => a.order - b.order);
    const shouldRenderAsParent = parent.isParent || childGroups.length > 0;
    if (!shouldRenderAsParent) continue;

    let targetGroup = childGroups[0];
    if (!targetGroup) {
      targetGroup = {
        id: `cat-${now}-${createdIndex++}`,
        name: "\u6536\u96c6\u7bb1",
        icon: "inbox",
        color: "#888888",
        order: 0,
        createdAt: now,
        updatedAt: now,
        parentId: parent.id,
        sectionId: parent.sectionId || activeSectionId,
      };
      nextCategories.push(targetGroup);
      changed = true;
    }

    parent.isParent = true;
    parent.updatedAt = now;
    directCards
      .sort((a, b) => a.order - b.order)
      .forEach((card, index) => {
        card.categoryId = targetGroup.id;
        card.order = index;
        card.updatedAt = now;
        changed = true;
      });
  }

  return { categories: nextCategories, cards: nextCards, changed };
}

function removeRecoveredMainData(
  categories: Category[],
  cards: WebCard[],
  activeSectionId: string
): { categories: Category[]; cards: WebCard[]; changed: boolean } {
  const recoveredIds = new Set(
    categories
      .filter((category) => /^Recovered\s+[0-9a-f-]+$/i.test(category.name.trim()))
      .map((category) => category.id)
  );
  if (recoveredIds.size === 0) {
    return { categories, cards, changed: false };
  }

  const nextCategories = categories.filter((category) => !recoveredIds.has(category.id));
  const now = Date.now();
  const inbox = ensureInboxForSection(nextCategories, activeSectionId, now);
  let nextOrder = cards
    .filter((card) => card.categoryId === inbox.inboxId)
    .reduce((max, card) => Math.max(max, card.order), -1);
  const nextCards = cards.map((card) => {
    if (!recoveredIds.has(card.categoryId)) return card;
    nextOrder += 1;
    return { ...card, categoryId: inbox.inboxId, order: nextOrder, updatedAt: now };
  });

  return { categories: inbox.categories, cards: nextCards, changed: true };
}

function ensureSectionInboxes(categories: Category[], sections: CollectionSection[]): Category[] {
  const nextCategories = categories.map((category) =>
    category.name.trim() === "\u6536\u96c6\u7bb1" && category.isParent ? { ...category, isParent: false } : category
  );
  for (const section of sections) {
    const hasInbox = nextCategories.some(
      (category) =>
        (category.sectionId || DEFAULT_SECTION_ID) === section.id &&
        category.name.trim() === "\u6536\u96c6\u7bb1"
    );
    if (!hasInbox) {
      const now = Date.now();
      nextCategories.push({
        id: section.id === DEFAULT_SECTION_ID ? "cat-inbox" : `cat-inbox-${section.id}`,
        name: "\u6536\u96c6\u7bb1",
        icon: "inbox",
        color: "#888888",
        order: 99,
        createdAt: now,
        updatedAt: now,
        sectionId: section.id,
      });
    }
  }
  return nextCategories;
}

function ensureInboxForSection(
  categories: Category[],
  sectionId: string,
  now: number
): { categories: Category[]; inboxId: string; changed: boolean } {
  const existing = categories.find(
    (category) =>
      !category.parentId &&
      (category.sectionId || DEFAULT_SECTION_ID) === sectionId &&
      category.name.trim() === "\u6536\u96c6\u7bb1"
  );
  if (existing) {
    return { categories, inboxId: existing.id, changed: false };
  }

  const preferredId = sectionId === DEFAULT_SECTION_ID ? "cat-inbox" : `cat-inbox-${sectionId}`;
  const ids = new Set(categories.map((category) => category.id));
  const inboxId = ids.has(preferredId) ? `cat-inbox-${sectionId}-${now}` : preferredId;
  return {
    categories: [
      ...categories,
      {
        id: inboxId,
        name: "\u6536\u96c6\u7bb1",
        icon: "inbox",
        color: "#888888",
        order: 99,
        createdAt: now,
        updatedAt: now,
        sectionId,
      },
    ],
    inboxId,
    changed: true,
  };
}

function repairMainDataVisibility(
  categories: Category[],
  cards: WebCard[],
  sections: CollectionSection[],
  activeSectionId: string
): { categories: Category[]; cards: WebCard[]; changed: boolean } {
  const sectionIds = new Set(sections.map((section) => section.id));
  const fallbackSectionId = sectionIds.has(activeSectionId)
    ? activeSectionId
    : getDefaultSectionId(sections);
  const now = Date.now();

  const categoriesWithInboxes = ensureSectionInboxes(categories, sections);
  let changed =
    categoriesWithInboxes.length !== categories.length ||
    categoriesWithInboxes.some((category, index) => category !== categories[index]);
  let nextCategories = categoriesWithInboxes.map((category) => ({ ...category }));

  const categoryById = () => new Map(nextCategories.map((category) => [category.id, category]));
  let byId = categoryById();

  nextCategories = nextCategories.map((category) => {
    let next = category;
    const sectionId = next.sectionId || DEFAULT_SECTION_ID;
    if (!sectionIds.has(sectionId)) {
      next = { ...next, sectionId: fallbackSectionId, updatedAt: now };
      changed = true;
    }

    if (next.parentId) {
      const parent = byId.get(next.parentId);
      if (!parent) {
        const detached = { ...next, isParent: false, updatedAt: now };
        delete detached.parentId;
        next = detached;
        changed = true;
      } else {
        const rawParentSectionId = parent.sectionId || DEFAULT_SECTION_ID;
        const parentSectionId = sectionIds.has(rawParentSectionId) ? rawParentSectionId : fallbackSectionId;
        if ((next.sectionId || DEFAULT_SECTION_ID) !== parentSectionId) {
          next = { ...next, sectionId: parentSectionId, updatedAt: now };
          changed = true;
        }
      }
    }

    return next;
  });

  byId = categoryById();
  let nextCards = cards.map((card) => ({ ...card }));
  const invalidCards = nextCards.filter((card) => !byId.has(card.categoryId));
  if (invalidCards.length > 0) {
    const inbox = ensureInboxForSection(nextCategories, fallbackSectionId, now);
    nextCategories = inbox.categories;
    const maxOrder = nextCards
      .filter((card) => card.categoryId === inbox.inboxId)
      .reduce((max, card) => Math.max(max, card.order), -1);
    let offset = 1;
    nextCards = nextCards.map((card) => {
      if (byId.has(card.categoryId)) return card;
      changed = true;
      return {
        ...card,
        categoryId: inbox.inboxId,
        order: maxOrder + offset++,
        updatedAt: now,
      };
    });
    changed = true;
  }

  return { categories: nextCategories, cards: nextCards, changed };
}

async function resolveCardDropCategoryId(
  categories: Category[],
  targetCategoryId: string,
  activeSectionId: string
): Promise<string> {
  const target = categories.find((category) => category.id === targetCategoryId);
  if (!target) return targetCategoryId;

  const targetChildren = categories
    .filter((category) => category.parentId === target.id)
    .sort((a, b) => a.order - b.order);
  const isContainerOnly = target.isParent || targetChildren.length > 0;
  if (!isContainerOnly) return targetCategoryId;
  if (targetChildren[0]) return targetChildren[0].id;

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
  return inboxGroup.id;
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
  loadData: (options?: { showLoading?: boolean }) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (id: string) => void;
  setActiveSection: (id: string) => Promise<void>;
  addSection: (name: string) => Promise<void>;
  updateSection: (section: CollectionSection) => Promise<void>;
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

  // Category widths
  categoryWidths: Record<string, number>;
  setCategoryWidth: (categoryId: string, widthPercent: number) => void;
  visualScale: number;
  setVisualScale: (scale: number) => void;
  linkOpenMode: LinkOpenMode;
  setLinkOpenMode: (mode: LinkOpenMode) => void;

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
  visualScale: 100,
  linkOpenMode: "new-background-tab",

  loadData: async (options) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) set({ isLoading: true });
    const [storedCards, initCategories, init, hiddenSites, pinnedIds, pinnedBookmarkItems, widths, visualScale, linkOpenMode, storedSections, storedActiveSectionId, workspaceResetAt] = await Promise.all([
      getCards(),
      getCategories(),
      isInitialized(),
      getHiddenSites(),
      getPinnedCategoryIds(),
      getPinnedBookmarkItems(),
      getCategoryWidths(),
      getVisualScale(),
      getLinkOpenMode(),
      getSections(),
      getActiveSectionId(),
      getWorkspaceResetAt(),
    ]);
    let categories = workspaceResetAt > 0
      ? initCategories.filter((category) => category.id === "cat-inbox" || (category.updatedAt || category.createdAt || 0) >= workspaceResetAt)
      : initCategories;
    let cards = workspaceResetAt > 0
      ? storedCards.filter((card) => (card.updatedAt || card.createdAt || 0) >= workspaceResetAt)
      : storedCards;
    if (categories.length !== initCategories.length || cards.length !== storedCards.length) {
      await withoutLocalChangeEvents(async () => {
        await saveCategories(categories);
        await saveCards(cards);
      });
    }
    const resetAwareStoredSections = workspaceResetAt > 0
      ? storedSections.filter((section) =>
        section.id === DEFAULT_SECTION_ID || (section.updatedAt || section.createdAt || 0) >= workspaceResetAt
      )
      : storedSections;
    let sections = resetAwareStoredSections.map(normalizeSectionName);
    if (sections.length === 0) {
      sections = [createDefaultSection()];
      await withoutLocalChangeEvents(() => saveSections(sections));
    } else if (resetAwareStoredSections.length !== storedSections.length) {
      await withoutLocalChangeEvents(() => saveSections(sections));
    }
    const sectionIds = new Set(sections.map((section) => section.id));
    const fallbackSectionId = getDefaultSectionId(sections);
    const activeSectionId = storedActiveSectionId && sectionIds.has(storedActiveSectionId)
      ? storedActiveSectionId
      : fallbackSectionId;
    if (storedActiveSectionId !== activeSectionId) {
      await withoutLocalChangeEvents(() => saveActiveSectionId(activeSectionId));
    }

    const needsSectionMigration = categories.some((category) => !category.sectionId || !sectionIds.has(category.sectionId));
    if (needsSectionMigration) {
      categories = categories.map((category) => ({
        ...category,
        sectionId: category.sectionId && sectionIds.has(category.sectionId) ? category.sectionId : fallbackSectionId,
      }));
      await withoutLocalChangeEvents(() => saveCategories(categories));
    }

    const visibilityRepair = repairMainDataVisibility(categories, cards, sections, activeSectionId);
    if (visibilityRepair.changed) {
      categories = visibilityRepair.categories;
      cards = visibilityRepair.cards;
      await withoutLocalChangeEvents(async () => {
        await saveCategories(categories);
        await saveCards(cards);
      });
    }

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

    set({
      cards,
      categories,
      sections,
      activeSectionId,
      hiddenSites: cleanedHidden,
      pinnedCategoryIds: pinnedIds,
      pinnedBookmarkItems: normalizePinnedBookmarkItems(pinnedBookmarkItems),
      categoryWidths: widths,
      visualScale,
      linkOpenMode,
      initialized: init,
      isLoading: false,
    });

    // Load recycle bin in background (non-blocking)
    void get().loadRecycleBin();

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
      await withoutLocalChangeEvents(() => saveCards(updated));
      cards = updated;
      set({ cards: updated });
    }

    const categoriesWithInboxes = ensureSectionInboxes(categories, sections);
    if (
      categoriesWithInboxes.length !== categories.length ||
      categoriesWithInboxes.some((category, index) => category !== categories[index])
    ) {
      categories = categoriesWithInboxes;
      await withoutLocalChangeEvents(() => saveCategories(categories));
    }

    const cleanedMainData = removeRecoveredMainData(categories, cards, activeSectionId);
    if (cleanedMainData.changed) {
      categories = cleanedMainData.categories;
      cards = cleanedMainData.cards;
      await withoutLocalChangeEvents(async () => {
        await saveCategories(categories);
        await saveCards(cards);
      });
    }


    // Migration: set isParent for known parent categories that lack it
    const knownParentIds = ["cat-work", "cat-ai", "cat-dev"];
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
      await withoutLocalChangeEvents(() => saveCategories(categories));
    }

    const visibleParentRepair = ensureParentDirectCardsAreVisible(categories, cards, get().activeSectionId);
    if (visibleParentRepair.changed) {
      categories = visibleParentRepair.categories;
      cards = visibleParentRepair.cards;
      await withoutLocalChangeEvents(async () => {
        await saveCategories(categories);
        await saveCards(cards);
      });
    }

    const prunedCategories = pruneEmptySeedTemplates(pruneEmptyDuplicateCategories(categories, cards), cards);
    if (
      prunedCategories.length !== categories.length ||
      prunedCategories.some((category, index) => category !== categories[index])
    ) {
      categories = ensureSectionInboxes(prunedCategories, sections);
      await withoutLocalChangeEvents(() => saveCategories(categories));
    }

    set({ cards, categories });
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
      await saveCategories(nextCategories);
      set({ categories: nextCategories });
    }
    await saveSections(nextSections);
    await saveActiveSectionId(nextSection.id);
    set({ sections: nextSections, activeSectionId: nextSection.id, activeCategoryId: "all", searchQuery: "" });
  },
  updateSection: async (section) => {
    const sections = await getSections();
    const nextSections = sections.map((item) =>
      item.id === section.id ? { ...section, updatedAt: Date.now() } : item
    );
    await saveSections(nextSections);
    set({ sections: nextSections });
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

    await saveCategories(nextCategories);
    await saveSections(nextSections);
    if (nextActiveSectionId !== get().activeSectionId) {
      await saveActiveSectionId(nextActiveSectionId);
    }
    set({
      categories: nextCategories,
      sections: nextSections,
      activeSectionId: nextActiveSectionId,
      activeCategoryId: "all",
      searchQuery: "",
    });
  },
  setEditMode: (v) => set({ editMode: v }),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  addCard: async (card) => {
    await dbAddCard(card);
    const cards = await getCards();
    set({ cards });
  },

  updateCard: async (card) => {
    await dbUpdateCard({ ...card, updatedAt: Date.now() });
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
    const categories = await getCategories();
    const finalCategoryId = await resolveCardDropCategoryId(categories, targetCategoryId, get().activeSectionId);
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

    await saveCards(allCards);
    set({ cards: await getCards(), categories: await getCategories() });
  },

  reorderCards: async (cardId, targetCategoryId, newOrder) => {
    const cards = await getCards();
    const categories = await getCategories();
    const finalCategoryId = await resolveCardDropCategoryId(categories, targetCategoryId, get().activeSectionId);
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

    await saveCards(cards);
    set({ cards: await getCards(), categories: await getCategories() });
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
    const categories = await getCategories();
    set({ categories });
  },

  updateCategory: async (cat) => {
    await dbUpdateCategory({ ...cat, updatedAt: Date.now(), sectionId: cat.sectionId || get().activeSectionId });
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
    const now = Date.now();
    orderedIds.forEach((id, order) => {
      const cat = categories.find((c) => c.id === id);
      if (cat && cat.order !== order) {
        cat.order = order;
        cat.updatedAt = now;
      }
    });
    await saveCategories(categories);
    set({ categories: await getCategories() });
  },

  // Move a standalone category into a parent (demotion: 鍒嗙被 鈫?鍒嗙粍)
  moveCategoryToParent: async (categoryId: string, parentId: string, insertIndex?: number) => {
    const categories = await getCategories();
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
    await saveCategories(categories);
    set({ categories: await getCategories() });
  },

  // Remove a sub-group from its parent (promotion: 鍒嗙粍 鈫?椤剁骇鍒嗙被)
  detachCategoryFromParent: async (categoryId: string) => {
    const categories = await getCategories();
    const cards = await getCards();
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
    await saveCategories(repaired.categories);
    if (repaired.changed) {
      await saveCards(repaired.cards);
    }
    set({ cards: await getCards(), categories: await getCategories() });
  },

  // Promote an ungrouped item to a parent category
  promoteToParent: async (categoryId: string) => {
    const categories = await getCategories();
    const cards = await getCards();
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.isParent = true;
    cat.sectionId = cat.sectionId || get().activeSectionId;
    cat.updatedAt = Date.now();
    const repaired = ensureParentDirectCardsAreVisible(categories, cards, get().activeSectionId);
    await saveCategories(repaired.categories);
    if (repaired.changed) {
      await saveCards(repaired.cards);
    }
    set({ cards: await getCards(), categories: await getCategories() });
  },

  // Demote a parent category: remove isParent, detach all sub-groups
  demoteParentCategory: async (categoryId: string) => {
    const categories = await getCategories();
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
    await saveCategories(categories);
    set({ categories: await getCategories() });
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

    await saveCategories(nextCategories);
    set({ categories: await getCategories() });
  },

  moveCardToSection: async (cardId: string, targetSectionId: string, targetCategoryId?: string) => {
    const sections = await getSections();
    if (!sections.some((section) => section.id === targetSectionId)) return;
    const [cards, categories] = await Promise.all([getCards(), getCategories()]);
    const card = cards.find((item) => item.id === cardId);
    if (!card) return;

    let finalCategoryId = targetCategoryId;
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
      }
    }

    const nextCards = (await getCards()).map((item) =>
      item.id === cardId
        ? { ...item, categoryId: finalCategoryId as string, updatedAt: Date.now() }
        : item
    );
    await saveCards(nextCards);
    set({ cards: await getCards(), categories: await getCategories() });
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

  setCategoryWidth: (categoryId, widthPercent) => {
    const widths = { ...get().categoryWidths, [categoryId]: widthPercent };
    saveCategoryWidths(widths);
    set({ categoryWidths: widths });
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
    set({ categories: newCategories, cards: newCards });
    await saveCategories(newCategories);
    await saveCards(newCards);
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
    set({ categories: newCategories, cards: newCards });
    await saveCategories(newCategories);
    await saveCards(newCards);
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
    set({ cards: newCards });
    await saveCards(newCards);
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

    set({ categories: newCategories, cards: newCards });
    await saveCategories(newCategories);
    await saveCards(newCards);

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

import { create } from "zustand";
import type { WebCard, Category } from "./types";
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
} from "./db";

interface AppState {
  cards: WebCard[];
  categories: Category[];
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
}

export const useAppStore = create<AppState>((set, _get) => ({
  cards: [],
  categories: [],
  searchQuery: "",
  activeCategoryId: "all",
  isLoading: true,
  initialized: false,
  editMode: false,

  loadData: async () => {
    set({ isLoading: true });
    const [cards, categories, init] = await Promise.all([
      getCards(),
      getCategories(),
      isInitialized(),
    ]);
    set({
      cards,
      categories,
      initialized: init,
      isLoading: false,
    });
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
}));

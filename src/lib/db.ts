import localforage from "localforage";
import type { WebCard, Category, HiddenSite, RecycleBinItem } from "./types";

localforage.config({
  name: "WebCollect",
  storeName: "webcollect_data",
});

const CARDS_KEY = "cards";
const CATEGORIES_KEY = "categories";
const INIT_KEY = "initialized";
const HIDDEN_SITES_KEY = "hiddenSites";

export async function getCards(): Promise<WebCard[]> {
  const cards = (await localforage.getItem<WebCard[]>(CARDS_KEY)) || [];
  return cards.sort((a, b) => a.order - b.order);
}

export async function saveCards(cards: WebCard[]): Promise<void> {
  await localforage.setItem(CARDS_KEY, cards);
}

export async function addCard(card: WebCard): Promise<void> {
  const cards = await getCards();
  cards.push(card);
  await saveCards(cards);
}

export async function updateCard(updated: WebCard): Promise<void> {
  const cards = await getCards();
  const idx = cards.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cards[idx] = updated;
    await saveCards(cards);
  }
}

export async function deleteCard(id: string): Promise<void> {
  const cards = await getCards();
  await saveCards(cards.filter((c) => c.id !== id));
}

export async function getCategories(): Promise<Category[]> {
  const cats = (await localforage.getItem<Category[]>(CATEGORIES_KEY)) || [];
  return cats.sort((a, b) => a.order - b.order);
}

export async function saveCategories(categories: Category[]): Promise<void> {
  await localforage.setItem(CATEGORIES_KEY, categories);
}

export async function addCategory(category: Category): Promise<void> {
  const cats = await getCategories();
  cats.push(category);
  await saveCategories(cats);
}

export async function updateCategory(updated: Category): Promise<void> {
  const cats = await getCategories();
  const idx = cats.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cats[idx] = updated;
    await saveCategories(cats);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const cats = await getCategories();
  await saveCategories(cats.filter((c) => c.id !== id));
}

export async function isInitialized(): Promise<boolean> {
  const val = await localforage.getItem<boolean>(INIT_KEY);
  return val === true;
}

export async function setInitialized(): Promise<void> {
  await localforage.setItem(INIT_KEY, true);
}

export async function exportData(): Promise<{ cards: WebCard[]; categories: Category[] }> {
  const cards = await getCards();
  const categories = await getCategories();
  return { cards, categories };
}

export async function importData(data: { cards: WebCard[]; categories: Category[] }): Promise<void> {
  await saveCards(data.cards);
  await saveCategories(data.categories);
}

export async function getHiddenSites(): Promise<HiddenSite[]> {
  return (await localforage.getItem<HiddenSite[]>(HIDDEN_SITES_KEY)) || [];
}

export async function saveHiddenSites(sites: HiddenSite[]): Promise<void> {
  await localforage.setItem(HIDDEN_SITES_KEY, sites);
}

const PINNED_CATEGORIES_KEY = "pinnedCategoryIds";

export async function getPinnedCategoryIds(): Promise<string[]> {
  return (await localforage.getItem<string[]>(PINNED_CATEGORIES_KEY)) || [];
}

export async function savePinnedCategoryIds(ids: string[]): Promise<void> {
  await localforage.setItem(PINNED_CATEGORIES_KEY, ids);
}

const CATEGORY_WIDTHS_KEY = "categoryWidths";

export async function getCategoryWidths(): Promise<Record<string, number>> {
  return (await localforage.getItem<Record<string, number>>(CATEGORY_WIDTHS_KEY)) || {};
}

export async function saveCategoryWidths(widths: Record<string, number>): Promise<void> {
  await localforage.setItem(CATEGORY_WIDTHS_KEY, widths);
}

// ============ Recycle Bin ============

const RECYCLE_BIN_KEY = "recycleBin";

export async function getRecycleBin(): Promise<RecycleBinItem[]> {
  return (await localforage.getItem<RecycleBinItem[]>(RECYCLE_BIN_KEY)) || [];
}

export async function saveRecycleBin(items: RecycleBinItem[]): Promise<void> {
  await localforage.setItem(RECYCLE_BIN_KEY, items);
}

export async function getRecycleBinItem(id: string): Promise<RecycleBinItem | null> {
  const items = await getRecycleBin();
  return items.find((item) => item.id === id) || null;
}

export async function addToRecycleBin(items: RecycleBinItem[]): Promise<void> {
  const existing = await getRecycleBin();
  await saveRecycleBin([...existing, ...items]);
}

export async function removeFromRecycleBin(ids: string[]): Promise<void> {
  const existing = await getRecycleBin();
  await saveRecycleBin(existing.filter((item) => !ids.includes(item.id)));
}

export async function clearRecycleBin(): Promise<void> {
  await saveRecycleBin([]);
}

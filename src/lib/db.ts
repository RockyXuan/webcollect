import localforage from "localforage";
import type { WebCard, Category } from "./types";

localforage.config({
  name: "WebCollect",
  storeName: "webcollect_data",
});

const CARDS_KEY = "cards";
const CATEGORIES_KEY = "categories";
const INIT_KEY = "initialized";

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

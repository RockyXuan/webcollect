import localforage from "localforage";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addCard,
  addCategory,
  addToRecycleBin,
  getCards,
  getCategories,
  getRecycleBin,
  getSyncDirtySets,
  markDirty,
  saveCardsRebased,
  saveCategoriesRebased,
} from "@/lib/db";
import type { Category, RecycleBinItem, WebCard } from "@/lib/types";

const baseTime = 1_777_200_000_000;

function card(id: string): WebCard {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: id,
    imageUrl: "",
    categoryId: "category-one",
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
  };
}

function category(id: string): Category {
  return {
    id,
    name: id,
    icon: "star",
    color: "#4A7C59",
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
    sectionId: "section-default",
  };
}

function recycleItem(id: string): RecycleBinItem {
  return {
    id,
    type: "card",
    name: id,
    deletedAt: baseTime,
    categories: [],
    cards: [card(id)],
  };
}

beforeEach(async () => {
  await localforage.clear();
});

describe("atomic local storage mutations", () => {
  it("keeps both cards and dirty IDs when two captures finish together", async () => {
    await Promise.all([addCard(card("card-a")), addCard(card("card-b"))]);
    expect((await getCards()).map((item) => item.id).sort()).toEqual(["card-a", "card-b"]);
    expect((await getSyncDirtySets()).cards.sort()).toEqual(["card-a", "card-b"]);
  });

  it("keeps concurrent category, recycle-bin, and dirty-set writes", async () => {
    await Promise.all([addCategory(category("category-a")), addCategory(category("category-b"))]);
    await Promise.all([addToRecycleBin([recycleItem("bin-a")]), addToRecycleBin([recycleItem("bin-b")])]);
    await Promise.all([markDirty("card", "dirty-a"), markDirty("card", "dirty-b")]);

    expect((await getCategories()).map((item) => item.id).sort()).toEqual(["category-a", "category-b"]);
    expect((await getRecycleBin()).map((item) => item.id).sort()).toEqual(["bin-a", "bin-b"]);
    expect((await getSyncDirtySets()).cards).toEqual(expect.arrayContaining(["dirty-a", "dirty-b"]));
  });

  it("rebases two whole-array edits made from the same stale snapshot", async () => {
    const initialCard = card("card-initial");
    const initialCategory = category("category-initial");
    await Promise.all([addCard(initialCard), addCategory(initialCategory)]);
    const cardBaseline = await getCards();
    const categoryBaseline = await getCategories();

    await Promise.all([
      saveCardsRebased(cardBaseline, [...cardBaseline, card("card-a")]),
      saveCardsRebased(cardBaseline, [...cardBaseline, card("card-b")]),
      saveCategoriesRebased(categoryBaseline, [...categoryBaseline, category("category-a")]),
      saveCategoriesRebased(categoryBaseline, [...categoryBaseline, category("category-b")]),
    ]);

    expect((await getCards()).map((item) => item.id).sort()).toEqual([
      "card-a",
      "card-b",
      "card-initial",
    ]);
    expect((await getCategories()).map((item) => item.id).sort()).toEqual([
      "category-a",
      "category-b",
      "category-initial",
    ]);
  });
});

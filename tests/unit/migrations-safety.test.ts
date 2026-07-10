import localforage from "localforage";
import { beforeEach, describe, expect, it } from "vitest";
import type { Category, CollectionSection, WebCard } from "@/lib/types";
import { runLocalMigrations } from "@/lib/migrations";

const baseTime = 1_777_200_000_000;

const section: CollectionSection = {
  id: "section-default",
  name: "主页",
  order: 0,
  createdAt: baseTime,
  updatedAt: baseTime,
};

function category(input: Partial<Category>): Category {
  return {
    id: "category-default",
    name: "自定义分类",
    icon: "star",
    color: "#4A7C59",
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
    sectionId: section.id,
    ...input,
  };
}

function card(input: Partial<WebCard>): WebCard {
  return {
    id: "card-default",
    url: "https://example.com",
    title: "Example",
    shortDesc: "Original English description",
    fullDesc: "Original English description",
    note: "",
    abbreviation: "EX",
    imageUrl: "https://example.com/favicon.ico",
    categoryId: "category-default",
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
    ...input,
  };
}

beforeEach(async () => {
  await localforage.clear();
});

describe("local migrations preserve user-owned data", () => {
  it("does not delete empty categories based on seed names or semantic duplicates", async () => {
    const categories = [
      category({ id: "custom-work", name: "工作" }),
      category({ id: "custom-work-copy", name: "工作" }),
      category({ id: "category-default" }),
    ];

    const result = await runLocalMigrations({
      cards: [card({})],
      categories,
      sections: [section],
      activeSectionId: section.id,
      workspaceResetAt: 0,
    });

    expect(result.categories.map((item) => item.id)).toEqual(expect.arrayContaining([
      "custom-work",
      "custom-work-copy",
      "category-default",
    ]));
  });

  it("keeps recovered categories, original descriptions, and pre-reset local rows", async () => {
    const recoveredCategory = category({
      id: "recovered-category",
      name: "Recovered 123e4567-e89b-12d3-a456-426614174000",
    });
    const recoveredCard = card({
      id: "recovered-card",
      categoryId: recoveredCategory.id,
      updatedAt: baseTime,
    });

    const result = await runLocalMigrations({
      cards: [recoveredCard],
      categories: [recoveredCategory],
      sections: [section],
      activeSectionId: section.id,
      workspaceResetAt: baseTime + 100_000,
    });

    expect(result.categories.some((item) => item.id === recoveredCategory.id)).toBe(true);
    expect(result.cards[0]).toMatchObject({
      id: recoveredCard.id,
      categoryId: recoveredCategory.id,
      shortDesc: "Original English description",
      fullDesc: "Original English description",
    });
  });

  it("creates a forced snapshot before applying a new migration version", async () => {
    const storedCategory = category({ id: "category-default" });
    const storedCard = card({});
    await localforage.setItem("cards", [storedCard]);
    await localforage.setItem("categories", [storedCategory]);
    await localforage.setItem("collectionSections", [section]);
    await localforage.setItem("activeCollectionSectionId", section.id);

    await runLocalMigrations({
      cards: [storedCard],
      categories: [storedCategory],
      sections: [section],
      activeSectionId: section.id,
      workspaceResetAt: 0,
    });

    const snapshots = await localforage.getItem<Array<{ reason: string; data: { cards: WebCard[] } }>>(
      "localSnapshotHistory"
    );
    expect(snapshots?.some((snapshot) =>
      snapshot.reason.startsWith("before-local-migration-v") && snapshot.data.cards[0]?.id === storedCard.id
    )).toBe(true);
  });
});

import assert from "node:assert/strict";
import localforage from "localforage";
import type { Category, CollectionSection, WebCard } from "../src/lib/types";
import type { LocalSnapshotData, LocalSnapshotEntry } from "../src/lib/local-snapshots";

const memoryStore = new Map<string, unknown>();
let writeCount = 0;

Object.assign(localforage, {
  async getItem<T>(key: string): Promise<T | null> {
    return (memoryStore.has(key) ? memoryStore.get(key) : null) as T | null;
  },
  async setItem<T>(key: string, value: T): Promise<T> {
    writeCount += 1;
    memoryStore.set(key, value);
    return value;
  },
  async removeItem(key: string): Promise<void> {
    writeCount += 1;
    memoryStore.delete(key);
  },
});

const baseTime = 1_777_200_000_000;
const defaultSectionId = "section-default";

function section(id: string, name: string, order: number): CollectionSection {
  return { id, name, order, createdAt: baseTime, updatedAt: baseTime };
}

function category(input: Partial<Category> = {}): Category {
  return {
    id: input.id || `cat-${Math.random().toString(36).slice(2)}`,
    name: input.name || "分类",
    icon: "folder",
    color: "#888888",
    order: input.order || 0,
    createdAt: baseTime,
    updatedAt: baseTime,
    sectionId: input.sectionId || defaultSectionId,
    parentId: input.parentId,
    isParent: input.isParent,
  };
}

function card(input: Partial<WebCard> = {}): WebCard {
  return {
    id: input.id || `card-${Math.random().toString(36).slice(2)}`,
    url: input.url || "https://example.com",
    title: input.title || "Example",
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: "EX",
    imageUrl: "",
    categoryId: input.categoryId || "cat-0",
    order: input.order || 0,
    createdAt: baseTime,
    updatedAt: baseTime,
  };
}

function makeData(options: { sections: number; categories: number; cards: number; nonDefaultCards: number }): LocalSnapshotData {
  const sections = Array.from({ length: options.sections }, (_, index) =>
    section(index === 0 ? defaultSectionId : `section-${index}`, index === 0 ? "主页" : `分项 ${index}`, index)
  );
  const categories: Category[] = [];
  for (let index = 0; index < options.categories; index += 1) {
    const targetSection = index < Math.ceil(options.categories / 2) ? sections[0] : sections[index % sections.length];
    categories.push(category({
      id: `cat-${index}`,
      name: `分类 ${index}`,
      order: index,
      sectionId: targetSection.id,
      isParent: index < 6,
      parentId: index >= 6 && index < 12 ? `cat-${index - 6}` : undefined,
    }));
  }
  const cards: WebCard[] = [];
  for (let index = 0; index < options.cards; index += 1) {
    const useNonDefault = index < options.nonDefaultCards && sections.length > 1;
    const sectionId = useNonDefault ? sections[(index % (sections.length - 1)) + 1].id : defaultSectionId;
    const targetCategory = categories.find((item) => (item.sectionId || defaultSectionId) === sectionId) || categories[0];
    cards.push(card({
      id: `card-${index}`,
      title: `网页 ${index}`,
      categoryId: targetCategory.id,
      order: index,
      url: `https://example.com/${index}`,
    }));
  }
  return {
    cards,
    categories,
    hiddenSites: [],
    pinnedCategoryIds: [],
    pinnedBookmarkItems: [],
    categoryWidths: {},
    categoryLayouts: {},
    visualScale: 100,
    linkOpenMode: "new-background-tab",
    sections,
    activeSectionId: defaultSectionId,
    recycleBin: [],
    warehouseCards: [],
    warehouseCategories: [],
    warehouseImportBatches: [],
    warehouseUpdatedAt: baseTime,
    workspaceResetAt: 0,
    localSnapshotUpdatedAt: baseTime,
  };
}

function snapshot(data: LocalSnapshotData): LocalSnapshotEntry {
  return {
    id: "snapshot-healthy",
    createdAt: baseTime + 10_000,
    reason: "manual",
    label: "healthy snapshot",
    counts: {
      sections: data.sections.length,
      categories: data.categories.length,
      cards: data.cards.length,
      recycleBin: 0,
      warehouseCategories: 0,
      warehouseCards: 0,
      warehouseBatches: 0,
    },
    sectionNames: data.sections.map((item) => item.name),
    sampleCategoryNames: data.categories.slice(0, 5).map((item) => item.name),
    sampleCardTitles: data.cards.slice(0, 5).map((item) => item.title),
    data,
  };
}

function loadCurrent(data: LocalSnapshotData): void {
  memoryStore.set("cards", data.cards);
  memoryStore.set("categories", data.categories);
  memoryStore.set("collectionSections", data.sections);
}

async function main(): Promise<void> {
  const { restoreLatestHealthyWorkspaceIfNeeded, restoreEmergencyWorkspaceSnapshot } = await import("../src/lib/emergency-restore");
  const db = await import("../src/lib/db");

  memoryStore.clear();
  loadCurrent(makeData({ sections: 3, categories: 20, cards: 45, nonDefaultCards: 20 }));
  writeCount = 0;
  const healthyResult = await restoreLatestHealthyWorkspaceIfNeeded();
  assert.equal(healthyResult.shouldPrompt, false, "healthy current layout should not prompt");
  assert.equal(writeCount, 0, "healthy startup check should not write IndexedDB");

  const collapsed = makeData({ sections: 3, categories: 20, cards: 45, nonDefaultCards: 0 });
  const healthySnapshot = snapshot(makeData({ sections: 3, categories: 24, cards: 50, nonDefaultCards: 18 }));
  memoryStore.clear();
  loadCurrent(collapsed);
  memoryStore.set("localSnapshotHistory", [healthySnapshot]);
  writeCount = 0;
  const promptResult = await restoreLatestHealthyWorkspaceIfNeeded();
  assert.equal(promptResult.shouldPrompt, true, "collapsed current layout with a healthy snapshot should prompt");
  assert.equal(writeCount, 0, "startup restore check should not write before user confirms");
  assert.equal((await db.getCards()).length, collapsed.cards.length, "startup check should leave cards unchanged");

  await restoreEmergencyWorkspaceSnapshot("snapshot-healthy");
  assert.ok(writeCount > 0, "confirmed restore should write local data");
  assert.equal((await db.getCards()).length, healthySnapshot.data.cards.length, "confirmed restore should apply snapshot cards");

  console.log("emergency restore tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

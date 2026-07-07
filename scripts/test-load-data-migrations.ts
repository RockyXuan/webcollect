import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import localforage from "localforage";
import type { Category, CollectionSection, WebCard } from "../src/lib/types";

const baseTime = 1_777_200_000_000;
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
  async clear(): Promise<void> {
    writeCount += 1;
    memoryStore.clear();
  },
});

function seedCleanWorkspace(): void {
  const section: CollectionSection = {
    id: "section-default",
    name: "主页",
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
  };
  const category: Category = {
    id: "cat-inbox",
    name: "收集箱",
    icon: "inbox",
    color: "#888888",
    order: 99,
    createdAt: baseTime,
    updatedAt: baseTime,
    sectionId: section.id,
  };
  const card: WebCard = {
    id: "card-clean",
    url: "https://example.com",
    title: "示例",
    shortDesc: "已经迁移过的简介",
    fullDesc: "已经迁移过的简介",
    note: "",
    abbreviation: "EX",
    imageUrl: "https://www.google.com/s2/favicons?domain=example.com&sz=64",
    categoryId: category.id,
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
  };

  memoryStore.clear();
  memoryStore.set("cards", [card]);
  memoryStore.set("categories", [category]);
  memoryStore.set("collectionSections", [section]);
  memoryStore.set("activeCollectionSectionId", section.id);
  memoryStore.set("initialized", true);
  memoryStore.set("hiddenSites", []);
  memoryStore.set("currentWorkspaceResetAt", 0);
}

async function main(): Promise<void> {
  const { CURRENT_LOCAL_DATA_SCHEMA_VERSION } = await import("../src/lib/migrations");
  const { useAppStore } = await import("../src/lib/store");

  seedCleanWorkspace();

  writeCount = 0;
  await useAppStore.getState().loadData({ showLoading: false });
  assert.ok(writeCount > 0, "first run should persist the local migration version and any one-time repairs");
  assert.equal(memoryStore.get("localDataSchemaVersion"), CURRENT_LOCAL_DATA_SCHEMA_VERSION);

  writeCount = 0;
  await useAppStore.getState().loadData({ showLoading: false });
  assert.equal(writeCount, 0, "second startup after migrations should not write IndexedDB");

  const state = useAppStore.getState();
  assert.equal(state.cards.length, 1);
  assert.equal(state.categories.length, 1);
  assert.equal(state.sections.length, 1);
  assert.equal(state.isLoading, false);

  const storeSource = readFileSync("src/lib/store.ts", "utf8");
  const loadStart = storeSource.indexOf("loadData: async (options) => {");
  const setSearchStart = storeSource.indexOf("setSearchQuery:", loadStart);
  const loadBody = storeSource.slice(loadStart, setSearchStart);
  assert.ok(loadBody.includes("runLocalMigrations"));
  assert.equal(loadBody.includes("needsIsParentMigration"), false);
  assert.equal(loadBody.includes("fill missing imageUrl"), false);
  assert.equal(loadBody.includes("set({ cards, categories })"), false);

  console.log("load data migration tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

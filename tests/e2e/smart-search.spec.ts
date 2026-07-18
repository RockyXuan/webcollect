import { expect, test, type Page } from "@playwright/test";
import type { Category, CollectionSection, WebCard } from "@/lib/types";
import { openCollection } from "./helpers";

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) || []).toEqual([]);
});

const PROTECTED_KEYS = [
  "cards",
  "categories",
  "collectionSections",
  "activeCollectionSectionId",
  "syncDirtySets",
  "syncTombstones",
  "syncPreferenceRevisions",
  "syncMetadataVersion",
  "syncDeviceId",
  "syncLamportCounter",
  "hiddenSites",
  "pinnedCategoryIds",
  "pinnedBookmarkItems",
  "categoryWidths",
  "categoryLayouts",
  "visualScale",
  "linkOpenMode",
  "searchEngine",
  "recycleBin",
  "localSnapshotHistory",
  "localSnapshotUpdatedAt",
  "localSnapshotSyncedAt",
] as const;

const fixtureSections: CollectionSection[] = [
  { id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 },
];

const fixtureCategories: Category[] = [
  {
    id: "cat-dev",
    name: "开发",
    icon: "terminal",
    color: "#4a7c59",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    sectionId: "section-default",
    isParent: true,
  },
  {
    id: "group-code",
    name: "代码托管",
    icon: "code",
    color: "#4a7c59",
    order: 0,
    createdAt: 2,
    updatedAt: 2,
    sectionId: "section-default",
    parentId: "cat-dev",
  },
  {
    id: "cat-inbox",
    name: "收集箱",
    icon: "inbox",
    color: "#888888",
    order: 99,
    createdAt: 3,
    updatedAt: 3,
    sectionId: "section-default",
    isParent: true,
  },
];

const fixtureCards: WebCard[] = [
  {
    id: "github",
    url: "/smart-search-target",
    title: "GitHub",
    shortDesc: "代码托管与协作平台",
    fullDesc: "管理 Git 仓库、Issue 和 Pull Request",
    note: "开发工作流",
    abbreviation: "GH",
    imageUrl: "/assets/mascots/chipmunk-head.png",
    categoryId: "group-code",
    order: 0,
    createdAt: 10,
    updatedAt: 10,
  },
];

async function writeIsolatedSearchFixture(page: Page): Promise<void> {
  await page.evaluate(async (fixture) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      const transaction = database.transaction("webcollect_data", "readwrite");
      const store = transaction.objectStore("webcollect_data");
      for (const [key, value] of Object.entries(fixture)) store.put(value, key);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, {
    cards: fixtureCards,
    categories: fixtureCategories,
    collectionSections: fixtureSections,
    activeCollectionSectionId: "section-default",
    syncDirtySets: { cards: ["existing-card-dirty"], categories: ["existing-category-dirty"] },
    syncTombstones: [],
    syncPreferenceRevisions: {},
    syncMetadataVersion: { userId: "fixture-user", version: 7 },
    syncDeviceId: "fixture-device",
    syncLamportCounter: 11,
    hiddenSites: [],
    pinnedCategoryIds: [],
    pinnedBookmarkItems: [],
    categoryWidths: {},
    categoryLayouts: {},
    visualScale: 100,
    linkOpenMode: "new-active-tab",
    searchEngine: "baidu",
    recycleBin: [],
    localSnapshotHistory: [],
    localSnapshotUpdatedAt: 101,
    localSnapshotSyncedAt: 99,
    initialized: true,
  });
}

async function readProtectedCollectionState(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async (keys) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      if (!database.objectStoreNames.contains("webcollect_data")) return {};
      const transaction = database.transaction("webcollect_data", "readonly");
      const store = transaction.objectStore("webcollect_data");
      const entries = await Promise.all(keys.map((key) => new Promise<[string, unknown]>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve([key, request.result]);
        request.onerror = () => reject(request.error);
      })));
      return Object.fromEntries(entries);
    } finally {
      database.close();
    }
  }, [...PROTECTED_KEYS]);
}

async function loadFixture(page: Page): Promise<void> {
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedSearchFixture(page);
  await page.reload();
  await openCollection(page);
  await expect(page.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" })).toBeVisible();
}

async function installWindowOpenRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const global = window as typeof window & { __wcSmartSearchOpenedUrls?: string[] };
    global.__wcSmartSearchOpenedUrls = [];
    window.open = ((url?: string | URL) => {
      global.__wcSmartSearchOpenedUrls?.push(String(url ?? ""));
      return null;
    }) as typeof window.open;
  });
}

async function readOpenedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const global = window as typeof window & { __wcSmartSearchOpenedUrls?: string[] };
    return [...(global.__wcSmartSearchOpenedUrls ?? [])];
  });
}

test("local fuzzy results, keyboard selection, and Escape preserve collection state", async ({ page }) => {
  await loadFixture(page);
  await installWindowOpenRecorder(page);
  const before = await readProtectedCollectionState(page);
  const searchInput = page.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });

  await searchInput.fill("githb");

  const listbox = page.getByRole("listbox", { name: "搜索结果" });
  const githubOption = page.getByRole("option", { name: /GitHub/ });
  await expect(listbox).toBeVisible();
  await expect(githubOption).toBeVisible({ timeout: 500 });
  await expect(githubOption.getByLabel("匹配原因")).toContainText("模糊匹配");

  await searchInput.press("ArrowDown");
  const githubOptionId = await githubOption.getAttribute("id");
  expect(githubOptionId).toBeTruthy();
  await expect(searchInput).toHaveAttribute("aria-activedescendant", githubOptionId!);
  await expect(githubOption).toHaveAttribute("aria-selected", "true");

  await searchInput.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(searchInput).toBeFocused();
  await expect(searchInput).toHaveAttribute("aria-expanded", "false");

  await searchInput.press("ArrowDown");
  await searchInput.press("ArrowDown");
  await expect(searchInput).toHaveAttribute("aria-activedescendant", githubOptionId!);
  await searchInput.press("Enter");
  await expect.poll(() => readOpenedUrls(page)).toEqual(["/smart-search-target"]);

  expect(await readProtectedCollectionState(page)).toEqual(before);
});

test("IME composition blocks Enter until composition ends and keeps ordinary Baidu search", async ({ page }) => {
  await loadFixture(page);
  await installWindowOpenRecorder(page);
  const before = await readProtectedCollectionState(page);
  const searchInput = page.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });

  await expect(page.getByRole("combobox", { name: "选择搜索引擎" })).toHaveValue("baidu");
  await searchInput.dispatchEvent("compositionstart", { data: "输入法" });
  await searchInput.fill("输入法");
  await searchInput.press("Enter");
  expect(await readOpenedUrls(page)).toEqual([]);
  await expect(page.getByRole("listbox", { name: "搜索结果" })).toBeVisible();

  await searchInput.dispatchEvent("compositionend", { data: "输入法" });
  await searchInput.press("Enter");
  await expect.poll(() => readOpenedUrls(page)).toHaveLength(1);
  const [openedUrl] = await readOpenedUrls(page);
  const parsed = new URL(openedUrl);
  expect(parsed.origin).toBe("https://www.baidu.com");
  expect(parsed.pathname).toBe("/s");
  expect(parsed.searchParams.get("wd")).toBe("输入法");

  expect(await readProtectedCollectionState(page)).toEqual(before);
});

test("390px smart-search panel stays inside the viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page);
  const before = await readProtectedCollectionState(page);
  const searchInput = page.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });

  await searchInput.fill("githb");
  await expect(page.getByRole("option", { name: /GitHub/ })).toBeVisible();

  const geometry = await page.locator(".wc-search-popover").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      panelClientWidth: element.clientWidth,
      panelScrollWidth: element.scrollWidth,
      panelLeft: rect.left,
      panelRight: rect.right,
      viewportWidth: window.innerWidth,
    };
  });

  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth + 1);
  expect(geometry.panelScrollWidth).toBeLessThanOrEqual(geometry.panelClientWidth + 1);
  expect(geometry.panelLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.panelRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(await readProtectedCollectionState(page)).toEqual(before);
});

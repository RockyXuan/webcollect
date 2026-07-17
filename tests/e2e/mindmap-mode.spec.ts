import { expect, test, type Page } from "@playwright/test";
import { buildMindmapTree, fitCamera, layoutMindmap } from "@/components/mindmap/layout-engine";
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
] as const;

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

const fixtureSections: CollectionSection[] = [
  { id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 },
  { id: "section-research", name: "资料", order: 1, createdAt: 2, updatedAt: 2 },
];
const fixtureCategories: Category[] = [
  { id: "cat-work", name: "工作", icon: "briefcase", color: "#b8860b", order: 0, createdAt: 1, sectionId: "section-default", isParent: true },
  { id: "cat-ai", name: "AI", icon: "brain", color: "#8b5cf6", order: 1, createdAt: 2, sectionId: "section-default", isParent: true },
  { id: "cat-inbox", name: "收集箱", icon: "inbox", color: "#888888", order: 99, createdAt: 5, sectionId: "section-default", isParent: true },
  { id: "group-common", name: "常用", icon: "star", color: "#b8860b", order: 0, createdAt: 3, sectionId: "section-default", parentId: "cat-work" },
  { id: "group-tools", name: "AI 工具", icon: "wrench", color: "#8b5cf6", order: 0, createdAt: 4, sectionId: "section-default", parentId: "cat-ai" },
  { id: "cat-research", name: "资料分类", icon: "book-open", color: "#4a7c59", order: 0, createdAt: 6, sectionId: "section-research", isParent: true },
  { id: "group-reading", name: "待读", icon: "book-open", color: "#4a7c59", order: 0, createdAt: 7, sectionId: "section-research", parentId: "cat-research" },
];
const fixtureCard = (id: string, title: string, categoryId: string, order: number): WebCard => ({
  id,
  title,
  categoryId,
  order,
  createdAt: 10 + order,
  updatedAt: 10 + order,
  url: `https://${id}.example.com`,
  shortDesc: `${title} description`,
  fullDesc: "",
  note: "",
  abbreviation: title.slice(0, 1),
  imageUrl: "/assets/mascots/chipmunk-head.png",
});
const fixtureCards: WebCard[] = [
  { ...fixtureCard("notion", "Notion", "group-common", 0), url: "/mindmap-target" },
  fixtureCard("google", "Google", "group-common", 1),
  fixtureCard("github", "GitHub", "group-common", 2),
  fixtureCard("chatgpt", "ChatGPT", "group-tools", 0),
  fixtureCard("claude", "Claude", "group-tools", 1),
  fixtureCard("gemini", "Gemini", "group-tools", 2),
  fixtureCard("reader", "Reader", "group-reading", 0),
];

async function enterMindmap(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^导图/ }).click();
  await expect(page.getByTestId("collection-view-mindmap")).toHaveClass(/is-idle/);
  await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-hydrated", "true");
}

async function readViewState(page: Page, sectionId: string): Promise<unknown> {
  return page.evaluate(async (key) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("webcollect_data", "readonly");
      const request = transaction.objectStore("webcollect_data").get(key);
      return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }, `mindmapViewState:${sectionId}`);
}

async function writeViewState(page: Page, sectionId: string, value: unknown): Promise<void> {
  await page.evaluate(async ({ key, value: rawValue }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("webcollect_data", "readwrite");
      transaction.objectStore("webcollect_data").put(rawValue, key);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, { key: `mindmapViewState:${sectionId}`, value });
}

async function writeIsolatedMindmapFixture(page: Page): Promise<void> {
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
    pinnedBookmarkItems: [],
    linkOpenMode: "new-active-tab",
    initialized: true,
  });
}

async function writeLargeMindmapFixture(page: Page, cardCount = 330): Promise<void> {
  const largeCards = Array.from({ length: cardCount }, (_, index): WebCard => ({
    ...fixtureCard(`large-${index.toString().padStart(3, "0")}`, `Large ${index.toString().padStart(3, "0")}`, "group-large", index),
    url: `https://large-${index}.example.com`,
  }));
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
    cards: largeCards,
    categories: [
      { id: "cat-large", name: "大树分类", icon: "layers", color: "#4a7c59", order: 0, createdAt: 1, sectionId: "section-default", isParent: true },
      { id: "group-large", name: "大树分组", icon: "book-open", color: "#4a7c59", order: 0, createdAt: 2, sectionId: "section-default", parentId: "cat-large" },
    ],
    collectionSections: [{ id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 }],
    activeCollectionSectionId: "section-default",
    pinnedBookmarkItems: [],
    linkOpenMode: "new-active-tab",
    initialized: true,
  });
}

async function readCollectionKey(page: Page, key: string): Promise<unknown> {
  return page.evaluate(async (storageKey) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("webcollect_data", "readonly");
      const request = transaction.objectStore("webcollect_data").get(storageKey);
      return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }, key);
}

test("classic and mindmap modes share one header without mutating collection data", async ({ page }) => {
  await page.goto("/");
  await openCollection(page);

  const before = await readProtectedCollectionState(page);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByTestId("mindmap-stage")).toHaveCount(0);

  await enterMindmap(page);
  await expect(page.getByTestId("mindmap-stage")).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(1);
  await expect(page.locator('[data-node-type="section"]')).toHaveCount(1);
  await expect(page.locator('[data-node-type="category"]')).toHaveCount(1);
  await expect(page.locator(".wc-mindmap-edges path")).toHaveCount(1);

  for (const layoutName of ["双侧脑图", "下行组织图", "缩进树", "右侧逻辑图（默认）"]) {
    const layoutButton = page.getByRole("button", { name: layoutName });
    await layoutButton.click();
    await expect(layoutButton).toHaveAttribute("aria-pressed", "true");
  }

  const zoomPercent = page.getByTestId("mindmap-zoom-percent");
  const fittedZoom = await zoomPercent.textContent();
  await page.getByRole("button", { name: "放大" }).click();
  await expect(zoomPercent).not.toHaveText(fittedZoom || "");
  await page.getByRole("button", { name: "缩小" }).click();
  await page.getByRole("button", { name: "适应画布" }).click();
  await expect(zoomPercent).toHaveText(fittedZoom || "");

  const rootNode = page.locator('[data-node-type="section"]');
  const rootBeforeWheel = await rootNode.boundingBox();
  expect(rootBeforeWheel).not.toBeNull();
  if (rootBeforeWheel) {
    const anchorX = rootBeforeWheel.x + rootBeforeWheel.width / 2;
    const anchorY = rootBeforeWheel.y + rootBeforeWheel.height / 2;
    await page.mouse.move(anchorX, anchorY);
    await page.mouse.wheel(0, -180);
    const rootAfterWheel = await rootNode.boundingBox();
    expect(rootAfterWheel).not.toBeNull();
    expect(Math.abs((rootAfterWheel?.x || 0) + (rootAfterWheel?.width || 0) / 2 - anchorX)).toBeLessThanOrEqual(1);
    expect(Math.abs((rootAfterWheel?.y || 0) + (rootAfterWheel?.height || 0) / 2 - anchorY)).toBeLessThanOrEqual(1);
  }

  const stageBox = await page.getByTestId("mindmap-stage").boundingBox();
  expect(stageBox).not.toBeNull();
  const transformBeforePan = await page.locator(".wc-mindmap-world").getAttribute("style");
  if (stageBox) {
    await page.mouse.move(stageBox.x + stageBox.width - 300, stageBox.y + 90);
    await page.mouse.down();
    await page.mouse.move(stageBox.x + stageBox.width - 250, stageBox.y + 125, { steps: 3 });
    await page.mouse.up();
  }
  await expect(page.locator(".wc-mindmap-world")).not.toHaveAttribute("style", transformBeforePan || "");
  await page.getByRole("button", { name: "适应画布" }).click();

  await page.getByRole("button", { name: "经典", exact: true }).click();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByTestId("mindmap-stage")).toHaveCount(0);

  expect(await readProtectedCollectionState(page)).toEqual(before);
});

test("mindmap layouts match the Fable geometry at 1920x1080", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);

  const protectedFixture = await readProtectedCollectionState(page);
  const tree = buildMindmapTree(fixtureSections, fixtureCategories, fixtureCards, "section-default");
  const layoutChecks = [
    { button: "右侧逻辑图（默认）", id: "logic-right" as const },
    { button: "双侧脑图", id: "bilateral" as const },
    { button: "下行组织图", id: "tree-down" as const },
  ];

  for (const check of layoutChecks) {
    const layoutButton = page.getByRole("button", { name: check.button });
    await layoutButton.click();
    await expect(layoutButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-layout", check.id);
    const stageBox = await page.getByTestId("mindmap-stage").boundingBox();
    expect(stageBox).not.toBeNull();
    if (!stageBox) continue;

    const expectedLayout = layoutMindmap(tree, check.id);
    const expectedCamera = fitCamera(expectedLayout.bounds, { width: stageBox.width, height: stageBox.height });
    await expect(page.getByTestId("mindmap-zoom-percent")).toHaveText(`${Math.round(expectedCamera.k * 100)}%`);

    for (const [nodeId, position] of Object.entries(expectedLayout.positions)) {
      await expect.poll(async () => page.locator(`[data-mindmap-node="${nodeId}"]`).evaluate((element) => {
        const html = element as HTMLElement;
        return {
          left: Number.parseFloat(html.style.left),
          top: Number.parseFloat(html.style.top),
          width: html.offsetWidth,
          height: html.offsetHeight,
        };
      })).toEqual({
        left: expect.closeTo(position.x, 0),
        top: expect.closeTo(position.y, 0),
        width: expect.closeTo(position.width, 0),
        height: expect.closeTo(position.height, 0),
      });
    }
  }

  const stageBox = await page.getByTestId("mindmap-stage").boundingBox();
  const railBox = await page.locator(".wc-mindmap-layout-rail").boundingBox();
  const zoomBox = await page.locator(".wc-mindmap-zoom-cluster").boundingBox();
  expect(stageBox && railBox && Math.abs(railBox.x - stageBox.x - 18)).toBeLessThanOrEqual(2);
  expect(stageBox && railBox && Math.abs(railBox.y + railBox.height / 2 - (stageBox.y + stageBox.height / 2))).toBeLessThanOrEqual(2);
  expect(stageBox && zoomBox && Math.abs(stageBox.x + stageBox.width - zoomBox.x - zoomBox.width - 18)).toBeLessThanOrEqual(2);
  expect(stageBox && zoomBox && Math.abs(stageBox.y + stageBox.height - zoomBox.y - zoomBox.height - 18)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1080);
  expect(await readProtectedCollectionState(page)).toEqual(protectedFixture);
});

test("mindmap drag, collapse, and hover preview preserve collection data", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);
  const before = await readProtectedCollectionState(page);

  const category = page.locator('[data-mindmap-node="cat:cat-work"]');
  const card = page.locator('[data-mindmap-node="card:notion"]');
  const sibling = page.locator('[data-mindmap-node="cat:cat-ai"]');
  const categoryBefore = await category.boundingBox();
  const cardBefore = await card.boundingBox();
  const siblingBefore = await sibling.boundingBox();
  const edgeBefore = await page.locator('.wc-mindmap-edges path').first().getAttribute("d");
  expect(categoryBefore && cardBefore && siblingBefore).toBeTruthy();
  if (!categoryBefore || !cardBefore || !siblingBefore) return;

  await page.mouse.move(categoryBefore.x + categoryBefore.width / 2, categoryBefore.y + categoryBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(categoryBefore.x + categoryBefore.width / 2 + 84, categoryBefore.y + categoryBefore.height / 2 + 42, { steps: 5 });
  await page.mouse.up();

  const categoryAfter = await category.boundingBox();
  const cardAfter = await card.boundingBox();
  const siblingAfter = await sibling.boundingBox();
  expect(categoryAfter && cardAfter && siblingAfter).toBeTruthy();
  if (!categoryAfter || !cardAfter || !siblingAfter) return;
  expect(categoryAfter.x - categoryBefore.x).toBeCloseTo(84, 0);
  expect(categoryAfter.y - categoryBefore.y).toBeCloseTo(42, 0);
  expect(cardAfter.x - cardBefore.x).toBeCloseTo(84, 0);
  expect(cardAfter.y - cardBefore.y).toBeCloseTo(42, 0);
  expect(siblingAfter.x).toBeCloseTo(siblingBefore.x, 0);
  expect(siblingAfter.y).toBeCloseTo(siblingBefore.y, 0);
  await expect.poll(() => page.locator('.wc-mindmap-edges path').first().getAttribute("d")).not.toBe(edgeBefore);

  const collapseButton = page.getByRole("button", { name: "收起“工作”" });
  await collapseButton.click();
  await expect(page.getByRole("button", { name: "展开“工作”，包含 4 个后代" })).toBeVisible();
  await expect(page.locator('[data-mindmap-node="grp:group-common"]')).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "展开“工作”，包含 4 个后代" }).click();
  await expect(card).toBeVisible();

  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  if (!cardBox) return;
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await expect(page.getByTestId("mindmap-hover-preview")).toBeVisible({ timeout: 1_200 });
  await expect(page.getByTestId("mindmap-hover-preview")).toContainText("Notion");
  await expect(page.getByTestId("mindmap-hover-preview")).toContainText("主页 › 工作 › 常用");
  const previewBox = await page.getByTestId("mindmap-hover-preview").boundingBox();
  expect(previewBox).not.toBeNull();
  if (!previewBox) return;
  expect(previewBox.x).toBeGreaterThanOrEqual(8);
  expect(previewBox.y).toBeGreaterThanOrEqual(8);
  expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(1912);
  expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(1072);
  await page.mouse.move(previewBox.x + 20, previewBox.y + 20);
  await page.waitForTimeout(260);
  await expect(page.getByTestId("mindmap-hover-preview")).toBeVisible();
  await page.getByRole("button", { name: "放大" }).click();
  await expect(page.getByTestId("mindmap-hover-preview")).toHaveCount(0);

  expect(await readProtectedCollectionState(page)).toEqual(before);
});

test("mindmap view state stays independent per section and survives classic roundtrips", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  const before = await readProtectedCollectionState(page);
  await enterMindmap(page);

  await page.getByRole("button", { name: "双侧脑图" }).click();
  await page.getByRole("button", { name: "放大" }).click();
  await page.getByRole("button", { name: "收起“工作”" }).click();
  await expect.poll(() => readViewState(page, "section-default")).toMatchObject({
    layout: "bilateral",
    collapsed: expect.arrayContaining(["cat:cat-work"]),
  });

  await page.getByRole("button", { name: "资料", exact: true }).click();
  await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-hydrated", "true");
  await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-layout", "logic-right");
  await page.getByRole("button", { name: "下行组织图" }).click();
  await expect.poll(() => readViewState(page, "section-research")).toMatchObject({ layout: "tree-down" });

  await page.getByRole("button", { name: "主页", exact: true }).click();
  await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-hydrated", "true");
  await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-layout", "bilateral");
  await expect(page.getByRole("button", { name: "展开“工作”，包含 4 个后代" })).toBeVisible();

  await page.getByRole("button", { name: "经典", exact: true }).click();
  await expect(page.getByTestId("collection-view-classic")).toHaveClass(/is-idle/);
  await enterMindmap(page);
  await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-layout", "bilateral");
  await expect(page.getByRole("button", { name: "展开“工作”，包含 4 个后代" })).toBeVisible();
  expect(await readProtectedCollectionState(page)).toEqual(before);
});

test("corrupt mindmap state is normalized in memory without rewriting the legacy value", async ({ page }) => {
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  const corrupt = {
    layout: "retired-layout",
    collapsed: ["cat:cat-work", "cat:stale"],
    offsets: { "logic-right": { "cat:stale": { dx: 9, dy: 4 } } },
    camera: { x: 33, y: 44, k: 99 },
    updatedAt: 11,
  };
  await writeViewState(page, "section-default", corrupt);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);

  await expect(page.getByTestId("mindmap-stage")).toHaveAttribute("data-mindmap-layout", "logic-right");
  await expect(page.getByTestId("mindmap-zoom-percent")).toHaveText("200%");
  expect(await readViewState(page, "section-default")).toEqual(corrupt);
});

test("rapid mode changes keep one view and category search focuses the right section", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);

  await page.getByRole("button", { name: "导图", exact: true }).click();
  await page.getByRole("button", { name: "经典", exact: true }).click();
  await page.waitForTimeout(240);
  await expect(page.getByTestId("collection-view-classic")).toHaveCount(1);
  await expect(page.getByTestId("collection-view-mindmap")).toHaveCount(0);
  await enterMindmap(page);
  await expect(page.locator('[data-testid^="collection-view-"]')).toHaveCount(1);

  const search = page.getByPlaceholder("搜索网站、分组或分类...");
  await search.fill("资料分类");
  await page.getByRole("button", { name: /^资料分类 资料 \/ 资料分类/ }).click();
  await expect(page.getByRole("button", { name: "资料", exact: true })).toHaveClass(/wc-section-tab-active/);
  await expect(page.locator('[data-mindmap-node="cat:cat-research"]')).toHaveClass(/is-search-highlight/);
  const stage = await page.getByTestId("mindmap-stage").boundingBox();
  const target = await page.locator('[data-mindmap-node="cat:cat-research"]').boundingBox();
  expect(stage && target).toBeTruthy();
  if (stage && target) {
    expect(Math.abs(target.x + target.width / 2 - (stage.x + stage.width / 2))).toBeLessThanOrEqual(2);
    expect(Math.abs(target.y + target.height / 2 - (stage.y + stage.height / 2))).toBeLessThanOrEqual(2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1080);
});

test("mindmap additions reuse the existing dialogs and collection write path", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);

  const beforeCancel = await readProtectedCollectionState(page);
  const rootNode = page.locator('[data-node-type="section"]');
  await rootNode.getByRole("button", { name: "新建分类" }).click();
  await expect(page.getByRole("heading", { name: "新建分类" })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(await readProtectedCollectionState(page)).toEqual(beforeCancel);

  await rootNode.getByRole("button", { name: "新建分类" }).click();
  await page.getByLabel("分类名称").fill("导图新增分类");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  const newCategory = page.locator('[data-node-type="category"]').filter({ hasText: "导图新增分类" });
  await expect(newCategory).toBeVisible();
  await expect(newCategory).toHaveClass(/is-entering/);

  const workCategory = page.locator('[data-mindmap-node="cat:cat-work"]');
  await workCategory.getByRole("button", { name: "在“工作”中新建分组" }).click();
  await expect(page.getByRole("heading", { name: "新建分组" })).toBeVisible();
  await page.getByLabel("分组名称").fill("导图新增分组");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  const newGroup = page.locator('[data-node-type="group"]').filter({ hasText: "导图新增分组" });
  await expect(newGroup).toBeVisible();

  const categories = (await readCollectionKey(page, "categories")) as Category[];
  const createdGroup = categories.find((category) => category.name === "导图新增分组");
  expect(createdGroup?.parentId).toBe("cat-work");
  expect(createdGroup?.sectionId).toBe("section-default");

  const commonGroup = page.locator('[data-mindmap-node="grp:group-common"]');
  await commonGroup.getByRole("button", { name: "在“常用”中添加网站" }).click();
  await expect(page.getByRole("heading", { name: "添加网站" })).toBeVisible();
  await expect(page.getByRole("combobox")).toContainText("常用");
  await page.getByLabel("网页链接").fill("https://mindmap-added.example.com");
  await page.getByLabel("网站名称").fill("导图新增网页");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  const newCard = page.locator('[data-node-type="card"]').filter({ hasText: "导图新增网页" });
  await expect(newCard).toBeVisible();
  await expect(newCard).toHaveClass(/is-entering/);

  const afterAdd = await readProtectedCollectionState(page);
  expect(afterAdd.cards).not.toEqual(beforeCancel.cards);
  expect(afterAdd.categories).not.toEqual(beforeCancel.categories);
  expect(afterAdd.syncDirtySets).not.toEqual(beforeCancel.syncDirtySets);

  await page.getByRole("button", { name: "经典", exact: true }).click();
  await expect(page.getByTestId("collection-view-classic")).toHaveClass(/is-idle/);
  await expect(page.getByText("导图新增分类", { exact: true })).toBeVisible();
  await expect(page.getByText("导图新增分组", { exact: true })).toBeVisible();
  await expect(page.getByText("导图新增网页", { exact: true })).toBeVisible();
});

test("classic collection additions, edits, and soft deletes rebuild the mindmap", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);

  await page.getByRole("button", { name: "网页", exact: true }).click();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "常用" }).click();
  await page.getByLabel("网页链接").fill("https://example.com/classic-added-target");
  await page.getByLabel("网站名称").fill("经典新增网页");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  const classicCard = page.locator(".wc-site-tile").filter({ hasText: "经典新增网页" });
  await expect(classicCard).toBeVisible();

  await enterMindmap(page);
  await expect(page.locator('[data-node-type="card"]').filter({ hasText: "经典新增网页" })).toBeVisible();

  await page.getByRole("button", { name: "经典", exact: true }).click();
  await expect(page.getByTestId("collection-view-classic")).toHaveClass(/is-idle/);
  const editableCard = page.locator(".wc-site-tile").filter({ hasText: "经典新增网页" });
  await editableCard.getByRole("button", { name: "网页更多操作" }).focus();
  await page.getByRole("button", { name: "编辑详情" }).click();
  await page.getByLabel("网站名称").fill("经典修改网页");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".wc-site-tile").filter({ hasText: "经典修改网页" })).toBeVisible();

  await enterMindmap(page);
  await expect(page.locator('[data-node-type="card"]').filter({ hasText: "经典修改网页" })).toBeVisible();
  await expect(page.locator('[data-node-type="card"]').filter({ hasText: "经典新增网页" })).toHaveCount(0);

  await page.getByRole("button", { name: "经典", exact: true }).click();
  await expect(page.getByTestId("collection-view-classic")).toHaveClass(/is-idle/);
  const deletableCard = page.locator(".wc-site-tile").filter({ hasText: "经典修改网页" });
  await deletableCard.getByRole("button", { name: "网页更多操作" }).focus();
  await page.getByRole("button", { name: "删除网页" }).click();
  await expect(deletableCard).toHaveCount(0);

  await enterMindmap(page);
  await expect(page.locator('[data-node-type="card"]').filter({ hasText: "经典修改网页" })).toHaveCount(0);
  const recycleBin = await readCollectionKey(page, "recycleBin");
  expect(recycleBin).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "card", name: "经典修改网页" }),
  ]));
});

test("mindmap card activation and preview actions reuse link and bookmark preferences", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);

  const notion = page.locator('[data-mindmap-node="card:notion"]');
  await notion.hover();
  const preview = page.getByTestId("mindmap-hover-preview");
  await expect(preview).toBeVisible({ timeout: 2_000 });
  const pinButton = preview.getByRole("button", { name: "☆ 收藏栏" });
  await pinButton.click();
  await expect(preview.getByRole("button", { name: "★ 已在收藏栏" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => readCollectionKey(page, "pinnedBookmarkItems")).toEqual([
    expect.objectContaining({ cardId: "notion" }),
  ]);

  const previewPopupPromise = page.waitForEvent("popup");
  await preview.getByRole("button", { name: "打开网页" }).click();
  const previewPopup = await previewPopupPromise;
  await expect.poll(() => previewPopup.url()).toContain("/mindmap-target");
  await previewPopup.close();

  const nodePopupPromise = page.waitForEvent("popup");
  await notion.click();
  const nodePopup = await nodePopupPromise;
  await expect.poll(() => nodePopup.url()).toContain("/mindmap-target");
  await nodePopup.close();
});

test("mindmap exposes tree semantics and keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);

  const tree = page.getByRole("tree", { name: "导图节点" });
  await expect(tree).toBeVisible();
  await expect(page.locator('[data-mindmap-node="sec:section-default"]')).toHaveAttribute("role", "treeitem");
  await expect(page.locator('[data-mindmap-node="sec:section-default"]')).toHaveAttribute("aria-level", "1");
  await expect(page.locator('[data-mindmap-node="card:notion"]')).toHaveAttribute("aria-level", "4");

  const root = page.locator('[data-mindmap-node="sec:section-default"]');
  await root.focus();
  await expect(root).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-mindmap-node="cat:cat-work"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-mindmap-node="cat:cat-ai"]')).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(root).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-mindmap-node="cat:cat-work"]')).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator('[data-mindmap-node="cat:cat-work"]')).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-mindmap-node="grp:group-common"]')).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator('[data-mindmap-node="cat:cat-work"]')).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-mindmap-node="cat:cat-work"]')).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-mindmap-node="grp:group-common"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-mindmap-node="card:notion"]')).toBeFocused();
  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toContain("/mindmap-target");
  await popup.close();
});

test("mindmap compact viewport keeps controls usable without horizontal document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openCollection(page);
  await writeIsolatedMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);

  await expect(page.getByTestId("mindmap-stage")).toBeVisible();
  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.html).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);

  const rail = page.locator(".wc-mindmap-layout-rail");
  await expect(rail).toBeVisible();
  await expect(rail).toHaveCSS("flex-direction", "row");
  const railBox = await rail.boundingBox();
  expect(railBox).not.toBeNull();
  if (railBox) {
    expect(railBox.x).toBeGreaterThanOrEqual(0);
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(390);
  }
  await expect(page.getByRole("button", { name: "双侧脑图" })).toBeVisible();
  await page.getByRole("button", { name: "双侧脑图" }).click();
  await expect(page.getByRole("button", { name: "双侧脑图" })).toHaveAttribute("aria-pressed", "true");
});

test("mindmap virtualizes large trees while preserving layout metadata and focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await openCollection(page);
  await writeLargeMindmapFixture(page);
  await page.reload();
  await openCollection(page);
  await enterMindmap(page);

  const counts = await page.getByTestId("mindmap-stage").evaluate((element) => ({
    total: Number(element.getAttribute("data-mindmap-total-nodes")),
    rendered: Number(element.getAttribute("data-mindmap-rendered-nodes")),
  }));
  expect(counts.total).toBeGreaterThan(300);
  expect(counts.rendered).toBeGreaterThan(0);
  expect(counts.rendered).toBeLessThan(counts.total);
  expect(await page.locator('[data-node-type="card"]').count()).toBe(counts.rendered - 3);

  const root = page.locator('[data-mindmap-node="sec:section-default"]');
  await root.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-mindmap-node="cat:cat-large"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-mindmap-node="grp:group-large"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-mindmap-node="card:large-000"]')).toBeFocused();

  await page.getByRole("button", { name: "适应画布" }).click();
  await expect(page.getByTestId("mindmap-zoom-percent")).toBeVisible();
  const afterFit = await page.getByTestId("mindmap-stage").evaluate((element) => ({
    total: Number(element.getAttribute("data-mindmap-total-nodes")),
    rendered: Number(element.getAttribute("data-mindmap-rendered-nodes")),
  }));
  expect(afterFit.total).toBe(counts.total);
  expect(afterFit.rendered).toBeLessThanOrEqual(afterFit.total);
});

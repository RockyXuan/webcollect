import { expect, test, type Page } from "@playwright/test";
import { buildMindmapTree, fitCamera, layoutMindmap } from "@/components/mindmap/layout-engine";
import type { Category, CollectionSection, WebCard } from "@/lib/types";
import { openCollection } from "./helpers";

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
];
const fixtureCategories: Category[] = [
  { id: "cat-work", name: "工作", icon: "briefcase", color: "#b8860b", order: 0, createdAt: 1, sectionId: "section-default", isParent: true },
  { id: "cat-ai", name: "AI", icon: "brain", color: "#8b5cf6", order: 1, createdAt: 2, sectionId: "section-default", isParent: true },
  { id: "cat-inbox", name: "收集箱", icon: "inbox", color: "#888888", order: 99, createdAt: 5, sectionId: "section-default", isParent: true },
  { id: "group-common", name: "常用", icon: "star", color: "#b8860b", order: 0, createdAt: 3, sectionId: "section-default", parentId: "cat-work" },
  { id: "group-tools", name: "AI 工具", icon: "wrench", color: "#8b5cf6", order: 0, createdAt: 4, sectionId: "section-default", parentId: "cat-ai" },
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
  imageUrl: "",
});
const fixtureCards: WebCard[] = [
  fixtureCard("notion", "Notion", "group-common", 0),
  fixtureCard("google", "Google", "group-common", 1),
  fixtureCard("github", "GitHub", "group-common", 2),
  fixtureCard("chatgpt", "ChatGPT", "group-tools", 0),
  fixtureCard("claude", "Claude", "group-tools", 1),
  fixtureCard("gemini", "Gemini", "group-tools", 2),
];

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
    initialized: true,
  });
}

test("classic and mindmap modes share one header without mutating collection data", async ({ page }) => {
  await page.goto("/");
  await openCollection(page);

  const before = await readProtectedCollectionState(page);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByTestId("mindmap-stage")).toHaveCount(0);

  await page.getByRole("button", { name: "导图", exact: true }).click();
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
  await page.getByRole("button", { name: "导图", exact: true }).click();

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
  await page.getByRole("button", { name: "导图", exact: true }).click();
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

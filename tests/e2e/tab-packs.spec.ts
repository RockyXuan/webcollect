import { expect, test, type Page } from "@playwright/test";
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

async function writeFixture(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("webcollect_data", "readwrite");
      const store = transaction.objectStore("webcollect_data");
      const values = {
        cards: [{
          id: "card-alpha",
          url: "https://alpha.example.com/tool#details",
          title: "Alpha Tool",
          shortDesc: "固定模板测试",
          fullDesc: "",
          note: "",
          abbreviation: "AT",
          imageUrl: "/assets/mascots/chipmunk-head.png",
          categoryId: "group-tools",
          order: 0,
          createdAt: 3,
          updatedAt: 3,
        }],
        categories: [
          { id: "cat-work", name: "工作", icon: "briefcase", color: "#4a7c59", order: 0, createdAt: 1, sectionId: "section-default", isParent: true },
          { id: "group-tools", name: "工具", icon: "layers", color: "#4a7c59", order: 0, createdAt: 2, sectionId: "section-default", parentId: "cat-work" },
        ],
        collectionSections: [{ id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 }],
        activeCollectionSectionId: "section-default",
        pinnedBookmarkItems: [],
        initialized: true,
      };
      for (const [key, value] of Object.entries(values)) store.put(value, key);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  });
}

async function readProtectedState(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("webcollect_data", "readonly");
      const store = transaction.objectStore("webcollect_data");
      const keys = ["cards", "categories", "syncDirtySets", "syncTombstones", "recycleBin"];
      const entries = await Promise.all(keys.map((key) => new Promise<[string, unknown]>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve([key, request.result]);
        request.onerror = () => reject(request.error);
      })));
      return Object.fromEntries(entries);
    } finally {
      database.close();
    }
  });
}

async function dragCardToPack(page: Page): Promise<void> {
  const handle = page.locator('[data-wc-card-id="card-alpha"]').getByRole("button", { name: "拖动排序" });
  const target = page.getByRole("button", { name: /打开标签组 工作台/ });
  const [sourceBox, targetBox] = await Promise.all([handle.boundingBox(), target.boundingBox()]);
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) return;
  const from = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const to = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test("tag packs copy cards, deduplicate URLs, persist, and stay usable in mindmap mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await openCollection(page);
  await writeFixture(page);
  await page.reload();
  await openCollection(page);
  const protectedBefore = await readProtectedState(page);

  await page.getByRole("button", { name: "标签组", exact: true }).click();
  await page.getByLabel("名称", { exact: true }).fill("工作台");
  await page.getByRole("button", { name: "创建标签组", exact: true }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByRole("button", { name: "打开标签组 工作台，共 0 个网页" })).toBeVisible();

  await dragCardToPack(page);
  await expect(page.getByRole("button", { name: "打开标签组 工作台，共 1 个网页" })).toBeVisible();
  await dragCardToPack(page);
  await expect(page.getByRole("button", { name: "打开标签组 工作台，共 1 个网页" })).toBeVisible();
  expect(await readProtectedState(page)).toEqual(protectedBefore);

  await page.reload();
  await openCollection(page);
  await expect(page.getByRole("button", { name: "打开标签组 工作台，共 1 个网页" })).toBeVisible();

  await page.getByRole("button", { name: /^导图/ }).click();
  await expect(page.getByTestId("collection-view-mindmap")).toHaveClass(/is-idle/);
  await page.getByRole("button", { name: "管理标签组 工作台" }).click();
  const manager = page.getByRole("dialog", { name: "管理标签组" });
  const savedItem = manager.locator(".wc-tab-pack-item");
  await expect(savedItem.getByText("Alpha Tool", { exact: true })).toBeVisible();
  await expect(savedItem.getByText("https://alpha.example.com/tool", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "打开标签组 工作台，共 1 个网页" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

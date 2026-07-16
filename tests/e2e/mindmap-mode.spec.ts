import { expect, test, type Page } from "@playwright/test";
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

  await page.getByRole("button", { name: "经典", exact: true }).click();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByTestId("mindmap-stage")).toHaveCount(0);

  expect(await readProtectedCollectionState(page)).toEqual(before);
});

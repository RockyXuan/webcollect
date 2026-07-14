import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`wallpaper text layers do not overlap at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator('[data-wallpaper-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".wc-zoom-idle-hint-visible")).toBeVisible({ timeout: 15_000 });

    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const value = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
        return value ? { left: value.left, top: value.top, right: value.right, bottom: value.bottom } : null;
      };
      return {
        quote: rect(".wc-zoom-quote"),
        hint: rect(".wc-zoom-idle-hint-visible"),
        controls: rect(".wc-wallpaper-controls"),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    const intersects = (
      left: NonNullable<typeof geometry.quote>,
      right: NonNullable<typeof geometry.quote>,
    ) => left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;

    expect(geometry.quote).not.toBeNull();
    expect(geometry.hint).not.toBeNull();
    expect(geometry.controls).not.toBeNull();
    expect(intersects(geometry.quote!, geometry.hint!)).toBe(false);
    expect(intersects(geometry.quote!, geometry.controls!)).toBe(false);
    expect(intersects(geometry.hint!, geometry.controls!)).toBe(false);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport.width + 1);
  });
}

test("disabling wallpaper mode opens the next page directly in the collection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "壁纸设置" }).click();

  const wallpaperMode = page.getByRole("checkbox", {
    name: "启动壁纸模式 关闭后，下次打开新页面会直接进入主页。",
  });
  await wallpaperMode.uncheck();
  await page.getByRole("button", { name: "完成", exact: true }).click();

  await page.reload();
  await expect(page.getByText("WebCollect", { exact: true })).toBeVisible();
  await expect(page.locator(".wc-zoom-wallpaper")).toHaveCount(0);
});

test("top bar wallpaper switch changes the next-tab startup mode without opening settings", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-wallpaper-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Enter");

  const startupSwitch = page.getByRole("switch", { name: "启动壁纸模式" });
  await expect(startupSwitch).toBeVisible();
  await expect(startupSwitch).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await startupSwitch.click();
  await expect(startupSwitch).toHaveAttribute("aria-checked", "false");
  await expect(startupSwitch).toContainText("关");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("WebCollect", { exact: true })).toBeVisible();
  await expect(page.locator(".wc-zoom-wallpaper")).toHaveCount(0);

  const restoredSwitch = page.getByRole("switch", { name: "启动壁纸模式" });
  await restoredSwitch.click();
  await expect(restoredSwitch).toHaveAttribute("aria-checked", "true");
  await expect(restoredSwitch).toContainText("开");

  await page.reload();
  await expect(page.locator('[data-wallpaper-ready="true"]')).toBeVisible({ timeout: 30_000 });
});

test("repairs obsolete packaged wallpaper paths from IndexedDB", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(async () => {
    const databases = await indexedDB.databases();
    return databases.some((database) => database.name === "WebCollect");
  });

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction("webcollect_wallpaper", "readwrite");
    const store = transaction.objectStore("webcollect_wallpaper");
    const staleUrl = "/assets/wallpapers/zoom-wle-madygen-geopark.jpg";
    store.put([{
      id: "zoom-wle-madygen-geopark",
      title: "Madygen Geopark colors",
      author: "Marat Nadjibaev",
      source: "wikimedia",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
      imageUrl: staleUrl,
      thumbnailUrl: staleUrl,
      license: "Creative Commons Attribution-Share Alike 4.0",
      width: 3200,
      height: 1800,
      category: "landscape",
      quality: "award",
      sourceCollection: "Wiki Loves Earth 2024 winners",
      quoteId: "old-stone",
      fetchedAt: 99,
    }], "wallpaperLibrary");
    store.put({
      defaultMode: "wallpaper",
      themeMode: "auto",
      rotationInterval: "15m",
      enabledCategories: ["landscape", "landmark", "animals", "ocean"],
      autoUpdate: false,
      paused: false,
      showZoomHints: true,
      currentWallpaperId: "zoom-wle-madygen-geopark",
      currentQuoteId: null,
      recentQuoteIds: [],
      recentAssetIds: [],
      recentMediaIds: [],
      lastRemoteRefreshAt: Date.now(),
      settingsUpdatedAt: 0,
      updatedAt: 0,
    }, "wallpaperPrefs");
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });

  const obsoleteRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/assets\/wallpapers\/[^/?]+\.jpg(?:\?|$)/.test(request.url())) {
      obsoleteRequests.push(request.url());
    }
  });
  await page.reload();

  await expect(page.locator(".wc-wallpaper-image")).toHaveCSS(
    "background-image",
    /zoom-wle-madygen-geopark\.webp/
  );
  expect(obsoleteRequests).toEqual([]);
});

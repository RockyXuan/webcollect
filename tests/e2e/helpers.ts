import { expect, type Page } from "@playwright/test";

export async function openCollection(page: Page): Promise<void> {
  const wallpaper = page.locator('[data-wallpaper-ready="true"]');
  const brand = page.getByText("WebCollect", { exact: true });

  await expect.poll(async () => (await brand.isVisible()) || (await wallpaper.isVisible()), {
    timeout: 30_000,
  }).toBe(true);
  // Wallpaper preferences hydrate after the first paint. Let that settle before
  // deciding whether the collection is already open.
  await page.waitForTimeout(250);
  if (await wallpaper.isVisible()) await wallpaper.press("Enter");
  await expect(brand).toBeVisible({ timeout: 15_000 });
}

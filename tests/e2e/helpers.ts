import { expect, type Page } from "@playwright/test";

export async function openCollection(page: Page): Promise<void> {
  const wallpaper = page.locator('[data-wallpaper-ready="true"]');
  const brand = page.getByText("WebCollect", { exact: true });

  if (await brand.isVisible()) return;
  await expect(wallpaper).toBeVisible({ timeout: 30_000 });
  await wallpaper.press("Enter");
  await expect(brand).toBeVisible({ timeout: 15_000 });
}

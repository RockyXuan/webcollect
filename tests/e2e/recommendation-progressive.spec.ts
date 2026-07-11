import { expect, test } from "@playwright/test";

test("discover categories render progressively", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.keyboard.press("Enter");

  const groups = page.locator("[data-recommendation-group]");
  await expect(groups).toHaveCount(6);
  await page.locator("[data-recommendation-more]").scrollIntoViewIfNeeded();
  await expect.poll(() => groups.count()).toBeGreaterThan(6);
});

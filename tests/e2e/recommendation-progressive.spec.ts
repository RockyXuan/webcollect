import { expect, test } from "@playwright/test";
import { openCollection } from "./helpers";

test("discover categories render progressively", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await openCollection(page);

  const groups = page.locator("[data-recommendation-group]");
  await expect(groups).toHaveCount(6, { timeout: 15_000 });
  await page.locator("[data-recommendation-more]").scrollIntoViewIfNeeded();
  await expect.poll(() => groups.count()).toBeGreaterThan(6);
});

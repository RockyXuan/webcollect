import { expect, test } from "@playwright/test";
import { openCollection } from "./helpers";

const viewports = [
  { width: 2048, height: 1152 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`collection stays inside ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await openCollection(page);

    await expect(page.getByText("WebCollect", { exact: true })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const brand = document.querySelector<HTMLElement>(".wc-brand");
      const rect = brand?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        brandLeft: rect?.left ?? -1,
        brandRight: rect?.right ?? Number.POSITIVE_INFINITY,
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.brandLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.brandRight).toBeLessThanOrEqual(geometry.viewportWidth);
  });
}

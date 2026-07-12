import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`wallpaper text layers do not overlap at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.waitForTimeout(2_300);

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

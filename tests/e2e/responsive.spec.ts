import { expect, test } from "@playwright/test";
import { openCollection } from "./helpers";

const viewports = [
  { width: 2048, height: 1152 },
  { width: 1800, height: 1080 },
  { width: 1728, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
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

for (const viewport of [
  { width: 2048, height: 1152 },
  { width: 1800, height: 1080 },
  { width: 1728, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
]) {
  test(`desktop header controls stay separated at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await openCollection(page);

    await page.evaluate(() => {
      const actions = document.querySelector<HTMLElement>(".wc-header-actions");
      if (!actions || actions.querySelector("[data-test-sync-badge]")) return;

      const badge = document.createElement("button");
      badge.type = "button";
      badge.dataset.testSyncBadge = "true";
      badge.className = "wc-sync-status-badge";
      badge.style.display = "flex";
      badge.innerHTML = [
        '<span class="wc-sync-status-line">本地已保存 12:34</span>',
        '<span class="wc-sync-status-line">云端同步中</span>',
      ].join("");
      actions.prepend(badge);
    });

    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const value = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
        return value ? {
          left: value.left,
          top: value.top,
          right: value.right,
          bottom: value.bottom,
          height: value.height,
        } : null;
      };
      const login = document.querySelector<HTMLElement>(".wc-login-button");
      const loginStyle = login ? window.getComputedStyle(login) : null;
      return {
        search: rect(".wc-header-search-wrap"),
        actions: rect(".wc-header-actions"),
        login: rect(".wc-login-button"),
        loginWhiteSpace: loginStyle?.whiteSpace ?? "",
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(geometry.search).not.toBeNull();
    expect(geometry.actions).not.toBeNull();
    expect(geometry.login).not.toBeNull();
    const intersects = geometry.search!.left < geometry.actions!.right
      && geometry.search!.right > geometry.actions!.left
      && geometry.search!.top < geometry.actions!.bottom
      && geometry.search!.bottom > geometry.actions!.top;
    expect(intersects).toBe(false);
    expect(geometry.loginWhiteSpace).toBe("nowrap");
    expect(geometry.login!.height).toBeLessThanOrEqual(44);
    expect(geometry.login!.left).toBeGreaterThanOrEqual(0);
    expect(geometry.login!.right).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  });
}

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
        compactControlHeights: [
          document.querySelector<HTMLElement>(".wc-header-tool")?.getBoundingClientRect().height,
          document.querySelector<HTMLElement>(".wc-header-primary")?.getBoundingClientRect().height,
          document.querySelector<HTMLElement>(".wc-wallpaper-quick-control")?.getBoundingClientRect().height,
          document.querySelector<HTMLElement>(".wc-view-mode-toggle")?.getBoundingClientRect().height,
          document.querySelector<HTMLElement>(".wc-login-button")?.getBoundingClientRect().height,
        ].filter((height): height is number => typeof height === "number"),
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.brandLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.brandRight).toBeLessThanOrEqual(geometry.viewportWidth);
    if (viewport.width === 390) {
      expect(geometry.compactControlHeights.length).toBeGreaterThan(0);
      expect(geometry.compactControlHeights.every((height) => height === 36)).toBe(true);
    }
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
      badge.className = "wc-sync-status-badge is-success";
      badge.style.display = "flex";
      badge.innerHTML = [
        '<span class="wc-sync-status-line"><svg class="wc-sync-status-icon is-success"></svg><span>本地已保存 12:34</span></span>',
        '<span class="wc-sync-status-line"><svg class="wc-sync-status-icon is-syncing"></svg><span>云端同步中</span></span>',
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
      const style = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        return {
          height: bounds.height,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          border: computed.border,
          borderRadius: computed.borderRadius,
        };
      };
      const toolStyles = Array.from(document.querySelectorAll<HTMLElement>(".wc-header-tool")).map((element) => {
        const bounds = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        return {
          height: bounds.height,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          border: computed.border,
          borderRadius: computed.borderRadius,
        };
      });
      return {
        search: rect(".wc-header-search-wrap"),
        actions: rect(".wc-header-actions"),
        login: rect(".wc-login-button"),
        loginWhiteSpace: loginStyle?.whiteSpace ?? "",
        loginStyle: style(".wc-login-button"),
        searchEngineStyle: style(".wc-search-engine-select"),
        syncStyle: style(".wc-sync-status-badge"),
        syncTextColor: window.getComputedStyle(document.querySelector<HTMLElement>(".wc-sync-status-line span")!).color,
        syncSuccessIconColor: window.getComputedStyle(document.querySelector<SVGElement>(".wc-sync-status-icon.is-success")!).color,
        primaryStyle: style(".wc-header-primary"),
        wallpaperStyle: style(".wc-wallpaper-quick-control"),
        modeStyle: style(".wc-view-mode-toggle"),
        toolStyles,
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
    expect(geometry.login!.height).toBe(38);
    expect(geometry.login!.left).toBeGreaterThanOrEqual(0);
    expect(geometry.login!.right).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

    const neutralColor = "rgb(71, 85, 105)";
    const neutralBackground = "rgba(255, 255, 255, 0.68)";
    const neutralBorder = "1px solid rgba(148, 163, 184, 0.24)";
    for (const surface of [
      geometry.loginStyle,
      geometry.syncStyle,
      geometry.wallpaperStyle,
      geometry.modeStyle,
      ...geometry.toolStyles,
    ]) {
      expect(surface).not.toBeNull();
      expect(surface?.height).toBe(38);
      expect(surface?.backgroundColor).toBe(neutralBackground);
      expect(surface?.border).toBe(neutralBorder);
      expect(surface?.borderRadius).toBe("14px");
    }
    for (const toolStyle of geometry.toolStyles) {
      expect(toolStyle.color).toBe(neutralColor);
    }
    expect(geometry.searchEngineStyle?.color).toBe("rgb(100, 116, 139)");
    expect(geometry.searchEngineStyle?.border).toBe(neutralBorder);
    expect(geometry.syncTextColor).toBe(neutralColor);
    expect(geometry.syncSuccessIconColor).toBe("rgb(16, 185, 129)");
    expect(geometry.primaryStyle?.height).toBe(38);
    expect(geometry.primaryStyle?.borderRadius).toBe("14px");
  });
}

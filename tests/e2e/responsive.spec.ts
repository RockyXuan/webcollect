import { expect, test } from "@playwright/test";
import { openCollection } from "./helpers";

async function writeThreePanelFixture(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const card = (id: string, categoryId: string, order: number) => ({
      id,
      url: `https://${id}.example.com`,
      title: id,
      shortDesc: "",
      fullDesc: "",
      note: "",
      abbreviation: id.slice(0, 2),
      imageUrl: "",
      categoryId,
      order,
      createdAt: order + 10,
      updatedAt: order + 10,
    });
    try {
      const transaction = database.transaction("webcollect_data", "readwrite");
      const store = transaction.objectStore("webcollect_data");
      const categories = [
        { id: "parent-chrome", name: "Chrome", icon: "folder", color: "#64748b", order: 0, createdAt: 1, sectionId: "section-default", isParent: true },
        { id: "parent-common", name: "常用", icon: "folder", color: "#64748b", order: 1, createdAt: 2, sectionId: "section-default", isParent: true },
        { id: "parent-download", name: "download", icon: "folder", color: "#64748b", order: 2, createdAt: 3, sectionId: "section-default", isParent: true },
        { id: "group-chrome", name: "Settings", icon: "layers", color: "#64748b", order: 0, createdAt: 4, sectionId: "section-default", parentId: "parent-chrome" },
        { id: "group-common", name: "看世界", icon: "layers", color: "#64748b", order: 0, createdAt: 5, sectionId: "section-default", parentId: "parent-common" },
        { id: "group-download", name: "下载", icon: "layers", color: "#64748b", order: 0, createdAt: 6, sectionId: "section-default", parentId: "parent-download" },
      ];
      const cards = [
        ...Array.from({ length: 4 }, (_, index) => card(`chrome-${index}`, "group-chrome", index)),
        ...Array.from({ length: 7 }, (_, index) => card(`common-${index}`, "group-common", index)),
        ...Array.from({ length: 4 }, (_, index) => card(`download-${index}`, "group-download", index)),
      ];
      const values = {
        cards,
        categories,
        collectionSections: [{ id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 }],
        activeCollectionSectionId: "section-default",
        categoryWidths: {},
        categoryLayouts: {},
        pinnedBookmarkItems: [],
        visualScale: 100,
        initialized: true,
      };
      for (const [key, value] of Object.entries(values)) store.put(value, key);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  });
}

async function readLayoutProtectedState(page: import("@playwright/test").Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("webcollect_data", "readonly");
      const store = transaction.objectStore("webcollect_data");
      const keys = ["cards", "categories", "categoryWidths", "categoryLayouts", "syncDirtySets", "syncTombstones"];
      const entries = await Promise.all(keys.map((key) => new Promise<[string, unknown]>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve([key, request.result]);
        request.onerror = () => reject(request.error);
      })));
      return Object.fromEntries(entries);
    } finally {
      database.close();
    }
  });
}

const viewports = [
  { width: 2048, height: 1152 },
  { width: 1920, height: 1080 },
  { width: 1880, height: 1080 },
  { width: 1800, height: 1080 },
  { width: 1728, height: 1080 },
  { width: 1680, height: 1050 },
  { width: 1600, height: 900 },
  { width: 1599, height: 900 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1180, height: 820 },
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
        tier: document.querySelector<HTMLElement>(".wc-resolution-viewport")?.dataset.wcLayoutTier,
        availableWidth: Number(
          document.querySelector<HTMLElement>(".wc-resolution-viewport")?.dataset.wcAvailableWidth || "0"
        ),
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.brandLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.brandRight).toBeLessThanOrEqual(geometry.viewportWidth);
    if (viewport.width === 390) {
      expect(geometry.compactControlHeights.length).toBeGreaterThan(0);
      expect(geometry.compactControlHeights.every((height) => height === 36)).toBe(true);
    }
    if (geometry.availableWidth >= 1880) expect(geometry.tier).toBe("wide");
    if (geometry.availableWidth >= 1600 && geometry.availableWidth < 1880) {
      expect(geometry.tier).toBe("compressed");
    }
    if (geometry.availableWidth > 1180 && geometry.availableWidth < 1600) {
      expect(geometry.tier).toBe("reflow");
    }
    if (geometry.availableWidth <= 1180) expect(geometry.tier).toBe("compact");
  });
}

for (const viewport of [
  { width: 2048, height: 1152 },
  { width: 1920, height: 1080 },
  { width: 1880, height: 1080 },
  { width: 1800, height: 1080 },
  { width: 1728, height: 1080 },
  { width: 1680, height: 1050 },
  { width: 1600, height: 900 },
  { width: 1599, height: 900 },
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
        tier: document.querySelector<HTMLElement>(".wc-resolution-viewport")?.dataset.wcLayoutTier,
        density: Number(document.querySelector<HTMLElement>(".wc-resolution-viewport")?.dataset.wcLayoutDensity || "1"),
        controlHeight: Number.parseFloat(
          window.getComputedStyle(document.querySelector<HTMLElement>(".wc-resolution-viewport")!)
            .getPropertyValue("--wc-adaptive-control-height")
        ),
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
    expect(geometry.login!.height).toBeCloseTo(geometry.controlHeight, 0);
    expect(geometry.login!.left).toBeGreaterThanOrEqual(0);
    expect(geometry.login!.right).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    if (geometry.tier === "reflow") {
      expect(geometry.actions!.top).toBeGreaterThanOrEqual(geometry.search!.bottom);
    } else {
      expect(Math.abs(geometry.actions!.top - geometry.search!.top)).toBeLessThanOrEqual(12);
    }

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
      expect(surface?.height).toBeCloseTo(geometry.controlHeight, 0);
      expect(surface?.backgroundColor).toBe(neutralBackground);
      expect(surface?.border).toBe(neutralBorder);
      expect(Number.parseFloat(surface?.borderRadius || "0")).toBeCloseTo(14 * geometry.density, 0);
    }
    for (const toolStyle of geometry.toolStyles) {
      expect(toolStyle.color).toBe(neutralColor);
    }
    expect(geometry.searchEngineStyle?.color).toBe("rgb(100, 116, 139)");
    expect(geometry.searchEngineStyle?.border).toBe(neutralBorder);
    expect(geometry.syncTextColor).toBe(neutralColor);
    expect(geometry.syncSuccessIconColor).toBe("rgb(16, 185, 129)");
    expect(geometry.primaryStyle?.height).toBeCloseTo(geometry.controlHeight, 0);
    expect(Number.parseFloat(geometry.primaryStyle?.borderRadius || "0")).toBeCloseTo(14 * geometry.density, 0);
  });
}

test("three representative classic panels stay in one row at 1680 without persisting responsive density", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCollection(page);
  await writeThreePanelFixture(page);
  await page.reload();
  await openCollection(page);
  const before = await readLayoutProtectedState(page);

  await page.setViewportSize({ width: 1680, height: 1050 });
  await expect(page.locator(".wc-resolution-viewport")).toHaveAttribute("data-wc-layout-tier", "compressed");
  const compressedPanels = await page.locator(".wc-category-panel").evaluateAll((nodes) => (
    nodes.slice(0, 3).map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, left: rect.left, right: rect.right, width: rect.width };
    })
  ));
  expect(compressedPanels).toHaveLength(3);
  expect(Math.max(...compressedPanels.map((panel) => panel.top))
    - Math.min(...compressedPanels.map((panel) => panel.top))).toBeLessThanOrEqual(1);
  expect(compressedPanels[2].right).toBeLessThanOrEqual(1680);

  await page.setViewportSize({ width: 1536, height: 864 });
  await expect(page.locator(".wc-resolution-viewport")).toHaveAttribute("data-wc-layout-tier", "reflow");
  const reflowPanelTops = await page.locator(".wc-category-panel").evaluateAll((nodes) => (
    nodes.slice(0, 3).map((node) => node.getBoundingClientRect().top)
  ));
  expect(new Set(reflowPanelTops.map((top) => Math.round(top))).size).toBeGreaterThan(1);

  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(await readLayoutProtectedState(page)).toEqual(before);
});

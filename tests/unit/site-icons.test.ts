import localforage from "localforage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getChromeFaviconUrl,
  getSiteIconCandidates,
  isGenericFaviconProvider,
  shouldPersistSiteIcon,
} from "@/lib/site-icons";
import {
  SITE_ICON_CACHE_DB,
  SITE_ICON_CACHE_ITEM_MAX_BYTES,
  SITE_ICON_CACHE_STORE,
  cacheLoadedSiteIcon,
  cacheSiteIconDataUrl,
  getCachedSiteIcon,
} from "@/lib/site-icon-cache";
import type { WebCard } from "@/lib/types";

function card(url: string, title: string, imageUrl = ""): WebCard {
  return {
    id: `card-${title}`,
    url,
    title,
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: title.slice(0, 2),
    imageUrl,
    categoryId: "category-icons",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  };
}

beforeEach(async () => {
  await localforage.createInstance({ name: SITE_ICON_CACHE_DB, storeName: SITE_ICON_CACHE_STORE }).clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("site icon recovery", () => {
  it("prefers a stored official icon, then Chrome's internal favicon service, before generic providers", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "stable-extension-id",
        getURL: (path: string) => `chrome-extension://stable-extension-id${path}`,
      },
    });
    const stored = "https://example.com/official-icon.png";
    const candidates = getSiteIconCandidates(card("https://example.com/page", "Example", stored));

    expect(candidates[0]).toBe(stored);
    expect(candidates[1]).toContain("chrome-extension://stable-extension-id/_favicon/");
    expect(candidates.findIndex(isGenericFaviconProvider)).toBeGreaterThan(1);
  });

  it("adds reliable direct candidates for the reported Douyin, Xiaohongshu, and Douban sites", () => {
    const douyin = getSiteIconCandidates(card(
      "https://creator.douyin.com/creator-micro/home",
      "抖音创作者中心",
    ));
    const xiaohongshu = getSiteIconCandidates(card(
      "https://creator.xiaohongshu.com/publish/publish",
      "小红书创作者中心",
    ));
    const doubanBook = getSiteIconCandidates(card("https://book.douban.com", "豆瓣读书"));
    const doubanMovie = getSiteIconCandidates(card("https://movie.douban.com", "豆瓣电影"));

    expect(douyin).toContain("https://www.douyin.com/favicon.ico");
    expect(xiaohongshu).toContain("https://creator.xiaohongshu.com/favicon.ico");
    expect(doubanBook[0]).toBe("https://book.douban.com/favicon.ico");
    expect(doubanMovie).toContain("https://movie.douban.com/favicon.ico");
  });

  it("never persists generic, data, or Chrome-internal derived candidates into a WebCard", () => {
    expect(shouldPersistSiteIcon("", "https://example.com/favicon.ico")).toBe(true);
    expect(shouldPersistSiteIcon("", "https://www.google.com/s2/favicons?domain=example.com&sz=128")).toBe(false);
    expect(shouldPersistSiteIcon("", "data:image/png;base64,AA==")).toBe(false);
    expect(shouldPersistSiteIcon("", "chrome-extension://stable-extension-id/_favicon/?pageUrl=x")).toBe(false);
    expect(getChromeFaviconUrl("javascript:alert(1)")).toBe("");
  });

  it("stores rebuildable icon data only in the bounded derived cache", async () => {
    const tinyPng = "data:image/png;base64,iVBORw0KGgo=";
    expect(await cacheSiteIconDataUrl("https://example.com/page", "https://example.com/favicon.ico", tinyPng))
      .toBe(true);
    expect(await getCachedSiteIcon("https://example.com/another-page")).toBe(tinyPng);

    const oversized = `data:image/png;base64,${"A".repeat(Math.ceil(SITE_ICON_CACHE_ITEM_MAX_BYTES * 4 / 3) + 100)}`;
    expect(await cacheSiteIconDataUrl("https://too-large.example", "https://too-large.example/favicon.ico", oversized))
      .toBe(false);
    expect(await getCachedSiteIcon("https://too-large.example")).toBe("");
  });

  it("does not re-download packaged or relative icons into hundreds of per-site cache entries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await cacheLoadedSiteIcon("https://large-1.example.com", "/assets/mascots/chipmunk-head.png");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

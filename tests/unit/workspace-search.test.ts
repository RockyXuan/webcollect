import { describe, expect, it } from "vitest";
import {
  buildWorkspaceSearchIndex,
  limitSearchQuery,
  searchWorkspace,
  searchWorkspaceIndex,
} from "../../src/lib/workspace-search";
import type { Category, CollectionSection, WebCard } from "../../src/lib/types";

const now = 1_777_777_777;

const sections: CollectionSection[] = [
  { id: "section-default", name: "主页", order: 0, createdAt: now, updatedAt: now },
  { id: "section-tools", name: "效率工具", order: 1, createdAt: now, updatedAt: now },
];

const categories: Category[] = [
  {
    id: "cat-dev",
    name: "开发",
    icon: "terminal",
    color: "#4a7c59",
    order: 0,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-tools",
    isParent: true,
  },
  {
    id: "cat-code",
    name: "代码工具",
    icon: "code",
    color: "#4a7c59",
    order: 0,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-tools",
    parentId: "cat-dev",
  },
  {
    id: "cat-video",
    name: "影音下载",
    icon: "download",
    color: "#2563eb",
    order: 1,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-default",
  },
];

const cards: WebCard[] = [
  {
    id: "card-github",
    title: "GitHub",
    url: "https://github.com",
    shortDesc: "代码托管平台",
    fullDesc: "用于管理 Git 仓库、协作开发和代码审查。",
    note: "写代码时常用",
    abbreviation: "GH",
    imageUrl: "",
    categoryId: "cat-code",
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "card-downloader",
    title: "视频下载助手",
    url: "https://www.downloadhelper.net",
    shortDesc: "在线视频下载工具",
    fullDesc: "保存网页中的视频和媒体文件。",
    note: "下载视频",
    abbreviation: "VDH",
    imageUrl: "",
    categoryId: "cat-video",
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
];

const input = { cards, categories, sections };

describe("workspace fuzzy search", () => {
  it("matches a short Latin typo without hiding the match source", () => {
    const result = searchWorkspace(input, "githb");

    expect(result.cards[0]?.card.id).toBe("card-github");
    expect(result.cards[0]?.matchKind).toBe("fuzzy");
    expect(result.cards[0]?.matchReasons).toEqual(["title", "fuzzy"]);
  });

  it("matches an incomplete domain token", () => {
    const result = searchWorkspace(input, "downloadhelpr");

    expect(result.cards[0]?.card.id).toBe("card-downloader");
    expect(result.cards[0]?.matchReasons).toContain("url");
    expect(result.cards[0]?.matchReasons).toContain("fuzzy");
  });

  it("allows one missing Chinese bigram while keeping useful context matches", () => {
    const result = searchWorkspace(input, "下载视频网站");

    expect(result.cards[0]?.card.id).toBe("card-downloader");
    expect(result.cards[0]?.matchReasons).toContain("description");
  });

  it("keeps exact title matches ahead of fuzzy candidates", () => {
    const result = searchWorkspace(input, "github");

    expect(result.cards[0]?.card.id).toBe("card-github");
    expect(result.cards[0]?.exactMatch).toBe(true);
    expect(result.cards[0]?.matchKind).toBe("exact");
  });

  it("reuses a prebuilt index without mutating source data", () => {
    const before = structuredClone(input);
    const index = buildWorkspaceSearchIndex(input);

    expect(searchWorkspaceIndex(index, "效率 开发").categories[0]?.category.id).toBe("cat-dev");
    expect(input).toEqual(before);
  });

  it("keeps 20 card candidates while category and section groups stay capped at eight", () => {
    const result = searchWorkspace({
      cards: Array.from({ length: 22 }, (_, itemIndex): WebCard => ({
        ...cards[0],
        id: `card-tool-${String(itemIndex).padStart(2, "0")}`,
        title: `Tool ${String(itemIndex).padStart(2, "0")}`,
        order: itemIndex,
      })),
      categories: Array.from({ length: 10 }, (_, itemIndex): Category => ({
        ...categories[0],
        id: `cat-tool-${String(itemIndex).padStart(2, "0")}`,
        name: `Tool category ${String(itemIndex).padStart(2, "0")}`,
        order: itemIndex,
      })),
      sections: Array.from({ length: 10 }, (_, itemIndex): CollectionSection => ({
        ...sections[0],
        id: `section-tool-${String(itemIndex).padStart(2, "0")}`,
        name: `Tool section ${String(itemIndex).padStart(2, "0")}`,
        order: itemIndex,
      })),
    }, "tool");

    expect(result.cards).toHaveLength(20);
    expect(result.cards[19]?.card.id).toBe("card-tool-19");
    expect(result.categories).toHaveLength(8);
    expect(result.sections).toHaveLength(8);
  });

  it("limits local matching to the first 200 Unicode characters", () => {
    const ignoredSuffixQuery = `${" ".repeat(200)}github`;
    const result = searchWorkspace(input, ignoredSuffixQuery);

    expect(limitSearchQuery(`${"😀".repeat(200)}ignored`)).toBe("😀".repeat(200));
    expect(result.query).toBe(" ".repeat(200));
    expect(result.cards).toEqual([]);
  });

  it("returns the correct first result within 50ms for 1,000 pre-indexed bookmarks", () => {
    const performanceCards: WebCard[] = [
      ...Array.from({ length: 999 }, (_, index): WebCard => ({
        id: `card-reference-${index}`,
        title: `Reference Library ${index}`,
        url: `https://reference-${index}.example.com`,
        shortDesc: `通用资料库条目 ${index}`,
        fullDesc: "产品设计、研究资料与团队协作文档。",
        note: "日常参考",
        abbreviation: `R${index}`,
        imageUrl: "",
        categoryId: index % 2 === 0 ? "cat-code" : "cat-video",
        order: index,
        createdAt: now,
        updatedAt: now,
      })),
      { ...cards[0], order: 999 },
    ];
    const index = buildWorkspaceSearchIndex({ cards: performanceCards, categories, sections });

    // Warm up the scoring path so the gate measures retrieval rather than one-time JIT work.
    expect(searchWorkspaceIndex(index, "githb").cards[0]?.card.id).toBe("card-github");

    const durations = Array.from({ length: 7 }, () => {
      const startedAt = performance.now();
      const result = searchWorkspaceIndex(index, "githb");
      const duration = performance.now() - startedAt;

      expect(result.cards[0]?.card.id).toBe("card-github");
      expect(result.cards[0]?.matchKind).toBe("fuzzy");
      return duration;
    }).sort((left, right) => left - right);
    const medianMs = durations[Math.floor(durations.length / 2)];

    expect(medianMs, `median local retrieval took ${medianMs.toFixed(2)}ms`).toBeLessThan(50);
  });

  it("keeps very long CJK input bounded and stable for 1,000 pre-indexed bookmarks", () => {
    const performanceCards = Array.from({ length: 1_000 }, (_, itemIndex): WebCard => ({
      ...cards[itemIndex % cards.length],
      id: `card-long-query-${itemIndex}`,
      title: `知识工具 ${itemIndex}`,
      order: itemIndex,
    }));
    const index = buildWorkspaceSearchIndex({ cards: performanceCards, categories, sections });
    const veryLongQuery = "知识".repeat(500_000);

    searchWorkspaceIndex(index, veryLongQuery);
    const durations = Array.from({ length: 5 }, () => {
      const startedAt = performance.now();
      const result = searchWorkspaceIndex(index, veryLongQuery);
      expect(Array.from(result.query)).toHaveLength(200);
      return performance.now() - startedAt;
    }).sort((left, right) => left - right);
    const medianMs = durations[Math.floor(durations.length / 2)];

    expect(medianMs, `median bounded long-query retrieval took ${medianMs.toFixed(2)}ms`).toBeLessThan(50);
  });
});

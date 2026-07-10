import { describe, expect, it } from "vitest";
import {
  assessLocalDataSnapshot,
  type LocalSnapshotData,
  type LocalSnapshotEntry,
} from "@/lib/local-snapshots";

const baseTime = 1_777_200_000_000;

function snapshot(categoryId = "category-one", cardCategoryId = categoryId): LocalSnapshotEntry {
  const data: LocalSnapshotData = {
    cards: [{
      id: "card-one",
      url: "https://example.com",
      title: "Example",
      shortDesc: "Example",
      fullDesc: "Example",
      note: "",
      abbreviation: "EX",
      imageUrl: "",
      categoryId: cardCategoryId,
      order: 0,
      createdAt: baseTime,
      updatedAt: baseTime,
    }],
    categories: [{
      id: categoryId,
      name: "zkSync research",
      icon: "star",
      color: "#4A7C59",
      order: 0,
      createdAt: baseTime,
      updatedAt: baseTime,
      sectionId: "section-default",
    }],
    hiddenSites: [],
    pinnedCategoryIds: [],
    pinnedBookmarkItems: [],
    categoryWidths: {},
    categoryLayouts: {},
    visualScale: 100,
    linkOpenMode: "new-background-tab",
    searchEngine: "google",
    sections: [{
      id: "section-default",
      name: "主页",
      order: 0,
      createdAt: baseTime,
      updatedAt: baseTime,
    }],
    activeSectionId: "section-default",
    recycleBin: [],
    warehouseCards: [],
    warehouseCategories: [],
    warehouseImportBatches: [],
    warehouseUpdatedAt: 0,
    workspaceResetAt: 0,
    localSnapshotUpdatedAt: baseTime,
  };

  return {
    id: "snapshot-one",
    createdAt: baseTime,
    reason: "manual-snapshot",
    label: "small valid workspace",
    counts: {
      sections: 1,
      categories: 1,
      cards: 1,
      recycleBin: 0,
      warehouseCategories: 0,
      warehouseCards: 0,
      warehouseBatches: 0,
    },
    sectionNames: ["主页"],
    sampleCategoryNames: ["zkSync research"],
    sampleCardTitles: ["Example"],
    data,
  };
}

describe("snapshot health", () => {
  it("accepts a small but internally consistent workspace", () => {
    const assessment = assessLocalDataSnapshot(snapshot());
    expect(assessment.recoverable).toBe(true);
    expect(assessment.details).not.toMatch(/数量偏少|分项不足|crypto/i);
  });

  it("rejects orphaned cards regardless of workspace size", () => {
    const assessment = assessLocalDataSnapshot(snapshot("category-one", "missing-category"));
    expect(assessment.recoverable).toBe(false);
    expect(assessment.details).toContain("网页引用了不存在的分类");
  });
});

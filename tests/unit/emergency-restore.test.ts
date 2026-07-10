import { describe, expect, it } from "vitest";
import { selectEmergencyRestoreCandidate } from "@/lib/emergency-restore";
import type { LocalSnapshotData, LocalSnapshotEntry } from "@/lib/local-snapshots";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const baseTime = 1_777_200_000_000;

function sections(): CollectionSection[] {
  return ["section-default", "section-ai"].map((id, order) => ({
    id,
    name: order === 0 ? "主页" : "AI",
    order,
    createdAt: baseTime,
    updatedAt: baseTime,
  }));
}

function categories(distributed: boolean): Category[] {
  return [0, 1, 2].map((index) => ({
    id: `category-${index}`,
    name: `分类 ${index}`,
    icon: "star",
    color: "#4A7C59",
    order: index,
    createdAt: baseTime,
    updatedAt: baseTime,
    sectionId: distributed && index > 0 ? "section-ai" : "section-default",
  }));
}

function cards(): WebCard[] {
  return [0, 1, 2].map((index) => ({
    id: `card-${index}`,
    url: `https://example.com/${index}`,
    title: `网页 ${index}`,
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: "EX",
    imageUrl: "",
    categoryId: `category-${index}`,
    order: index,
    createdAt: baseTime,
    updatedAt: baseTime,
  }));
}

function entry(distributed: boolean): LocalSnapshotEntry {
  const data = {
    cards: cards(),
    categories: categories(distributed),
    sections: sections(),
    activeSectionId: "section-default",
    hiddenSites: [],
    pinnedCategoryIds: [],
    pinnedBookmarkItems: [],
    categoryWidths: {},
    categoryLayouts: {},
    visualScale: 100,
    linkOpenMode: "new-background-tab",
    searchEngine: "google",
    recycleBin: [],
    warehouseCards: [],
    warehouseCategories: [],
    warehouseImportBatches: [],
    warehouseUpdatedAt: 0,
    workspaceResetAt: 0,
    localSnapshotUpdatedAt: baseTime,
  } satisfies LocalSnapshotData;
  return {
    id: distributed ? "healthy" : "collapsed",
    createdAt: baseTime,
    reason: "automatic",
    label: "candidate",
    counts: {
      sections: 2,
      categories: 3,
      cards: 3,
      recycleBin: 0,
      warehouseCategories: 0,
      warehouseCards: 0,
      warehouseBatches: 0,
    },
    sectionNames: ["主页", "AI"],
    sampleCategoryNames: [],
    sampleCardTitles: [],
    data,
  };
}

describe("emergency restore selection", () => {
  it("protects a small workspace when a same-size snapshot has richer section structure", () => {
    const candidate = selectEmergencyRestoreCandidate({
      cards: cards(),
      categories: categories(false),
      sections: sections(),
    }, [entry(true)]);
    expect(candidate?.id).toBe("healthy");
  });

  it("does not prompt when the current workspace is already as structured as the snapshot", () => {
    const candidate = selectEmergencyRestoreCandidate({
      cards: cards(),
      categories: categories(true),
      sections: sections(),
    }, [entry(true)]);
    expect(candidate).toBeNull();
  });
});

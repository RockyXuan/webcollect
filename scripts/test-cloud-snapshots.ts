import assert from "node:assert/strict";
import {
  buildCloudWorkspaceSnapshotRow,
  cloudWorkspaceSnapshotDayKey,
  mapCloudWorkspaceSnapshotRow,
  shouldReplaceCloudWorkspaceSnapshot,
} from "../src/lib/cloud-snapshots";
import type { LocalSnapshotEntry } from "../src/lib/local-snapshots";

const sampleSnapshot: LocalSnapshotEntry = {
  id: "snapshot-20260518",
  createdAt: new Date("2026-05-18T15:30:00+08:00").getTime(),
  reason: "manual-snapshot",
  label: "Manual save",
  counts: {
    sections: 7,
    categories: 115,
    cards: 324,
    recycleBin: 2,
    warehouseCategories: 3,
    warehouseCards: 4,
    warehouseBatches: 1,
  },
  sectionNames: ["Home", "FOM", "HODL"],
  sampleCategoryNames: ["Chrome", "AI", "Bstocks"],
  sampleCardTitles: ["Settings", "ChatGPT"],
  data: {
    cards: [{
      id: "card-1",
      url: "https://example.com",
      title: "Example",
      shortDesc: "A saved website",
      fullDesc: "",
      note: "",
      abbreviation: "",
      imageUrl: "",
      categoryId: "cat-1",
      order: 0,
      createdAt: 1,
      updatedAt: 2,
    }],
    categories: [{
      id: "cat-1",
      name: "Chrome",
      icon: "Folder",
      color: "#888888",
      order: 0,
      createdAt: 1,
      updatedAt: 2,
      sectionId: "section-home",
    }],
    hiddenSites: [],
    pinnedCategoryIds: [],
    pinnedBookmarkItems: [],
    categoryWidths: {},
    categoryLayouts: {},
    visualScale: 100,
    linkOpenMode: "new-background-tab",
    sections: [{
      id: "section-home",
      name: "Home",
      order: 0,
      createdAt: 1,
      updatedAt: 2,
    }],
    activeSectionId: "section-home",
    recycleBin: [],
    warehouseCards: [],
    warehouseCategories: [],
    warehouseImportBatches: [],
    warehouseUpdatedAt: 0,
    workspaceResetAt: 0,
    localSnapshotUpdatedAt: 123,
  },
};

const manualRow = buildCloudWorkspaceSnapshotRow("user-1", sampleSnapshot, {
  kind: "manual",
  source: "header-save",
});

assert.equal(manualRow.user_id, "user-1");
assert.equal(manualRow.kind, "manual");
assert.equal(manualRow.reason, "manual-snapshot");
assert.equal(manualRow.source, "header-save");
assert.equal(manualRow.day_key, null);
assert.deepEqual(manualRow.counts, sampleSnapshot.counts);
assert.deepEqual(manualRow.data, sampleSnapshot.data);
assert.equal(shouldReplaceCloudWorkspaceSnapshot("manual"), false);

const systemRow = buildCloudWorkspaceSnapshotRow("user-1", sampleSnapshot, {
  kind: "system",
  source: "auto-local-change",
});

assert.equal(systemRow.kind, "system");
assert.equal(systemRow.day_key, "2026-05-18");
assert.equal(shouldReplaceCloudWorkspaceSnapshot("system"), true);
assert.equal(cloudWorkspaceSnapshotDayKey(sampleSnapshot.createdAt), "2026-05-18");

const mapped = mapCloudWorkspaceSnapshotRow({
  ...systemRow,
  id: "cloud-1",
  created_at: "2026-05-18T07:30:00.000Z",
  updated_at: "2026-05-18T07:30:00.000Z",
});

assert.equal(mapped.id, "cloud-1");
assert.equal(mapped.kind, "system");
assert.equal(mapped.source, "cloud");
assert.equal(mapped.createdAt, sampleSnapshot.createdAt);
assert.equal(mapped.label, sampleSnapshot.label);
assert.deepEqual(mapped.data, sampleSnapshot.data);

console.log("cloud snapshot contract tests passed");

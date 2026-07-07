import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUTO_SYNC_INTERVAL_MS,
  buildSafetySnapshotHash,
  CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS,
  shouldUploadCloudSafetySnapshot,
} from "../src/lib/auth-store";
import type { LocalSnapshotEntry } from "../src/lib/local-snapshots";

const baseSnapshot: LocalSnapshotEntry = {
  id: "snapshot-throttle",
  createdAt: 1_777_200_000_000,
  reason: "auto-local-change",
  label: "本地修改自动版本",
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
  sampleCategoryNames: ["收集箱"],
  sampleCardTitles: ["Example"],
  data: {
    cards: [{
      id: "card-1",
      url: "https://example.com",
      title: "Example",
      shortDesc: "",
      fullDesc: "",
      note: "",
      abbreviation: "EX",
      imageUrl: "",
      categoryId: "cat-inbox",
      order: 0,
      createdAt: 1,
      updatedAt: 2,
    }],
    categories: [{
      id: "cat-inbox",
      name: "收集箱",
      icon: "inbox",
      color: "#888888",
      order: 99,
      createdAt: 1,
      updatedAt: 2,
      sectionId: "section-default",
    }],
    hiddenSites: [],
    pinnedCategoryIds: [],
    pinnedBookmarkItems: [],
    categoryWidths: {},
    visualScale: 100,
    linkOpenMode: "new-background-tab",
    sections: [{
      id: "section-default",
      name: "主页",
      order: 0,
      createdAt: 1,
      updatedAt: 2,
    }],
    activeSectionId: "section-default",
    recycleBin: [],
    warehouseCards: [],
    warehouseCategories: [],
    warehouseImportBatches: [],
    warehouseUpdatedAt: 0,
    workspaceResetAt: 0,
    localSnapshotUpdatedAt: 2,
  },
};

const changedSnapshot: LocalSnapshotEntry = {
  ...baseSnapshot,
  data: {
    ...baseSnapshot.data,
    cards: [{
      ...baseSnapshot.data.cards[0],
      title: "Changed",
      updatedAt: 3,
    }],
  },
};

assert.equal(AUTO_SYNC_INTERVAL_MS, 10 * 60 * 1000, "background polling should run every 10 minutes");
assert.equal(CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS, 30 * 60 * 1000);

const baseHash = buildSafetySnapshotHash(baseSnapshot);
const sameHash = buildSafetySnapshotHash({ ...baseSnapshot, id: "snapshot-copy", createdAt: baseSnapshot.createdAt + 1 });
const changedHash = buildSafetySnapshotHash(changedSnapshot);

assert.equal(baseHash, sameHash, "snapshot hash should ignore entry id and createdAt metadata");
assert.notEqual(baseHash, changedHash, "snapshot hash should change when workspace data changes");
assert.equal(shouldUploadCloudSafetySnapshot(1_000, baseHash, 0, ""), true);
assert.equal(
  shouldUploadCloudSafetySnapshot(1_000 + 60_000, changedHash, 1_000, baseHash),
  false,
  "changed snapshots should still respect the 30 minute cloud upload throttle"
);
assert.equal(
  shouldUploadCloudSafetySnapshot(1_000 + CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS + 1, baseHash, 1_000, baseHash),
  false,
  "same snapshot content should not be uploaded again even after the throttle window"
);
assert.equal(
  shouldUploadCloudSafetySnapshot(1_000 + CLOUD_SAFETY_SNAPSHOT_MIN_INTERVAL_MS + 1, changedHash, 1_000, baseHash),
  true,
  "changed snapshot content can upload after the throttle window"
);

const authSource = readFileSync("src/lib/auth-store.ts", "utf8");
assert.ok(authSource.includes("createLocalDataSnapshot(\"auto-local-change\""), "local safety snapshots should still be created");
assert.ok(authSource.includes("maybeUploadCloudSafetySnapshot"), "cloud snapshot upload should pass through the throttle gate");

console.log("background sync throttle tests passed");

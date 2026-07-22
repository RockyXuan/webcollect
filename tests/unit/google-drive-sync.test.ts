import { describe, expect, it } from "vitest";
import { sha256Hex, stableJsonStringify } from "@/lib/content-hash";
import { mergeDriveWorkspaceEnvelopes } from "@/lib/drive-sync-engine";
import {
  createDriveWorkspaceEnvelope,
  driveSnapshotFileName,
  validateDriveWorkspaceEnvelope,
} from "@/lib/google-drive-sync";
import type { DriveWorkspaceEnvelopeV1, DriveWorkspacePayloadV1 } from "@/lib/drive-types";
import type { Category, SavedTabPack, WebCard } from "@/lib/types";
import { DEFAULT_WALLPAPER_PREFS } from "@/lib/wallpaper-sources";
import { toWallpaperSyncedSettings } from "@/lib/wallpaper-db";

function category(id: string, revision: number, deviceId: string): Category {
  return {
    id,
    name: id,
    icon: "folder",
    color: "#888888",
    order: 0,
    createdAt: 1,
    updatedAt: revision,
    sectionId: "section-default",
    syncRevision: revision,
    syncDeviceId: deviceId,
  };
}

function card(id: string, categoryId: string, revision: number, deviceId: string): WebCard {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: id,
    imageUrl: "",
    categoryId,
    order: 0,
    createdAt: 1,
    updatedAt: revision,
    syncRevision: revision,
    syncDeviceId: deviceId,
  };
}

function payload(deviceId: string): DriveWorkspacePayloadV1 {
  return {
    cards: [],
    categories: [],
    hiddenSites: [],
    pinnedCategoryIds: [],
    pinnedBookmarkItems: [],
    pinnedBookmarkItemsUpdatedAt: 0,
    categoryWidths: {},
    categoryLayouts: {},
    visualScale: 100,
    linkOpenMode: "new-background-tab",
    searchEngine: "google",
    sections: [{ id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 }],
    activeSectionId: "section-default",
    recycleBin: [],
    warehouseCards: [],
    warehouseCategories: [],
    warehouseImportBatches: [],
    warehouseUpdatedAt: 0,
    wallpaperPrefs: toWallpaperSyncedSettings(DEFAULT_WALLPAPER_PREFS),
    workspaceResetAt: 0,
    localSnapshotUpdatedAt: 1,
    syncTombstones: [],
    syncPreferenceRevisions: {
      collectionSections: { syncRevision: 1, syncDeviceId: deviceId },
      activeCollectionSectionId: { syncRevision: 1, syncDeviceId: deviceId },
    },
  };
}

async function envelope(deviceId: string, data: DriveWorkspacePayloadV1): Promise<DriveWorkspaceEnvelopeV1> {
  return createDriveWorkspaceEnvelope(deviceId, data);
}

function savedTabPack(id: string, revision: number, deviceId: string, deletedAt?: number): SavedTabPack {
  return {
    id,
    name: id,
    icon: "layers",
    color: "#4A6FA5",
    order: 0,
    items: [{
      id: `${id}-item`,
      url: `https://example.com/${id}`,
      title: id,
      order: 0,
      addedAt: 1,
    }],
    createdAt: 1,
    updatedAt: deletedAt || revision,
    ...(deletedAt ? { deletedAt } : {}),
    syncRevision: revision,
    syncDeviceId: deviceId,
  };
}

describe("Google Drive workspace merge", () => {
  it("merges concurrent device additions and keeps the newest preference", async () => {
    const left = payload("device-a");
    left.categories = [category("category-a", 2, "device-a")];
    left.cards = [card("card-a", "category-a", 3, "device-a")];
    left.linkOpenMode = "current-tab";
    left.syncPreferenceRevisions.linkOpenMode = { syncRevision: 8, syncDeviceId: "device-a" };

    const right = payload("device-b");
    right.categories = [category("category-b", 2, "device-b")];
    right.cards = [card("card-b", "category-b", 3, "device-b")];
    right.linkOpenMode = "new-active-tab";
    right.syncPreferenceRevisions.linkOpenMode = { syncRevision: 9, syncDeviceId: "device-b" };

    const merged = mergeDriveWorkspaceEnvelopes([
      await envelope("device-a", left),
      await envelope("device-b", right),
    ]);
    expect(merged.categories.map((item) => item.id)).toEqual(["category-a", "category-b"]);
    expect(merged.cards.map((item) => item.id)).toEqual(["card-a", "card-b"]);
    expect(merged.linkOpenMode).toBe("new-active-tab");
  });

  it("keeps a newer tombstone from an offline device", async () => {
    const left = payload("device-a");
    left.categories = [category("category-a", 2, "device-a")];
    left.cards = [card("card-a", "category-a", 3, "device-a")];

    const right = payload("device-b");
    right.categories = [category("category-a", 2, "device-a")];
    right.syncTombstones = [{
      entityType: "card",
      entityId: "card-a",
      deletedAt: 50,
      syncRevision: 4,
      syncDeviceId: "device-b",
    }];

    const merged = mergeDriveWorkspaceEnvelopes([
      await envelope("device-a", left),
      await envelope("device-b", right),
    ]);
    expect(merged.cards).toEqual([]);
    expect(merged.syncTombstones).toHaveLength(1);
  });

  it("does not let an older offline preference replace the newer device choice", async () => {
    const stale = payload("device-a");
    stale.visualScale = 80;
    stale.syncPreferenceRevisions.visualScale = { syncRevision: 4, syncDeviceId: "device-a" };

    const current = payload("device-b");
    current.visualScale = 120;
    current.syncPreferenceRevisions.visualScale = { syncRevision: 5, syncDeviceId: "device-b" };

    const merged = mergeDriveWorkspaceEnvelopes([
      await envelope("device-a", stale),
      await envelope("device-b", current),
    ]);
    expect(merged.visualScale).toBe(120);
  });

  it("keeps additive tag packs when merging with a legacy payload that has no tag-pack fields", async () => {
    const legacy = payload("legacy-device");
    const current = payload("current-device");
    current.savedTabPacks = [savedTabPack("pack-current", 4, "current-device")];
    current.tabPackOpenMode = "first-active";
    current.syncPreferenceRevisions.savedTabPacks = { syncRevision: 4, syncDeviceId: "current-device" };
    current.syncPreferenceRevisions.tabPackOpenMode = { syncRevision: 5, syncDeviceId: "current-device" };

    const merged = mergeDriveWorkspaceEnvelopes([
      await envelope("legacy-device", legacy),
      await envelope("current-device", current),
    ]);

    expect(merged.savedTabPacks?.map((item) => item.id)).toEqual(["pack-current"]);
    expect(merged.tabPackOpenMode).toBe("first-active");
  });

  it("combines concurrent tag-pack additions and keeps the newer soft deletion", async () => {
    const left = payload("device-a");
    left.savedTabPacks = [
      savedTabPack("pack-a", 2, "device-a"),
      savedTabPack("pack-delete", 2, "device-a"),
    ];
    left.syncPreferenceRevisions.savedTabPacks = { syncRevision: 2, syncDeviceId: "device-a" };

    const right = payload("device-b");
    right.savedTabPacks = [
      savedTabPack("pack-b", 2, "device-b"),
      savedTabPack("pack-delete", 3, "device-b", 50),
    ];
    right.syncPreferenceRevisions.savedTabPacks = { syncRevision: 3, syncDeviceId: "device-b" };

    const merged = mergeDriveWorkspaceEnvelopes([
      await envelope("device-a", left),
      await envelope("device-b", right),
    ]);

    expect(merged.savedTabPacks?.map((item) => item.id)).toEqual(["pack-a", "pack-b", "pack-delete"]);
    expect(merged.savedTabPacks?.find((item) => item.id === "pack-delete")?.deletedAt).toBe(50);
  });

  it("stops instead of flattening a category or reviving an orphaned card", async () => {
    const left = payload("device-a");
    left.cards = [card("orphan-card", "missing-category", 3, "device-a")];
    const leftEnvelope = await envelope("device-a", left);

    expect(() => mergeDriveWorkspaceEnvelopes([
      leftEnvelope,
    ])).toThrow(/失效的分项、分类或网页引用/);
  });

  it("keeps the first device payload byte-stable when no remote device exists", async () => {
    const firstDevice = payload("device-a");
    firstDevice.categories = [
      category("category-z", 2, "device-a"),
      category("category-a", 1, "device-a"),
    ];
    firstDevice.cards = [
      card("card-z", "category-z", 2, "device-a"),
      card("card-a", "category-a", 1, "device-a"),
    ];

    const merged = mergeDriveWorkspaceEnvelopes([
      await envelope("device-a", firstDevice),
    ]);

    expect(merged).toEqual(firstDevice);
    expect(merged.categories.map((item) => item.id)).toEqual(["category-z", "category-a"]);
    expect(merged.cards.map((item) => item.id)).toEqual(["card-z", "card-a"]);

    const exactReadback = mergeDriveWorkspaceEnvelopes([
      await envelope("device-a", firstDevice),
      await envelope("device-a", structuredClone(firstDevice)),
    ]);
    expect(exactReadback).toEqual(firstDevice);
    expect(exactReadback.categories.map((item) => item.id)).toEqual(["category-z", "category-a"]);
  });

  it("stops on equal-version divergent content", async () => {
    const left = payload("device-a");
    left.categories = [category("category-a", 2, "device-a")];
    const right = payload("device-b");
    right.categories = [{ ...category("category-a", 2, "device-a"), name: "different" }];

    const leftEnvelope = await envelope("device-a", left);
    const rightEnvelope = await envelope("device-b", right);

    expect(() => mergeDriveWorkspaceEnvelopes([
      leftEnvelope,
      rightEnvelope,
    ])).toThrow(/版本号相同但内容不同/);
  });

  it("detects a corrupted workspace envelope", async () => {
    const original = await envelope("device-a", payload("device-a"));
    const corrupted = {
      ...original,
      payload: { ...original.payload, visualScale: 73 },
    };
    await expect(validateDriveWorkspaceEnvelope(corrupted)).rejects.toThrow(/校验失败/);
  });

  it("uses canonical JSON for portable content hashes", async () => {
    expect(stableJsonStringify({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
    await expect(sha256Hex({ a: 1, b: 2 })).resolves.toBe(await sha256Hex({ b: 2, a: 1 }));
  });

  it("keeps every snapshot on its immutable snapshot id", () => {
    expect(driveSnapshotFileName("snapshot-123-abc")).toBe(
      "webcollect-snapshot-v1-snapshot-123-abc.json",
    );
  });
});

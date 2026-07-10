import localforage from "localforage";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getSyncPreferenceRevisions,
  getSyncTombstones,
  saveCards,
  saveCategories,
  savePinnedCategoryIds,
} from "@/lib/db";
import {
  createLocalDataSnapshot,
  saveVersionAndClearLocalData,
} from "@/lib/local-snapshots";
import { saveWallpaperPrefs } from "@/lib/wallpaper-db";
import type { Category, WebCard } from "@/lib/types";

const now = 1_777_200_000_000;

const category: Category = {
  id: "category-snapshot",
  name: "Snapshot category",
  icon: "folder",
  color: "#4A7C59",
  order: 0,
  createdAt: now,
  updatedAt: now,
  sectionId: "section-default",
};

const card: WebCard = {
  id: "card-snapshot",
  url: "https://example.com/snapshot",
  title: "Snapshot card",
  shortDesc: "",
  fullDesc: "",
  note: "",
  abbreviation: "",
  imageUrl: "",
  categoryId: category.id,
  order: 0,
  createdAt: now,
  updatedAt: now,
};

beforeEach(async () => {
  await localforage.clear();
  await localforage.createInstance({ name: "WebCollect", storeName: "webcollect_wallpaper" }).clear();
});

describe("complete local safety snapshots", () => {
  it("captures wallpaper/sync state and versions a user-initiated clear", async () => {
    await saveCategories([category]);
    await saveCards([card]);
    await savePinnedCategoryIds([category.id]);
    await saveWallpaperPrefs({ defaultMode: "collection", autoUpdate: false });

    const snapshot = await createLocalDataSnapshot("snapshot-completeness", "Snapshot completeness", { force: true });
    expect(snapshot?.data.wallpaperPrefs?.defaultMode).toBe("collection");
    expect(snapshot?.data.syncPreferenceRevisions?.pinnedCategoryIds.syncRevision).toBeGreaterThan(0);
    expect(snapshot?.data.syncTombstones).toEqual([]);

    const pinRevisionBefore = (await getSyncPreferenceRevisions()).pinnedCategoryIds.syncRevision;
    await saveVersionAndClearLocalData();

    const tombstoneKeys = (await getSyncTombstones()).map((item) => `${item.entityType}:${item.entityId}`);
    expect(tombstoneKeys).toEqual(expect.arrayContaining([
      `card:${card.id}`,
      `category:${category.id}`,
    ]));
    expect((await getSyncPreferenceRevisions()).pinnedCategoryIds.syncRevision).toBeGreaterThan(pinRevisionBefore);
  });
});

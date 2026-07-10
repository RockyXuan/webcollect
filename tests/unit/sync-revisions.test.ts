import localforage from "localforage";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addCard,
  deleteCard,
  getCards,
  getSyncTombstones,
} from "@/lib/db";
import { compareSyncVersions } from "@/lib/sync-revisions";
import type { WebCard } from "@/lib/types";

function card(id: string): WebCard {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: id,
    imageUrl: "",
    categoryId: "category-one",
    order: 0,
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

beforeEach(async () => {
  await localforage.clear();
});

describe("Lamport sync revisions", () => {
  it("records a newer tombstone and a still-newer restore", async () => {
    await addCard(card("card-one"));
    const created = (await getCards())[0];
    expect(created.syncRevision).toBeGreaterThan(0);

    await deleteCard(created.id);
    const deleted = (await getSyncTombstones()).find((item) => item.entityId === created.id);
    expect(deleted?.entityType).toBe("card");
    expect(deleted?.syncRevision).toBeGreaterThan(created.syncRevision || 0);

    await addCard(card("card-one"));
    const restored = (await getCards())[0];
    expect(restored.syncRevision).toBeGreaterThan(deleted?.syncRevision || 0);
  });

  it("orders conflicts by revision and device ID instead of wall-clock time", () => {
    expect(compareSyncVersions(
      { syncRevision: 11, syncDeviceId: "device-a", updatedAt: 1 },
      { syncRevision: 10, syncDeviceId: "device-z", updatedAt: 9_999_999 }
    )).toBeGreaterThan(0);
    expect(compareSyncVersions(
      { syncRevision: 11, syncDeviceId: "device-b" },
      { syncRevision: 11, syncDeviceId: "device-a" }
    )).toBeGreaterThan(0);
  });
});

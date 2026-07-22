import { describe, expect, it } from "vitest";
import {
  MAX_TAB_PACK_ITEMS,
  addCardSnapshotToTabPack,
  mergeSavedTabPackSets,
  normalizeSavedTabPack,
  normalizeTabPackUrl,
  tabPackShortLabel,
} from "@/lib/tab-packs";
import type { SavedTabPack, WebCard } from "@/lib/types";

function card(overrides: Partial<WebCard> = {}): WebCard {
  return {
    id: "card-source",
    url: "https://example.com/tool#details",
    title: "原始网页",
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: "原",
    imageUrl: "https://example.com/favicon.ico",
    categoryId: "category-source",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function pack(overrides: Partial<SavedTabPack> = {}): SavedTabPack {
  return {
    id: "pack-one",
    name: "视频制作",
    icon: "layers",
    color: "#4A6FA5",
    order: 0,
    items: [],
    createdAt: 1,
    updatedAt: 1,
    syncRevision: 1,
    syncDeviceId: "device-a",
    ...overrides,
  };
}

describe("saved tab packs", () => {
  it("copies a fixed card snapshot instead of retaining a live card reference", () => {
    const source = card();
    const updatedPack = addCardSnapshotToTabPack(pack(), source, 10);

    source.title = "后来修改的标题";
    source.url = "https://changed.example.com";
    source.imageUrl = "";

    expect(updatedPack.items[0]).toMatchObject({
      sourceCardId: "card-source",
      title: "原始网页",
      url: "https://example.com/tool",
      iconUrl: "https://example.com/favicon.ico",
    });
  });

  it("normalizes URLs, prevents duplicates, and caps one pack at fifty items", () => {
    expect(normalizeTabPackUrl("HTTPS://Example.COM:443/path#one"))
      .toBe("https://example.com/path");

    let current = addCardSnapshotToTabPack(pack(), card(), 10);
    current = addCardSnapshotToTabPack(current, card({ id: "duplicate", url: "https://example.com/tool#other" }), 11);
    expect(current.items).toHaveLength(1);

    for (let index = 0; index < MAX_TAB_PACK_ITEMS + 5; index += 1) {
      current = addCardSnapshotToTabPack(current, card({
        id: `card-${index}`,
        url: `https://example.com/tool-${index}`,
        title: `网页 ${index}`,
      }), 20 + index);
    }
    expect(current.items).toHaveLength(MAX_TAB_PACK_ITEMS);
  });

  it("merges different packs and lets a newer soft deletion win", () => {
    const left = pack({ id: "pack-left", syncRevision: 2, syncDeviceId: "device-a" });
    const oldRight = pack({ id: "pack-right", name: "旧名称", syncRevision: 2, syncDeviceId: "device-b" });
    const deletedRight = pack({
      id: "pack-right",
      name: "旧名称",
      deletedAt: 50,
      updatedAt: 50,
      syncRevision: 3,
      syncDeviceId: "device-c",
    });

    const merged = mergeSavedTabPackSets([[left, oldRight], [deletedRight]]);
    expect(merged.map((item) => item.id)).toEqual(["pack-left", "pack-right"]);
    expect(merged.find((item) => item.id === "pack-right")?.deletedAt).toBe(50);
  });

  it("rejects equal-version divergent records instead of guessing", () => {
    expect(() => mergeSavedTabPackSets([
      [pack()],
      [pack({ name: "内容冲突" })],
    ])).toThrow(/版本相同但内容不同/);
  });

  it("normalizes corrupt or duplicate item data without losing valid snapshots", () => {
    const normalized = normalizeSavedTabPack({
      ...pack(),
      items: [
        { id: "one", url: "https://example.com/a#one", title: "A", order: 3, addedAt: 2 },
        { id: "two", url: "https://example.com/a#two", title: "重复", order: 2, addedAt: 3 },
        { id: "bad", url: "javascript:alert(1)", title: "无效", order: 1, addedAt: 1 },
      ],
    });
    expect(normalized?.items).toHaveLength(1);
    expect(normalized?.items[0]?.url).toBe("https://example.com/a");
  });

  it("uses at most two visible characters in the compact shelf", () => {
    expect(tabPackShortLabel("AI 视频制作")).toBe("AI");
    expect(tabPackShortLabel("剪辑")).toBe("剪辑");
    expect(tabPackShortLabel(" 🎬 组 ")).toBe("🎬组");
  });
});

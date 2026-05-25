import assert from "node:assert/strict";
import type { PinnedBookmarkItem, WebCard } from "../src/lib/types";
import {
  resolvePinnedBookmarkCards,
  reorderPinnedBookmarkItems,
  togglePinnedBookmarkItem,
  updatePinnedBookmarkItem,
} from "../src/lib/pinned-bookmarks";

const now = 1_700_000_000_000;

const cards: WebCard[] = [
  {
    id: "card-a",
    url: "https://a.example.com",
    title: "Alpha",
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: "A",
    imageUrl: "",
    categoryId: "cat",
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "card-b",
    url: "https://b.example.com",
    title: "Beta",
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: "B",
    imageUrl: "",
    categoryId: "cat",
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
];

let items: PinnedBookmarkItem[] = [];
items = togglePinnedBookmarkItem(items, "card-a", now);
assert.equal(items.length, 1);
assert.equal(items[0].cardId, "card-a");
assert.equal(items[0].displayMode, "icon");

items = togglePinnedBookmarkItem(items, "card-a", now + 1);
assert.equal(items.length, 0, "toggling the same card removes it");

items = togglePinnedBookmarkItem([], "card-a", now);
items = togglePinnedBookmarkItem(items, "card-b", now + 10);
items = [...items, { ...items[0], id: "duplicate-a", order: 99, updatedAt: now + 20 }];
items = reorderPinnedBookmarkItems(items, items.map((item) => item.id), now + 30);
assert.deepEqual(items.map((item) => item.cardId), ["card-a", "card-b"], "duplicate pins are ignored");

items = updatePinnedBookmarkItem(items, { ...items[0], displayMode: "label", customLabel: "AA" });
assert.equal(items[0].displayMode, "label");
assert.equal(items[0].customLabel, "AA");

items = reorderPinnedBookmarkItems(items, [items[1].id, items[0].id], now + 30);
assert.deepEqual(items.map((item) => item.cardId), ["card-b", "card-a"]);
assert.deepEqual(items.map((item) => item.order), [0, 1]);

const resolved = resolvePinnedBookmarkCards(
  [...items, { ...items[0], id: "missing", cardId: "missing-card", order: -1 }],
  cards
);
assert.deepEqual(resolved.map((entry) => entry.card.id), ["card-b", "card-a"]);

console.log("pinned-bookmarks tests passed");

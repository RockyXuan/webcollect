import type { PinnedBookmarkItem, WebCard } from "./types";

export interface ResolvedPinnedBookmark {
  item: PinnedBookmarkItem;
  card: WebCard;
}

export function normalizePinnedBookmarkItems(items: PinnedBookmarkItem[]): PinnedBookmarkItem[] {
  const byCardId = new Map<string, PinnedBookmarkItem>();
  for (const item of items) {
    if (!item.cardId) continue;
    const existing = byCardId.get(item.cardId);
    if (!existing || item.order < existing.order || (item.order === existing.order && item.updatedAt > existing.updatedAt)) {
      byCardId.set(item.cardId, {
        ...item,
        displayMode: normalizeDisplayMode(item.displayMode),
      });
    }
  }

  return [...byCardId.values()]
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .map((item, order) => ({ ...item, order }));
}

export function togglePinnedBookmarkItem(
  items: PinnedBookmarkItem[],
  cardId: string,
  now = Date.now()
): PinnedBookmarkItem[] {
  const normalized = normalizePinnedBookmarkItems(items);
  const existing = normalized.find((item) => item.cardId === cardId);
  if (existing) {
    return normalizePinnedBookmarkItems(normalized.filter((item) => item.id !== existing.id));
  }

  return normalizePinnedBookmarkItems([
    ...normalized,
    {
      id: `pin-${now}-${cardId}`,
      cardId,
      order: normalized.length,
      displayMode: "icon",
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export function updatePinnedBookmarkItem(
  items: PinnedBookmarkItem[],
  nextItem: PinnedBookmarkItem,
  now = Date.now()
): PinnedBookmarkItem[] {
  return normalizePinnedBookmarkItems(
    items.map((item) =>
      item.id === nextItem.id
        ? {
            ...item,
            ...nextItem,
            customLabel: sanitizeBookmarkLabel(nextItem.customLabel),
            displayMode: normalizeDisplayMode(nextItem.displayMode),
            updatedAt: now,
          }
        : item
    )
  );
}

export function reorderPinnedBookmarkItems(
  items: PinnedBookmarkItem[],
  orderedIds: string[],
  now = Date.now()
): PinnedBookmarkItem[] {
  const byId = new Map(normalizePinnedBookmarkItems(items).map((item) => [item.id, item]));
  const ordered: PinnedBookmarkItem[] = [];
  const used = new Set<string>();

  for (const id of orderedIds) {
    const item = byId.get(id);
    if (!item || used.has(id)) continue;
    used.add(id);
    ordered.push(item);
  }

  for (const item of byId.values()) {
    if (!used.has(item.id)) ordered.push(item);
  }

  return ordered.map((item, order) => ({
    ...item,
    order,
    updatedAt: item.order === order ? item.updatedAt : now,
  }));
}

export function resolvePinnedBookmarkCards(
  items: PinnedBookmarkItem[],
  cards: WebCard[]
): ResolvedPinnedBookmark[] {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  return normalizePinnedBookmarkItems(items)
    .map((item) => {
      const card = cardById.get(item.cardId);
      return card ? { item, card } : null;
    })
    .filter((entry): entry is ResolvedPinnedBookmark => entry !== null);
}

export function getPinnedBookmarkLabel(item: PinnedBookmarkItem, card: WebCard): string {
  const custom = sanitizeBookmarkLabel(item.customLabel);
  if (custom) return custom;
  return card.abbreviation || card.title?.slice(0, 2) || "?";
}

function normalizeDisplayMode(value: unknown): PinnedBookmarkItem["displayMode"] {
  return value === "label" || value === "both" || value === "icon" ? value : "icon";
}

function sanitizeBookmarkLabel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 8) : undefined;
}

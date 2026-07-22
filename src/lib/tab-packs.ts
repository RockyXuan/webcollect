import { stableJsonStringify } from "@/lib/content-hash";
import { compareSyncVersions } from "@/lib/sync-revisions";
import type { SavedTabPack, SavedTabPackItem, TabPackOpenMode, WebCard } from "@/lib/types";

export const DEFAULT_TAB_PACK_OPEN_MODE: TabPackOpenMode = "all-background";
export const MAX_TAB_PACK_ITEMS = 50;
export const TAB_PACK_CONFIRM_THRESHOLD = 10;
export const DEFAULT_TAB_PACK_ICON = "layers";
export const DEFAULT_TAB_PACK_COLOR = "#4A6FA5";

export function isTabPackOpenMode(value: unknown): value is TabPackOpenMode {
  return value === "all-background" || value === "first-active";
}

export function normalizeTabPackUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    if ((parsed.protocol === "https:" && parsed.port === "443")
      || (parsed.protocol === "http:" && parsed.port === "80")) {
      parsed.port = "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeTabPackItem(value: unknown, index: number): SavedTabPackItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<SavedTabPackItem>;
  const url = normalizeTabPackUrl(cleanText(raw.url));
  if (!url) return null;
  const now = Date.now();
  return {
    id: cleanText(raw.id) || `tab-pack-item-${now}-${index}`,
    ...(cleanText(raw.sourceCardId) ? { sourceCardId: cleanText(raw.sourceCardId) } : {}),
    url,
    title: cleanText(raw.title) || new URL(url).hostname,
    ...(cleanText(raw.iconUrl) ? { iconUrl: cleanText(raw.iconUrl) } : {}),
    order: Math.max(0, Math.floor(finiteNumber(raw.order, index))),
    addedAt: Math.max(0, finiteNumber(raw.addedAt, now)),
  };
}

export function normalizeSavedTabPack(value: unknown, index = 0): SavedTabPack | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<SavedTabPack>;
  const id = cleanText(raw.id);
  const name = cleanText(raw.name);
  if (!id || !name) return null;
  const now = Date.now();
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeTabPackItem).filter((item): item is SavedTabPackItem => Boolean(item))
    : [];
  const seenUrls = new Set<string>();
  const dedupedItems = items
    .sort((left, right) => left.order - right.order || left.addedAt - right.addedAt || left.id.localeCompare(right.id))
    .filter((item) => {
      const key = normalizeTabPackUrl(item.url);
      if (!key || seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    })
    .slice(0, MAX_TAB_PACK_ITEMS)
    .map((item, order) => ({ ...item, order }));
  const deletedAt = finiteNumber(raw.deletedAt, 0);
  return {
    id,
    name,
    icon: cleanText(raw.icon) || DEFAULT_TAB_PACK_ICON,
    color: cleanText(raw.color) || DEFAULT_TAB_PACK_COLOR,
    order: Math.max(0, Math.floor(finiteNumber(raw.order, index))),
    items: dedupedItems,
    createdAt: Math.max(0, finiteNumber(raw.createdAt, now)),
    updatedAt: Math.max(0, finiteNumber(raw.updatedAt, now)),
    ...(deletedAt > 0 ? { deletedAt } : {}),
    syncRevision: Math.max(0, Math.floor(finiteNumber(raw.syncRevision, 0))),
    syncDeviceId: cleanText(raw.syncDeviceId),
  };
}

export function normalizeSavedTabPacks(value: unknown): SavedTabPack[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SavedTabPack>();
  value.forEach((raw, index) => {
    const pack = normalizeSavedTabPack(raw, index);
    if (!pack) return;
    const current = byId.get(pack.id);
    if (!current || compareSyncVersions(pack, current) > 0) byId.set(pack.id, pack);
  });
  return [...byId.values()].sort((left, right) =>
    left.order - right.order || left.createdAt - right.createdAt || left.id.localeCompare(right.id)
  );
}

export function visibleSavedTabPacks(packs: readonly SavedTabPack[]): SavedTabPack[] {
  return packs.filter((pack) => !pack.deletedAt).sort((left, right) =>
    left.order - right.order || left.createdAt - right.createdAt || left.id.localeCompare(right.id)
  );
}

export function createSavedTabPackItem(card: WebCard, order: number, now = Date.now()): SavedTabPackItem | null {
  const url = normalizeTabPackUrl(card.url);
  if (!url) return null;
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `tab-pack-item-${crypto.randomUUID()}`
      : `tab-pack-item-${now}-${Math.random().toString(36).slice(2, 9)}`,
    sourceCardId: card.id,
    url,
    title: card.title.trim() || new URL(url).hostname,
    ...(card.imageUrl.trim() ? { iconUrl: card.imageUrl.trim() } : {}),
    order,
    addedAt: now,
  };
}

export function addCardSnapshotToTabPack(pack: SavedTabPack, card: WebCard, now = Date.now()): SavedTabPack {
  const item = createSavedTabPackItem(card, pack.items.length, now);
  if (!item) return pack;
  const itemKey = normalizeTabPackUrl(item.url);
  if (pack.items.some((existing) => normalizeTabPackUrl(existing.url) === itemKey)) return pack;
  if (pack.items.length >= MAX_TAB_PACK_ITEMS) return pack;
  return { ...pack, items: [...pack.items, item], updatedAt: now };
}

export function tabPackShortLabel(name: string): string {
  return Array.from(name.trim()).filter((character) => !/\s/u.test(character)).slice(0, 2).join("") || "组";
}

/** Merge only records from payloads that explicitly carry the additive field. */
export function mergeSavedTabPackSets(packSets: readonly SavedTabPack[][]): SavedTabPack[] {
  const byId = new Map<string, SavedTabPack>();
  for (const packs of packSets) {
    for (const pack of normalizeSavedTabPacks(packs)) {
      const current = byId.get(pack.id);
      if (!current) {
        byId.set(pack.id, pack);
        continue;
      }
      const comparison = compareSyncVersions(pack, current);
      if (comparison > 0) byId.set(pack.id, pack);
      if (comparison === 0 && stableJsonStringify(pack) !== stableJsonStringify(current)) {
        throw new Error(`云端标签组版本相同但内容不同：${pack.id}。已停止合并。`);
      }
    }
  }
  return normalizeSavedTabPacks([...byId.values()]);
}

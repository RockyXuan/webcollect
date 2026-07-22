import { create } from "zustand";
import {
  getSavedTabPacks,
  getTabPackOpenMode,
  mutateSavedTabPacks,
  saveTabPackOpenMode,
} from "@/lib/db";
import {
  DEFAULT_TAB_PACK_COLOR,
  DEFAULT_TAB_PACK_ICON,
  addCardSnapshotToTabPack,
  createSavedTabPackItem,
  visibleSavedTabPacks,
} from "@/lib/tab-packs";
import type { SavedTabPack, TabPackOpenMode, WebCard } from "@/lib/types";

interface CreateTabPackInput {
  name: string;
  icon?: string;
  color?: string;
  cards?: WebCard[];
}

interface UpdateTabPackInput {
  name?: string;
  icon?: string;
  color?: string;
}

interface TabPackState {
  packs: SavedTabPack[];
  openMode: TabPackOpenMode;
  isLoaded: boolean;
  loadData: () => Promise<void>;
  createPack: (input: CreateTabPackInput) => Promise<SavedTabPack>;
  updatePack: (packId: string, input: UpdateTabPackInput) => Promise<void>;
  addCard: (packId: string, card: WebCard) => Promise<void>;
  removeItem: (packId: string, itemId: string) => Promise<void>;
  reorderItems: (packId: string, orderedItemIds: string[]) => Promise<void>;
  reorderPacks: (orderedPackIds: string[]) => Promise<void>;
  deletePack: (packId: string) => Promise<void>;
  setOpenMode: (mode: TabPackOpenMode) => Promise<void>;
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function visible(packs: SavedTabPack[]): SavedTabPack[] {
  return visibleSavedTabPacks(packs);
}

export const useTabPackStore = create<TabPackState>((set) => ({
  packs: [],
  openMode: "all-background",
  isLoaded: false,

  loadData: async () => {
    const [packs, openMode] = await Promise.all([getSavedTabPacks(), getTabPackOpenMode()]);
    set({ packs: visible(packs), openMode, isLoaded: true });
  },

  createPack: async (input) => {
    const name = input.name.trim();
    if (!name) throw new Error("请输入标签组名称。");
    const now = Date.now();
    let created: SavedTabPack | null = null;
    const persisted = await mutateSavedTabPacks((current) => {
      const active = visible(current);
      const items = (input.cards || [])
        .map((card, index) => createSavedTabPackItem(card, index, now))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      created = {
        id: makeId("tab-pack"),
        name,
        icon: input.icon || DEFAULT_TAB_PACK_ICON,
        color: input.color || DEFAULT_TAB_PACK_COLOR,
        order: active.length > 0 ? Math.max(...active.map((pack) => pack.order)) + 1 : 0,
        items,
        createdAt: now,
        updatedAt: now,
        syncRevision: 0,
        syncDeviceId: "",
      };
      return [...current, created];
    });
    const saved = persisted.find((pack) => pack.id === created?.id);
    if (!saved) throw new Error("标签组保存失败，请重试。");
    set({ packs: visible(persisted) });
    return saved;
  },

  updatePack: async (packId, input) => {
    const persisted = await mutateSavedTabPacks((current) => current.map((pack) => {
      if (pack.id !== packId || pack.deletedAt) return pack;
      const nextName = input.name === undefined ? pack.name : input.name.trim();
      if (!nextName) return pack;
      return {
        ...pack,
        name: nextName,
        icon: input.icon?.trim() || pack.icon,
        color: input.color?.trim() || pack.color,
        updatedAt: Date.now(),
      };
    }));
    set({ packs: visible(persisted) });
  },

  addCard: async (packId, card) => {
    const persisted = await mutateSavedTabPacks((current) => current.map((pack) =>
      pack.id === packId && !pack.deletedAt ? addCardSnapshotToTabPack(pack, card) : pack
    ));
    set({ packs: visible(persisted) });
  },

  removeItem: async (packId, itemId) => {
    const now = Date.now();
    const persisted = await mutateSavedTabPacks((current) => current.map((pack) => {
      if (pack.id !== packId || pack.deletedAt) return pack;
      const items = pack.items
        .filter((item) => item.id !== itemId)
        .map((item, order) => ({ ...item, order }));
      if (items.length === pack.items.length) return pack;
      return { ...pack, items, updatedAt: now };
    }));
    set({ packs: visible(persisted) });
  },

  reorderItems: async (packId, orderedItemIds) => {
    const persisted = await mutateSavedTabPacks((current) => current.map((pack) => {
      if (pack.id !== packId || pack.deletedAt) return pack;
      const byId = new Map(pack.items.map((item) => [item.id, item]));
      const seen = new Set<string>();
      const ordered = orderedItemIds.flatMap((id) => {
        const item = byId.get(id);
        if (!item || seen.has(id)) return [];
        seen.add(id);
        return [item];
      });
      const items = [...ordered, ...pack.items.filter((item) => !seen.has(item.id))]
        .map((item, order) => ({ ...item, order }));
      return { ...pack, items, updatedAt: Date.now() };
    }));
    set({ packs: visible(persisted) });
  },

  reorderPacks: async (orderedPackIds) => {
    const rank = new Map(orderedPackIds.map((id, index) => [id, index]));
    const persisted = await mutateSavedTabPacks((current) => {
      const active = visible(current).sort((left, right) => {
        const leftRank = rank.get(left.id);
        const rightRank = rank.get(right.id);
        if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
        if (leftRank !== undefined) return -1;
        if (rightRank !== undefined) return 1;
        return left.order - right.order;
      });
      const activeById = new Map(active.map((pack, order) => [pack.id, { ...pack, order, updatedAt: Date.now() }]));
      return current.map((pack) => activeById.get(pack.id) || pack);
    });
    set({ packs: visible(persisted) });
  },

  deletePack: async (packId) => {
    const now = Date.now();
    const persisted = await mutateSavedTabPacks((current) => current.map((pack) =>
      pack.id === packId && !pack.deletedAt
        ? { ...pack, deletedAt: now, updatedAt: now }
        : pack
    ));
    set({ packs: visible(persisted) });
  },

  setOpenMode: async (mode) => {
    await saveTabPackOpenMode(mode);
    set({ openMode: mode });
  },
}));

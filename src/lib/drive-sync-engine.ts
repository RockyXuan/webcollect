import { compareSyncVersions } from "@/lib/sync-revisions";
import type { SyncPreferenceRevisions, SyncTombstone } from "@/lib/types";
import type { DriveWorkspaceEnvelopeV1, DriveWorkspacePayloadV1 } from "@/lib/drive-types";
import { stableJsonStringify } from "@/lib/content-hash";

type SyncEntity = {
  id: string;
  syncRevision?: number;
  syncDeviceId?: string;
  updatedAt?: number;
  createdAt?: number;
};

const PREFERENCE_KEYS = [
  "hiddenSites",
  "pinnedCategoryIds",
  "pinnedBookmarkItems",
  "pinnedBookmarkItemsUpdatedAt",
  "categoryWidths",
  "categoryLayouts",
  "visualScale",
  "linkOpenMode",
  "searchEngine",
  "collectionSections",
  "activeCollectionSectionId",
  "recycleBin",
  "warehouseCards",
  "warehouseCategories",
  "warehouseImportBatches",
  "warehouseUpdatedAt",
  "wallpaperPrefs",
  "currentWorkspaceResetAt",
] as const;

type PreferenceKey = typeof PREFERENCE_KEYS[number];

const PAYLOAD_PROPERTY_BY_PREFERENCE: Record<PreferenceKey, keyof DriveWorkspacePayloadV1> = {
  hiddenSites: "hiddenSites",
  pinnedCategoryIds: "pinnedCategoryIds",
  pinnedBookmarkItems: "pinnedBookmarkItems",
  pinnedBookmarkItemsUpdatedAt: "pinnedBookmarkItemsUpdatedAt",
  categoryWidths: "categoryWidths",
  categoryLayouts: "categoryLayouts",
  visualScale: "visualScale",
  linkOpenMode: "linkOpenMode",
  searchEngine: "searchEngine",
  collectionSections: "sections",
  activeCollectionSectionId: "activeSectionId",
  recycleBin: "recycleBin",
  warehouseCards: "warehouseCards",
  warehouseCategories: "warehouseCategories",
  warehouseImportBatches: "warehouseImportBatches",
  warehouseUpdatedAt: "warehouseUpdatedAt",
  wallpaperPrefs: "wallpaperPrefs",
  currentWorkspaceResetAt: "workspaceResetAt",
};

function newestTombstones(envelopes: readonly DriveWorkspaceEnvelopeV1[]): SyncTombstone[] {
  const byKey = new Map<string, SyncTombstone>();
  for (const envelope of envelopes) {
    for (const item of envelope.payload.syncTombstones) {
      const key = `${item.entityType}:${item.entityId}`;
      const current = byKey.get(key);
      if (!current || compareSyncVersions(item, current) > 0) byKey.set(key, item);
    }
  }
  return [...byKey.values()].sort((left, right) =>
    `${left.entityType}:${left.entityId}`.localeCompare(`${right.entityType}:${right.entityId}`)
  );
}

function mergeEntities<T extends SyncEntity>(
  envelopes: readonly DriveWorkspaceEnvelopeV1[],
  read: (payload: DriveWorkspacePayloadV1) => T[],
  tombstones: readonly SyncTombstone[],
  entityType: "card" | "category"
): T[] {
  const byId = new Map<string, T>();
  for (const envelope of envelopes) {
    for (const item of read(envelope.payload)) {
      const current = byId.get(item.id);
      if (!current) {
        byId.set(item.id, item);
        continue;
      }
      const comparison = compareSyncVersions(item, current);
      if (comparison > 0) byId.set(item.id, item);
      if (comparison === 0 && stableJsonStringify(item) !== stableJsonStringify(current)) {
        throw new Error(`云端存在版本号相同但内容不同的 ${entityType}：${item.id}。已停止合并。`);
      }
    }
  }
  const tombstoneById = new Map(
    tombstones.filter((item) => item.entityType === entityType).map((item) => [item.entityId, item])
  );
  return [...byId.values()]
    .filter((item) => {
      const deleted = tombstoneById.get(item.id);
      return !deleted || compareSyncVersions(item, deleted) > 0;
    })
    .sort((left, right) => {
      const leftOrder = "order" in left && typeof left.order === "number" ? left.order : 0;
      const rightOrder = "order" in right && typeof right.order === "number" ? right.order : 0;
      return leftOrder - rightOrder || left.id.localeCompare(right.id);
    });
}

function preferenceFallbackTime(payload: DriveWorkspacePayloadV1, key: PreferenceKey): number {
  switch (key) {
    case "hiddenSites":
      return Math.max(0, ...payload.hiddenSites.map((item) => item.hiddenAt));
    case "pinnedBookmarkItems":
    case "pinnedBookmarkItemsUpdatedAt":
      return payload.pinnedBookmarkItemsUpdatedAt;
    case "categoryLayouts":
      return Math.max(0, ...Object.values(payload.categoryLayouts).map((item) => item.updatedAt));
    case "collectionSections":
      return Math.max(0, ...payload.sections.map((item) => item.updatedAt));
    case "recycleBin":
      return Math.max(0, ...payload.recycleBin.map((item) => item.deletedAt));
    case "warehouseCards":
    case "warehouseCategories":
    case "warehouseImportBatches":
    case "warehouseUpdatedAt":
      return payload.warehouseUpdatedAt;
    case "wallpaperPrefs":
      return payload.wallpaperPrefs.settingsUpdatedAt;
    case "currentWorkspaceResetAt":
      return payload.workspaceResetAt;
    default:
      return payload.localSnapshotUpdatedAt;
  }
}

function preferenceVersion(
  envelope: DriveWorkspaceEnvelopeV1,
  key: PreferenceKey
): { syncRevision: number; syncDeviceId: string; updatedAt: number } {
  const revision = envelope.payload.syncPreferenceRevisions[key];
  return {
    syncRevision: revision?.syncRevision || 0,
    syncDeviceId: revision?.syncDeviceId || "",
    updatedAt: preferenceFallbackTime(envelope.payload, key) || envelope.updatedAt,
  };
}

function mergePreferenceRevisions(
  envelopes: readonly DriveWorkspaceEnvelopeV1[]
): SyncPreferenceRevisions {
  const merged: SyncPreferenceRevisions = {};
  for (const key of PREFERENCE_KEYS) {
    let winner: DriveWorkspaceEnvelopeV1 | null = null;
    for (const envelope of envelopes) {
      if (!winner || compareSyncVersions(preferenceVersion(envelope, key), preferenceVersion(winner, key)) > 0) {
        winner = envelope;
      }
    }
    const revision = winner?.payload.syncPreferenceRevisions[key];
    if (revision) merged[key] = revision;
  }
  return merged;
}

function mergePreferences(
  envelopes: readonly DriveWorkspaceEnvelopeV1[],
  base: DriveWorkspacePayloadV1
): DriveWorkspacePayloadV1 {
  const result = { ...base } as DriveWorkspacePayloadV1;
  for (const key of PREFERENCE_KEYS) {
    let winner = envelopes[0];
    for (const envelope of envelopes.slice(1)) {
      const comparison = compareSyncVersions(preferenceVersion(envelope, key), preferenceVersion(winner, key));
      const property = PAYLOAD_PROPERTY_BY_PREFERENCE[key];
      if (comparison > 0) winner = envelope;
      if (
        comparison === 0
        && stableJsonStringify(envelope.payload[property]) !== stableJsonStringify(winner.payload[property])
      ) {
        throw new Error(`云端偏好 ${key} 版本相同但内容不同。已停止合并。`);
      }
    }
    const property = PAYLOAD_PROPERTY_BY_PREFERENCE[key];
    (result as unknown as Record<string, unknown>)[property] = winner.payload[property];
  }
  result.syncPreferenceRevisions = mergePreferenceRevisions(envelopes);
  return result;
}

export function mergeDriveWorkspaceEnvelopes(
  envelopes: readonly DriveWorkspaceEnvelopeV1[]
): DriveWorkspacePayloadV1 {
  if (envelopes.length === 0) throw new Error("没有可合并的 Google Drive 工作区文件。");
  const tombstones = newestTombstones(envelopes);
  const base = mergePreferences(envelopes, envelopes[0].payload);
  const categories = mergeEntities(envelopes, (payload) => payload.categories, tombstones, "category");
  const cards = mergeEntities(envelopes, (payload) => payload.cards, tombstones, "card");
  const categoryIds = new Set(categories.map((item) => item.id));
  const sectionIds = new Set(base.sections.map((item) => item.id));
  const orphanedCategory = categories.find((item) =>
    (item.parentId && !categoryIds.has(item.parentId))
    || (item.sectionId && !sectionIds.has(item.sectionId))
  );
  const orphanedCard = cards.find((item) => !categoryIds.has(item.categoryId));
  if (orphanedCategory || orphanedCard) {
    throw new Error("合并后的云端数据存在失效的分项、分类或网页引用。已停止写入本机。");
  }
  return {
    ...base,
    categories,
    cards,
    syncTombstones: tombstones,
    localSnapshotUpdatedAt: Math.max(...envelopes.map((item) => item.payload.localSnapshotUpdatedAt)),
  };
}


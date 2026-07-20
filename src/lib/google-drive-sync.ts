import { APP_VERSION } from "@/lib/app-version";
import type { CloudSnapshotRecord, CloudSyncProvider, CloudSyncResult } from "@/lib/cloud-sync-types";
import { sha256Hex, stableJsonStringify } from "@/lib/content-hash";
import {
  clearSyncDirtySets,
  getActiveSectionId,
  getCards,
  getCategories,
  getCategoryLayouts,
  getCategoryWidths,
  getHiddenSites,
  getLinkOpenMode,
  getLocalSnapshotUpdatedAt,
  getOrCreateSyncDeviceId,
  getPinnedBookmarkItems,
  getPinnedBookmarkItemsUpdatedAt,
  getPinnedCategoryIds,
  getRecycleBin,
  getSearchEngine,
  getSections,
  getSyncPreferenceRevisions,
  getSyncTombstones,
  getVisualScale,
  getWorkspaceResetAt,
  saveActiveSectionId,
  saveCards,
  saveCategories,
  saveCategoryLayouts,
  saveCategoryWidths,
  saveHiddenSites,
  saveLinkOpenMode,
  saveLocalSnapshotSyncedAt,
  savePinnedBookmarkItems,
  savePinnedCategoryIds,
  saveRecycleBin,
  saveSearchEngine,
  saveSections,
  saveSyncPreferenceRevisions,
  saveSyncTombstones,
  saveVisualScale,
  saveWorkspaceResetAt,
  withoutLocalChangeEvents,
} from "@/lib/db";
import {
  getImportBatches,
  getWarehouseCards,
  getWarehouseCategories,
  getWarehouseUpdatedAt,
  restoreWarehouseSyncData,
} from "@/lib/db-warehouse";
import {
  DRIVE_SNAPSHOT_SCHEMA_VERSION,
  DRIVE_WORKSPACE_SCHEMA_VERSION,
  type DriveSnapshotEnvelopeV1,
  type DriveWorkspaceEnvelopeV1,
  type DriveWorkspacePayloadV1,
} from "@/lib/drive-types";
import { mergeDriveWorkspaceEnvelopes } from "@/lib/drive-sync-engine";
import { GoogleDriveApi } from "@/lib/google-drive-api";
import {
  disconnectGoogleDrive,
  fetchGoogleDriveIdentity,
  getDriveConnectionRecord,
  updateDriveConnectionRecord,
} from "@/lib/google-drive-auth";
import { getWallpaperPrefs, saveSyncedWallpaperPrefs, toWallpaperSyncedSettings } from "@/lib/wallpaper-db";
import { withStorageLock } from "@/lib/storage-lock";

const WORKSPACE_PREFIX = "webcollect-workspace-v1-";
const SNAPSHOT_PREFIX = "webcollect-snapshot-v1-";

function withoutContentHash<T extends { contentHash: string }>(document: T): Omit<T, "contentHash"> {
  const body = { ...document } as Partial<T>;
  delete body.contentHash;
  return body as Omit<T, "contentHash">;
}

export async function hashDriveDocument<T extends { contentHash: string }>(document: T): Promise<string> {
  return sha256Hex(withoutContentHash(document));
}

export async function readCurrentDrivePayload(): Promise<DriveWorkspacePayloadV1> {
  const [
    cards,
    categories,
    hiddenSites,
    pinnedCategoryIds,
    pinnedBookmarkItems,
    pinnedBookmarkItemsUpdatedAt,
    categoryWidths,
    categoryLayouts,
    visualScale,
    linkOpenMode,
    searchEngine,
    sections,
    activeSectionId,
    recycleBin,
    warehouseCards,
    warehouseCategories,
    warehouseImportBatches,
    warehouseUpdatedAt,
    wallpaperPrefs,
    workspaceResetAt,
    localSnapshotUpdatedAt,
    syncTombstones,
    syncPreferenceRevisions,
  ] = await Promise.all([
    getCards(), getCategories(), getHiddenSites(), getPinnedCategoryIds(), getPinnedBookmarkItems(),
    getPinnedBookmarkItemsUpdatedAt(), getCategoryWidths(), getCategoryLayouts(), getVisualScale(),
    getLinkOpenMode(), getSearchEngine(), getSections(), getActiveSectionId(), getRecycleBin(),
    getWarehouseCards(), getWarehouseCategories(), getImportBatches(), getWarehouseUpdatedAt(),
    getWallpaperPrefs(), getWorkspaceResetAt(), getLocalSnapshotUpdatedAt(), getSyncTombstones(),
    getSyncPreferenceRevisions(),
  ]);
  return {
    cards,
    categories,
    hiddenSites,
    pinnedCategoryIds,
    pinnedBookmarkItems,
    pinnedBookmarkItemsUpdatedAt,
    categoryWidths,
    categoryLayouts,
    visualScale,
    linkOpenMode,
    searchEngine,
    sections,
    activeSectionId,
    recycleBin,
    warehouseCards,
    warehouseCategories,
    warehouseImportBatches,
    warehouseUpdatedAt,
    wallpaperPrefs: toWallpaperSyncedSettings(wallpaperPrefs),
    workspaceResetAt,
    localSnapshotUpdatedAt,
    syncTombstones,
    syncPreferenceRevisions,
  };
}

export async function createDriveWorkspaceEnvelope(
  deviceId: string,
  payload: DriveWorkspacePayloadV1
): Promise<DriveWorkspaceEnvelopeV1> {
  const partial = {
    schemaVersion: DRIVE_WORKSPACE_SCHEMA_VERSION,
    kind: "workspace" as const,
    appVersion: APP_VERSION,
    deviceId,
    updatedAt: payload.localSnapshotUpdatedAt || Date.now(),
    payload,
  };
  return { ...partial, contentHash: await sha256Hex(partial) };
}

export async function validateDriveWorkspaceEnvelope(
  value: unknown,
  expectedDeviceId?: string
): Promise<DriveWorkspaceEnvelopeV1> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Google Drive 工作区文件不是有效对象。");
  }
  const document = value as Partial<DriveWorkspaceEnvelopeV1>;
  if (
    document.schemaVersion !== DRIVE_WORKSPACE_SCHEMA_VERSION
    || document.kind !== "workspace"
    || typeof document.deviceId !== "string"
    || !document.payload
    || typeof document.contentHash !== "string"
  ) {
    throw new Error("Google Drive 工作区文件版本或结构不受支持。");
  }
  if (expectedDeviceId && document.deviceId !== expectedDeviceId) {
    throw new Error("Google Drive 工作区文件名与设备标识不一致。");
  }
  const calculated = await hashDriveDocument(document as DriveWorkspaceEnvelopeV1);
  if (calculated !== document.contentHash) throw new Error("Google Drive 工作区文件校验失败。");
  return document as DriveWorkspaceEnvelopeV1;
}

async function applyDrivePayload(payload: DriveWorkspacePayloadV1): Promise<void> {
  await withoutLocalChangeEvents(async () => {
    await saveSections(payload.sections);
    await saveCategories(payload.categories);
    await saveCards(payload.cards);
    await saveHiddenSites(payload.hiddenSites);
    await savePinnedCategoryIds(payload.pinnedCategoryIds);
    await savePinnedBookmarkItems(payload.pinnedBookmarkItems, payload.pinnedBookmarkItemsUpdatedAt);
    await saveCategoryWidths(payload.categoryWidths);
    await saveCategoryLayouts(payload.categoryLayouts);
    await saveVisualScale(payload.visualScale);
    await saveLinkOpenMode(payload.linkOpenMode);
    await saveSearchEngine(payload.searchEngine);
    await saveActiveSectionId(payload.activeSectionId || payload.sections[0]?.id || "section-default");
    await saveRecycleBin(payload.recycleBin);
    await restoreWarehouseSyncData({
      cards: payload.warehouseCards,
      categories: payload.warehouseCategories,
      batches: payload.warehouseImportBatches,
      updatedAt: payload.warehouseUpdatedAt,
    });
    const localWallpaper = await getWallpaperPrefs();
    await saveSyncedWallpaperPrefs({ ...localWallpaper, ...payload.wallpaperPrefs });
    await saveWorkspaceResetAt(payload.workspaceResetAt);
    await saveSyncTombstones(payload.syncTombstones);
    await saveSyncPreferenceRevisions(payload.syncPreferenceRevisions);
  });
}

export class GoogleDriveSyncProvider implements CloudSyncProvider {
  readonly id = "google-drive" as const;
  constructor(private readonly api = new GoogleDriveApi()) {}

  async connect() {
    const identity = await fetchGoogleDriveIdentity(true);
    const now = Date.now();
    await updateDriveConnectionRecord({ enabled: true, connectedAt: now });
    return identity;
  }

  async disconnect(): Promise<void> {
    await disconnectGoogleDrive();
  }

  async getIdentity(options: { interactive?: boolean } = {}) {
    const connection = await getDriveConnectionRecord();
    if (!connection.enabled && !options.interactive) return null;
    try {
      return await fetchGoogleDriveIdentity(options.interactive === true);
    } catch (error) {
      if (!options.interactive) return null;
      throw error;
    }
  }

  async sync(): Promise<CloudSyncResult> {
    return withStorageLock("google-drive-sync", async () => {
      const connection = await getDriveConnectionRecord();
      if (!connection.enabled) throw new Error("请先连接 Google Drive。");
      const deviceId = await getOrCreateSyncDeviceId();
      const localPayload = await readCurrentDrivePayload();
      const localEnvelope = await createDriveWorkspaceEnvelope(deviceId, localPayload);
      const files = (await this.api.listAppDataFiles()).filter((file) =>
        file.name.startsWith(WORKSPACE_PREFIX)
      );
      const remoteEnvelopes: DriveWorkspaceEnvelopeV1[] = [];
      for (const file of files) {
        const downloaded = await this.api.downloadJson<unknown>(file);
        const expectedDeviceId = file.name.slice(WORKSPACE_PREFIX.length).replace(/\.json$/, "");
        remoteEnvelopes.push(await validateDriveWorkspaceEnvelope(downloaded.value, expectedDeviceId));
      }
      const merged = mergeDriveWorkspaceEnvelopes([localEnvelope, ...remoteEnvelopes]);
      const changedLocal = stableJsonStringify(merged) !== stableJsonStringify(localPayload);
      if (changedLocal) await applyDrivePayload(merged);
      const refreshed = changedLocal ? await readCurrentDrivePayload() : merged;
      const uploadedEnvelope = await createDriveWorkspaceEnvelope(deviceId, refreshed);
      const name = `${WORKSPACE_PREFIX}${deviceId}.json`;
      const uploaded = await this.api.upsertJsonFile(name, {
        webcollectKind: "workspace",
        schemaVersion: "1",
        deviceId,
        contentHash: uploadedEnvelope.contentHash,
      }, uploadedEnvelope);
      const verified = await this.api.downloadJson<unknown>(uploaded.metadata);
      await validateDriveWorkspaceEnvelope(verified.value, deviceId);
      const syncedAt = Date.now();
      await Promise.all([
        clearSyncDirtySets(),
        saveLocalSnapshotSyncedAt(refreshed.localSnapshotUpdatedAt),
        updateDriveConnectionRecord({ lastSyncAt: syncedAt }),
      ]);
      return { syncedAt, remoteFilesRead: remoteEnvelopes.length, changedLocal };
    });
  }

  async saveSnapshot(record: CloudSnapshotRecord): Promise<CloudSnapshotRecord> {
    const partial = {
      schemaVersion: DRIVE_SNAPSHOT_SCHEMA_VERSION,
      kind: "snapshot" as const,
      appVersion: APP_VERSION,
      snapshotId: record.snapshot.id,
      snapshotKind: record.kind,
      source: record.source,
      dayKey: record.dayKey,
      updatedAt: record.cloudUpdatedAt || Date.now(),
      snapshot: record.snapshot,
    };
    const envelope: DriveSnapshotEnvelopeV1 = {
      ...partial,
      contentHash: await sha256Hex(partial),
    };
    const stableSnapshotName = record.kind === "system" && record.dayKey
      ? `system-${record.dayKey}`
      : record.snapshot.id;
    const name = `${SNAPSHOT_PREFIX}${stableSnapshotName}.json`;
    const saved = await this.api.upsertJsonFile(name, {
      webcollectKind: "snapshot",
      schemaVersion: "1",
      snapshotId: record.snapshot.id,
      snapshotKind: record.kind,
      contentHash: envelope.contentHash,
    }, envelope);
    const verified = await this.api.downloadJson<DriveSnapshotEnvelopeV1>(saved.metadata);
    if (await hashDriveDocument(verified.value) !== verified.value.contentHash) {
      throw new Error("Google Drive 版本文件回读校验失败。");
    }
    return { ...record, cloudUpdatedAt: envelope.updatedAt };
  }

  async listSnapshots(): Promise<CloudSnapshotRecord[]> {
    const files = (await this.api.listAppDataFiles()).filter((file) => file.name.startsWith(SNAPSHOT_PREFIX));
    const records: CloudSnapshotRecord[] = [];
    for (const file of files) {
      const { value } = await this.api.downloadJson<DriveSnapshotEnvelopeV1>(file);
      if (
        value?.schemaVersion !== DRIVE_SNAPSHOT_SCHEMA_VERSION
        || value.kind !== "snapshot"
        || typeof value.contentHash !== "string"
        || await hashDriveDocument(value) !== value.contentHash
      ) {
        throw new Error(`Google Drive 版本文件校验失败：${file.name}`);
      }
      records.push({
        snapshot: value.snapshot,
        kind: value.snapshotKind,
        source: value.source,
        dayKey: value.dayKey,
        cloudUpdatedAt: value.updatedAt,
      });
    }
    return records.sort((left, right) => right.snapshot.createdAt - left.snapshot.createdAt);
  }
}

export const googleDriveSyncProvider = new GoogleDriveSyncProvider();

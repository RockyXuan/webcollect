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
  DRIVE_RECEIPT_SCHEMA_VERSION,
  DRIVE_SNAPSHOT_SCHEMA_VERSION,
  DRIVE_WORKSPACE_SCHEMA_VERSION,
  type DriveMigrationReceiptV1,
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
import { isPortableBackupRestoreInProgress } from "@/lib/portable-backup";

const WORKSPACE_PREFIX = "webcollect-workspace-v1-";
const SNAPSHOT_PREFIX = "webcollect-snapshot-v1-";
const MIGRATION_RECEIPT_NAME = "webcollect-migration-receipt-v1-supabase.json";

function withoutContentHash<T extends { contentHash: string }>(document: T): Omit<T, "contentHash"> {
  const body = { ...document } as Partial<T>;
  delete body.contentHash;
  return body as Omit<T, "contentHash">;
}

export async function hashDriveDocument<T extends { contentHash: string }>(document: T): Promise<string> {
  return sha256Hex(withoutContentHash(document));
}

export function driveSnapshotFileName(snapshotId: string): string {
  return `${SNAPSHOT_PREFIX}${snapshotId}.json`;
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
    if (isPortableBackupRestoreInProgress()) {
      throw new Error("完整备份正在恢复，Google Drive 同步已暂停。");
    }
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
      if (await getLocalSnapshotUpdatedAt() !== localPayload.localSnapshotUpdatedAt) {
        throw new Error("Google Drive 读取期间本机数据发生了变化，已停止本轮合并，请重新同步。");
      }
      const merged = mergeDriveWorkspaceEnvelopes([localEnvelope, ...remoteEnvelopes]);
      const changedLocal = stableJsonStringify(merged) !== stableJsonStringify(localPayload);
      if (changedLocal) await applyDrivePayload(merged);
      if (await getLocalSnapshotUpdatedAt() !== localPayload.localSnapshotUpdatedAt) {
        throw new Error("Google Drive 合并期间本机数据发生了变化，已停止上传，请重新同步。");
      }
      const refreshed = changedLocal ? await readCurrentDrivePayload() : merged;
      const uploadedEnvelope = await createDriveWorkspaceEnvelope(deviceId, refreshed);
      const name = `${WORKSPACE_PREFIX}${deviceId}.json`;
      const currentDeviceFile = files.find((file) => file.name === name);
      const uploaded = await this.api.upsertJsonFile(name, {
        webcollectKind: "workspace",
        schemaVersion: "1",
        deviceId,
        contentHash: uploadedEnvelope.contentHash,
      }, uploadedEnvelope, { expectedVersion: currentDeviceFile?.version });
      const verified = await this.api.downloadJson<unknown>(uploaded.metadata);
      await validateDriveWorkspaceEnvelope(verified.value, deviceId);
      if (await getLocalSnapshotUpdatedAt() !== refreshed.localSnapshotUpdatedAt) {
        throw new Error("Google Drive 上传期间本机又有新修改；云端已保存上一版，本机新修改会在下次同步继续上传。");
      }
      const syncedAt = Date.now();
      await Promise.all([
        clearSyncDirtySets(),
        saveLocalSnapshotSyncedAt(refreshed.localSnapshotUpdatedAt),
        updateDriveConnectionRecord({ lastSyncAt: syncedAt }),
      ]);
      return { syncedAt, remoteFilesRead: remoteEnvelopes.length, changedLocal };
    });
  }

  async stageMigrationWorkspace(payload: DriveWorkspacePayloadV1): Promise<string> {
    return withStorageLock("google-drive-migration-workspace", async () => {
      const connection = await getDriveConnectionRecord();
      if (!connection.enabled) throw new Error("请先连接 Google Drive。");
      const deviceId = await getOrCreateSyncDeviceId();
      const envelope = await createDriveWorkspaceEnvelope(deviceId, payload);
      const name = `${WORKSPACE_PREFIX}${deviceId}.json`;
      const matches = await this.api.listAppDataFiles({ name });
      if (matches.length > 1) {
        throw new Error("Google Drive 中发现多个当前设备工作区文件，已停止迁移覆盖。");
      }
      if (matches[0]) {
        const current = await this.api.downloadJson<unknown>(matches[0]);
        await validateDriveWorkspaceEnvelope(current.value, deviceId);
      }
      const uploaded = await this.api.upsertJsonFile(name, {
        webcollectKind: "workspace",
        schemaVersion: "1",
        deviceId,
        contentHash: envelope.contentHash,
      }, envelope, { expectedVersion: matches[0]?.version });
      const verified = await this.api.downloadJson<unknown>(uploaded.metadata);
      const verifiedEnvelope = await validateDriveWorkspaceEnvelope(verified.value, deviceId);
      return sha256Hex(verifiedEnvelope.payload);
    });
  }

  async saveSnapshot(record: CloudSnapshotRecord): Promise<CloudSnapshotRecord> {
    return withStorageLock("google-drive-snapshot", async () => {
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
      const name = driveSnapshotFileName(record.snapshot.id);
      const existing = await this.api.listAppDataFiles({ name });
      if (existing.length > 1) {
        throw new Error(`Google Drive 中发现多个同名 WebCollect 版本：${name}。已停止覆盖。`);
      }
      if (existing[0]) {
        const downloaded = await this.api.downloadJson<DriveSnapshotEnvelopeV1>(existing[0]);
        if (
          downloaded.value?.snapshotId !== record.snapshot.id
          || await hashDriveDocument(downloaded.value) !== downloaded.value.contentHash
        ) {
          throw new Error(`Google Drive 版本文件校验失败：${name}`);
        }
        if (downloaded.value.contentHash !== envelope.contentHash) {
          throw new Error(`Google Drive 已存在相同版本 ID 但内容不同的文件：${record.snapshot.id}。已停止覆盖。`);
        }
        return { ...record, cloudUpdatedAt: downloaded.value.updatedAt };
      }
      const saved = await this.api.upsertJsonFile(name, {
        webcollectKind: "snapshot",
        schemaVersion: "1",
        snapshotId: record.snapshot.id,
        snapshotKind: record.kind,
        contentHash: envelope.contentHash,
      }, envelope);
      const verified = await this.api.downloadJson<DriveSnapshotEnvelopeV1>(saved.metadata);
      if (
        verified.value?.snapshotId !== record.snapshot.id
        || await hashDriveDocument(verified.value) !== verified.value.contentHash
      ) {
        throw new Error("Google Drive 版本文件回读校验失败。");
      }
      return { ...record, cloudUpdatedAt: envelope.updatedAt };
    });
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

  async saveMigrationReceipt(
    receipt: Omit<DriveMigrationReceiptV1, "schemaVersion" | "kind" | "contentHash">,
  ): Promise<DriveMigrationReceiptV1> {
    const partial = {
      schemaVersion: DRIVE_RECEIPT_SCHEMA_VERSION,
      kind: "migration-receipt" as const,
      ...receipt,
    };
    const document: DriveMigrationReceiptV1 = {
      ...partial,
      contentHash: await sha256Hex(partial),
    };
    const saved = await this.api.upsertJsonFile(MIGRATION_RECEIPT_NAME, {
      webcollectKind: "migration-receipt",
      schemaVersion: "1",
      source: document.source,
      contentHash: document.contentHash,
    }, document);
    const verified = await this.api.downloadJson<DriveMigrationReceiptV1>(saved.metadata);
    if (
      verified.value?.schemaVersion !== DRIVE_RECEIPT_SCHEMA_VERSION
      || verified.value.kind !== "migration-receipt"
      || await hashDriveDocument(verified.value) !== verified.value.contentHash
    ) {
      throw new Error("Google Drive 迁移回执回读校验失败。");
    }
    return verified.value;
  }

  async getMigrationReceipt(): Promise<DriveMigrationReceiptV1 | null> {
    const files = await this.api.listAppDataFiles({ name: MIGRATION_RECEIPT_NAME });
    if (files.length === 0) return null;
    if (files.length > 1) throw new Error("Google Drive 中发现多个迁移回执，已停止自动判断。");
    const { value } = await this.api.downloadJson<DriveMigrationReceiptV1>(files[0]);
    if (
      value?.schemaVersion !== DRIVE_RECEIPT_SCHEMA_VERSION
      || value.kind !== "migration-receipt"
      || await hashDriveDocument(value) !== value.contentHash
    ) {
      throw new Error("Google Drive 迁移回执校验失败。");
    }
    return value;
  }
}

export const googleDriveSyncProvider = new GoogleDriveSyncProvider();

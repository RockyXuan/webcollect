import { APP_VERSION } from "@/lib/app-version";
import type { CloudSnapshotRecord } from "@/lib/cloud-sync-types";
import { sha256Hex, stableJsonStringify } from "@/lib/content-hash";
import {
  getSyncPreferenceRevisions,
  getSyncTombstones,
  rotateSyncDeviceId,
  saveSyncPreferenceRevisions,
  saveSyncTombstones,
} from "@/lib/db";
import {
  assessLocalDataSnapshot,
  createLocalDataSnapshot,
  getLocalDataSnapshots,
  mergeImportedLocalDataSnapshots,
  readCurrentSnapshotData,
  restoreSnapshotData,
  type LocalSnapshotCounts,
  type LocalSnapshotData,
  type LocalSnapshotEntry,
} from "@/lib/local-snapshots";
import {
  listMindmapViewStates,
  restoreMindmapViewStates,
  type MindmapViewStateRecord,
} from "@/lib/mindmap-view-state";
import { compareSyncVersions } from "@/lib/sync-revisions";
import type { SyncPreferenceRevisions, SyncTombstone, SyncVersionStamp } from "@/lib/types";
import { readCollectionViewMode, writeCollectionViewMode } from "@/lib/collection-view-mode";
import { readWallpaperStartupMode, writeWallpaperStartupMode } from "@/lib/wallpaper-startup-mode";
import type { WallpaperMode } from "@/lib/wallpaper-types";

export const PORTABLE_BACKUP_SCHEMA_VERSION = 1 as const;
export const PORTABLE_BACKUP_KIND = "webcollect-portable-backup" as const;
export const PORTABLE_BACKUP_LAST_EXPORT_KEY = "webcollect_portable_backup_last_export_at";
export const PORTABLE_BACKUP_REMINDER_DAYS = 30;

export type PortableBackupCloudStatus = "not-connected" | "included" | "local-only";

export interface PortableBackupCounts extends LocalSnapshotCounts {
  localSnapshots: number;
  driveSnapshots: number;
  mindmapViewStates: number;
}

export interface PortableBackupV1 {
  schemaVersion: typeof PORTABLE_BACKUP_SCHEMA_VERSION;
  kind: typeof PORTABLE_BACKUP_KIND;
  appVersion: string;
  createdAt: number;
  cloudStatus: PortableBackupCloudStatus;
  workspace: LocalSnapshotData;
  localSnapshots: LocalSnapshotEntry[];
  driveSnapshots: CloudSnapshotRecord[];
  mindmapViewStates: MindmapViewStateRecord[];
  collectionViewMode: "classic" | "mindmap";
  wallpaperStartupMode: WallpaperMode | null;
  counts: PortableBackupCounts;
  contentHash: string;
}

export interface PortableBackupPreview {
  appVersion: string;
  createdAt: number;
  cloudStatus: PortableBackupCloudStatus;
  counts: PortableBackupCounts;
  sectionNames: string[];
  contentHash: string;
}

export interface PortableBackupReminder {
  lastExportAt: number | null;
  due: boolean;
}

export interface RestorePortableBackupResult {
  preImportSnapshotId: string;
  restoredCounts: PortableBackupCounts;
  rotatedDeviceIdentity: true;
}

let restoreDepth = 0;

export function isPortableBackupRestoreInProgress(): boolean {
  return restoreDepth > 0;
}

function backupBody(backup: PortableBackupV1): Omit<PortableBackupV1, "contentHash"> {
  const body = { ...backup } as Partial<PortableBackupV1>;
  delete body.contentHash;
  return body as Omit<PortableBackupV1, "contentHash">;
}

function countWorkspace(data: LocalSnapshotData): LocalSnapshotCounts {
  return {
    sections: data.sections.length,
    categories: data.categories.length,
    cards: data.cards.length,
    recycleBin: data.recycleBin.length,
    warehouseCategories: data.warehouseCategories.length,
    warehouseCards: data.warehouseCards.length,
    warehouseBatches: data.warehouseImportBatches.length,
  };
}

function buildCounts(
  workspace: LocalSnapshotData,
  localSnapshots: LocalSnapshotEntry[],
  driveSnapshots: CloudSnapshotRecord[],
  mindmapViewStates: MindmapViewStateRecord[],
): PortableBackupCounts {
  return {
    ...countWorkspace(workspace),
    localSnapshots: localSnapshots.length,
    driveSnapshots: driveSnapshots.length,
    mindmapViewStates: mindmapViewStates.length,
  };
}

function validationSnapshot(data: LocalSnapshotData): LocalSnapshotEntry {
  return {
    id: "portable-backup-validation",
    createdAt: Date.now(),
    reason: "portable-backup-validation",
    label: "portable-backup-validation",
    counts: countWorkspace(data),
    sectionNames: data.sections.map((section) => section.name),
    sampleCategoryNames: data.categories.map((category) => category.name).slice(0, 12),
    sampleCardTitles: data.cards.map((card) => card.title || card.url).slice(0, 12),
    data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertArrayProperty(value: Record<string, unknown>, key: string): void {
  if (!Array.isArray(value[key])) throw new Error(`备份缺少有效的 ${key} 列表。`);
}

function assertWorkspaceShape(value: unknown): asserts value is LocalSnapshotData {
  if (!isRecord(value)) throw new Error("备份中的工作区格式无效。");
  for (const key of [
    "cards",
    "categories",
    "hiddenSites",
    "pinnedCategoryIds",
    "pinnedBookmarkItems",
    "sections",
    "recycleBin",
    "warehouseCards",
    "warehouseCategories",
    "warehouseImportBatches",
  ]) {
    assertArrayProperty(value, key);
  }
  if (!isRecord(value.categoryWidths)) throw new Error("备份中的分类宽度格式无效。");
  if (typeof value.visualScale !== "number" || !Number.isFinite(value.visualScale)) {
    throw new Error("备份中的显示比例格式无效。");
  }
  if (typeof value.linkOpenMode !== "string") throw new Error("备份中的打开方式格式无效。");
  if (typeof value.workspaceResetAt !== "number" || !Number.isFinite(value.workspaceResetAt)) {
    throw new Error("备份中的工作区时间格式无效。");
  }

  const workspace = value as unknown as LocalSnapshotData;
  const assessment = assessLocalDataSnapshot(validationSnapshot(workspace));
  const isValidEmptyWorkspace = workspace.cards.length === 0
    && workspace.categories.length === 0
    && workspace.sections.length > 0
    && assessment.details === "快照为空";
  if (!assessment.recoverable && !isValidEmptyWorkspace) {
    throw new Error(`备份结构校验失败：${assessment.details}`);
  }
}

function assertHistoricalWorkspaceShape(value: unknown, label: string): asserts value is LocalSnapshotData {
  if (!isRecord(value)) throw new Error(`${label}中的工作区格式无效。`);

  // Snapshot history spans older WebCollect releases. Cards and categories
  // are the durable core; newer preference collections may be absent in an
  // old immutable version and must not prevent that version being archived.
  for (const key of ["cards", "categories"]) {
    if (!Array.isArray(value[key])) throw new Error(`${label}缺少有效的 ${key} 列表。`);
  }
  for (const key of [
    "hiddenSites",
    "pinnedCategoryIds",
    "pinnedBookmarkItems",
    "sections",
    "recycleBin",
    "warehouseCards",
    "warehouseCategories",
    "warehouseImportBatches",
  ]) {
    if (key in value && !Array.isArray(value[key])) {
      throw new Error(`${label}中的 ${key} 格式无效。`);
    }
  }
}

function assertSnapshotEntry(value: unknown, label: string): asserts value is LocalSnapshotEntry {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
    throw new Error(`${label}缺少有效 ID。`);
  }
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) {
    throw new Error(`${label}缺少有效时间。`);
  }
  // Historical versions are immutable evidence and can legitimately contain
  // older schemas or reference issues that a later release repaired. Keep
  // their complete data in the archive; recovery UI assesses them before any
  // explicit restore instead of silently rewriting or dropping the version.
  assertHistoricalWorkspaceShape(value.data, label);
}

function normalizeCloudStatus(value: unknown): PortableBackupCloudStatus {
  if (value === "not-connected" || value === "included" || value === "local-only") return value;
  throw new Error("备份中的云端状态无效。");
}

export async function createPortableBackup(options: {
  cloudStatus: PortableBackupCloudStatus;
  driveSnapshots?: CloudSnapshotRecord[];
}): Promise<PortableBackupV1> {
  const [workspace, localSnapshots, mindmapViewStates] = await Promise.all([
    readCurrentSnapshotData(),
    getLocalDataSnapshots(),
    listMindmapViewStates(),
  ]);
  const driveSnapshots = options.driveSnapshots || [];
  const backup: PortableBackupV1 = {
    schemaVersion: PORTABLE_BACKUP_SCHEMA_VERSION,
    kind: PORTABLE_BACKUP_KIND,
    appVersion: APP_VERSION,
    createdAt: Date.now(),
    cloudStatus: options.cloudStatus,
    workspace,
    localSnapshots,
    driveSnapshots,
    mindmapViewStates,
    collectionViewMode: readCollectionViewMode(),
    wallpaperStartupMode: readWallpaperStartupMode(),
    counts: buildCounts(workspace, localSnapshots, driveSnapshots, mindmapViewStates),
    contentHash: "",
  };
  backup.contentHash = await sha256Hex(backupBody(backup));
  return backup;
}

export async function validatePortableBackup(value: unknown): Promise<{
  backup: PortableBackupV1;
  preview: PortableBackupPreview;
}> {
  if (!isRecord(value)) throw new Error("这不是有效的 WebCollect 完整备份。");
  if (value.kind !== PORTABLE_BACKUP_KIND) throw new Error("文件类型不是 WebCollect 完整备份。");
  if (value.schemaVersion !== PORTABLE_BACKUP_SCHEMA_VERSION) {
    throw new Error(`暂不支持这个备份版本（${String(value.schemaVersion)}）。`);
  }
  if (typeof value.appVersion !== "string" || !value.appVersion) throw new Error("备份缺少应用版本。");
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) {
    throw new Error("备份时间无效。");
  }
  if (typeof value.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(value.contentHash)) {
    throw new Error("备份缺少有效的 SHA-256 校验值。");
  }
  assertWorkspaceShape(value.workspace);
  assertArrayProperty(value, "localSnapshots");
  assertArrayProperty(value, "driveSnapshots");
  assertArrayProperty(value, "mindmapViewStates");
  (value.localSnapshots as unknown[]).forEach((snapshot, index) =>
    assertSnapshotEntry(snapshot, `本地版本 ${index + 1}`));
  (value.driveSnapshots as unknown[]).forEach((record, index) => {
    if (!isRecord(record)) throw new Error(`云盘版本 ${index + 1} 格式无效。`);
    assertSnapshotEntry(record.snapshot, `云盘版本 ${index + 1}`);
  });
  for (const record of value.mindmapViewStates as unknown[]) {
    if (!isRecord(record) || typeof record.sectionId !== "string" || !isRecord(record.state)) {
      throw new Error("备份中的导图视图状态无效。");
    }
  }
  if (value.collectionViewMode !== "classic" && value.collectionViewMode !== "mindmap") {
    throw new Error("备份中的经典/导图模式无效。");
  }
  if (value.wallpaperStartupMode !== null
    && value.wallpaperStartupMode !== "wallpaper"
    && value.wallpaperStartupMode !== "collection") {
    throw new Error("备份中的壁纸启动模式无效。");
  }

  const backup = value as unknown as PortableBackupV1;
  const actualHash = await sha256Hex(backupBody(backup));
  if (actualHash !== backup.contentHash) throw new Error("备份 SHA-256 校验失败，文件可能已损坏或被修改。");

  const expectedCounts = buildCounts(
    backup.workspace,
    backup.localSnapshots,
    backup.driveSnapshots,
    backup.mindmapViewStates,
  );
  if (stableJsonStringify(expectedCounts) !== stableJsonStringify(backup.counts)) {
    throw new Error("备份数量校验失败，文件可能不完整。");
  }

  const cloudStatus = normalizeCloudStatus(backup.cloudStatus);
  return {
    backup,
    preview: {
      appVersion: backup.appVersion,
      createdAt: backup.createdAt,
      cloudStatus,
      counts: expectedCounts,
      sectionNames: backup.workspace.sections.map((section) => section.name),
      contentHash: backup.contentHash,
    },
  };
}

export async function parsePortableBackup(text: string): Promise<{
  backup: PortableBackupV1;
  preview: PortableBackupPreview;
}> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("无法读取这个 JSON 文件，请确认文件没有损坏。");
  }
  return validatePortableBackup(value);
}

export function serializePortableBackup(backup: PortableBackupV1): string {
  return JSON.stringify(backup, null, 2);
}

export function portableBackupFileName(createdAt: number): string {
  const date = new Date(createdAt);
  const stamp = Number.isFinite(date.getTime())
    ? date.toISOString().replace(/[:.]/g, "-")
    : new Date().toISOString().replace(/[:.]/g, "-");
  return `WebCollect-complete-backup-${stamp}.json`;
}

export function downloadPortableBackup(backup: PortableBackupV1): void {
  if (typeof document === "undefined") throw new Error("当前环境无法下载备份文件。");
  const blob = new Blob([serializePortableBackup(backup)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = portableBackupFileName(backup.createdAt);
  anchor.click();
  URL.revokeObjectURL(url);
  markPortableBackupExported();
}

function newestByVersion<T extends SyncVersionStamp>(left: T | undefined, right: T): T {
  if (!left || compareSyncVersions(right, left) > 0) return right;
  return left;
}

function mergeTombstones(current: SyncTombstone[], imported: SyncTombstone[]): SyncTombstone[] {
  const byKey = new Map(current.map((item) => [`${item.entityType}:${item.entityId}`, item]));
  for (const item of imported) {
    const key = `${item.entityType}:${item.entityId}`;
    byKey.set(key, newestByVersion(byKey.get(key), item));
  }
  return [...byKey.values()].sort((left, right) =>
    `${left.entityType}:${left.entityId}`.localeCompare(`${right.entityType}:${right.entityId}`));
}

function mergePreferenceRevisions(
  current: SyncPreferenceRevisions,
  imported: SyncPreferenceRevisions,
): SyncPreferenceRevisions {
  const merged = { ...current };
  for (const [key, item] of Object.entries(imported)) {
    merged[key] = newestByVersion(merged[key], item);
  }
  return merged;
}

function maxObservedRevision(data: LocalSnapshotData): number {
  const entityRevisions = [
    ...data.cards,
    ...data.categories,
    ...data.warehouseCards,
    ...data.warehouseCategories,
    ...data.recycleBin.flatMap((item) => [...item.cards, ...item.categories]),
  ].map((item) => item.syncRevision || 0);
  const tombstoneRevisions = (data.syncTombstones || []).map((item) => item.syncRevision);
  const preferenceRevisions = Object.values(data.syncPreferenceRevisions || {}).map((item) => item.syncRevision);
  return Math.max(0, ...entityRevisions, ...tombstoneRevisions, ...preferenceRevisions);
}

export async function restorePortableBackup(
  input: PortableBackupV1,
  options: { confirmed: true },
): Promise<RestorePortableBackupResult> {
  if (options.confirmed !== true) throw new Error("恢复已取消：需要明确确认后才能写入数据。");
  const { backup } = await validatePortableBackup(input);
  const [originalTombstones, originalPreferenceRevisions, originalMindmapViewStates] = await Promise.all([
    getSyncTombstones(),
    getSyncPreferenceRevisions(),
    listMindmapViewStates(),
  ]);

  restoreDepth += 1;
  try {
    const preImportSnapshot = await createLocalDataSnapshot(
      "before-portable-backup-import",
      "导入完整备份前的安全版本",
      { force: true },
    );
    if (!preImportSnapshot) throw new Error("无法创建导入前安全版本，恢复已取消。");
    try {
      await restoreSnapshotData(backup.workspace);
      await Promise.all([
        saveSyncTombstones(mergeTombstones(originalTombstones, backup.workspace.syncTombstones || [])),
        saveSyncPreferenceRevisions(mergePreferenceRevisions(
          originalPreferenceRevisions,
          backup.workspace.syncPreferenceRevisions || {},
        )),
      ]);

      await mergeImportedLocalDataSnapshots([
        preImportSnapshot,
        ...backup.localSnapshots,
        ...backup.driveSnapshots.map((record) => record.snapshot),
      ]);
      await restoreMindmapViewStates(backup.mindmapViewStates);
      await rotateSyncDeviceId(maxObservedRevision(backup.workspace));
      writeCollectionViewMode(backup.collectionViewMode);
      if (backup.wallpaperStartupMode) writeWallpaperStartupMode(backup.wallpaperStartupMode);

      return {
        preImportSnapshotId: preImportSnapshot.id,
        restoredCounts: backup.counts,
        rotatedDeviceIdentity: true,
      };
    } catch (restoreError) {
      try {
        await restoreSnapshotData(preImportSnapshot.data);
        await Promise.all([
          saveSyncTombstones(originalTombstones),
          saveSyncPreferenceRevisions(originalPreferenceRevisions),
          restoreMindmapViewStates(originalMindmapViewStates),
        ]);
      } catch (rollbackError) {
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : "未知错误";
        throw new Error(`恢复中断，自动回退也失败：${rollbackMessage}。请保留当前页面并使用导入前安全版本。`);
      }
      const message = restoreError instanceof Error ? restoreError.message : "未知错误";
      throw new Error(`恢复失败，已自动回到导入前状态：${message}`);
    }
  } finally {
    restoreDepth = Math.max(0, restoreDepth - 1);
  }
}

export function markPortableBackupExported(exportedAt = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTABLE_BACKUP_LAST_EXPORT_KEY, String(exportedAt));
  } catch {
    // The download itself still succeeds when optional reminder state is unavailable.
  }
}

export function getPortableBackupReminder(now = Date.now()): PortableBackupReminder {
  if (typeof window === "undefined") return { lastExportAt: null, due: false };
  try {
    const raw = window.localStorage.getItem(PORTABLE_BACKUP_LAST_EXPORT_KEY);
    const lastExportAt = raw === null ? null : Number(raw);
    if (lastExportAt === null || !Number.isFinite(lastExportAt) || lastExportAt <= 0) {
      return { lastExportAt: null, due: true };
    }
    const due = now - lastExportAt >= PORTABLE_BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
    return { lastExportAt, due };
  } catch {
    return { lastExportAt: null, due: false };
  }
}

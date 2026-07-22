import type { WallpaperSyncedSettings } from "@/lib/wallpaper-types";
import type {
  Category,
  CategoryLayoutPreference,
  CollectionSection,
  HiddenSite,
  LinkOpenMode,
  PinnedBookmarkItem,
  RecycleBinItem,
  SavedTabPack,
  SyncPreferenceRevisions,
  SyncTombstone,
  TabPackOpenMode,
  WebCard,
} from "@/lib/types";
import type { SearchEngineId } from "@/lib/search-engines";
import type { ImportBatch, WarehouseCard, WarehouseCategory } from "@/lib/db-warehouse";
import type { LocalSnapshotEntry } from "@/lib/local-snapshots";

export const DRIVE_WORKSPACE_SCHEMA_VERSION = 1 as const;
export const DRIVE_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export const DRIVE_RECEIPT_SCHEMA_VERSION = 1 as const;

export interface DriveWorkspacePayloadV1 {
  cards: WebCard[];
  categories: Category[];
  hiddenSites: HiddenSite[];
  pinnedCategoryIds: string[];
  pinnedBookmarkItems: PinnedBookmarkItem[];
  pinnedBookmarkItemsUpdatedAt: number;
  /** Added in V1.5.0. Absence means a legacy payload, not an empty cloud value. */
  savedTabPacks?: SavedTabPack[];
  tabPackOpenMode?: TabPackOpenMode;
  categoryWidths: Record<string, number>;
  categoryLayouts: Record<string, CategoryLayoutPreference>;
  visualScale: number;
  linkOpenMode: LinkOpenMode;
  searchEngine: SearchEngineId;
  sections: CollectionSection[];
  activeSectionId: string | null;
  recycleBin: RecycleBinItem[];
  warehouseCards: WarehouseCard[];
  warehouseCategories: WarehouseCategory[];
  warehouseImportBatches: ImportBatch[];
  warehouseUpdatedAt: number;
  wallpaperPrefs: WallpaperSyncedSettings;
  workspaceResetAt: number;
  localSnapshotUpdatedAt: number;
  syncTombstones: SyncTombstone[];
  syncPreferenceRevisions: SyncPreferenceRevisions;
}

export interface DriveWorkspaceEnvelopeV1 {
  schemaVersion: typeof DRIVE_WORKSPACE_SCHEMA_VERSION;
  kind: "workspace";
  appVersion: string;
  deviceId: string;
  updatedAt: number;
  payload: DriveWorkspacePayloadV1;
  contentHash: string;
}

export interface DriveSnapshotEnvelopeV1 {
  schemaVersion: typeof DRIVE_SNAPSHOT_SCHEMA_VERSION;
  kind: "snapshot";
  appVersion: string;
  snapshotId: string;
  snapshotKind: "manual" | "system";
  source: string;
  dayKey: string | null;
  updatedAt: number;
  snapshot: LocalSnapshotEntry;
  contentHash: string;
}

export interface DriveMigrationReceiptV1 {
  schemaVersion: typeof DRIVE_RECEIPT_SCHEMA_VERSION;
  kind: "migration-receipt";
  source: "supabase";
  migratedAt: number;
  sourceCounts: Record<string, number>;
  sourceHashes: Record<string, string>;
  workspaceHash: string;
  snapshotCount: number;
  snapshotHashes: Record<string, string>;
  verified: true;
  contentHash: string;
}

export type DriveStoredDocument =
  | DriveWorkspaceEnvelopeV1
  | DriveSnapshotEnvelopeV1
  | DriveMigrationReceiptV1;

import type { LocalSnapshotEntry } from "@/lib/local-snapshots";

export interface CloudIdentity {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
}

export interface CloudSyncResult {
  syncedAt: number;
  remoteFilesRead: number;
  changedLocal: boolean;
}

export interface CloudSnapshotRecord {
  snapshot: LocalSnapshotEntry;
  kind: "manual" | "system";
  source: string;
  dayKey: string | null;
  cloudUpdatedAt: number;
}

export interface CloudSyncProvider {
  readonly id: "google-drive";
  connect(): Promise<CloudIdentity>;
  disconnect(): Promise<void>;
  getIdentity(options?: { interactive?: boolean }): Promise<CloudIdentity | null>;
  sync(): Promise<CloudSyncResult>;
  saveSnapshot(record: CloudSnapshotRecord): Promise<CloudSnapshotRecord>;
  listSnapshots(): Promise<CloudSnapshotRecord[]>;
}


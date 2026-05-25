import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient, initBrowserSupabase } from "@/lib/supabase-browser";
import {
  assessLocalDataSnapshot,
  createLocalDataSnapshot,
  restoreSnapshotData,
  restoreStructureFromSnapshotEntry,
  type LocalSnapshotAssessment,
  type LocalSnapshotCounts,
  type LocalSnapshotData,
  type LocalSnapshotEntry,
  type StructureRestoreResult,
} from "@/lib/local-snapshots";

export type CloudWorkspaceSnapshotKind = "manual" | "system";

export interface CloudWorkspaceSnapshotRow {
  id?: string;
  user_id: string;
  kind: CloudWorkspaceSnapshotKind;
  label: string;
  reason: string;
  source: string;
  day_key: string | null;
  snapshot_created_at: string;
  snapshot_created_at_ms: number;
  counts: LocalSnapshotCounts;
  assessment: LocalSnapshotAssessment;
  section_names: string[];
  sample_category_names: string[];
  sample_card_titles: string[];
  data: LocalSnapshotData;
  created_at?: string;
  updated_at?: string;
}

export interface CloudWorkspaceSnapshotEntry extends LocalSnapshotEntry {
  kind: CloudWorkspaceSnapshotKind;
  source: "cloud";
  cloudSource: string;
  dayKey: string | null;
  cloudUpdatedAt: number;
  assessment: LocalSnapshotAssessment;
}

export interface CloudWorkspaceSnapshotOptions {
  kind: CloudWorkspaceSnapshotKind;
  source?: string;
}

const WORKSPACE_SNAPSHOTS_TABLE = "workspace_snapshots";

export function cloudWorkspaceSnapshotDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shouldReplaceCloudWorkspaceSnapshot(kind: CloudWorkspaceSnapshotKind): boolean {
  return kind === "system";
}

export function buildCloudWorkspaceSnapshotRow(
  userId: string,
  snapshot: LocalSnapshotEntry,
  options: CloudWorkspaceSnapshotOptions
): CloudWorkspaceSnapshotRow {
  const kind = options.kind;
  return {
    user_id: userId,
    kind,
    label: snapshot.label,
    reason: snapshot.reason,
    source: options.source || (kind === "manual" ? "manual-save" : "system-auto-save"),
    day_key: kind === "system" ? cloudWorkspaceSnapshotDayKey(snapshot.createdAt) : null,
    snapshot_created_at: new Date(snapshot.createdAt).toISOString(),
    snapshot_created_at_ms: snapshot.createdAt,
    counts: snapshot.counts,
    assessment: assessLocalDataSnapshot(snapshot),
    section_names: snapshot.sectionNames,
    sample_category_names: snapshot.sampleCategoryNames,
    sample_card_titles: snapshot.sampleCardTitles,
    data: snapshot.data,
  };
}

export function mapCloudWorkspaceSnapshotRow(row: CloudWorkspaceSnapshotRow): CloudWorkspaceSnapshotEntry {
  if (!row.id) {
    throw new Error("Cloud workspace snapshot row is missing id");
  }
  return {
    id: row.id,
    createdAt: row.snapshot_created_at_ms,
    reason: row.reason,
    label: row.label,
    counts: row.counts,
    sectionNames: row.section_names || [],
    sampleCategoryNames: row.sample_category_names || [],
    sampleCardTitles: row.sample_card_titles || [],
    data: row.data,
    kind: row.kind,
    source: "cloud",
    cloudSource: row.source,
    dayKey: row.day_key,
    cloudUpdatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
    assessment: row.assessment || assessLocalDataSnapshot({
      id: row.id,
      createdAt: row.snapshot_created_at_ms,
      reason: row.reason,
      label: row.label,
      counts: row.counts,
      sectionNames: row.section_names || [],
      sampleCategoryNames: row.sample_category_names || [],
      sampleCardTitles: row.sample_card_titles || [],
      data: row.data,
    }),
  };
}

function summarizeCloudSnapshotError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  if (/workspace_snapshots|schema cache|does not exist|Could not find the table/i.test(message)) {
    return "云端版本库表还不存在，请先执行 WebCollect 的 Supabase schema 更新。";
  }
  return message.length > 220 ? `${message.slice(0, 220)}...` : message;
}

async function getSnapshotClient(): Promise<SupabaseClient> {
  const configured = await initBrowserSupabase();
  if (!configured) {
    throw new Error("Supabase is not configured.");
  }
  return getBrowserSupabaseClient();
}

export async function saveCloudWorkspaceSnapshot(
  userId: string,
  snapshot: LocalSnapshotEntry,
  options: CloudWorkspaceSnapshotOptions
): Promise<CloudWorkspaceSnapshotEntry> {
  const client = await getSnapshotClient();
  const row = buildCloudWorkspaceSnapshotRow(userId, snapshot, options);
  const query = shouldReplaceCloudWorkspaceSnapshot(options.kind)
    ? client
      .from(WORKSPACE_SNAPSHOTS_TABLE)
      .upsert(row, { onConflict: "user_id,kind,day_key" })
      .select("*")
      .single()
    : client
      .from(WORKSPACE_SNAPSHOTS_TABLE)
      .insert(row)
      .select("*")
      .single();

  const { data, error } = await query;
  if (error) {
    throw new Error(summarizeCloudSnapshotError(error));
  }
  return mapCloudWorkspaceSnapshotRow(data as CloudWorkspaceSnapshotRow);
}

export async function createManualCloudWorkspaceSnapshot(userId: string): Promise<CloudWorkspaceSnapshotEntry> {
  const localSnapshot = await createLocalDataSnapshot("manual-snapshot", "手动保存当前版本", { force: true });
  if (!localSnapshot) {
    throw new Error("当前没有可保存的 WebCollect 数据。");
  }
  return saveCloudWorkspaceSnapshot(userId, localSnapshot, {
    kind: "manual",
    source: "header-save",
  });
}

export async function listCloudWorkspaceSnapshots(userId: string): Promise<CloudWorkspaceSnapshotEntry[]> {
  const client = await getSnapshotClient();
  const { data, error } = await client
    .from(WORKSPACE_SNAPSHOTS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("snapshot_created_at", { ascending: false })
    .limit(300);

  if (error) {
    throw new Error(summarizeCloudSnapshotError(error));
  }
  return ((data || []) as CloudWorkspaceSnapshotRow[]).map(mapCloudWorkspaceSnapshotRow);
}

async function getCloudWorkspaceSnapshot(
  userId: string,
  snapshotId: string
): Promise<CloudWorkspaceSnapshotEntry> {
  const client = await getSnapshotClient();
  const { data, error } = await client
    .from(WORKSPACE_SNAPSHOTS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("id", snapshotId)
    .single();

  if (error) {
    throw new Error(summarizeCloudSnapshotError(error));
  }
  return mapCloudWorkspaceSnapshotRow(data as CloudWorkspaceSnapshotRow);
}

export async function restoreCloudWorkspaceSnapshot(userId: string, snapshotId: string): Promise<void> {
  const snapshot = await getCloudWorkspaceSnapshot(userId, snapshotId);
  await createLocalDataSnapshot("before-cloud-rollback", "云端版本回档前自动备份", { force: true });
  await restoreSnapshotData(snapshot.data);
}

export async function restoreStructureFromCloudWorkspaceSnapshot(
  userId: string,
  snapshotId: string
): Promise<StructureRestoreResult> {
  const snapshot = await getCloudWorkspaceSnapshot(userId, snapshotId);
  await createLocalDataSnapshot("before-cloud-structure-restore", "云端结构修复前自动备份", { force: true });
  return restoreStructureFromSnapshotEntry(snapshot);
}

import type { SyncVersionStamp } from "./types";
import { compareSyncVersions, normalizeSyncRevision } from "./sync-revisions";

export interface CloudPreferenceVersion<T> {
  value: T;
  syncRevision?: number | null;
  syncDeviceId?: string | null;
  updatedAt?: number;
}

export interface PreferenceResolution<T> {
  value: T;
  version: SyncVersionStamp | null;
  source: "local" | "cloud" | "legacy";
  shouldPush: boolean;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeVersion(
  value: Pick<SyncVersionStamp, "syncRevision" | "syncDeviceId"> | null | undefined
): SyncVersionStamp | null {
  const syncRevision = normalizeSyncRevision(value?.syncRevision);
  if (syncRevision === 0) return null;
  return {
    syncRevision,
    syncDeviceId: value?.syncDeviceId || "legacy",
  };
}

export function resolvePreferenceByRevision<T>(input: {
  localValue: T;
  localVersion?: SyncVersionStamp | null;
  cloud?: CloudPreferenceVersion<T> | null;
  legacyValue: T;
}): PreferenceResolution<T> {
  const localVersion = normalizeVersion(input.localVersion);
  const cloudVersion = normalizeVersion(input.cloud
    ? {
        syncRevision: input.cloud.syncRevision ?? 0,
        syncDeviceId: input.cloud.syncDeviceId || "legacy",
      }
    : null);

  if (!localVersion && !cloudVersion) {
    return {
      value: input.legacyValue,
      version: null,
      source: "legacy",
      shouldPush: !input.cloud || !sameValue(input.legacyValue, input.cloud.value),
    };
  }

  const localComparison = compareSyncVersions(
    localVersion || { syncRevision: 0, syncDeviceId: "legacy" },
    cloudVersion || {
      syncRevision: 0,
      syncDeviceId: "legacy",
      updatedAt: input.cloud?.updatedAt,
    }
  );
  if (input.cloud && localComparison < 0) {
    return {
      value: input.cloud.value,
      version: cloudVersion,
      source: "cloud",
      shouldPush: false,
    };
  }

  return {
    value: input.localValue,
    version: localVersion,
    source: "local",
    shouldPush: !input.cloud || localComparison > 0 || !sameValue(input.localValue, input.cloud.value),
  };
}

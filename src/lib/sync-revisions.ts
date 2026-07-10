export interface SyncVersionLike {
  syncRevision?: number;
  syncDeviceId?: string;
  updatedAt?: number;
  createdAt?: number;
}

export function normalizeSyncRevision(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function compareSyncVersions(left: SyncVersionLike, right: SyncVersionLike): number {
  const leftRevision = normalizeSyncRevision(left.syncRevision);
  const rightRevision = normalizeSyncRevision(right.syncRevision);
  if (leftRevision !== rightRevision) return leftRevision - rightRevision;

  const leftDevice = left.syncDeviceId || "";
  const rightDevice = right.syncDeviceId || "";
  if (leftDevice || rightDevice) return leftDevice.localeCompare(rightDevice);

  const leftLegacyTime = left.updatedAt || left.createdAt || 0;
  const rightLegacyTime = right.updatedAt || right.createdAt || 0;
  return leftLegacyTime - rightLegacyTime;
}

import localforage from "localforage";
import type { CloudIdentity } from "@/lib/cloud-sync-types";
import { isChromeExtension } from "@/lib/platform";
import { withStorageLock } from "@/lib/storage-lock";

export const GOOGLE_DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const DRIVE_CONNECTION_KEY = "googleDriveConnectionV1";

const driveSettingsDb = localforage.createInstance({
  name: "WebCollect",
  storeName: "webcollect_data",
});

export interface DriveConnectionRecord {
  version: 1;
  enabled: boolean;
  connectedAt: number;
  lastSyncAt: number;
  migrationVerifiedAt: number;
}

const EMPTY_CONNECTION: DriveConnectionRecord = {
  version: 1,
  enabled: false,
  connectedAt: 0,
  lastSyncAt: 0,
  migrationVerifiedAt: 0,
};

function normalizeConnection(value: unknown): DriveConnectionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_CONNECTION };
  const raw = value as Partial<DriveConnectionRecord>;
  return {
    version: 1,
    enabled: raw.enabled === true,
    connectedAt: typeof raw.connectedAt === "number" && Number.isFinite(raw.connectedAt) ? raw.connectedAt : 0,
    lastSyncAt: typeof raw.lastSyncAt === "number" && Number.isFinite(raw.lastSyncAt) ? raw.lastSyncAt : 0,
    migrationVerifiedAt:
      typeof raw.migrationVerifiedAt === "number" && Number.isFinite(raw.migrationVerifiedAt)
        ? raw.migrationVerifiedAt
        : 0,
  };
}

export async function getDriveConnectionRecord(): Promise<DriveConnectionRecord> {
  return normalizeConnection(await driveSettingsDb.getItem<unknown>(DRIVE_CONNECTION_KEY));
}

export async function updateDriveConnectionRecord(
  update: Partial<Omit<DriveConnectionRecord, "version">>
): Promise<DriveConnectionRecord> {
  return withStorageLock(DRIVE_CONNECTION_KEY, async () => {
    const current = await getDriveConnectionRecord();
    const next = normalizeConnection({ ...current, ...update, version: 1 });
    await driveSettingsDb.setItem(DRIVE_CONNECTION_KEY, next);
    return next;
  });
}

export function isGoogleDriveAuthAvailable(): boolean {
  return isChromeExtension()
    && typeof chrome !== "undefined"
    && !!chrome.identity?.getAuthToken;
}

function normalizeTokenResult(result: chrome.identity.GetAuthTokenResult | string | undefined): string {
  if (typeof result === "string") return result;
  return result?.token || "";
}

export async function getGoogleDriveAccessToken(interactive: boolean): Promise<string> {
  if (!isGoogleDriveAuthAvailable()) {
    throw new Error("Google Drive 连接当前仅支持 Chrome 扩展版。");
  }
  const result = await chrome.identity.getAuthToken({
    interactive,
    scopes: [GOOGLE_DRIVE_APPDATA_SCOPE],
  });
  const token = normalizeTokenResult(result);
  if (!token) {
    throw new Error(interactive ? "没有取得 Google Drive 授权。" : "Google Drive 需要重新授权。");
  }
  return token;
}

export async function invalidateGoogleDriveAccessToken(token: string): Promise<void> {
  if (!token || !isGoogleDriveAuthAvailable()) return;
  await chrome.identity.removeCachedAuthToken({ token });
}

export async function disconnectGoogleDrive(): Promise<void> {
  await updateDriveConnectionRecord({ enabled: false });
  if (!isGoogleDriveAuthAvailable()) return;
  await chrome.identity.clearAllCachedAuthTokens();
}

interface DriveAboutResponse {
  user?: {
    permissionId?: string;
    emailAddress?: string;
    displayName?: string;
    photoLink?: string;
  };
}

export async function fetchGoogleDriveIdentity(
  interactive: boolean,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<CloudIdentity> {
  let token = await getGoogleDriveAccessToken(interactive);
  let response = await fetchImpl(
    "https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress,displayName,photoLink)",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (response.status === 401) {
    await invalidateGoogleDriveAccessToken(token);
    token = await getGoogleDriveAccessToken(interactive);
    response = await fetchImpl(
      "https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress,displayName,photoLink)",
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
  if (!response.ok) {
    throw new Error(`Google Drive 身份验证失败（${response.status}）。`);
  }
  const result = await response.json() as DriveAboutResponse;
  const user = result.user;
  if (!user?.permissionId) throw new Error("Google Drive 没有返回当前账号信息。");
  return {
    id: user.permissionId,
    email: user.emailAddress || "",
    displayName: user.displayName || user.emailAddress?.split("@")[0] || "Google 用户",
    avatarUrl: user.photoLink || "",
  };
}

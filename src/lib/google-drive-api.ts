import {
  getGoogleDriveAccessToken,
  invalidateGoogleDriveAccessToken,
} from "@/lib/google-drive-auth";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFileMetadata {
  id: string;
  name: string;
  modifiedTime: string;
  version?: string;
  size?: string;
  appProperties?: Record<string, string>;
}

interface DriveFileListResponse {
  files?: DriveFileMetadata[];
  nextPageToken?: string;
}

export interface DriveJsonFile<T> {
  metadata: DriveFileMetadata;
  value: T;
}

export interface GoogleDriveApiOptions {
  fetchImpl?: typeof fetch;
  getToken?: (interactive: boolean) => Promise<string>;
  invalidateToken?: (token: string) => Promise<void>;
  timeoutMs?: number;
}

function safeErrorMessage(value: string): string {
  const plain = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.slice(0, 240);
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export class GoogleDriveApi {
  private readonly fetchImpl: typeof fetch;
  private readonly getToken: (interactive: boolean) => Promise<string>;
  private readonly invalidateToken: (token: string) => Promise<void>;
  private readonly timeoutMs: number;

  constructor(options: GoogleDriveApiOptions = {}) {
    // Chromium's native fetch performs a brand check on its receiver. Keeping
    // the bare method and later invoking it through this.fetchImpl can throw
    // "Illegal invocation" in a real extension even though mocked tests pass.
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
    this.getToken = options.getToken || getGoogleDriveAccessToken;
    this.invalidateToken = options.invalidateToken || invalidateGoogleDriveAccessToken;
    this.timeoutMs = options.timeoutMs || 12_000;
  }

  private async request(
    url: string,
    init: RequestInit = {},
    retryAuth = true,
    transientRetries = 2,
  ): Promise<Response> {
    const token = await this.getToken(false);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, headers, signal: controller.signal });
    } catch (error) {
      const isAbort = !!error && typeof error === "object" && "name" in error && error.name === "AbortError";
      if (isAbort) throw new Error("Google Drive 请求超时，本机数据保持不变。");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401 && retryAuth) {
      await this.invalidateToken(token);
      return this.request(url, init, false, transientRetries);
    }
    const method = (init.method || "GET").toUpperCase();
    if (
      transientRetries > 0
      && (method === "GET" || method === "HEAD")
      && (response.status === 408 || response.status === 429 || response.status >= 500)
    ) {
      return this.request(url, init, retryAuth, transientRetries - 1);
    }
    if (!response.ok) {
      const message = safeErrorMessage(await response.text());
      throw new Error(`Google Drive 请求失败（${response.status}）${message ? `：${message}` : ""}`);
    }
    return response;
  }

  async listAppDataFiles(options: { name?: string } = {}): Promise<DriveFileMetadata[]> {
    const files: DriveFileMetadata[] = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        spaces: "appDataFolder",
        pageSize: "1000",
        fields: "nextPageToken,files(id,name,modifiedTime,version,size,appProperties)",
        orderBy: "modifiedTime desc",
      });
      params.set("q", options.name
        ? `trashed = false and name = '${escapeDriveQueryValue(options.name)}'`
        : "trashed = false");
      if (pageToken) params.set("pageToken", pageToken);
      const response = await this.request(`${DRIVE_API_BASE}/files?${params.toString()}`);
      const result = await response.json() as DriveFileListResponse;
      files.push(...(result.files || []));
      pageToken = result.nextPageToken || "";
    } while (pageToken);
    return files;
  }

  async downloadJson<T>(file: DriveFileMetadata): Promise<DriveJsonFile<T>> {
    const response = await this.request(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(file.id)}?alt=media`
    );
    return { metadata: file, value: await response.json() as T };
  }

  private multipartBody(
    metadata: Record<string, unknown>,
    value: unknown
  ): { body: Blob; contentType: string } {
    const boundary = `webcollect-${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(value),
      `\r\n--${boundary}--`,
    ], { type: `multipart/related; boundary=${boundary}` });
    return { body, contentType: `multipart/related; boundary=${boundary}` };
  }

  private async createJsonFile<T>(
    name: string,
    appProperties: Record<string, string>,
    value: T
  ): Promise<DriveJsonFile<T>> {
    const multipart = this.multipartBody({
      name,
      parents: ["appDataFolder"],
      mimeType: "application/json",
      appProperties,
    }, value);
    const response = await this.request(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime,version,size,appProperties`,
      {
        method: "POST",
        headers: { "Content-Type": multipart.contentType },
        body: multipart.body,
      }
    );
    return { metadata: await response.json() as DriveFileMetadata, value };
  }

  private async updateJsonFile<T>(
    file: DriveFileMetadata,
    appProperties: Record<string, string>,
    value: T
  ): Promise<DriveJsonFile<T>> {
    const multipart = this.multipartBody({
      name: file.name,
      mimeType: "application/json",
      appProperties,
    }, value);
    const response = await this.request(
      `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(file.id)}?uploadType=multipart&fields=id,name,modifiedTime,version,size,appProperties`,
      {
        method: "PATCH",
        headers: { "Content-Type": multipart.contentType },
        body: multipart.body,
      }
    );
    return { metadata: await response.json() as DriveFileMetadata, value };
  }

  async upsertJsonFile<T>(
    name: string,
    appProperties: Record<string, string>,
    value: T,
    options: { expectedVersion?: string } = {},
  ): Promise<DriveJsonFile<T>> {
    const matches = await this.listAppDataFiles({ name });
    if (matches.length > 1) {
      throw new Error(`Google Drive 中发现多个同名 WebCollect 文件：${name}。已停止覆盖，请先检查迁移状态。`);
    }
    if (
      matches[0]
      && options.expectedVersion
      && matches[0].version !== options.expectedVersion
    ) {
      throw new Error("Google Drive 文件在上传前已被另一窗口更新，请重新同步后再试。");
    }
    return matches[0]
      ? this.updateJsonFile(matches[0], appProperties, value)
      : this.createJsonFile(name, appProperties, value);
  }
}

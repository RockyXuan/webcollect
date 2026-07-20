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

  constructor(options: GoogleDriveApiOptions = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.getToken = options.getToken || getGoogleDriveAccessToken;
    this.invalidateToken = options.invalidateToken || invalidateGoogleDriveAccessToken;
  }

  private async request(url: string, init: RequestInit = {}, retryAuth = true): Promise<Response> {
    const token = await this.getToken(false);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await this.fetchImpl(url, { ...init, headers });
    if (response.status === 401 && retryAuth) {
      await this.invalidateToken(token);
      return this.request(url, init, false);
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
      if (options.name) {
        params.set("q", `name = '${escapeDriveQueryValue(options.name)}'`);
      }
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
    value: T
  ): Promise<DriveJsonFile<T>> {
    const matches = await this.listAppDataFiles({ name });
    if (matches.length > 1) {
      throw new Error(`Google Drive 中发现多个同名 WebCollect 文件：${name}。已停止覆盖，请先检查迁移状态。`);
    }
    return matches[0]
      ? this.updateJsonFile(matches[0], appProperties, value)
      : this.createJsonFile(name, appProperties, value);
  }
}


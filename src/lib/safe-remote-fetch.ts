import { lookup } from "node:dns/promises";
import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import {
  RemoteUrlPolicyError,
  assertSafeRemoteUrl,
  isPublicIpAddress,
} from "../../shared/remote-url-policy.js";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type ResolveHost = (hostname: string) => Promise<string[]>;
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface SafeRemoteFetchOptions {
  method?: "GET" | "HEAD";
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRedirects?: number;
  fetchImpl?: FetchLike;
  resolveHost?: ResolveHost;
}

interface FetchRemoteTextOptions extends SafeRemoteFetchOptions {
  allowedContentTypes?: string[];
  maxBytes?: number;
}

interface SafeRemoteResponse {
  response: Response;
  url: string;
}

async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  if (isIP(normalized)) return [normalized];
  const results = await lookup(normalized, { all: true, verbatim: true });
  return results.map((result) => result.address);
}

function assertPublicAddresses(addresses: string[]): void {
  if (addresses.length === 0 || addresses.some((address) => !isPublicIpAddress(address))) {
    throw new RemoteUrlPolicyError("目标域名未解析到可验证的公网地址");
  }
}

function headersToObject(headers?: HeadersInit): Record<string, string> {
  const normalized = new Headers(headers);
  return Object.fromEntries(normalized.entries());
}

function fetchPinnedAddress(
  url: URL,
  address: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? requestHttps : requestHttp;
    const signal = AbortSignal.timeout(timeoutMs);
    const request = transport(url, {
      method: init.method || "GET",
      headers: headersToObject(init.headers),
      signal,
      lookup: (_hostname, options, callback) => {
        const family = isIP(address);
        if (typeof options === "object" && options.all) {
          callback(null, [{ address, family }]);
          return;
        }
        callback(null, address, family);
      },
    }, (incoming) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) {
          value.forEach((item) => headers.append(name, item));
        } else if (value !== undefined) {
          headers.set(name, value);
        }
      }
      const method = String(init.method || "GET").toUpperCase();
      const body = method === "HEAD" ? null : Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
      resolve(new Response(body, {
        status: incoming.statusCode || 502,
        statusText: incoming.statusMessage,
        headers,
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

function redirectMethod(method: "GET" | "HEAD", status: number): "GET" | "HEAD" {
  if (method === "HEAD") return "HEAD";
  return status === 303 ? "GET" : method;
}

export async function safeRemoteFetch(
  input: string,
  options: SafeRemoteFetchOptions = {}
): Promise<SafeRemoteResponse> {
  const resolveHost = options.resolveHost || resolvePublicAddresses;
  const fetchImpl = options.fetchImpl;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxRedirects = options.maxRedirects ?? 4;
  let method = options.method ?? "GET";
  let currentUrl = assertSafeRemoteUrl(input);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const addresses = await resolveHost(currentUrl.hostname.replace(/^\[|\]$/g, ""));
    assertPublicAddresses(addresses);
    const init: RequestInit = {
      method,
      headers: options.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    };
    const response = fetchImpl
      ? await fetchImpl(currentUrl.toString(), init)
      : await fetchPinnedAddress(currentUrl, addresses[0], init, timeoutMs);

    if (!REDIRECT_STATUSES.has(response.status)) {
      return { response, url: currentUrl.toString() };
    }

    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new RemoteUrlPolicyError("远程网页返回了无效跳转");
    if (redirectCount === maxRedirects) {
      throw new RemoteUrlPolicyError("远程网页跳转次数过多");
    }
    currentUrl = assertSafeRemoteUrl(new URL(location, currentUrl).toString());
    method = redirectMethod(method, response.status);
  }

  throw new RemoteUrlPolicyError("远程网页跳转次数过多");
}

async function readResponseTextLimited(response: Response, maxBytes: number): Promise<string> {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new RemoteUrlPolicyError("远程网页内容过大");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RemoteUrlPolicyError("远程网页内容超过大小限制");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function fetchRemoteText(
  input: string,
  options: FetchRemoteTextOptions = {}
): Promise<SafeRemoteResponse & { text: string }> {
  const result = await safeRemoteFetch(input, options);
  const contentType = result.response.headers.get("content-type")?.toLowerCase() || "";
  const allowed = options.allowedContentTypes || [];
  if (allowed.length > 0 && !allowed.some((type) => contentType.startsWith(type))) {
    await result.response.body?.cancel();
    throw new RemoteUrlPolicyError("远程资源的 Content Type 不受支持");
  }
  const text = await readResponseTextLimited(result.response, options.maxBytes ?? 1_500_000);
  return { ...result, text };
}

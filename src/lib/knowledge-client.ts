import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getBrowserSupabaseClient,
  initBrowserSupabase,
} from "./supabase-browser";
import { isChromeExtension } from "./platform";

const BOOKMARK_SEARCH_FUNCTION = "bookmark-search";
const MAX_QUERY_CHARACTERS = 200;
const MAX_DOCUMENT_CHARACTERS = 6_000;
const MAX_INDEX_BATCH_SIZE = 32;
const CONTENT_HASH_PATTERN = /^[0-9a-f]{64}$/i;

export type KnowledgeClientErrorCode =
  | "aborted"
  | "authentication-required"
  | "extension-public-fetch-disabled"
  | "forbidden"
  | "index-failed"
  | "invalid-request"
  | "invalid-response"
  | "network-error"
  | "not-configured"
  | "public-fetch-failed"
  | "public-fetch-rejected"
  | "rate-limited"
  | "remove-failed"
  | "semantic-search-failed"
  | "service-unavailable"
  | "timeout";

export class KnowledgeClientError extends Error {
  constructor(public readonly code: KnowledgeClientErrorCode) {
    super(code);
    this.name = "KnowledgeClientError";
  }
}

export interface SemanticKnowledgeResult {
  cardId: string;
  contentHash: string;
  similarity: number;
}

export interface KnowledgeIndexItem {
  cardId: string;
  contentHash: string;
  text: string;
}

export interface KnowledgeIndexResult {
  cardId: string;
  indexedAt: number;
}

export interface PublicKnowledgeResult {
  resolvedUrl: string;
  text: string;
  truncated: boolean;
  segmentCount: number;
}

export interface SemanticSearchKnowledgeOptions {
  limit?: number;
  signal?: AbortSignal;
  allowedCardIds?: ReadonlySet<string> | readonly string[];
}

export interface KnowledgeRequestOptions {
  signal?: AbortSignal;
}

interface KnowledgeClientDependencies {
  initSupabase: () => Promise<boolean>;
  getSupabaseClient: () => SupabaseClient;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  isExtension: () => boolean;
}

const defaultDependencies: KnowledgeClientDependencies = {
  initSupabase: initBrowserSupabase,
  getSupabaseClient: getBrowserSupabaseClient,
  fetch: (input, init) => globalThis.fetch(input, init),
  isExtension: isChromeExtension,
};

let testDependencies: Partial<KnowledgeClientDependencies> | null = null;

function dependencies(): KnowledgeClientDependencies {
  return testDependencies
    ? { ...defaultDependencies, ...testDependencies }
    : defaultDependencies;
}

export function __setKnowledgeClientDependenciesForTest(
  overrides: Partial<KnowledgeClientDependencies>,
): void {
  testDependencies = { ...overrides };
}

export function __resetKnowledgeClientDependenciesForTest(): void {
  testDependencies = null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function characterLength(value: string): number {
  return Array.from(value).length;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new KnowledgeClientError("aborted");
}

function normalizedFailure(error: unknown, fallback: KnowledgeClientErrorCode, signal?: AbortSignal): KnowledgeClientError {
  if (error instanceof KnowledgeClientError) return error;
  if (signal?.aborted) return new KnowledgeClientError("aborted");
  if (error instanceof DOMException && error.name === "AbortError") {
    return new KnowledgeClientError("aborted");
  }
  return new KnowledgeClientError(fallback);
}

function mapServiceCode(
  rawCode: string,
  status: number,
  fallback: KnowledgeClientErrorCode,
): KnowledgeClientErrorCode {
  if (rawCode === "authentication-required" || status === 401) return "authentication-required";
  if (rawCode === "card-not-owned" || status === 403) return "forbidden";
  if (rawCode === "rate-limited" || rawCode === "embedding-rate-limited" || status === 429) {
    return "rate-limited";
  }
  if (rawCode === "embedding-timeout" || status === 504) return "timeout";
  if (rawCode === "remote-url-rejected") return "public-fetch-rejected";
  if (rawCode.startsWith("invalid-") || status === 400) return "invalid-request";
  if (rawCode === "semantic-search-failed") return "semantic-search-failed";
  if (rawCode.startsWith("index-")) return "index-failed";
  if (rawCode === "knowledge-fetch-failed" || rawCode.startsWith("upstream-")) {
    return "public-fetch-failed";
  }
  if (status >= 500) return "service-unavailable";
  return fallback;
}

async function responseErrorCode(response: Response | undefined): Promise<string> {
  if (!response) return "";
  try {
    const value = await response.clone().json() as unknown;
    return isRecord(value) && typeof value.error === "string" ? value.error : "";
  } catch {
    return "";
  }
}

async function serviceFailure(
  response: Response | undefined,
  fallback: KnowledgeClientErrorCode,
  signal?: AbortSignal,
): Promise<KnowledgeClientError> {
  if (signal?.aborted) return new KnowledgeClientError("aborted");
  const rawCode = await responseErrorCode(response);
  return new KnowledgeClientError(mapServiceCode(rawCode, response?.status ?? 0, fallback));
}

async function authenticatedContext(signal?: AbortSignal): Promise<{
  client: SupabaseClient;
  accessToken: string;
}> {
  assertNotAborted(signal);
  const deps = dependencies();
  let configured = false;
  try {
    configured = await deps.initSupabase();
  } catch (error) {
    throw normalizedFailure(error, "service-unavailable", signal);
  }
  if (!configured) throw new KnowledgeClientError("not-configured");

  assertNotAborted(signal);
  const client = deps.getSupabaseClient();
  try {
    const { data, error } = await client.auth.getSession();
    assertNotAborted(signal);
    const accessToken = data.session?.access_token?.trim() ?? "";
    if (error || !accessToken) throw new KnowledgeClientError("authentication-required");
    return { client, accessToken };
  } catch (error) {
    throw normalizedFailure(error, "authentication-required", signal);
  }
}

function normalizeAllowedCardIds(
  value: SemanticSearchKnowledgeOptions["allowedCardIds"],
): ReadonlySet<string> | null {
  if (!value) return null;
  return value instanceof Set ? value : new Set(value);
}

function validateSemanticResults(
  data: unknown,
  allowedCardIds: ReadonlySet<string> | null,
  limit: number,
): SemanticKnowledgeResult[] {
  if (!isRecord(data) || !Array.isArray(data.results)) {
    throw new KnowledgeClientError("invalid-response");
  }

  const results: SemanticKnowledgeResult[] = [];
  const seen = new Set<string>();
  for (const value of data.results) {
    if (!isRecord(value)) throw new KnowledgeClientError("invalid-response");
    const cardId = typeof value.cardId === "string" ? value.cardId.trim() : "";
    const contentHash = typeof value.contentHash === "string" ? value.contentHash : "";
    const similarity = value.similarity;
    if (
      !cardId
      || !CONTENT_HASH_PATTERN.test(contentHash)
      || typeof similarity !== "number"
      || !Number.isFinite(similarity)
      || similarity < -1
      || similarity > 1
    ) {
      throw new KnowledgeClientError("invalid-response");
    }
    if (seen.has(cardId) || (allowedCardIds && !allowedCardIds.has(cardId))) continue;
    seen.add(cardId);
    results.push({ cardId, contentHash: contentHash.toLowerCase(), similarity });
    if (results.length >= limit) break;
  }
  return results;
}

function normalizedIndexItems(items: readonly KnowledgeIndexItem[]): KnowledgeIndexItem[] {
  if (items.length < 1 || items.length > MAX_INDEX_BATCH_SIZE) {
    throw new KnowledgeClientError("invalid-request");
  }
  const seen = new Set<string>();
  return items.map((item) => {
    const cardId = item.cardId.trim();
    const contentHash = item.contentHash.trim().toLowerCase();
    const text = item.text.trim();
    if (
      !cardId
      || seen.has(cardId)
      || !CONTENT_HASH_PATTERN.test(contentHash)
      || !text
      || characterLength(text) > MAX_DOCUMENT_CHARACTERS
    ) {
      throw new KnowledgeClientError("invalid-request");
    }
    seen.add(cardId);
    return { cardId, contentHash, text };
  });
}

function validateIndexResults(data: unknown, requestedCardIds: ReadonlySet<string>): KnowledgeIndexResult[] {
  if (!isRecord(data) || !Array.isArray(data.indexed)) {
    throw new KnowledgeClientError("invalid-response");
  }
  const results: KnowledgeIndexResult[] = [];
  const seen = new Set<string>();
  for (const value of data.indexed) {
    if (!isRecord(value)) throw new KnowledgeClientError("invalid-response");
    const cardId = typeof value.cardId === "string" ? value.cardId.trim() : "";
    const indexedAt = value.indexedAt;
    if (!cardId || typeof indexedAt !== "number" || !Number.isFinite(indexedAt) || indexedAt <= 0) {
      throw new KnowledgeClientError("invalid-response");
    }
    if (!requestedCardIds.has(cardId) || seen.has(cardId)) continue;
    seen.add(cardId);
    results.push({ cardId, indexedAt });
  }
  return results;
}

export async function semanticSearchKnowledge(
  query: string,
  options: SemanticSearchKnowledgeOptions = {},
): Promise<SemanticKnowledgeResult[]> {
  const normalizedQuery = query.trim();
  if (characterLength(normalizedQuery) < 2 || characterLength(normalizedQuery) > MAX_QUERY_CHARACTERS) {
    throw new KnowledgeClientError("invalid-request");
  }
  const limit = Number.isFinite(options.limit)
    ? Math.max(1, Math.min(20, Math.floor(options.limit ?? 20)))
    : 20;
  const { client, accessToken } = await authenticatedContext(options.signal);
  try {
    const { data, error, response } = await client.functions.invoke<unknown>(BOOKMARK_SEARCH_FUNCTION, {
      body: { action: "search", query: normalizedQuery, limit },
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options.signal,
    });
    if (error) throw await serviceFailure(response, "semantic-search-failed", options.signal);
    return validateSemanticResults(data, normalizeAllowedCardIds(options.allowedCardIds), limit);
  } catch (error) {
    throw normalizedFailure(error, "semantic-search-failed", options.signal);
  }
}

export async function indexKnowledge(
  items: readonly KnowledgeIndexItem[],
  options: KnowledgeRequestOptions = {},
): Promise<KnowledgeIndexResult[]> {
  const normalizedItems = normalizedIndexItems(items);
  const { client, accessToken } = await authenticatedContext(options.signal);
  try {
    const { data, error, response } = await client.functions.invoke<unknown>(BOOKMARK_SEARCH_FUNCTION, {
      body: { action: "index", items: normalizedItems },
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options.signal,
    });
    if (error) throw await serviceFailure(response, "index-failed", options.signal);
    return validateIndexResults(data, new Set(normalizedItems.map((item) => item.cardId)));
  } catch (error) {
    throw normalizedFailure(error, "index-failed", options.signal);
  }
}

export async function removeKnowledgeEmbedding(
  cardId: string,
  options: KnowledgeRequestOptions = {},
): Promise<void> {
  const normalizedCardId = cardId.trim();
  if (!normalizedCardId) throw new KnowledgeClientError("invalid-request");
  const { client } = await authenticatedContext(options.signal);
  try {
    let request = client
      .from("bookmark_search_embeddings")
      .delete()
      .eq("card_id", normalizedCardId);
    if (options.signal) request = request.abortSignal(options.signal);
    const { error } = await request;
    if (error) throw new KnowledgeClientError("remove-failed");
  } catch (error) {
    throw normalizedFailure(error, "remove-failed", options.signal);
  }
}

function validatePublicKnowledge(data: unknown): PublicKnowledgeResult {
  if (!isRecord(data)) throw new KnowledgeClientError("invalid-response");
  const resolvedUrl = typeof data.resolvedUrl === "string" ? data.resolvedUrl : "";
  const text = typeof data.text === "string" ? data.text : "";
  const truncated = data.truncated;
  const segmentCount = data.segmentCount;
  let protocol = "";
  try {
    protocol = new URL(resolvedUrl).protocol;
  } catch {
    throw new KnowledgeClientError("invalid-response");
  }
  if (
    (protocol !== "http:" && protocol !== "https:")
    || characterLength(text) > MAX_DOCUMENT_CHARACTERS
    || typeof truncated !== "boolean"
    || typeof segmentCount !== "number"
    || !Number.isInteger(segmentCount)
    || segmentCount < 0
  ) {
    throw new KnowledgeClientError("invalid-response");
  }
  return { resolvedUrl, text, truncated, segmentCount };
}

export async function fetchPublicKnowledge(
  url: string,
  options: KnowledgeRequestOptions = {},
): Promise<PublicKnowledgeResult> {
  if (dependencies().isExtension()) {
    throw new KnowledgeClientError("extension-public-fetch-disabled");
  }
  let normalizedUrl = "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new KnowledgeClientError("invalid-request");
    }
    normalizedUrl = parsed.toString();
  } catch (error) {
    throw normalizedFailure(error, "invalid-request", options.signal);
  }

  const { accessToken } = await authenticatedContext(options.signal);
  try {
    const response = await dependencies().fetch("/api/knowledge/fetch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: normalizedUrl }),
      cache: "no-store",
      signal: options.signal,
    });
    if (!response.ok) throw await serviceFailure(response, "public-fetch-failed", options.signal);
    return validatePublicKnowledge(await response.json() as unknown);
  } catch (error) {
    throw normalizedFailure(error, "network-error", options.signal);
  }
}

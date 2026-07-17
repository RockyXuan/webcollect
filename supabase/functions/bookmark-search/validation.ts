export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_INDEX_VERSION = 1;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export interface IndexRequestItem {
  cardId: string;
  contentHash: string;
  text: string;
}

export type BookmarkSearchRequest =
  | { action: "index"; items: IndexRequestItem[] }
  | { action: "search"; query: string; limit: number };

export interface ExistingEmbeddingMetadata {
  content_hash?: unknown;
  model?: unknown;
  index_version?: unknown;
}

export class RequestValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "RequestValidationError";
  }
}

export function quotaUnitsForRequest(request: BookmarkSearchRequest): number {
  if (request.action === "search") return Array.from(request.query).length;
  return request.items.reduce(
    (total, item) => total + Array.from(item.text).length,
    0,
  );
}

export function needsEmbeddingRefresh(
  existing: ExistingEmbeddingMetadata | undefined,
  item: IndexRequestItem,
): boolean {
  return !existing ||
    existing.content_hash !== item.contentHash ||
    existing.model !== EMBEDDING_MODEL ||
    Number(existing.index_version) !== EMBEDDING_INDEX_VERSION;
}

export function parseBookmarkSearchRequest(
  value: unknown,
): BookmarkSearchRequest {
  if (!value || typeof value !== "object") {
    throw new RequestValidationError("invalid-request");
  }
  const candidate = value as Record<string, unknown>;

  if (candidate.action === "search") {
    const query = typeof candidate.query === "string"
      ? candidate.query.trim()
      : "";
    if (query.length < 2 || query.length > 200) {
      throw new RequestValidationError("invalid-query");
    }
    const requestedLimit = Number(candidate.limit ?? 20);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(20, Math.floor(requestedLimit)))
      : 20;
    return { action: "search", query, limit };
  }

  if (candidate.action === "index") {
    if (
      !Array.isArray(candidate.items) || candidate.items.length < 1 ||
      candidate.items.length > 32
    ) {
      throw new RequestValidationError("invalid-index-batch");
    }
    const seen = new Set<string>();
    const items = candidate.items.map((raw) => {
      if (!raw || typeof raw !== "object") {
        throw new RequestValidationError("invalid-index-item");
      }
      const item = raw as Record<string, unknown>;
      const cardId = typeof item.cardId === "string" ? item.cardId : "";
      const contentHash = typeof item.contentHash === "string"
        ? item.contentHash
        : "";
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!UUID_PATTERN.test(cardId) || seen.has(cardId)) {
        throw new RequestValidationError("invalid-card-id");
      }
      if (!HASH_PATTERN.test(contentHash)) {
        throw new RequestValidationError("invalid-content-hash");
      }
      if (!text || Array.from(text).length > 6000) {
        throw new RequestValidationError("invalid-document-text");
      }
      seen.add(cardId);
      return { cardId, contentHash, text };
    });
    return { action: "index", items };
  }

  throw new RequestValidationError("invalid-action");
}

import localforage from "localforage";
import { withStorageLock } from "./storage-lock";
import type { Category, CollectionSection, WebCard } from "./types";
import { buildKnowledgeDocument, hashKnowledgeDocument } from "./knowledge-index";
import { buildWorkspaceSearchIndex } from "./workspace-search";

export const EXTENSION_KNOWLEDGE_LEDGER_VERSION = 2;
const EXTENSION_KNOWLEDGE_LEDGER_KEY_PREFIX = "extension-ledger:v2:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_HASH_PATTERN = /^[0-9a-f]{64}$/i;

const knowledgeDb = localforage.createInstance({
  name: "WebCollectSearch",
  storeName: "knowledge_index",
});

export type ExtensionKnowledgeLedgerEntryStatus = "active" | "deleted";

export type ExtensionKnowledgeEmbeddingSource = "public-html" | "saved-fields";

export interface ExtensionKnowledgeEmbeddingState {
  cardId: string;
  source: ExtensionKnowledgeEmbeddingSource;
  contentHash: string;
}

export interface ExtensionKnowledgeLedgerEntry {
  cardId: string;
  /** Normalized URL whose lifecycle this observation represents. */
  sourceUrl: string;
  /** Last locally observed saved-fields document hash. */
  observedHash: string;
  /** Last saved-fields hash confirmed by a cloud read or successful index. */
  indexedSavedHash: string | null;
  /** Sticky observation used to distinguish an empty baseline from cloud loss. */
  hasEverHadCloudVector: boolean;
  status: ExtensionKnowledgeLedgerEntryStatus;
}

export interface ExtensionKnowledgeLedger {
  version: 2;
  scopeId: string;
  entries: ExtensionKnowledgeLedgerEntry[];
}

export interface ExtensionSavedFieldsIndexItem {
  cardId: string;
  contentHash: string;
  text: string;
}

export interface ExtensionKnowledgeLedgerPlanInput {
  scopeId: string;
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
  ledger: ExtensionKnowledgeLedger | null;
  embeddingStates: readonly ExtensionKnowledgeEmbeddingState[];
  /** Consent time. Pre-existing cards stay a zero-write first baseline. */
  baselineCutoffAt?: number | null;
}

export interface ExtensionKnowledgeLedgerPlan {
  /** A baseline observes the current collection without requesting any cloud mutation. */
  isInitialBaseline: boolean;
  indexItems: ExtensionSavedFieldsIndexItem[];
  deletedCardIds: string[];
  /** URL changes prune only the stale public-page document after saved fields are safe. */
  prunePublicHtmlCardIds: string[];
  nextLedger: ExtensionKnowledgeLedger;
}

function normalizeScopeId(scopeId: string): string {
  const normalized = scopeId.trim();
  if (!normalized) throw new Error("Extension knowledge ledger requires a user scope");
  return normalized;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeContentHash(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return CONTENT_HASH_PATTERN.test(normalized) ? normalized : null;
}

function normalizeSourceUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const normalized = new URL(trimmed);
    normalized.hash = "";
    return normalized.href;
  } catch {
    // Invalid legacy/user-entered URLs still need a stable lifecycle key. They
    // cannot be fetched as public HTML, but must not disappear from the ledger.
    return trimmed;
  }
}

function normalizeEntry(value: unknown): ExtensionKnowledgeLedgerEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ExtensionKnowledgeLedgerEntry>;
  if (typeof candidate.cardId !== "string" || !isUuid(candidate.cardId)) return null;
  if (typeof candidate.sourceUrl !== "string") return null;
  if (typeof candidate.observedHash !== "string") return null;
  if (candidate.indexedSavedHash !== null && typeof candidate.indexedSavedHash !== "string") return null;
  if (typeof candidate.hasEverHadCloudVector !== "boolean") return null;
  if (candidate.status !== "active" && candidate.status !== "deleted") return null;

  const observedHash = normalizeContentHash(candidate.observedHash);
  const indexedSavedHash = candidate.indexedSavedHash === null
    ? null
    : normalizeContentHash(candidate.indexedSavedHash);
  if (!observedHash || (candidate.indexedSavedHash !== null && !indexedSavedHash)) return null;
  return {
    cardId: candidate.cardId.toLowerCase(),
    sourceUrl: normalizeSourceUrl(candidate.sourceUrl),
    observedHash,
    indexedSavedHash,
    hasEverHadCloudVector: candidate.hasEverHadCloudVector,
    status: candidate.status,
  };
}

function normalizeEmbeddingStates(
  values: readonly ExtensionKnowledgeEmbeddingState[],
): Map<string, Map<ExtensionKnowledgeEmbeddingSource, string>> {
  const byCardId = new Map<string, Map<ExtensionKnowledgeEmbeddingSource, string>>();
  for (const value of values) {
    if (!value || !isUuid(value.cardId)) continue;
    if (value.source !== "public-html" && value.source !== "saved-fields") continue;
    const contentHash = normalizeContentHash(value.contentHash);
    if (!contentHash) continue;
    const cardId = value.cardId.toLowerCase();
    const bySource = byCardId.get(cardId) ?? new Map<ExtensionKnowledgeEmbeddingSource, string>();
    bySource.set(value.source, contentHash);
    byCardId.set(cardId, bySource);
  }
  return byCardId;
}

function changedAfterCutoff(card: WebCard, baselineCutoffAt?: number | null): boolean {
  if (baselineCutoffAt === null || baselineCutoffAt === undefined || !Number.isFinite(baselineCutoffAt)) {
    return false;
  }
  const createdAt = Number.isFinite(card.createdAt) ? card.createdAt : 0;
  const updatedAt = Number.isFinite(card.updatedAt) ? card.updatedAt : 0;
  return Math.max(createdAt, updatedAt) > baselineCutoffAt;
}

function normalizeEntries(values: unknown[]): ExtensionKnowledgeLedgerEntry[] {
  const byCardId = new Map<string, ExtensionKnowledgeLedgerEntry>();
  for (const value of values) {
    const entry = normalizeEntry(value);
    if (entry) byCardId.set(entry.cardId, entry);
  }
  return Array.from(byCardId.values()).sort((left, right) => left.cardId.localeCompare(right.cardId));
}

export function extensionKnowledgeLedgerKey(scopeId: string): string {
  return `${EXTENSION_KNOWLEDGE_LEDGER_KEY_PREFIX}${encodeURIComponent(normalizeScopeId(scopeId))}`;
}

export function normalizeExtensionKnowledgeLedger(
  value: unknown,
  expectedScopeId: string,
): ExtensionKnowledgeLedger | null {
  const scopeId = normalizeScopeId(expectedScopeId);
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ExtensionKnowledgeLedger>;
  if (
    candidate.version !== EXTENSION_KNOWLEDGE_LEDGER_VERSION
    || candidate.scopeId !== scopeId
    || !Array.isArray(candidate.entries)
  ) return null;

  return {
    version: EXTENSION_KNOWLEDGE_LEDGER_VERSION,
    scopeId,
    entries: normalizeEntries(candidate.entries),
  };
}

export async function getExtensionKnowledgeLedger(scopeId: string): Promise<ExtensionKnowledgeLedger | null> {
  const normalizedScopeId = normalizeScopeId(scopeId);
  const value = await knowledgeDb.getItem<unknown>(extensionKnowledgeLedgerKey(normalizedScopeId));
  return normalizeExtensionKnowledgeLedger(value, normalizedScopeId);
}

export async function saveExtensionKnowledgeLedger(
  scopeId: string,
  ledger: ExtensionKnowledgeLedger,
): Promise<void> {
  const normalizedScopeId = normalizeScopeId(scopeId);
  if (ledger.scopeId !== normalizedScopeId) {
    throw new Error("Extension knowledge ledger scope mismatch");
  }

  const safeLedger = normalizeExtensionKnowledgeLedger(ledger, normalizedScopeId);
  if (!safeLedger) throw new Error("Invalid extension knowledge ledger");

  const key = extensionKnowledgeLedgerKey(normalizedScopeId);
  await withStorageLock(`extension-knowledge-ledger:${key}`, () => (
    knowledgeDb.setItem(key, safeLedger).then(() => undefined)
  ));
}

/**
 * Computes an extension-side observation plan without reading storage, calling
 * the network, or mutating any input. The first observation is deliberately a
 * zero-write baseline; subsequent observations emit only saved-field deltas.
 */
export async function planExtensionKnowledgeLedger({
  scopeId: rawScopeId,
  cards,
  categories,
  sections,
  ledger,
  embeddingStates,
  baselineCutoffAt,
}: ExtensionKnowledgeLedgerPlanInput): Promise<ExtensionKnowledgeLedgerPlan> {
  const scopeId = normalizeScopeId(rawScopeId);
  const previous = ledger
    ? normalizeExtensionKnowledgeLedger(ledger, scopeId)
    : null;
  const isInitialBaseline = previous === null;
  const previousByCardId = new Map(previous?.entries.map((entry) => [entry.cardId, entry]) ?? []);
  const cloudByCardId = normalizeEmbeddingStates(embeddingStates);

  const authoritativeCards = new Map<string, WebCard>();
  for (const card of cards) {
    if (!isUuid(card.id)) continue;
    const cardId = card.id.toLowerCase();
    if (!authoritativeCards.has(cardId)) authoritativeCards.set(cardId, card);
  }

  const searchIndex = buildWorkspaceSearchIndex({ cards, categories, sections });
  const pathByCardId = new Map(
    searchIndex.cardEntries
      .filter((entry) => isUuid(entry.card.id))
      .map((entry) => [entry.card.id.toLowerCase(), entry.pathLabels] as const),
  );

  const currentItems: ExtensionSavedFieldsIndexItem[] = [];
  const currentSourceUrls = new Map<string, string>();
  for (const [cardId, card] of Array.from(authoritativeCards.entries()).sort(([left], [right]) => left.localeCompare(right))) {
    const text = buildKnowledgeDocument({
      card,
      pathLabels: pathByCardId.get(cardId) ?? [],
    });
    currentItems.push({ cardId, contentHash: await hashKnowledgeDocument(text), text });
    currentSourceUrls.set(cardId, normalizeSourceUrl(card.url));
  }

  const currentByCardId = new Map(currentItems.map((item) => [item.cardId, item]));
  const indexItems = currentItems.filter((item) => {
    const previousEntry = previousByCardId.get(item.cardId);
    const cloudSources = cloudByCardId.get(item.cardId);
    const cloudSavedHash = cloudSources?.get("saved-fields") ?? null;

    if (isInitialBaseline) {
      const currentCard = authoritativeCards.get(item.cardId);
      return Boolean(currentCard && changedAfterCutoff(currentCard, baselineCutoffAt));
    }

    // URL changes can leave a public-html row describing the previous page.
    // Even when the saved document hash happens to stay equal (for example,
    // only the path changed on the same host), never prune that row until the
    // current saved-fields hash is independently confirmed in the cloud.
    if (
      previousEntry?.status === "active"
      && previousEntry.sourceUrl !== currentSourceUrls.get(item.cardId)
    ) {
      return cloudSavedHash !== item.contentHash;
    }

    // A new/restored card needs a saved-fields row unless another successful
    // tab or a previous server-committed request already installed this hash.
    if (!previousEntry || previousEntry.status === "deleted") {
      return cloudSavedHash !== item.contentHash;
    }

    if (previousEntry.observedHash !== item.contentHash) {
      return cloudSavedHash !== item.contentHash;
    }

    // Do not backfill a baseline that never had a vector. Once a vector has
    // been observed, however, complete cloud loss must be repaired.
    if (previousEntry.hasEverHadCloudVector && !cloudSources?.size) return true;

    // If this ledger expected a saved-fields row, its absence or replacement
    // is a repairable drift even when the local document hash did not change.
    if (previousEntry.indexedSavedHash !== null && cloudSavedHash !== item.contentHash) return true;

    // A newly observed stale saved-fields row should not outrank fresher local
    // data (the search RPC prefers saved-fields on equal similarity).
    return cloudSavedHash !== null && cloudSavedHash !== item.contentHash;
  });

  const deletedCardIds = isInitialBaseline
    ? []
    : Array.from(previousByCardId.values())
      .filter((entry) => (
        !currentByCardId.has(entry.cardId)
        && (entry.status === "active" || Boolean(cloudByCardId.get(entry.cardId)?.size))
      ))
      .map((entry) => entry.cardId)
      .sort((left, right) => left.localeCompare(right));

  const prunePublicHtmlCardIds = isInitialBaseline
    ? []
    : currentItems
      .filter((item) => {
        const previousEntry = previousByCardId.get(item.cardId);
        return previousEntry?.status === "active"
          && previousEntry.sourceUrl !== currentSourceUrls.get(item.cardId);
      })
      .map((item) => item.cardId);

  const nextEntries = new Map<string, ExtensionKnowledgeLedgerEntry>();
  for (const previousEntry of previousByCardId.values()) {
    if (!currentByCardId.has(previousEntry.cardId)) {
      nextEntries.set(previousEntry.cardId, {
        ...previousEntry,
        indexedSavedHash: null,
        hasEverHadCloudVector: previousEntry.hasEverHadCloudVector
          || Boolean(cloudByCardId.get(previousEntry.cardId)?.size),
        status: "deleted",
      });
    }
  }
  const indexedIds = new Set(indexItems.map((item) => item.cardId));
  for (const item of currentItems) {
    const previousEntry = previousByCardId.get(item.cardId);
    const cloudSources = cloudByCardId.get(item.cardId);
    const willIndex = indexedIds.has(item.cardId);
    nextEntries.set(item.cardId, {
      cardId: item.cardId,
      sourceUrl: currentSourceUrls.get(item.cardId) ?? "",
      observedHash: item.contentHash,
      indexedSavedHash: willIndex
        ? item.contentHash
        : cloudSources?.get("saved-fields") ?? null,
      hasEverHadCloudVector: Boolean(
        previousEntry?.hasEverHadCloudVector
        || cloudSources?.size
        || willIndex
      ),
      status: "active",
    });
  }

  return {
    isInitialBaseline,
    indexItems,
    deletedCardIds,
    prunePublicHtmlCardIds,
    nextLedger: {
      version: EXTENSION_KNOWLEDGE_LEDGER_VERSION,
      scopeId,
      entries: Array.from(nextEntries.values()).sort((left, right) => left.cardId.localeCompare(right.cardId)),
    },
  };
}

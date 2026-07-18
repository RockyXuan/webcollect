import {
  buildKnowledgeSourceDocumentTexts,
  createKnowledgeBuildState,
  getKnowledgeCacheSourceHash,
  getKnowledgeBuildState,
  getKnowledgeCacheEntry,
  hashKnowledgeDocumentSet,
  hashKnowledgeSourceDocuments,
  saveKnowledgeBuildState,
  saveKnowledgeCacheEntry,
  type KnowledgeBuildState,
  type KnowledgeCacheEntry,
  type KnowledgeExtractionSource,
} from "./knowledge-index";
import type { WebCard } from "./types";

const FETCH_CONCURRENCY = 2;
const INDEX_BATCH_SIZE = 32;
const RETRYABLE_FETCH_FAILURES = new Set(["network", "timeout", "rate-limited", "fetch-failed"]);

export interface KnowledgeFetchResult {
  resolvedUrl: string;
  text: string;
}

export interface KnowledgeIndexItem {
  cardId: string;
  contentHash: string;
  text: string;
  source: KnowledgeExtractionSource;
}

export interface KnowledgeIndexResult {
  cardId: string;
  contentHash: string;
  indexedAt: number;
  source: KnowledgeExtractionSource;
}

export interface KnowledgeIndexGuard {
  cardId: string;
  sourceUrl: string;
  savedFieldsHash: string;
}

export class KnowledgeWorkspaceChangedError extends Error {
  constructor(message = "knowledge-workspace-changed") {
    super(message);
    this.name = "KnowledgeWorkspaceChangedError";
  }
}

export interface KnowledgeExistingEmbeddingState {
  cardId: string;
  contentHash: string;
  source: KnowledgeExtractionSource;
}

export interface RunKnowledgeBuildOptions {
  scopeId: string;
  cards: WebCard[];
  targetCardIds?: readonly string[];
  pathLabelsByCardId: ReadonlyMap<string, string[]>;
  existingEmbeddingStates?: readonly KnowledgeExistingEmbeddingState[];
  fetchPublicPage?: (url: string, signal: AbortSignal) => Promise<KnowledgeFetchResult>;
  indexDocuments?: (
    items: KnowledgeIndexItem[],
    guards: KnowledgeIndexGuard[],
    signal: AbortSignal,
  ) => Promise<KnowledgeIndexResult[]>;
  removeEmbedding?: (
    cardId: string,
    source: KnowledgeExtractionSource,
    signal: AbortSignal,
  ) => Promise<void>;
  resume?: boolean;
  signal?: AbortSignal;
  onProgress?: (state: KnowledgeBuildState) => void;
}

function cloneState(state: KnowledgeBuildState): KnowledgeBuildState {
  return {
    ...state,
    jobs: state.jobs.map((job) => ({ ...job })),
  };
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

function normalizeSourceUrl(url: string): string | null {
  try {
    const normalized = new URL(url.trim());
    normalized.hash = "";
    return normalized.href;
  } catch {
    return null;
  }
}

function embeddingKey(cardId: string, source: KnowledgeExtractionSource): string {
  return `${cardId}:${source}`;
}

function embeddingReceiptKey(
  cardId: string,
  source: KnowledgeExtractionSource,
  contentHash: string,
): string {
  return `${embeddingKey(cardId, source)}:${contentHash}`;
}

function isValidIndexResult(result: KnowledgeIndexResult): boolean {
  return typeof result.cardId === "string"
    && (result.source === "saved-fields" || result.source === "public-html")
    && /^[a-f0-9]{64}$/i.test(result.contentHash)
    && Number.isFinite(result.indexedAt)
    && result.indexedAt > 0;
}

/**
 * Validates every Edge Function acknowledgement against the exact requested
 * source/hash identity. Missing receipts are handled per item by the caller;
 * duplicate, malformed, unexpected, or missing source/hash results must never
 * mark the corresponding local cache marker as indexed.
 */
export function validateKnowledgeIndexReceipts(
  requested: readonly KnowledgeIndexItem[],
  received: readonly KnowledgeIndexResult[],
): Map<string, number> {
  const requestedKeys = new Set<string>();
  for (const item of requested) {
    const key = embeddingReceiptKey(item.cardId, item.source, item.contentHash.toLowerCase());
    if (requestedKeys.has(key)) throw new Error("duplicate-index-request");
    requestedKeys.add(key);
  }

  const receipts = new Map<string, number>();
  for (const result of received) {
    if (!isValidIndexResult(result)) throw new Error("invalid-index-receipt");
    const key = embeddingReceiptKey(
      result.cardId,
      result.source,
      result.contentHash.toLowerCase(),
    );
    if (!requestedKeys.has(key)) throw new Error("unexpected-index-receipt");
    if (receipts.has(key)) throw new Error("duplicate-index-receipt");
    receipts.set(key, result.indexedAt);
  }
  return receipts;
}

export function expectedEmbeddingSourcesAreCurrent(
  expected: readonly Pick<KnowledgeIndexItem, "cardId" | "source" | "contentHash">[],
  existing: readonly KnowledgeExistingEmbeddingState[],
): boolean {
  const existingByKey = new Map(existing.map((item) => [
    embeddingKey(item.cardId, item.source),
    item.contentHash.toLowerCase(),
  ]));
  return expected.every((item) => (
    existingByKey.get(embeddingKey(item.cardId, item.source)) === item.contentHash.toLowerCase()
  ));
}

function canReuseExtractedText(existing: KnowledgeCacheEntry | null, currentUrl: string): boolean {
  if (!existing) return false;
  const existingSourceUrl = normalizeSourceUrl(existing.sourceUrl);
  const normalizedCurrentUrl = normalizeSourceUrl(currentUrl);
  return existingSourceUrl !== null
    && normalizedCurrentUrl !== null
    && existingSourceUrl === normalizedCurrentUrl;
}

function failureCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "aborted";
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate.?limit/i.test(message)) return "rate-limited";
  if (/timeout|timed out/i.test(message)) return "timeout";
  if (/private|公网|unsafe|url policy|public-fetch-rejected|invalid-request/i.test(message)) return "unsafe-url";
  if (/content.?type|html/i.test(message)) return "unsupported-content";
  if (/too large|内容过大|大小限制/i.test(message)) return "too-large";
  if (/\b5\d\d\b|network|fetch/i.test(message)) return "network";
  return "fetch-failed";
}

async function fetchPublicPage(
  fetchPage: RunKnowledgeBuildOptions["fetchPublicPage"],
  url: string,
  signal: AbortSignal,
): Promise<KnowledgeFetchResult> {
  if (!fetchPage) return { resolvedUrl: url, text: "" };
  return fetchPage(url, signal);
}

function createRunState(
  cards: WebCard[],
  previous: KnowledgeBuildState | null,
  runId: string,
  resume: boolean,
  targetCardIds: readonly string[] | undefined,
): { state: KnowledgeBuildState; runnableCardIds: Set<string> } {
  const previousById = new Map((previous?.jobs ?? []).map((job) => [job.cardId, job]));
  const targets = targetCardIds === undefined ? null : new Set(targetCardIds);
  const runnableCardIds = new Set<string>();
  const jobs = cards.map((card) => {
    const old = previousById.get(card.id);
    const resumeNeedsWork = old?.status !== "complete"
      || Boolean(old.failureCode && RETRYABLE_FETCH_FAILURES.has(old.failureCode));
    const shouldRun = targets === null
      ? !resume || resumeNeedsWork
      : !old || (targets.has(card.id) && (!resume || resumeNeedsWork));

    if (!shouldRun && old) return { ...old };
    runnableCardIds.add(card.id);
    return {
      cardId: card.id,
      generation: (old?.generation ?? 0) + 1,
      status: "pending" as const,
      attempts: old?.attempts ?? 0,
    };
  });

  return {
    state: {
      ...createKnowledgeBuildState([], runId),
      jobs,
    },
    runnableCardIds,
  };
}

async function runKnowledgeBuildWithSignal(
  options: RunKnowledgeBuildOptions,
  signal: AbortSignal,
): Promise<KnowledgeBuildState> {
  const runId = globalThis.crypto.randomUUID();
  const needsPreviousLedger = options.resume === true || options.targetCardIds !== undefined;
  const previous = needsPreviousLedger ? await getKnowledgeBuildState(options.scopeId) : null;
  const { state, runnableCardIds } = createRunState(
    options.cards,
    previous,
    runId,
    options.resume === true,
    options.targetCardIds,
  );
  const cardById = new Map(options.cards.map((card) => [card.id, card]));
  const knownEmbeddingHashes = options.existingEmbeddingStates === undefined
    ? null
    : new Map(options.existingEmbeddingStates.map((item) => [
        embeddingKey(item.cardId, item.source),
        item.contentHash.toLowerCase(),
      ]));
  let persistence = Promise.resolve();

  const persist = () => {
    const snapshot = cloneState(state);
    persistence = persistence.then(() => saveKnowledgeBuildState(options.scopeId, snapshot));
    options.onProgress?.(snapshot);
    return persistence;
  };

  await persist();

  const jobs = state.jobs.filter((job) => runnableCardIds.has(job.cardId) && job.status !== "complete");
  const hostTails = new Map<string, Promise<void>>();

  for (let batchStart = 0; batchStart < jobs.length && !signal.aborted; batchStart += INDEX_BATCH_SIZE) {
    const batchJobs = jobs.slice(batchStart, batchStart + INDEX_BATCH_SIZE);
    const prepared: Array<{
      entry: KnowledgeCacheEntry;
      guard: KnowledgeIndexGuard;
      missingItems: KnowledgeIndexItem[];
      prunePublicHtml: boolean;
      fetchFailure?: string;
    }> = [];
    let nextIndex = 0;

    const worker = async () => {
      while (!signal.aborted) {
        const jobIndex = nextIndex;
        nextIndex += 1;
        const job = batchJobs[jobIndex];
        if (!job) return;
        const card = cardById.get(job.cardId);
        if (!card) {
          job.status = "failed";
          job.failureCode = "missing-card";
          await persist();
          continue;
        }

        job.status = "fetching";
        job.attempts += 1;
        delete job.failureCode;
        await persist();

        const host = hostname(card.url);
        const previousHostTail = hostTails.get(host) ?? Promise.resolve();
        let releaseHost: (() => void) | undefined;
        const currentHostTail = new Promise<void>((resolve) => { releaseHost = resolve; });
        hostTails.set(host, previousHostTail.then(() => currentHostTail));

        const existing = await getKnowledgeCacheEntry(options.scopeId, card.id);
        const reuseExistingExtraction = canReuseExtractedText(existing, card.url);
        const sourceUrlChanged = existing !== null && !reuseExistingExtraction;
        let fetched: KnowledgeFetchResult = {
          resolvedUrl: reuseExistingExtraction ? existing?.resolvedUrl || card.url : card.url,
          text: reuseExistingExtraction ? existing?.extractedText || "" : "",
        };
        let fetchFailure: string | undefined;
        try {
          await previousHostTail;
          if (options.fetchPublicPage) {
            fetched = await fetchPublicPage(options.fetchPublicPage, card.url, signal);
          }
        } catch (error) {
          if (signal.aborted) return;
          fetchFailure = failureCode(error);
        } finally {
          releaseHost?.();
        }

        const sourceDocuments = await hashKnowledgeSourceDocuments(buildKnowledgeSourceDocumentTexts({
          card,
          pathLabels: options.pathLabelsByCardId.get(card.id) ?? [],
          extractedText: fetched.text,
        }));
        const contentHash = await hashKnowledgeDocumentSet(sourceDocuments);
        const expectedItems = sourceDocuments.map((document) => ({
          cardId: card.id,
          contentHash: document.contentHash,
          text: document.text,
          source: document.source,
        } satisfies KnowledgeIndexItem));
        const sourceIsCurrent = (item: KnowledgeIndexItem) => {
          const expectedHash = item.contentHash.toLowerCase();
          if (knownEmbeddingHashes !== null) {
            return knownEmbeddingHashes.get(embeddingKey(card.id, item.source)) === expectedHash;
          }
          return existing?.indexedAt !== null
            && getKnowledgeCacheSourceHash(existing, item.source) === expectedHash
            && existing?.failureCode !== "prune-public-html-failed";
        };
        const missingItems = expectedItems.filter((item) => !sourceIsCurrent(item));
        const hasPublicHtml = sourceDocuments.some((document) => document.source === "public-html");
        const stalePublicHtmlExists = Boolean(existing?.extractedText)
          || knownEmbeddingHashes?.has(embeddingKey(card.id, "public-html")) === true;
        const prunePublicHtml = !hasPublicHtml && (
          sourceUrlChanged
          // A transient fetch failure is not evidence that a same-URL public
          // document became invalid. Keep the last cloud vector until a
          // successful empty extraction proves there is no public text.
          || (fetchFailure === undefined && stalePublicHtmlExists)
          || existing?.failureCode === "prune-public-html-failed"
        );
        const allSourcesCurrent = missingItems.length === 0;
        const savedFields = sourceDocuments.find((document) => document.source === "saved-fields");
        const publicHtml = sourceDocuments.find((document) => document.source === "public-html");
        if (!savedFields) {
          job.status = "failed";
          job.failureCode = "missing-saved-fields-document";
          await persist();
          continue;
        }
        const entry: KnowledgeCacheEntry = {
          schemaVersion: 1,
          scopeId: options.scopeId,
          cardId: card.id,
          sourceUrl: card.url,
          resolvedUrl: fetched.resolvedUrl,
          contentHash,
          savedFieldsHash: savedFields.contentHash,
          ...(publicHtml ? { publicHtmlHash: publicHtml.contentHash } : {}),
          documentText: savedFields.text,
          extractedText: fetched.text,
          extraction: hasPublicHtml ? "public-html" : "saved-fields",
          fetchedAt: Date.now(),
          indexedAt: allSourcesCurrent && !prunePublicHtml
            ? existing?.indexedAt ?? Date.now()
            : null,
          ...(fetchFailure ? { failureCode: fetchFailure } : {}),
        };
        await saveKnowledgeCacheEntry(entry);

        if ((allSourcesCurrent && !prunePublicHtml) || !options.indexDocuments) {
          job.status = "complete";
          if (fetchFailure) job.failureCode = fetchFailure;
        } else {
          job.status = "embedding";
          if (fetchFailure) job.failureCode = fetchFailure;
          prepared.push({
            entry,
            guard: {
              cardId: card.id,
              sourceUrl: normalizeSourceUrl(card.url) ?? card.url.trim(),
              savedFieldsHash: savedFields.contentHash,
            },
            missingItems,
            prunePublicHtml,
            ...(fetchFailure ? { fetchFailure } : {}),
          });
        }
        await persist();
      }
    };

    await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, batchJobs.length) }, () => worker()));
    if (signal.aborted) break;

    if (prepared.length > 0 && options.indexDocuments) {
      const receipts = new Map<string, number>();
      const failedCards = new Map<string, "index-failed" | "index-missing-result">();
      const itemsToIndex = prepared.flatMap((item) => item.missingItems);

      for (let itemStart = 0; itemStart < itemsToIndex.length && !signal.aborted; itemStart += INDEX_BATCH_SIZE) {
        const indexBatch = itemsToIndex.slice(itemStart, itemStart + INDEX_BATCH_SIZE);
        // Validate the complete prepared card batch before every network slice.
        // A dual-source batch can require two <=32-item HTTP requests; checking
        // only the cards present in the first slice could upload half of an old
        // workspace before a changed card in the second slice is noticed.
        const batchGuards = prepared.map((item) => item.guard);
        try {
          const indexed = await options.indexDocuments(indexBatch, batchGuards, signal);
          const batchReceipts = validateKnowledgeIndexReceipts(indexBatch, indexed);
          for (const [key, indexedAt] of batchReceipts) receipts.set(key, indexedAt);
        } catch (error) {
          if (error instanceof KnowledgeWorkspaceChangedError) {
            for (const item of prepared) {
              const job = state.jobs.find((candidate) => candidate.cardId === item.entry.cardId);
              if (job) job.status = "pending";
            }
            state.status = "paused";
            state.runId = null;
            await persist();
            await persistence;
            throw error;
          }
          const reason = error instanceof Error && /receipt|duplicate-index-request/.test(error.message)
            ? "index-missing-result"
            : "index-failed";
          for (const indexItem of indexBatch) failedCards.set(indexItem.cardId, reason);
        }
      }

      for (const item of prepared) {
        const job = state.jobs.find((candidate) => candidate.cardId === item.entry.cardId);
        if (!job) continue;
        if (signal.aborted) {
          job.status = "pending";
          continue;
        }
        const missingReceipt = item.missingItems.some((indexItem) => !receipts.has(
          embeddingReceiptKey(indexItem.cardId, indexItem.source, indexItem.contentHash.toLowerCase()),
        ));
        if (failedCards.has(item.entry.cardId) || missingReceipt) {
          job.status = "failed";
          job.failureCode = failedCards.get(item.entry.cardId) ?? "index-missing-result";
          continue;
        }

        if (item.prunePublicHtml) {
          if (!options.removeEmbedding) {
            await saveKnowledgeCacheEntry({
              ...item.entry,
              failureCode: "prune-public-html-failed",
              indexedAt: null,
            });
            job.status = "failed";
            job.failureCode = "prune-public-html-failed";
            continue;
          }
          try {
            await options.removeEmbedding(item.entry.cardId, "public-html", signal);
          } catch {
            await saveKnowledgeCacheEntry({
              ...item.entry,
              failureCode: "prune-public-html-failed",
              indexedAt: null,
            });
            job.status = signal.aborted ? "pending" : "failed";
            if (!signal.aborted) job.failureCode = "prune-public-html-failed";
            continue;
          }
        }

        const receiptTimes = item.missingItems.flatMap((indexItem) => {
          const indexedAt = receipts.get(embeddingReceiptKey(
            indexItem.cardId,
            indexItem.source,
            indexItem.contentHash.toLowerCase(),
          ));
          return indexedAt === undefined ? [] : [indexedAt];
        });
        const indexedAt = receiptTimes.length > 0
          ? Math.max(...receiptTimes)
          : item.entry.indexedAt ?? Date.now();
        const completedEntry: KnowledgeCacheEntry = {
          ...item.entry,
          indexedAt,
        };
        if (item.fetchFailure) completedEntry.failureCode = item.fetchFailure;
        else delete completedEntry.failureCode;
        await saveKnowledgeCacheEntry(completedEntry);
        job.status = "complete";
        if (item.fetchFailure) job.failureCode = item.fetchFailure;
        else delete job.failureCode;
      }
      await persist();
    }
  }

  state.status = signal.aborted || state.jobs.some((job) => job.status === "pending")
    ? "paused"
    : state.jobs.some((job) => (
        job.status === "failed"
        || Boolean(job.failureCode && RETRYABLE_FETCH_FAILURES.has(job.failureCode))
      ))
      ? "complete-with-errors"
      : "complete";
  state.runId = state.status === "paused" ? null : runId;
  await persist();
  await persistence;
  return cloneState(state);
}

export async function runKnowledgeBuild(options: RunKnowledgeBuildOptions): Promise<KnowledgeBuildState> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();

  options.signal?.addEventListener("abort", forwardAbort, { once: true });
  if (options.signal?.aborted) controller.abort();

  try {
    return await runKnowledgeBuildWithSignal(options, controller.signal);
  } finally {
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}

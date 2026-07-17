import {
  buildKnowledgeDocument,
  createKnowledgeBuildState,
  getKnowledgeBuildState,
  getKnowledgeCacheEntry,
  hashKnowledgeDocument,
  saveKnowledgeBuildState,
  saveKnowledgeCacheEntry,
  type KnowledgeBuildState,
  type KnowledgeCacheEntry,
} from "./knowledge-index";
import type { WebCard } from "./types";

const FETCH_CONCURRENCY = 2;
const INDEX_BATCH_SIZE = 32;

export interface KnowledgeFetchResult {
  resolvedUrl: string;
  text: string;
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

export interface RunKnowledgeBuildOptions {
  scopeId: string;
  cards: WebCard[];
  pathLabelsByCardId: ReadonlyMap<string, string[]>;
  fetchPublicPage?: (url: string, signal: AbortSignal) => Promise<KnowledgeFetchResult>;
  indexDocuments?: (items: KnowledgeIndexItem[], signal: AbortSignal) => Promise<KnowledgeIndexResult[]>;
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

function failureCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "aborted";
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate.?limit/i.test(message)) return "rate-limited";
  if (/timeout|timed out/i.test(message)) return "timeout";
  if (/private|公网|unsafe|url policy/i.test(message)) return "unsafe-url";
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

function shouldRetryPreviousJob(status: string, code: string | undefined): boolean {
  if (status === "failed") return true;
  return code === "network"
    || code === "timeout"
    || code === "rate-limited"
    || code === "fetch-failed";
}

function createResumeState(cards: WebCard[], previous: KnowledgeBuildState | null, runId: string): KnowledgeBuildState {
  if (!previous) return createKnowledgeBuildState(cards.map((card) => card.id), runId);
  const previousById = new Map(previous.jobs.map((job) => [job.cardId, job]));
  return {
    ...createKnowledgeBuildState([], runId),
    jobs: cards.map((card) => {
      const old = previousById.get(card.id);
      if (old?.status === "complete" && !shouldRetryPreviousJob(old.status, old.failureCode)) {
        return { ...old };
      }
      return {
        cardId: card.id,
        generation: (old?.generation ?? 0) + 1,
        status: "pending" as const,
        attempts: old?.attempts ?? 0,
      };
    }),
  };
}

export async function runKnowledgeBuild(options: RunKnowledgeBuildOptions): Promise<KnowledgeBuildState> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener("abort", forwardAbort, { once: true });
  const signal = controller.signal;
  const runId = globalThis.crypto.randomUUID();
  const previous = options.resume ? await getKnowledgeBuildState(options.scopeId) : null;
  const state = createResumeState(options.cards, previous, runId);
  const cardById = new Map(options.cards.map((card) => [card.id, card]));
  let persistence = Promise.resolve();

  const persist = () => {
    const snapshot = cloneState(state);
    persistence = persistence.then(() => saveKnowledgeBuildState(options.scopeId, snapshot));
    options.onProgress?.(snapshot);
    return persistence;
  };

  await persist();

  const jobs = state.jobs.filter((job) => job.status !== "complete");
  const hostTails = new Map<string, Promise<void>>();

  for (let batchStart = 0; batchStart < jobs.length && !signal.aborted; batchStart += INDEX_BATCH_SIZE) {
    const batchJobs = jobs.slice(batchStart, batchStart + INDEX_BATCH_SIZE);
    const prepared: Array<{ entry: KnowledgeCacheEntry; indexItem: KnowledgeIndexItem }> = [];
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
        let fetched: KnowledgeFetchResult = {
          resolvedUrl: existing?.resolvedUrl || card.url,
          text: existing?.extractedText || "",
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

        const documentText = buildKnowledgeDocument({
          card,
          pathLabels: options.pathLabelsByCardId.get(card.id) ?? [],
          extractedText: fetched.text,
        });
        const contentHash = await hashKnowledgeDocument(documentText);
        const unchangedAndIndexed = existing?.contentHash === contentHash && existing.indexedAt !== null;
        const entry: KnowledgeCacheEntry = {
          schemaVersion: 1,
          scopeId: options.scopeId,
          cardId: card.id,
          sourceUrl: card.url,
          resolvedUrl: fetched.resolvedUrl,
          contentHash,
          documentText,
          extractedText: fetched.text,
          extraction: fetched.text ? "public-html" : "saved-fields",
          fetchedAt: Date.now(),
          indexedAt: unchangedAndIndexed ? existing.indexedAt : null,
          ...(fetchFailure ? { failureCode: fetchFailure } : {}),
        };
        await saveKnowledgeCacheEntry(entry);

        if (unchangedAndIndexed || !options.indexDocuments) {
          job.status = "complete";
          if (fetchFailure) job.failureCode = fetchFailure;
        } else {
          job.status = "embedding";
          if (fetchFailure) job.failureCode = fetchFailure;
          prepared.push({ entry, indexItem: { cardId: card.id, contentHash, text: documentText } });
        }
        await persist();
      }
    };

    await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, batchJobs.length) }, () => worker()));
    if (signal.aborted) break;

    if (prepared.length > 0 && options.indexDocuments) {
      try {
        const indexed = await options.indexDocuments(prepared.map((item) => item.indexItem), signal);
        const indexedById = new Map(indexed.map((item) => [item.cardId, item.indexedAt]));
        for (const item of prepared) {
          const job = state.jobs.find((candidate) => candidate.cardId === item.entry.cardId);
          const indexedAt = indexedById.get(item.entry.cardId);
          if (!job || !indexedAt) {
            if (job) {
              job.status = "failed";
              job.failureCode = "index-missing-result";
            }
            continue;
          }
          await saveKnowledgeCacheEntry({ ...item.entry, indexedAt });
          job.status = "complete";
        }
      } catch {
        for (const item of prepared) {
          const job = state.jobs.find((candidate) => candidate.cardId === item.entry.cardId);
          if (job) {
            job.status = "failed";
            job.failureCode = "index-failed";
          }
        }
      }
      await persist();
    }
  }

  state.status = signal.aborted
    ? "paused"
    : state.jobs.some((job) => job.status === "failed")
      ? "complete-with-errors"
      : "complete";
  state.runId = signal.aborted ? null : runId;
  await persist();
  await persistence;
  options.signal?.removeEventListener("abort", forwardAbort);
  return cloneState(state);
}

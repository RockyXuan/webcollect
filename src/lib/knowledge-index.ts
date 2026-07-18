import localforage from "localforage";
import { withStorageLock } from "./storage-lock";
import type { WebCard } from "./types";

export const KNOWLEDGE_INDEX_VERSION = 1;
export const KNOWLEDGE_CONSENT_VERSION = 1;

const knowledgeDb = localforage.createInstance({
  name: "WebCollectSearch",
  storeName: "knowledge_index",
});

export type KnowledgeExtractionSource = "saved-fields" | "public-html";
export type KnowledgeBuildStatus = "idle" | "running" | "paused" | "complete" | "complete-with-errors";
export type KnowledgeJobStatus = "pending" | "fetching" | "embedding" | "complete" | "failed";

export interface KnowledgeCacheEntry {
  schemaVersion: 1;
  scopeId: string;
  cardId: string;
  sourceUrl: string;
  resolvedUrl: string;
  contentHash: string;
  /**
   * A cache marker for the complete derived document set. `contentHash` is not
   * the hash of either cloud row; these source-specific hashes are the only
   * values that may be compared with embedding state returned by Supabase.
   */
  savedFieldsHash?: string;
  publicHtmlHash?: string;
  documentText: string;
  extractedText: string;
  extraction: KnowledgeExtractionSource;
  fetchedAt: number;
  indexedAt: number | null;
  failureCode?: string;
}

export interface KnowledgeBuildJob {
  cardId: string;
  generation: number;
  status: KnowledgeJobStatus;
  attempts: number;
  failureCode?: string;
}

export interface KnowledgeBuildState {
  version: 1;
  consentVersion: 1;
  runId: string | null;
  status: KnowledgeBuildStatus;
  jobs: KnowledgeBuildJob[];
  updatedAt: number;
}

export interface KnowledgeConsentRecord {
  version: 1;
  consentedAt: number;
}

export interface KnowledgeDocumentInput {
  card: WebCard;
  pathLabels: string[];
  extractedText?: string;
}

export interface KnowledgeSourceDocumentText {
  source: KnowledgeExtractionSource;
  text: string;
}

export interface HashedKnowledgeSourceDocument extends KnowledgeSourceDocumentText {
  contentHash: string;
}

const MAX_KNOWLEDGE_DOCUMENT_CHARACTERS = 6_000;

function normalizedScopeId(scopeId: string): string {
  return scopeId.trim() || "local";
}

function cacheKey(scopeId: string, cardId: string): string {
  return `entry:v${KNOWLEDGE_INDEX_VERSION}:${encodeURIComponent(normalizedScopeId(scopeId))}:${encodeURIComponent(cardId)}`;
}

function buildStateKey(scopeId: string): string {
  return `build:v${KNOWLEDGE_INDEX_VERSION}:${encodeURIComponent(normalizedScopeId(scopeId))}`;
}

function consentKey(scopeId: string): string {
  return `consent:v${KNOWLEDGE_CONSENT_VERSION}:${encodeURIComponent(normalizedScopeId(scopeId))}`;
}

function normalizeLine(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function cardDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function truncateKnowledgeDocument(value: string): string {
  const characters = Array.from(value);
  if (characters.length <= MAX_KNOWLEDGE_DOCUMENT_CHARACTERS) return value;

  const truncated = characters.slice(0, MAX_KNOWLEDGE_DOCUMENT_CHARACTERS).join("");
  const lastBoundary = Math.max(truncated.lastIndexOf("\n"), truncated.lastIndexOf("。"));
  if (lastBoundary >= MAX_KNOWLEDGE_DOCUMENT_CHARACTERS * 0.8) {
    return truncated.slice(0, lastBoundary + 1).trimEnd();
  }
  return truncated.trimEnd();
}

export function buildSavedFieldsKnowledgeDocument({ card, pathLabels }: KnowledgeDocumentInput): string {
  const lines = [
    ["标题", card.title],
    ["域名", cardDomain(card.url)],
    ["路径", pathLabels.join(" / ")],
    ["简称", card.abbreviation],
    ["简介", card.shortDesc],
    ["详细介绍", card.fullDesc],
    ["备注", card.note],
  ];

  const documentText = lines
    .map(([label, value]) => [label, normalizeLine(value)].join(": "))
    .filter((line) => !line.endsWith(": "))
    .join("\n");

  return truncateKnowledgeDocument(documentText);
}

export function buildPublicHtmlKnowledgeDocument(extractedText: string): string {
  const normalizedText = normalizeLine(extractedText);
  if (!normalizedText) return "";
  return truncateKnowledgeDocument(`公开网页正文: ${normalizedText}`);
}

/**
 * Builds the two privacy-separated documents used by semantic indexing.
 * User-saved fields never enter the public HTML row, and public text never
 * enters the saved-fields row.
 */
export function buildKnowledgeSourceDocumentTexts(
  input: KnowledgeDocumentInput,
): KnowledgeSourceDocumentText[] {
  const savedFields = buildSavedFieldsKnowledgeDocument(input);
  const publicHtml = buildPublicHtmlKnowledgeDocument(input.extractedText ?? "");
  return [
    { source: "saved-fields", text: savedFields },
    ...(publicHtml ? [{ source: "public-html" as const, text: publicHtml }] : []),
  ];
}

/**
 * Backwards-compatible name for callers that need the authoritative
 * saved-fields document. Public HTML must be built as its own source via
 * `buildKnowledgeSourceDocumentTexts`.
 */
export function buildKnowledgeDocument(input: KnowledgeDocumentInput): string {
  return buildSavedFieldsKnowledgeDocument(input);
}

export async function hashKnowledgeDocument(documentText: string): Promise<string> {
  const bytes = new TextEncoder().encode(documentText);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function hashKnowledgeSourceDocuments(
  documents: readonly KnowledgeSourceDocumentText[],
): Promise<HashedKnowledgeSourceDocument[]> {
  return Promise.all(documents.map(async (document) => ({
    ...document,
    contentHash: await hashKnowledgeDocument(document.text),
  })));
}

export async function hashKnowledgeDocumentSet(
  documents: readonly Pick<HashedKnowledgeSourceDocument, "source" | "contentHash">[],
): Promise<string> {
  const markerInput = [...documents]
    .sort((left, right) => left.source.localeCompare(right.source))
    .map((document) => `${document.source}:${document.contentHash}`)
    .join("\n");
  return hashKnowledgeDocument(`knowledge-document-set-v1\n${markerInput}`);
}

export function getKnowledgeCacheSourceHash(
  entry: KnowledgeCacheEntry | null | undefined,
  source: KnowledgeExtractionSource,
): string | null {
  const value = source === "saved-fields" ? entry?.savedFieldsHash : entry?.publicHtmlHash;
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
}

export async function getKnowledgeCacheEntry(
  scopeId: string,
  cardId: string,
): Promise<KnowledgeCacheEntry | null> {
  const entry = await knowledgeDb.getItem<KnowledgeCacheEntry>(cacheKey(scopeId, cardId));
  if (!entry || entry.schemaVersion !== KNOWLEDGE_INDEX_VERSION) return null;
  if (entry.scopeId !== normalizedScopeId(scopeId) || entry.cardId !== cardId) return null;
  return {
    ...entry,
    extractedText: typeof entry.extractedText === "string" ? entry.extractedText : "",
  };
}

export async function saveKnowledgeCacheEntry(entry: KnowledgeCacheEntry): Promise<void> {
  const scopeId = normalizedScopeId(entry.scopeId);
  const safeEntry: KnowledgeCacheEntry = {
    ...entry,
    scopeId,
    schemaVersion: KNOWLEDGE_INDEX_VERSION,
    extractedText: entry.extractedText || "",
  };
  const key = cacheKey(scopeId, entry.cardId);
  await withStorageLock(`knowledge-cache:${key}`, () => knowledgeDb.setItem(key, safeEntry).then(() => undefined));
}

export async function removeKnowledgeCacheEntry(scopeId: string, cardId: string): Promise<void> {
  const key = cacheKey(scopeId, cardId);
  await withStorageLock(`knowledge-cache:${key}`, () => knowledgeDb.removeItem(key));
}

export async function listKnowledgeCacheEntries(scopeId: string): Promise<KnowledgeCacheEntry[]> {
  const normalizedScope = normalizedScopeId(scopeId);
  const entries: KnowledgeCacheEntry[] = [];
  await knowledgeDb.iterate<KnowledgeCacheEntry, void>((entry) => {
    if (
      entry?.schemaVersion === KNOWLEDGE_INDEX_VERSION
      && entry.scopeId === normalizedScope
      && typeof entry.cardId === "string"
    ) {
      entries.push(entry);
    }
  });
  return entries;
}

export async function getKnowledgeConsent(scopeId: string): Promise<KnowledgeConsentRecord | null> {
  const consent = await knowledgeDb.getItem<KnowledgeConsentRecord>(consentKey(scopeId));
  if (
    !consent
    || consent.version !== KNOWLEDGE_CONSENT_VERSION
    || !Number.isFinite(consent.consentedAt)
    || consent.consentedAt <= 0
  ) return null;
  return { version: KNOWLEDGE_CONSENT_VERSION, consentedAt: consent.consentedAt };
}

export async function saveKnowledgeConsent(scopeId: string, consentedAt = Date.now()): Promise<void> {
  const key = consentKey(scopeId);
  const consent: KnowledgeConsentRecord = {
    version: KNOWLEDGE_CONSENT_VERSION,
    consentedAt,
  };
  await withStorageLock(`knowledge-consent:${key}`, () => knowledgeDb.setItem(key, consent).then(() => undefined));
}

export function createKnowledgeBuildState(cardIds: string[], runId: string): KnowledgeBuildState {
  return {
    version: KNOWLEDGE_INDEX_VERSION,
    consentVersion: KNOWLEDGE_CONSENT_VERSION,
    runId,
    status: "running",
    jobs: cardIds.map((cardId) => ({ cardId, generation: 1, status: "pending", attempts: 0 })),
    updatedAt: Date.now(),
  };
}

export function normalizeKnowledgeBuildState(value: unknown): KnowledgeBuildState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<KnowledgeBuildState>;
  if (
    candidate.version !== KNOWLEDGE_INDEX_VERSION
    || candidate.consentVersion !== KNOWLEDGE_CONSENT_VERSION
    || !Array.isArray(candidate.jobs)
  ) return null;

  const jobs = candidate.jobs.flatMap((job) => {
    if (!job || typeof job.cardId !== "string") return [];
    const status = job.status === "complete" || job.status === "failed" ? job.status : "pending";
    return [{
      cardId: job.cardId,
      generation: Number.isFinite(job.generation) ? Math.max(1, Math.floor(job.generation)) : 1,
      status,
      attempts: Number.isFinite(job.attempts) ? Math.max(0, Math.floor(job.attempts)) : 0,
      ...(typeof job.failureCode === "string" ? { failureCode: job.failureCode } : {}),
    } satisfies KnowledgeBuildJob];
  });

  return {
    version: KNOWLEDGE_INDEX_VERSION,
    consentVersion: KNOWLEDGE_CONSENT_VERSION,
    runId: typeof candidate.runId === "string" ? candidate.runId : null,
    status: candidate.status === "complete"
      ? "complete"
      : candidate.status === "complete-with-errors"
        ? "complete-with-errors"
        : candidate.status === "idle"
          ? "idle"
          : "paused",
    jobs,
    updatedAt: Number.isFinite(candidate.updatedAt) ? Number(candidate.updatedAt) : 0,
  };
}

export async function getKnowledgeBuildState(scopeId: string): Promise<KnowledgeBuildState | null> {
  const raw = await knowledgeDb.getItem<unknown>(buildStateKey(scopeId));
  return normalizeKnowledgeBuildState(raw);
}

export async function saveKnowledgeBuildState(scopeId: string, state: KnowledgeBuildState): Promise<void> {
  const key = buildStateKey(scopeId);
  const safeState: KnowledgeBuildState = {
    version: KNOWLEDGE_INDEX_VERSION,
    consentVersion: KNOWLEDGE_CONSENT_VERSION,
    runId: state.runId,
    status: state.status,
    jobs: state.jobs.map((job) => ({ ...job })),
    updatedAt: Date.now(),
  };
  await withStorageLock(`knowledge-build:${key}`, () => knowledgeDb.setItem(key, safeState).then(() => undefined));
}

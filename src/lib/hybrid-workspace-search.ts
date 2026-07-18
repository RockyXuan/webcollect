import {
  normalizeSearchText,
  type CardSearchEntry,
  type CardSearchResult,
  type WorkspaceSearchIndex,
  type WorkspaceSearchMatchKind,
  type WorkspaceSearchMatchReason,
} from "./workspace-search";

export const HYBRID_SEARCH_RRF_K = 60;
export const HYBRID_SEARCH_LOCAL_WEIGHT = 0.6;
export const HYBRID_SEARCH_SEMANTIC_WEIGHT = 0.4;
export const HYBRID_SEARCH_SOURCE_LIMIT = 20;
export const HYBRID_SEARCH_RESULT_LIMIT = 5;

/**
 * Semantic-only hits below this threshold stay hidden. Local matches may still
 * receive a small semantic RRF boost below the threshold because they already
 * have independent on-device evidence.
 */
export const SEMANTIC_ONLY_MIN_SIMILARITY = 0.62;

export interface SemanticWorkspaceSearchHit {
  cardId: string;
  similarity: number;
  contentHash?: string;
}

export type HybridWorkspaceSearchMatchReason = WorkspaceSearchMatchReason | "semantic";
export type HybridWorkspaceSearchMatchKind = WorkspaceSearchMatchKind | "semantic";

export interface HybridCardSearchResult extends CardSearchEntry {
  score: number;
  rrfScore: number;
  localScore?: number;
  localRank?: number;
  semanticRank?: number;
  matchedTokens: string[];
  matchReasons: HybridWorkspaceSearchMatchReason[];
  matchKind: HybridWorkspaceSearchMatchKind;
  exactMatch: boolean;
  exactTitleOrDomain: boolean;
  similarity?: number;
  contentHash?: string;
}

export interface MergeHybridCardResultsOptions {
  query: string;
  index: WorkspaceSearchIndex;
  localResults: readonly CardSearchResult[];
  semanticResults: readonly SemanticWorkspaceSearchHit[];
  limit?: number;
}

interface RankedLocalResult {
  result: CardSearchResult;
  rank: number;
}

interface RankedSemanticResult {
  result: SemanticWorkspaceSearchHit;
  rank: number;
}

function reciprocalRank(rank: number, weight: number): number {
  return weight / (HYBRID_SEARCH_RRF_K + rank + 1);
}

function finiteSimilarity(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

function normalizedDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
}

function queryDomain(query: string): string {
  const candidate = query.trim().toLowerCase();
  if (!candidate || /\s/.test(candidate)) return "";

  try {
    const parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    if (!parsed.hostname || (parsed.pathname !== "/" && parsed.pathname !== "")) return "";
    return parsed.hostname.replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
}

function isExactTitleOrDomain(entry: CardSearchEntry, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const titleMatches = Boolean(normalizedQuery)
    && normalizeSearchText(entry.card.title) === normalizedQuery;
  if (titleMatches) return true;

  const domain = queryDomain(query);
  return Boolean(domain) && normalizedDomain(entry.card.url) === domain;
}

function resultLimit(requested: number | undefined): number {
  if (requested === undefined) return HYBRID_SEARCH_RESULT_LIMIT;
  if (!Number.isFinite(requested)) return HYBRID_SEARCH_RESULT_LIMIT;
  return Math.max(0, Math.min(HYBRID_SEARCH_RESULT_LIMIT, Math.floor(requested)));
}

/**
 * Combines the first 20 local and semantic card results without mutating
 * either source. Unknown semantic card IDs are ignored, and a semantic-only
 * result must pass the calibrated similarity threshold.
 */
export function mergeHybridCardResults({
  query,
  index,
  localResults,
  semanticResults,
  limit,
}: MergeHybridCardResultsOptions): HybridCardSearchResult[] {
  const maxResults = resultLimit(limit);
  if (maxResults === 0) return [];

  const entryById = new Map(index.cardEntries.map((entry) => [entry.card.id, entry]));
  const localById = new Map<string, RankedLocalResult>();
  const semanticById = new Map<string, RankedSemanticResult>();

  localResults.slice(0, HYBRID_SEARCH_SOURCE_LIMIT).forEach((result, rank) => {
    if (!localById.has(result.card.id) && entryById.has(result.card.id)) {
      localById.set(result.card.id, { result, rank });
    }
  });

  semanticResults.slice(0, HYBRID_SEARCH_SOURCE_LIMIT).forEach((result, rank) => {
    if (
      !semanticById.has(result.cardId)
      && entryById.has(result.cardId)
      && finiteSimilarity(result.similarity) !== null
    ) {
      semanticById.set(result.cardId, { result, rank });
    }
  });

  const candidateIds = new Set([...localById.keys(), ...semanticById.keys()]);
  const merged: HybridCardSearchResult[] = [];

  for (const cardId of candidateIds) {
    const entry = entryById.get(cardId);
    if (!entry) continue;

    const local = localById.get(cardId);
    const semantic = semanticById.get(cardId);
    const similarity = semantic ? finiteSimilarity(semantic.result.similarity) : null;
    if (!local && (similarity === null || similarity < SEMANTIC_ONLY_MIN_SIMILARITY)) {
      continue;
    }

    const rrfScore = (local ? reciprocalRank(local.rank, HYBRID_SEARCH_LOCAL_WEIGHT) : 0)
      + (semantic ? reciprocalRank(semantic.rank, HYBRID_SEARCH_SEMANTIC_WEIGHT) : 0);
    const exactTitleOrDomain = isExactTitleOrDomain(entry, query);
    const matchReasons: HybridWorkspaceSearchMatchReason[] = local
      ? [...local.result.matchReasons]
      : [];
    if (semantic && !matchReasons.includes("semantic")) matchReasons.push("semantic");

    merged.push({
      ...entry,
      score: rrfScore,
      rrfScore,
      ...(local ? { localScore: local.result.score, localRank: local.rank } : {}),
      ...(semantic ? { semanticRank: semantic.rank } : {}),
      matchedTokens: local ? [...local.result.matchedTokens] : [],
      matchReasons,
      matchKind: exactTitleOrDomain
        ? "exact"
        : local?.result.matchKind ?? "semantic",
      exactMatch: exactTitleOrDomain || Boolean(local?.result.exactMatch),
      exactTitleOrDomain,
      ...(similarity !== null ? { similarity } : {}),
      ...(semantic?.result.contentHash ? { contentHash: semantic.result.contentHash } : {}),
    });
  }

  return merged
    .sort((left, right) => Number(right.exactTitleOrDomain) - Number(left.exactTitleOrDomain)
      || right.rrfScore - left.rrfScore
      || (right.localScore ?? Number.NEGATIVE_INFINITY) - (left.localScore ?? Number.NEGATIVE_INFINITY)
      || (right.similarity ?? Number.NEGATIVE_INFINITY) - (left.similarity ?? Number.NEGATIVE_INFINITY)
      || left.label.localeCompare(right.label, "zh-Hans-CN")
      || left.card.id.localeCompare(right.card.id))
    .slice(0, maxResults);
}

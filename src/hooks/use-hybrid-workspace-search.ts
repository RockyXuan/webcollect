"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  mergeHybridCardResults,
  type HybridCardSearchResult,
  type SemanticWorkspaceSearchHit,
} from "@/lib/hybrid-workspace-search";
import { semanticSearchKnowledge } from "@/lib/knowledge-client";
import {
  limitSearchQuery,
  normalizeSearchQuery,
  searchWorkspaceIndex,
  type WorkspaceSearchIndex,
  type WorkspaceSearchResults,
} from "@/lib/workspace-search";

const SEMANTIC_DEBOUNCE_MS = 250;
const SEMANTIC_SESSION_CACHE_LIMIT = 100;
const SEMANTIC_SESSION_CACHE_TTL_MS = 5 * 60 * 1_000;
const EMPTY_SEMANTIC_RESULTS: SemanticWorkspaceSearchHit[] = [];

interface SemanticCacheEpoch {
  global: number;
  user: number;
}

interface SemanticSessionCacheEntry {
  userId: string;
  results: SemanticWorkspaceSearchHit[];
  expiresAt: number;
}

const semanticSessionCache = new Map<string, SemanticSessionCacheEntry>();
let semanticSessionGlobalEpoch = 0;
const semanticSessionUserEpochs = new Map<string, number>();
const semanticCacheInvalidationListeners = new Set<(userId?: string) => void>();

export type HybridSearchNetworkStatus = "disabled" | "idle" | "loading" | "ready" | "fallback";

export interface UseHybridWorkspaceSearchOptions {
  query: string;
  index: WorkspaceSearchIndex;
  semanticEnabled: boolean;
  userId?: string;
}

export interface HybridWorkspaceSearchState {
  localResults: WorkspaceSearchResults;
  cards: HybridCardSearchResult[];
  semanticStatus: HybridSearchNetworkStatus;
  semanticResultCount: number;
}

export function shouldRequestSemanticSearch(query: string): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return false;
  const cjkCount = (normalized.match(/[\u3400-\u9fff]/gu) ?? []).length;
  if (cjkCount >= 2) return true;
  const latinCount = (normalized.match(/[a-z0-9]/giu) ?? []).length;
  return latinCount >= 3;
}

function cacheKey(userId: string, query: string): string {
  return `${userId}:${normalizeSearchQuery(query)}`;
}

function captureSemanticCacheEpoch(userId: string): SemanticCacheEpoch {
  return {
    global: semanticSessionGlobalEpoch,
    user: semanticSessionUserEpochs.get(userId) ?? 0,
  };
}

function isSemanticCacheEpochCurrent(userId: string, epoch: SemanticCacheEpoch): boolean {
  return epoch.global === semanticSessionGlobalEpoch
    && epoch.user === (semanticSessionUserEpochs.get(userId) ?? 0);
}

function readCachedSemantic(
  key: string,
  allowedCardIds: ReadonlySet<string>,
): SemanticWorkspaceSearchHit[] | null {
  const cached = semanticSessionCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    semanticSessionCache.delete(key);
    return null;
  }
  semanticSessionCache.delete(key);
  semanticSessionCache.set(key, cached);
  return cached.results
    .filter((item) => allowedCardIds.has(item.cardId))
    .map((item) => ({ ...item }));
}

function writeCachedSemantic(
  key: string,
  userId: string,
  results: SemanticWorkspaceSearchHit[],
): void {
  semanticSessionCache.delete(key);
  semanticSessionCache.set(key, {
    userId,
    results: results.map((item) => ({ ...item })),
    expiresAt: Date.now() + SEMANTIC_SESSION_CACHE_TTL_MS,
  });
  while (semanticSessionCache.size > SEMANTIC_SESSION_CACHE_LIMIT) {
    const oldest = semanticSessionCache.keys().next().value;
    if (typeof oldest !== "string") break;
    semanticSessionCache.delete(oldest);
  }
}

export function invalidateSemanticSearchSessionCache(userId?: string): void {
  if (!userId) {
    semanticSessionCache.clear();
    semanticSessionGlobalEpoch += 1;
    semanticSessionUserEpochs.clear();
    for (const listener of semanticCacheInvalidationListeners) listener();
    return;
  }
  for (const [key, cached] of semanticSessionCache) {
    if (cached.userId === userId) semanticSessionCache.delete(key);
  }
  semanticSessionUserEpochs.set(
    userId,
    (semanticSessionUserEpochs.get(userId) ?? 0) + 1,
  );
  for (const listener of semanticCacheInvalidationListeners) listener(userId);
}

export function __resetSemanticSearchSessionCacheForTest(): void {
  invalidateSemanticSearchSessionCache();
}

export function useHybridWorkspaceSearch({
  query,
  index,
  semanticEnabled,
  userId = "",
}: UseHybridWorkspaceSearchOptions): HybridWorkspaceSearchState {
  const limitedQuery = limitSearchQuery(query);
  const normalizedQuery = normalizeSearchQuery(limitedQuery);
  const requestKey = userId && normalizedQuery ? cacheKey(userId, normalizedQuery) : "";
  const allowedCardIds = useMemo(
    () => new Set(index.cardEntries.map((entry) => entry.card.id)),
    [index],
  );
  const localResults = useMemo(
    () => searchWorkspaceIndex(index, limitedQuery),
    [index, limitedQuery],
  );
  const [semanticState, setSemanticState] = useState<{
    key: string;
    status: HybridSearchNetworkStatus;
    results: SemanticWorkspaceSearchHit[];
  }>({ key: "", status: "idle", results: [] });
  const [cacheRevision, setCacheRevision] = useState(0);
  const requestSequenceRef = useRef(0);
  const previousUserIdRef = useRef(userId);

  useEffect(() => {
    const listener = (invalidatedUserId?: string) => {
      if (!invalidatedUserId || invalidatedUserId === userId) {
        setCacheRevision((revision) => revision + 1);
      }
    };
    semanticCacheInvalidationListeners.add(listener);
    return () => {
      semanticCacheInvalidationListeners.delete(listener);
    };
  }, [userId]);

  useEffect(() => {
    if (previousUserIdRef.current !== userId) {
      if (previousUserIdRef.current) {
        invalidateSemanticSearchSessionCache(previousUserIdRef.current);
      }
      previousUserIdRef.current = userId;
    }
  }, [userId]);

  useEffect(() => {
    const sequence = ++requestSequenceRef.current;
    const controller = new AbortController();

    if (!semanticEnabled || !userId) {
      setSemanticState({ key: requestKey, status: "disabled", results: [] });
      return () => controller.abort();
    }
    if (!shouldRequestSemanticSearch(normalizedQuery)) {
      setSemanticState({ key: requestKey, status: "idle", results: [] });
      return () => controller.abort();
    }

    const cached = readCachedSemantic(requestKey, allowedCardIds);
    if (cached) {
      setSemanticState({ key: requestKey, status: "ready", results: cached });
      return () => controller.abort();
    }

    setSemanticState({ key: requestKey, status: "loading", results: [] });
    const cacheEpoch = captureSemanticCacheEpoch(userId);
    const timer = window.setTimeout(() => {
      if (!isSemanticCacheEpochCurrent(userId, cacheEpoch)) return;
      void semanticSearchKnowledge(normalizedQuery, {
        limit: 20,
        signal: controller.signal,
        allowedCardIds,
        expectedUserId: userId,
      }).then((results) => {
        if (
          controller.signal.aborted
          || requestSequenceRef.current !== sequence
          || !isSemanticCacheEpochCurrent(userId, cacheEpoch)
        ) return;
        writeCachedSemantic(requestKey, userId, results);
        setSemanticState({ key: requestKey, status: "ready", results });
      }).catch(() => {
        if (
          controller.signal.aborted
          || requestSequenceRef.current !== sequence
          || !isSemanticCacheEpochCurrent(userId, cacheEpoch)
        ) return;
        setSemanticState({ key: requestKey, status: "fallback", results: [] });
      });
    }, SEMANTIC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [allowedCardIds, cacheRevision, normalizedQuery, requestKey, semanticEnabled, userId]);

  const activeSemanticResults = useMemo(() => {
    if (semanticState.key !== requestKey) return EMPTY_SEMANTIC_RESULTS;
    return semanticState.results.filter((item) => allowedCardIds.has(item.cardId));
  }, [allowedCardIds, requestKey, semanticState]);
  const semanticStatus = semanticState.key === requestKey
    ? semanticState.status
    : semanticEnabled && userId
      ? "idle"
      : "disabled";
  const cards = useMemo(
    () => mergeHybridCardResults({
      query: limitedQuery,
      index,
      localResults: localResults.cards,
      semanticResults: activeSemanticResults,
    }),
    [activeSemanticResults, index, limitedQuery, localResults.cards],
  );

  return {
    localResults,
    cards,
    semanticStatus,
    semanticResultCount: activeSemanticResults.length,
  };
}

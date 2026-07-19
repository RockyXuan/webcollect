"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { runKnowledgeBuild, type KnowledgeIndexItem } from "@/lib/knowledge-builder";
import { fetchPublicKnowledge } from "@/lib/knowledge-client";
import {
  getKnowledgeBuildState,
  getKnowledgeConsent,
  listKnowledgeCacheEntries,
  saveKnowledgeConsent,
  type KnowledgeBuildState,
  type KnowledgeCacheEntry,
} from "@/lib/knowledge-index";
import { isChromeExtension } from "@/lib/platform";
import { useAppStore } from "@/lib/store";
import type { KnowledgeSearchDocument } from "@/lib/workspace-search";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const INCREMENTAL_DEBOUNCE_MS = 1_500;

export type LocalKnowledgeBuildError = "build-failed";

export interface LocalKnowledgeBuildSummary {
  ready: boolean;
  consented: boolean;
  publicFetchSupported: boolean;
  isBuilding: boolean;
  buildState: KnowledgeBuildState | null;
  indexedCount: number;
  publicTextCount: number;
  totalCards: number;
  completedJobs: number;
  failedJobs: number;
  error: LocalKnowledgeBuildError | null;
  knowledgeDocuments: KnowledgeSearchDocument[];
  startInitialBuild: () => Promise<void>;
  update: () => Promise<void>;
  pause: () => void;
  retry: () => Promise<void>;
  clearError: () => void;
}

interface ExecuteBuildOptions {
  fetchPublicPages: boolean;
  resume?: boolean;
  targetCardIds?: readonly string[];
}

function normalizedSourceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function localIndexReceipts(items: readonly KnowledgeIndexItem[]) {
  const indexedAt = Date.now();
  return items.map((item) => ({
    cardId: item.cardId,
    contentHash: item.contentHash,
    source: item.source,
    indexedAt,
  }));
}

function buildPathLabelsByCardId(
  cards: readonly WebCard[],
  categories: readonly Category[],
  sections: readonly CollectionSection[],
): Map<string, string[]> {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const fallbackSection = sectionById.get("section-default") ?? sections[0];

  return new Map(cards.map((card) => {
    const category = categoryById.get(card.categoryId);
    const parent = category?.parentId ? categoryById.get(category.parentId) : undefined;
    const section = sectionById.get(category?.sectionId || parent?.sectionId || "section-default")
      ?? fallbackSection;
    const labels = category
      ? [section?.name, parent?.name, category.name].filter(Boolean) as string[]
      : [fallbackSection?.name || "主页"];
    return [card.id, labels];
  }));
}

/**
 * Coordinates the rebuildable, on-device knowledge cache. It never calls the
 * semantic Edge Function and never writes collection, sync, snapshot, or
 * Chrome-storage state.
 */
export function useLocalKnowledgeBuild(): LocalKnowledgeBuildSummary {
  const user = useAuthStore((state) => state.user);
  const cards = useAppStore((state) => state.cards);
  const categories = useAppStore((state) => state.categories);
  const sections = useAppStore((state) => state.sections);
  const scopeId = user?.id || "local";
  const extensionRuntime = isChromeExtension();
  const publicFetchSupported = extensionRuntime || Boolean(user);
  const [ready, setReady] = useState(false);
  const [consented, setConsented] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildState, setBuildState] = useState<KnowledgeBuildState | null>(null);
  const [cacheEntries, setCacheEntries] = useState<KnowledgeCacheEntry[]>([]);
  const [error, setError] = useState<LocalKnowledgeBuildError | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const scopeRef = useRef(scopeId);
  const fingerprintsRef = useRef<Map<string, string> | null>(null);

  const pathLabelsByCardId = useMemo(
    () => buildPathLabelsByCardId(cards, categories, sections),
    [cards, categories, sections],
  );
  const fingerprints = useMemo(() => new Map(cards.map((card) => [
    card.id,
    JSON.stringify([
      card.url,
      card.title,
      card.shortDesc,
      card.fullDesc,
      card.note,
      card.abbreviation,
      card.categoryId,
      pathLabelsByCardId.get(card.id) ?? [],
    ]),
  ])), [cards, pathLabelsByCardId]);

  const refreshCacheEntries = useCallback(async (expectedScopeId: string) => {
    const entries = await listKnowledgeCacheEntries(expectedScopeId);
    if (scopeRef.current === expectedScopeId) setCacheEntries(entries);
  }, []);

  useEffect(() => {
    scopeRef.current = scopeId;
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    fingerprintsRef.current = null;
    setReady(false);
    setConsented(false);
    setIsBuilding(false);
    setBuildState(null);
    setCacheEntries([]);
    setError(null);

    let cancelled = false;
    void Promise.all([
      getKnowledgeConsent(scopeId),
      getKnowledgeBuildState(scopeId),
      listKnowledgeCacheEntries(scopeId),
    ]).then(([consent, state, entries]) => {
      if (cancelled || scopeRef.current !== scopeId) return;
      setConsented(Boolean(consent));
      setBuildState(state);
      setCacheEntries(entries);
      setReady(true);
    }).catch(() => {
      if (cancelled || scopeRef.current !== scopeId) return;
      setError("build-failed");
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [scopeId]);

  useEffect(() => () => activeControllerRef.current?.abort(), []);

  const executeBuild = useCallback(async ({
    fetchPublicPages,
    resume = false,
    targetCardIds,
  }: ExecuteBuildOptions): Promise<void> => {
    if (activeControllerRef.current) return;
    const expectedScopeId = scopeId;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    setIsBuilding(true);
    setError(null);

    try {
      const result = await runKnowledgeBuild({
        scopeId: expectedScopeId,
        cards: cards.map((card) => ({ ...card })),
        pathLabelsByCardId: new Map(
          Array.from(pathLabelsByCardId, ([cardId, labels]) => [cardId, [...labels]]),
        ),
        ...(targetCardIds ? { targetCardIds: [...targetCardIds] } : {}),
        resume,
        signal: controller.signal,
        ...(fetchPublicPages && publicFetchSupported ? {
          fetchPublicPage: async (url: string, signal: AbortSignal) => {
            const fetched = await fetchPublicKnowledge(url, {
              signal,
              ...(user?.id ? { expectedUserId: user.id } : {}),
            });
            return { resolvedUrl: fetched.resolvedUrl, text: fetched.text };
          },
        } : {}),
        indexDocuments: async (items) => localIndexReceipts(items),
        removeEmbedding: async () => undefined,
        onProgress: (state) => {
          if (scopeRef.current === expectedScopeId) setBuildState(state);
        },
      });
      if (scopeRef.current === expectedScopeId) setBuildState(result);
    } catch (caught) {
      const aborted = controller.signal.aborted
        || (caught instanceof DOMException && caught.name === "AbortError");
      if (!aborted && scopeRef.current === expectedScopeId) setError("build-failed");
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = null;
      if (scopeRef.current === expectedScopeId) {
        await refreshCacheEntries(expectedScopeId).catch(() => setError("build-failed"));
        setIsBuilding(false);
      }
    }
  }, [cards, pathLabelsByCardId, publicFetchSupported, refreshCacheEntries, scopeId, user?.id]);

  const startInitialBuild = useCallback(async () => {
    try {
      await saveKnowledgeConsent(scopeId);
      if (scopeRef.current !== scopeId) return;
      setConsented(true);
      await executeBuild({ fetchPublicPages: true });
    } catch {
      if (scopeRef.current === scopeId) setError("build-failed");
    }
  }, [executeBuild, scopeId]);

  const update = useCallback(
    () => executeBuild({ fetchPublicPages: true }),
    [executeBuild],
  );
  const retry = useCallback(
    () => executeBuild({ fetchPublicPages: true, resume: true }),
    [executeBuild],
  );
  const pause = useCallback(() => {
    activeControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!ready || isBuilding) return;
    const previous = fingerprintsRef.current;
    if (!previous) {
      fingerprintsRef.current = new Map(fingerprints);
      return;
    }

    const changedCardIds = Array.from(fingerprints).flatMap(([cardId, fingerprint]) => (
      previous.get(cardId) === fingerprint ? [] : [cardId]
    ));
    fingerprintsRef.current = new Map(fingerprints);
    if (!consented || !buildState || changedCardIds.length === 0) return;

    const timer = window.setTimeout(() => {
      void executeBuild({
        fetchPublicPages: false,
        targetCardIds: changedCardIds,
      });
    }, INCREMENTAL_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [buildState, consented, executeBuild, fingerprints, isBuilding, ready]);

  const liveCardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const visibleCacheEntries = useMemo(() => cacheEntries.filter((entry) => {
    const card = liveCardById.get(entry.cardId);
    return Boolean(card)
      && normalizedSourceUrl(entry.sourceUrl) !== null
      && normalizedSourceUrl(entry.sourceUrl) === normalizedSourceUrl(card?.url ?? "");
  }), [cacheEntries, liveCardById]);
  const knowledgeDocuments = useMemo(() => visibleCacheEntries.flatMap((entry) => {
    const text = entry.extractedText.trim();
    return text ? [{ cardId: entry.cardId, text }] : [];
  }), [visibleCacheEntries]);
  const completedJobs = buildState?.jobs.filter((job) => job.status === "complete").length ?? 0;
  const failedJobs = buildState?.jobs.filter((job) => (
    job.status === "failed" || Boolean(job.failureCode)
  )).length ?? 0;

  return {
    ready,
    consented,
    publicFetchSupported,
    isBuilding,
    buildState,
    indexedCount: visibleCacheEntries.filter((entry) => entry.indexedAt !== null).length,
    publicTextCount: visibleCacheEntries.filter((entry) => entry.extractedText.trim()).length,
    totalCards: cards.length,
    completedJobs,
    failedJobs,
    error,
    knowledgeDocuments,
    startInitialBuild,
    update,
    pause,
    retry,
    clearError: () => setError(null),
  };
}

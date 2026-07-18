"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { invalidateSemanticSearchSessionCache } from "@/hooks/use-hybrid-workspace-search";
import {
  fetchPublicKnowledge,
  indexKnowledge,
  KnowledgeClientError,
  listKnowledgeEmbeddingStates,
  removeKnowledgeEmbedding,
} from "@/lib/knowledge-client";
import {
  KnowledgeWorkspaceChangedError,
  runKnowledgeBuild,
  type KnowledgeIndexGuard,
} from "@/lib/knowledge-builder";
import {
  buildKnowledgeDocument,
  buildKnowledgeSourceDocumentTexts,
  getKnowledgeCacheSourceHash,
  getKnowledgeBuildState,
  getKnowledgeConsent,
  hashKnowledgeDocumentSet,
  hashKnowledgeDocument,
  hashKnowledgeSourceDocuments,
  listKnowledgeCacheEntries,
  removeKnowledgeCacheEntry,
  saveKnowledgeConsent,
  type KnowledgeBuildState,
  type KnowledgeCacheEntry,
  type KnowledgeExtractionSource,
} from "@/lib/knowledge-index";
import { isChromeExtension } from "@/lib/platform";
import {
  CURRENT_SYNC_METADATA_VERSION,
  getCards,
  getCategories,
  getLocalSnapshotUpdatedAt,
  getSections,
  getSyncMetadataVersion,
} from "@/lib/db";
import { reconcileExtensionKnowledge } from "@/lib/extension-knowledge-coordinator";
import { withStorageLock } from "@/lib/storage-lock";
import { useAppStore } from "@/lib/store";
import { buildWorkspaceSearchIndex } from "@/lib/workspace-search";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INCREMENTAL_DEBOUNCE_MS = 2_000;
const MAX_RECONCILIATION_RETRY_MS = 30_000;
const MAX_AUTOMATIC_RECONCILIATION_RETRIES = 5;
const RETRYABLE_KNOWLEDGE_FAILURES = new Set([
  "network",
  "timeout",
  "rate-limited",
  "fetch-failed",
]);

class KnowledgeSyncRequiredError extends Error {
  constructor() {
    super("sync-required");
    this.name = "KnowledgeSyncRequiredError";
  }
}

export type KnowledgeBuildUiError =
  | "authentication-required"
  | "extension-build-disabled"
  | "sync-required"
  | "build-failed";

export type ExtensionIncrementalStatus =
  | "disabled"
  | "waiting-workspace"
  | "idle"
  | "reconciling"
  | "retrying"
  | "error";

export interface KnowledgeBuildSummary {
  consentReady: boolean;
  consented: boolean;
  buildSupported: boolean;
  incrementalSupported: boolean;
  incrementalStatus: ExtensionIncrementalStatus;
  isBuilding: boolean;
  buildState: KnowledgeBuildState | null;
  indexedCount: number;
  publicTextCount: number;
  totalCards: number;
  completedJobs: number;
  failedJobs: number;
  error: KnowledgeBuildUiError | null;
  startInitialBuild: () => Promise<void>;
  enableSemanticOnly: () => Promise<void>;
  pause: () => void;
  retry: () => Promise<void>;
  clearError: () => void;
}

interface UserContext {
  userId: string;
  generation: number;
}

interface ActiveBuildRun extends UserContext {
  controller: AbortController;
  token: symbol;
  workspaceSignature?: string;
}

interface PendingWorkspaceRestart extends UserContext {
  epoch: number;
}

interface ExecuteBuildOptions {
  context?: UserContext;
  resume?: boolean;
  targetCardIds?: readonly string[];
}

type BuildExecutionResult = "completed" | "failed" | "partial" | "skipped" | "stale";

const LOCAL_UPDATED_SIGNAL_KEY = "webcollect_local_snapshot_updated_at";

function normalizeKnowledgeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function buildKnowledgeWorkspaceSignature(
  cards: readonly WebCard[],
  categories: readonly Category[],
  sections: readonly CollectionSection[],
): string {
  const relevantCards = cards.map((card) => ({
    id: card.id,
    url: card.url,
    title: card.title,
    shortDesc: card.shortDesc,
    fullDesc: card.fullDesc,
    note: card.note,
    abbreviation: card.abbreviation,
    categoryId: card.categoryId,
  })).sort((left, right) => left.id.localeCompare(right.id));
  const relevantCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    parentId: category.parentId ?? "",
    sectionId: category.sectionId ?? "",
  })).sort((left, right) => left.id.localeCompare(right.id));
  const relevantSections = sections.map((section) => ({
    id: section.id,
    name: section.name,
  })).sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify([relevantCards, relevantCategories, relevantSections]);
}

function mapBuildError(error: unknown): KnowledgeBuildUiError {
  if (error instanceof KnowledgeSyncRequiredError) return "sync-required";
  if (error instanceof KnowledgeClientError && error.code === "authentication-required") {
    return "authentication-required";
  }
  return "build-failed";
}

function isAbortError(error: unknown): boolean {
  return (error instanceof KnowledgeClientError && error.code === "aborted")
    || (error instanceof DOMException && error.name === "AbortError");
}

function isCloudReadyCard(card: WebCard): boolean {
  return UUID_PATTERN.test(card.id);
}

export function liveCardIdsAreCloudReady(cards: readonly WebCard[]): boolean {
  return cards.length > 0 && cards.every(isCloudReadyCard);
}

export function useKnowledgeBuild(): KnowledgeBuildSummary {
  const user = useAuthStore((state) => state.user);
  const authIsLoading = useAuthStore((state) => state.isLoading);
  const syncStatus = useAuthStore((state) => state.syncStatus);
  const cards = useAppStore((state) => state.cards);
  const categories = useAppStore((state) => state.categories);
  const sections = useAppStore((state) => state.sections);
  const appIsLoading = useAppStore((state) => state.isLoading);
  const appInitialized = useAppStore((state) => state.initialized);
  const [consentReady, setConsentReady] = useState(false);
  const [consented, setConsented] = useState(false);
  const [consentGrantedAt, setConsentGrantedAt] = useState<number | null>(null);
  const [derivedScopeId, setDerivedScopeId] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<KnowledgeBuildState | null>(null);
  const [cacheEntries, setCacheEntries] = useState<KnowledgeCacheEntry[]>([]);
  const [error, setError] = useState<KnowledgeBuildUiError | null>(null);
  const [reconciliationRevision, setReconciliationRevision] = useState(0);
  const [extensionReconciliationRevision, setExtensionReconciliationRevision] = useState(0);
  const [extensionIncrementalStatus, setExtensionIncrementalStatus] = useState<ExtensionIncrementalStatus>("disabled");
  const activeBuildRef = useRef<ActiveBuildRun | null>(null);
  const activeWebReconciliationRef = useRef<AbortController | null>(null);
  const activeExtensionRunRef = useRef<ActiveBuildRun | null>(null);
  const userGenerationRef = useRef(0);
  const manualPauseRef = useRef(false);
  const workspaceMutationEpochRef = useRef(0);
  const pendingRestartRef = useRef<PendingWorkspaceRestart | null>(null);
  const refreshSequenceRef = useRef(0);
  const reconciliationRetryRef = useRef(0);
  const extensionRetryRef = useRef(0);
  const extensionHasObservedRef = useRef(false);
  const buildSupported = !isChromeExtension();

  const isCurrentContext = useCallback((context: UserContext): boolean => (
    userGenerationRef.current === context.generation
    && useAuthStore.getState().user?.id === context.userId
  ), []);

  const queueWorkspaceRestart = useCallback((run: ActiveBuildRun): void => {
    if (
      manualPauseRef.current
      || activeBuildRef.current?.token !== run.token
      || !isCurrentContext(run)
    ) return;
    const epoch = workspaceMutationEpochRef.current + 1;
    workspaceMutationEpochRef.current = epoch;
    pendingRestartRef.current = {
      userId: run.userId,
      generation: run.generation,
      epoch,
    };
    run.controller.abort();
    setReconciliationRevision((value) => value + 1);
  }, [isCurrentContext]);

  const refreshDerivedState = useCallback(async (
    scopeId: string | null,
    generation: number,
  ): Promise<void> => {
    const requestSequence = ++refreshSequenceRef.current;
    if (!scopeId) {
      if (userGenerationRef.current !== generation || requestSequence !== refreshSequenceRef.current) return;
      setConsentReady(true);
      setConsented(false);
      setConsentGrantedAt(null);
      setDerivedScopeId(null);
      setBuildState(null);
      setCacheEntries([]);
      return;
    }

    const context = { userId: scopeId, generation };
    try {
      const [consent, state, entries] = await Promise.all([
        getKnowledgeConsent(scopeId),
        getKnowledgeBuildState(scopeId),
        listKnowledgeCacheEntries(scopeId),
      ]);
      if (!isCurrentContext(context) || requestSequence !== refreshSequenceRef.current) return;
      setConsentReady(true);
      setConsented(Boolean(consent));
      setConsentGrantedAt(consent?.consentedAt ?? null);
      setDerivedScopeId(scopeId);
      setBuildState(state);
      setCacheEntries(entries);
    } catch {
      if (!isCurrentContext(context) || requestSequence !== refreshSequenceRef.current) return;
      setConsentReady(true);
      setConsented(false);
      setConsentGrantedAt(null);
      setDerivedScopeId(scopeId);
      setBuildState(null);
      setCacheEntries([]);
      setError("build-failed");
    }
  }, [isCurrentContext]);

  useEffect(() => {
    const generation = ++userGenerationRef.current;
    const activeRun = activeBuildRef.current;
    activeRun?.controller.abort();
    activeBuildRef.current = null;
    activeWebReconciliationRef.current?.abort();
    activeWebReconciliationRef.current = null;
    activeExtensionRunRef.current?.controller.abort();
    activeExtensionRunRef.current = null;
    refreshSequenceRef.current += 1;
    reconciliationRetryRef.current = 0;
    extensionRetryRef.current = 0;
    extensionHasObservedRef.current = false;
    manualPauseRef.current = false;
    workspaceMutationEpochRef.current = 0;
    pendingRestartRef.current = null;
    setConsentReady(false);
    setConsented(false);
    setConsentGrantedAt(null);
    setDerivedScopeId(user?.id ?? null);
    setBuildState(null);
    setCacheEntries([]);
    setError(null);
    setExtensionIncrementalStatus(buildSupported && user?.id ? "disabled" : user?.id ? "waiting-workspace" : "disabled");
    void refreshDerivedState(user?.id ?? null, generation);

    return () => {
      if (activeBuildRef.current?.generation === generation) {
        activeBuildRef.current.controller.abort();
        activeBuildRef.current = null;
      }
      activeWebReconciliationRef.current?.abort();
      activeWebReconciliationRef.current = null;
      if (activeExtensionRunRef.current?.generation === generation) {
        activeExtensionRunRef.current.controller.abort();
        activeExtensionRunRef.current = null;
      }
    };
  }, [buildSupported, refreshDerivedState, user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (
      error !== "sync-required"
      || !user
      || authIsLoading
      || appIsLoading
      || !appInitialized
      || syncStatus === "queued"
      || syncStatus === "syncing"
      || !liveCardIdsAreCloudReady(cards)
    ) return undefined;

    const context: UserContext = {
      userId: user.id,
      generation: userGenerationRef.current,
    };
    void getSyncMetadataVersion(context.userId).then((version) => {
      if (
        !cancelled
        && version === CURRENT_SYNC_METADATA_VERSION
        && isCurrentContext(context)
      ) setError(null);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [appInitialized, appIsLoading, authIsLoading, cards, error, isCurrentContext, syncStatus, user]);

  useEffect(() => {
    if (!buildSupported) return undefined;
    let disposed = false;
    let inspectionSequence = 0;

    const queueIdleWorkspaceReconciliation = () => {
      if (manualPauseRef.current) return;
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      const epoch = workspaceMutationEpochRef.current + 1;
      workspaceMutationEpochRef.current = epoch;
      pendingRestartRef.current = {
        userId,
        generation: userGenerationRef.current,
        epoch,
      };
      activeWebReconciliationRef.current?.abort();
      activeWebReconciliationRef.current = null;
      setReconciliationRevision((value) => value + 1);
    };

    const inspectAuthoritativeWorkspace = () => {
      const run = activeBuildRef.current;
      if (manualPauseRef.current) return;
      if (!run || !isCurrentContext(run)) {
        queueIdleWorkspaceReconciliation();
        return;
      }
      const sequence = ++inspectionSequence;
      if (run.workspaceSignature === undefined) {
        queueWorkspaceRestart(run);
        return;
      }
      void Promise.all([getCards(), getCategories(), getSections()]).then(([
        latestCards,
        latestCategories,
        latestSections,
      ]) => {
        if (
          disposed
          || sequence !== inspectionSequence
          || !isCurrentContext(run)
        ) return;
        const latestSignature = buildKnowledgeWorkspaceSignature(
          latestCards,
          latestCategories,
          latestSections,
        );
        if (latestSignature !== run.workspaceSignature) {
          if (activeBuildRef.current?.token === run.token) queueWorkspaceRestart(run);
          else queueIdleWorkspaceReconciliation();
        }
      }).catch(() => {
        if (disposed || !isCurrentContext(run)) return;
        if (activeBuildRef.current?.token === run.token) queueWorkspaceRestart(run);
        else queueIdleWorkspaceReconciliation();
      });
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_UPDATED_SIGNAL_KEY) inspectAuthoritativeWorkspace();
    };
    window.addEventListener("webcollect:local-change", inspectAuthoritativeWorkspace);
    window.addEventListener("storage", handleStorage);
    return () => {
      disposed = true;
      window.removeEventListener("webcollect:local-change", inspectAuthoritativeWorkspace);
      window.removeEventListener("storage", handleStorage);
    };
  }, [buildSupported, isCurrentContext, queueWorkspaceRestart]);

  useEffect(() => {
    if (buildSupported) return undefined;
    const queueExtensionReconciliation = () => {
      if (manualPauseRef.current) return;
      activeExtensionRunRef.current?.controller.abort();
      activeExtensionRunRef.current = null;
      setExtensionIncrementalStatus("retrying");
      setExtensionReconciliationRevision((value) => value + 1);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_UPDATED_SIGNAL_KEY) queueExtensionReconciliation();
    };
    window.addEventListener("webcollect:local-change", queueExtensionReconciliation);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("webcollect:local-change", queueExtensionReconciliation);
      window.removeEventListener("storage", handleStorage);
    };
  }, [buildSupported]);

  useEffect(() => {
    if (
      !buildSupported
      || (syncStatus !== "queued" && syncStatus !== "syncing")
      || manualPauseRef.current
    ) return;
    const run = activeBuildRef.current;
    if (run) queueWorkspaceRestart(run);
  }, [buildSupported, queueWorkspaceRestart, syncStatus]);

  const executeBuild = useCallback(async ({
    context: requestedContext,
    resume = false,
    targetCardIds,
  }: ExecuteBuildOptions = {}): Promise<BuildExecutionResult> => {
    const context = requestedContext ?? {
      userId: user?.id ?? "",
      generation: userGenerationRef.current,
    };
    if (!context.userId || !isCurrentContext(context)) {
      if (userGenerationRef.current === context.generation) setError("authentication-required");
      return "skipped";
    }
    if (!buildSupported) {
      setError("extension-build-disabled");
      return "skipped";
    }
    if (activeBuildRef.current) return "skipped";

    const controller = new AbortController();
    const run: ActiveBuildRun = {
      ...context,
      controller,
      token: Symbol("knowledge-build"),
    };
    activeBuildRef.current = run;
    setError(null);

    try {
      const result = await withStorageLock(`knowledge-scope:${context.userId}`, async () => {
        if (controller.signal.aborted || !isCurrentContext(context)) return null;
        if (await getSyncMetadataVersion(context.userId) !== CURRENT_SYNC_METADATA_VERSION) {
          throw new KnowledgeSyncRequiredError();
        }
        if (controller.signal.aborted || !isCurrentContext(context)) return null;
        // Another tab may have edited, deleted, restored, or normalized IDs while
        // this tab waited for the cross-tab knowledge lock. Read the authoritative
        // business snapshot only after the lock is held so an old in-memory
        // Zustand snapshot can never overwrite a newer derived vector.
        const [latestCards, latestCategories, latestSections] = await Promise.all([
          getCards(),
          getCategories(),
          getSections(),
        ]);
        if (controller.signal.aborted || !isCurrentContext(context)) return null;
        run.workspaceSignature = buildKnowledgeWorkspaceSignature(
          latestCards,
          latestCategories,
          latestSections,
        );
        if (targetCardIds === undefined && !resume && !liveCardIdsAreCloudReady(latestCards)) {
          throw new KnowledgeSyncRequiredError();
        }
        const cloudCards = latestCards.filter(isCloudReadyCard);
        const allowedIds = new Set(cloudCards.map((card) => card.id));
        const safeTargetIds = targetCardIds?.filter((cardId) => allowedIds.has(cardId));
        const embeddingStateCardIds = safeTargetIds ?? cloudCards.map((card) => card.id);
        const existingEmbeddingStates = embeddingStateCardIds.length > 0
          ? await listKnowledgeEmbeddingStates(embeddingStateCardIds, {
              signal: controller.signal,
              expectedUserId: context.userId,
            })
          : [];
        if (controller.signal.aborted || !isCurrentContext(context)) return null;
        const index = buildWorkspaceSearchIndex({
          cards: latestCards,
          categories: latestCategories,
          sections: latestSections,
        });
        const currentPathsByCardId = new Map(
          index.cardEntries.map((entry) => [entry.card.id, entry.pathLabels]),
        );
        return runKnowledgeBuild({
          scopeId: context.userId,
          cards: cloudCards,
          ...(safeTargetIds !== undefined ? { targetCardIds: safeTargetIds } : {}),
          pathLabelsByCardId: currentPathsByCardId,
          existingEmbeddingStates,
          resume,
          signal: controller.signal,
          fetchPublicPage: async (url, signal) => {
            const fetched = await fetchPublicKnowledge(url, {
              signal,
              expectedUserId: context.userId,
            });
            return { resolvedUrl: fetched.resolvedUrl, text: fetched.text };
          },
          indexDocuments: async (items, guards, batchSignal) => {
            const abortWithoutRestart = (): never => {
              throw new DOMException("Knowledge build aborted", "AbortError");
            };
            const rejectStaleWorkspace = (): never => {
              if (
                manualPauseRef.current
                || activeBuildRef.current?.token !== run.token
                || !isCurrentContext(context)
              ) abortWithoutRestart();
              queueWorkspaceRestart(run);
              throw new KnowledgeWorkspaceChangedError();
            };

            if (
              batchSignal.aborted
              || controller.signal.aborted
              || activeBuildRef.current?.token !== run.token
              || !isCurrentContext(context)
            ) abortWithoutRestart();
            const authState = useAuthStore.getState();
            if (
              authState.user?.id !== context.userId
              || authState.syncStatus === "queued"
              || authState.syncStatus === "syncing"
            ) rejectStaleWorkspace();

            const snapshotBefore = await getLocalSnapshotUpdatedAt();
            const [guardCards, guardCategories, guardSections, syncVersion] = await Promise.all([
              getCards(),
              getCategories(),
              getSections(),
              getSyncMetadataVersion(context.userId),
            ]);
            const snapshotAfterRead = await getLocalSnapshotUpdatedAt();
            if (
              batchSignal.aborted
              || controller.signal.aborted
              || syncVersion !== CURRENT_SYNC_METADATA_VERSION
              || snapshotBefore !== snapshotAfterRead
              || !isCurrentContext(context)
            ) rejectStaleWorkspace();

            const guardIndex = buildWorkspaceSearchIndex({
              cards: guardCards,
              categories: guardCategories,
              sections: guardSections,
            });
            const guardPaths = new Map(
              guardIndex.cardEntries.map((entry) => [entry.card.id, entry.pathLabels]),
            );
            const cardById = new Map(guardCards.map((card) => [card.id, card]));
            const guardByCardId = new Map<string, KnowledgeIndexGuard>();
            for (const guard of guards) {
              if (guardByCardId.has(guard.cardId)) rejectStaleWorkspace();
              guardByCardId.set(guard.cardId, guard);
            }
            if (items.some((item) => !guardByCardId.has(item.cardId))) rejectStaleWorkspace();

            for (const guard of guards) {
              const currentCard = cardById.get(guard.cardId);
              if (!currentCard) {
                queueWorkspaceRestart(run);
                throw new KnowledgeWorkspaceChangedError();
              }
              if (!isCloudReadyCard(currentCard)) rejectStaleWorkspace();
              const currentUrl = normalizeKnowledgeSourceUrl(currentCard.url) ?? currentCard.url.trim();
              if (currentUrl !== guard.sourceUrl) rejectStaleWorkspace();
              const savedFieldsText = buildKnowledgeDocument({
                card: currentCard,
                pathLabels: guardPaths.get(currentCard.id) ?? [],
              });
              const savedFieldsHash = await hashKnowledgeDocument(savedFieldsText);
              if (savedFieldsHash !== guard.savedFieldsHash.toLowerCase()) rejectStaleWorkspace();
            }

            const snapshotBeforeUpload = await getLocalSnapshotUpdatedAt();
            if (
              batchSignal.aborted
              || controller.signal.aborted
              || snapshotBeforeUpload !== snapshotAfterRead
              || activeBuildRef.current?.token !== run.token
              || !isCurrentContext(context)
            ) rejectStaleWorkspace();
            return indexKnowledge(items, {
              signal: batchSignal,
              expectedUserId: context.userId,
            });
          },
          removeEmbedding: (cardId, source, signal) => removeKnowledgeEmbedding(cardId, {
            source,
            signal,
            expectedUserId: context.userId,
          }),
          onProgress: (state) => {
            if (activeBuildRef.current?.token === run.token && isCurrentContext(context)) {
              setBuildState(state);
            }
          },
        });
      });
      if (result && activeBuildRef.current?.token === run.token && isCurrentContext(context)) {
        setBuildState(result);
        invalidateSemanticSearchSessionCache(context.userId);
        return result.status === "paused"
          ? "stale"
          : result.status === "complete-with-errors"
            ? "partial"
            : "completed";
      }
      return controller.signal.aborted ? "stale" : "skipped";
    } catch (caught) {
      if (caught instanceof KnowledgeWorkspaceChangedError) return "stale";
      if (!controller.signal.aborted && isCurrentContext(context)) {
        setError(mapBuildError(caught));
        return "failed";
      }
      return pendingRestartRef.current?.userId === context.userId ? "stale" : "skipped";
    } finally {
      const ownsRun = activeBuildRef.current?.token === run.token;
      if (ownsRun) activeBuildRef.current = null;
      if (ownsRun && isCurrentContext(context)) {
        await refreshDerivedState(context.userId, context.generation);
      }
    }
  }, [buildSupported, isCurrentContext, queueWorkspaceRestart, refreshDerivedState, user?.id]);

  const startInitialBuild = useCallback(async () => {
    const context: UserContext = {
      userId: user?.id ?? "",
      generation: userGenerationRef.current,
    };
    if (!context.userId || !isCurrentContext(context)) {
      setError("authentication-required");
      return;
    }
    if (!buildSupported) {
      setError("extension-build-disabled");
      return;
    }
    if (
      authIsLoading
      || appIsLoading
      || !appInitialized
      || syncStatus === "queued"
      || syncStatus === "syncing"
    ) {
      setError("sync-required");
      return;
    }
    if (!liveCardIdsAreCloudReady(useAppStore.getState().cards)) {
      setError("sync-required");
      return;
    }

    try {
      manualPauseRef.current = false;
      pendingRestartRef.current = null;
      reconciliationRetryRef.current = 0;
      const consentedAt = Date.now();
      await saveKnowledgeConsent(context.userId, consentedAt);
      if (!isCurrentContext(context)) return;
      setConsented(true);
      setConsentGrantedAt(consentedAt);
      setDerivedScopeId(context.userId);
      await executeBuild({ context });
    } catch (caught) {
      if (isCurrentContext(context)) setError(mapBuildError(caught));
    }
  }, [appInitialized, appIsLoading, authIsLoading, buildSupported, executeBuild, isCurrentContext, syncStatus, user?.id]);

  const enableSemanticOnly = useCallback(async () => {
    const context: UserContext = {
      userId: user?.id ?? "",
      generation: userGenerationRef.current,
    };
    if (!context.userId || !isCurrentContext(context)) {
      setError("authentication-required");
      return;
    }
    try {
      const consentedAt = Date.now();
      await saveKnowledgeConsent(context.userId, consentedAt);
      if (!isCurrentContext(context)) return;
      setConsented(true);
      setConsentGrantedAt(consentedAt);
      setDerivedScopeId(context.userId);
      setError(null);
    } catch (caught) {
      if (isCurrentContext(context)) setError(mapBuildError(caught));
    }
  }, [isCurrentContext, user?.id]);

  const retry = useCallback(async () => {
    if (!buildSupported) {
      setError(null);
      manualPauseRef.current = false;
      extensionRetryRef.current = 0;
      setExtensionIncrementalStatus("retrying");
      setExtensionReconciliationRevision((value) => value + 1);
      return;
    }
    const context: UserContext = {
      userId: user?.id ?? "",
      generation: userGenerationRef.current,
    };
    if (!context.userId || !isCurrentContext(context)) {
      setError("authentication-required");
      return;
    }
    manualPauseRef.current = false;
    reconciliationRetryRef.current = 0;
    setError(null);
    const persistedState = await getKnowledgeBuildState(context.userId).catch(() => null);
    if (!isCurrentContext(context)) return;
    if (!persistedState) {
      await executeBuild({ context, resume: true });
      return;
    }
    const epoch = workspaceMutationEpochRef.current + 1;
    workspaceMutationEpochRef.current = epoch;
    pendingRestartRef.current = { ...context, epoch };
    setReconciliationRevision((value) => value + 1);
  }, [buildSupported, executeBuild, isCurrentContext, user?.id]);

  const pause = useCallback(() => {
    manualPauseRef.current = true;
    pendingRestartRef.current = null;
    activeBuildRef.current?.controller.abort();
    activeWebReconciliationRef.current?.abort();
    activeWebReconciliationRef.current = null;
    activeExtensionRunRef.current?.controller.abort();
    activeExtensionRunRef.current = null;
    if (!buildSupported) setExtensionIncrementalStatus("idle");
  }, [buildSupported]);

  useEffect(() => {
    if (buildSupported) {
      setExtensionIncrementalStatus("disabled");
      return undefined;
    }
    if (manualPauseRef.current) {
      setExtensionIncrementalStatus("idle");
      return undefined;
    }
    if (!user || !consentReady || derivedScopeId !== user.id || !consented) {
      setExtensionIncrementalStatus(user ? "waiting-workspace" : "disabled");
      return undefined;
    }
    if (authIsLoading || appIsLoading || !appInitialized || syncStatus === "queued" || syncStatus === "syncing") {
      setExtensionIncrementalStatus("waiting-workspace");
      return undefined;
    }

    const context: UserContext = { userId: user.id, generation: userGenerationRef.current };
    const controller = new AbortController();
    const run: ActiveBuildRun = {
      ...context,
      controller,
      token: Symbol("extension-knowledge-reconciliation"),
    };
    // Register the controller during the debounce window as well as during the
    // network run. Otherwise a user clicking Pause while the UI says
    // "retrying" cannot cancel the already queued reconciliation.
    activeExtensionRunRef.current = run;
    let retryTimer: number | undefined;
    const reconciliationDelay = extensionHasObservedRef.current
      ? INCREMENTAL_DEBOUNCE_MS
      : 0;
    const timer = window.setTimeout(() => {
      if (
        controller.signal.aborted
        || activeExtensionRunRef.current?.token !== run.token
        || !isCurrentContext(context)
      ) return;
      setExtensionIncrementalStatus("reconciling");

      void reconcileExtensionKnowledge({
        userId: context.userId,
        baselineCutoffAt: consentGrantedAt,
        signal: controller.signal,
        isCurrent: () => isCurrentContext(context),
        getCurrentUserId: () => useAuthStore.getState().user?.id ?? null,
      }).then((result) => {
        if (controller.signal.aborted || !isCurrentContext(context)) return;
        if (result.status === "waiting-workspace") {
          setExtensionIncrementalStatus("waiting-workspace");
          return;
        }
        if (result.status === "workspace-changed") {
          extensionRetryRef.current += 1;
          if (extensionRetryRef.current >= MAX_AUTOMATIC_RECONCILIATION_RETRIES) {
            setExtensionIncrementalStatus("error");
            setError("build-failed");
            return;
          }
          setExtensionIncrementalStatus("retrying");
          retryTimer = window.setTimeout(() => {
            setExtensionReconciliationRevision((value) => value + 1);
          }, INCREMENTAL_DEBOUNCE_MS);
          return;
        }
        if (result.status === "aborted" || result.status === "stale-scope") return;
        extensionHasObservedRef.current = true;
        extensionRetryRef.current = 0;
        setExtensionIncrementalStatus("idle");
        setError((current) => current === "build-failed" ? null : current);
        if (result.status === "reconciled") {
          invalidateSemanticSearchSessionCache(context.userId);
        }
      }).catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught) || !isCurrentContext(context)) return;
        extensionRetryRef.current += 1;
        setExtensionIncrementalStatus("error");
        setError(mapBuildError(caught));
        if (extensionRetryRef.current >= MAX_AUTOMATIC_RECONCILIATION_RETRIES) return;
        const retryDelay = Math.min(
          MAX_RECONCILIATION_RETRY_MS,
          1_000 * (2 ** Math.min(extensionRetryRef.current - 1, 5)),
        );
        retryTimer = window.setTimeout(() => {
          setExtensionIncrementalStatus("retrying");
          setExtensionReconciliationRevision((value) => value + 1);
        }, retryDelay);
      }).finally(() => {
        if (activeExtensionRunRef.current?.token === run.token) {
          activeExtensionRunRef.current = null;
        }
      });
    }, reconciliationDelay);

    return () => {
      window.clearTimeout(timer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      controller.abort();
      if (activeExtensionRunRef.current?.controller === controller) {
        activeExtensionRunRef.current = null;
      }
    };
  }, [
    appInitialized,
    appIsLoading,
    authIsLoading,
    buildSupported,
    cards,
    categories,
    consentReady,
    consented,
    consentGrantedAt,
    derivedScopeId,
    extensionReconciliationRevision,
    isCurrentContext,
    sections,
    syncStatus,
    user,
  ]);

  useEffect(() => {
    const pending = pendingRestartRef.current;
    const canReconcileStatus = buildState?.status === "complete"
      || buildState?.status === "complete-with-errors"
      || (
        buildState?.status === "paused"
        && pending !== null
        && pending.userId === user?.id
        && pending.generation === userGenerationRef.current
        && !manualPauseRef.current
      );
    if (
      !user
      || !buildSupported
      || !consented
      || authIsLoading
      || appIsLoading
      || !appInitialized
      || syncStatus === "queued"
      || syncStatus === "syncing"
      || activeBuildRef.current
      || !canReconcileStatus
    ) return undefined;

    const context: UserContext = { userId: user.id, generation: userGenerationRef.current };
    const controller = new AbortController();
    activeWebReconciliationRef.current?.abort();
    activeWebReconciliationRef.current = controller;
    let retryTimer: number | undefined;
    const timer = window.setTimeout(() => {
      void (async () => {
        let shouldRetryReconciliation = false;
        let removedAny = false;
        let changedCardIds: string[] = [];
        const restartAtStart = pendingRestartRef.current;
        try {
          await withStorageLock(`knowledge-scope:${context.userId}`, async () => {
            if (
              controller.signal.aborted
              || manualPauseRef.current
              || !isCurrentContext(context)
            ) return;
            if (await getSyncMetadataVersion(context.userId) !== CURRENT_SYNC_METADATA_VERSION) {
              throw new KnowledgeSyncRequiredError();
            }
            if (controller.signal.aborted || !isCurrentContext(context)) return;
            const [
              latestEntries,
              latestCards,
              latestCategories,
              latestSections,
              latestBuildState,
            ] = await Promise.all([
              listKnowledgeCacheEntries(context.userId),
              getCards(),
              getCategories(),
              getSections(),
              getKnowledgeBuildState(context.userId),
            ]);
            if (latestCards.length > 0 && !liveCardIdsAreCloudReady(latestCards)) {
              throw new KnowledgeSyncRequiredError();
            }
            const liveCardIds = new Set(latestCards.map((card) => card.id));
            const entryById = new Map(latestEntries.map((entry) => [entry.cardId, entry]));
            const jobByCardId = new Map(
              (latestBuildState?.jobs ?? []).map((job) => [job.cardId, job]),
            );
            const cloudReadyCards = latestCards.filter(isCloudReadyCard);
            const cloudStates = cloudReadyCards.length > 0
              ? await listKnowledgeEmbeddingStates(
                  cloudReadyCards.map((card) => card.id),
                  {
                    signal: controller.signal,
                    expectedUserId: context.userId,
                  },
                )
              : [];
            if (controller.signal.aborted || !isCurrentContext(context)) return;
            const cloudHashByCardAndSource = new Map(
              cloudStates.map((state) => [
                `${state.cardId}:${state.source}`,
                state.contentHash,
              ]),
            );
            const cloudSourcesByCardId = new Map<string, Set<KnowledgeExtractionSource>>();
            for (const state of cloudStates) {
              const sources = cloudSourcesByCardId.get(state.cardId)
                ?? new Set<KnowledgeExtractionSource>();
              sources.add(state.source);
              cloudSourcesByCardId.set(state.cardId, sources);
            }

            for (const entry of latestEntries) {
              if (controller.signal.aborted || !isCurrentContext(context)) return;
              if (liveCardIds.has(entry.cardId)) continue;
              try {
                await removeKnowledgeEmbedding(entry.cardId, {
                  signal: controller.signal,
                  expectedUserId: context.userId,
                });
                // Both public-html and saved-fields vectors are derived rows. Once
                // their card-wide cloud delete completes, drop the local marker; a
                // restore raced with this request is detected below and rebuilt.
                await removeKnowledgeCacheEntry(context.userId, entry.cardId);
                entryById.delete(entry.cardId);
                removedAny = true;
                invalidateSemanticSearchSessionCache(context.userId);
              } catch (caught) {
                if (controller.signal.aborted || isAbortError(caught)) return;
                shouldRetryReconciliation = true;
              }
            }
            const currentIndex = buildWorkspaceSearchIndex({
              cards: latestCards,
              categories: latestCategories,
              sections: latestSections,
            });
            const currentPaths = new Map(
              currentIndex.cardEntries.map((entry) => [entry.card.id, entry.pathLabels]),
            );
            changedCardIds = [];
            for (const card of cloudReadyCards) {
              const cached = entryById.get(card.id);
              if (!cached) {
                changedCardIds.push(card.id);
                continue;
              }
              const sourceUrlIsCurrent = (
                normalizeKnowledgeSourceUrl(cached.sourceUrl) ?? cached.sourceUrl.trim()
              ) === (
                normalizeKnowledgeSourceUrl(card.url) ?? card.url.trim()
              );
              const sourceDocuments = await hashKnowledgeSourceDocuments(
                buildKnowledgeSourceDocumentTexts({
                  card,
                  pathLabels: currentPaths.get(card.id) ?? [],
                  extractedText: sourceUrlIsCurrent ? cached.extractedText : "",
                }),
              );
              const currentSetHash = await hashKnowledgeDocumentSet(sourceDocuments);
              const sourceHashesAreCurrent = sourceDocuments.every((document) => (
                getKnowledgeCacheSourceHash(cached, document.source) === document.contentHash
                && cloudHashByCardAndSource.get(`${card.id}:${document.source}`) === document.contentHash
              ));
              const expectedSources = new Set(sourceDocuments.map((document) => document.source));
              const hasUnexpectedCloudSource = [...(cloudSourcesByCardId.get(card.id) ?? [])]
                .some((source) => !expectedSources.has(source));
              const job = jobByCardId.get(card.id);
              if (
                !sourceUrlIsCurrent
                || currentSetHash !== cached.contentHash
                || !sourceHashesAreCurrent
                || hasUnexpectedCloudSource
                || cached.indexedAt === null
                || cached.failureCode === "prune-public-html-failed"
                || job?.status !== "complete"
                || Boolean(job?.failureCode && RETRYABLE_KNOWLEDGE_FAILURES.has(job.failureCode))
              ) {
                changedCardIds.push(card.id);
              }
            }
          });

          if (
            controller.signal.aborted
            || manualPauseRef.current
            || !isCurrentContext(context)
          ) return;
          if (changedCardIds.length > 0 || removedAny) {
            const execution = await executeBuild({ context, targetCardIds: changedCardIds });
            if (execution === "failed" || execution === "partial") {
              shouldRetryReconciliation = true;
            }
            if (execution === "stale") return;
          }
          if (
            restartAtStart
            && pendingRestartRef.current?.epoch === restartAtStart.epoch
            && pendingRestartRef.current.userId === context.userId
            && !manualPauseRef.current
          ) {
            pendingRestartRef.current = null;
          }
        } catch (caught) {
          if (!controller.signal.aborted && !isAbortError(caught) && isCurrentContext(context)) {
            if (caught instanceof KnowledgeSyncRequiredError) {
              setError("sync-required");
            } else {
              shouldRetryReconciliation = true;
            }
          }
        }

        if (controller.signal.aborted || !isCurrentContext(context)) return;
        if (shouldRetryReconciliation) {
          reconciliationRetryRef.current += 1;
          if (reconciliationRetryRef.current >= MAX_AUTOMATIC_RECONCILIATION_RETRIES) {
            setError("build-failed");
            return;
          }
          const retryDelay = Math.min(
            MAX_RECONCILIATION_RETRY_MS,
            1_000 * (2 ** Math.min(reconciliationRetryRef.current - 1, 5)),
          );
          retryTimer = window.setTimeout(
            () => setReconciliationRevision((value) => value + 1),
            retryDelay,
          );
        } else {
          reconciliationRetryRef.current = 0;
        }
      })().finally(() => {
        if (activeWebReconciliationRef.current === controller) {
          activeWebReconciliationRef.current = null;
        }
      });
    }, INCREMENTAL_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      controller.abort();
      if (activeWebReconciliationRef.current === controller) {
        activeWebReconciliationRef.current = null;
      }
    };
  }, [appInitialized, appIsLoading, authIsLoading, buildState?.status, buildSupported, cards, categories, consented, executeBuild, isCurrentContext, reconciliationRevision, sections, syncStatus, user]);

  const currentScopeId = user?.id ?? null;
  const scopeMatches = derivedScopeId === currentScopeId;
  const visibleBuildState = scopeMatches ? buildState : null;
  const visibleCacheEntries = scopeMatches ? cacheEntries : [];
  const completedJobs = visibleBuildState?.jobs.filter((job) => job.status === "complete").length ?? 0;
  const failedJobs = visibleBuildState?.jobs.filter((job) => job.status === "failed").length ?? 0;
  const extensionIsBusy = extensionIncrementalStatus === "reconciling"
    || extensionIncrementalStatus === "retrying";

  return {
    consentReady: scopeMatches && consentReady,
    consented: scopeMatches && consented,
    buildSupported,
    incrementalSupported: !buildSupported,
    incrementalStatus: buildSupported ? "disabled" : extensionIncrementalStatus,
    isBuilding: visibleBuildState?.status === "running" || extensionIsBusy,
    buildState: visibleBuildState,
    indexedCount: visibleCacheEntries.filter((entry) => entry.indexedAt !== null).length,
    publicTextCount: visibleCacheEntries.filter((entry) => entry.extraction === "public-html").length,
    totalCards: cards.length,
    completedJobs,
    failedJobs,
    error,
    startInitialBuild,
    enableSemanticOnly,
    pause,
    retry,
    clearError: () => setError(null),
  };
}

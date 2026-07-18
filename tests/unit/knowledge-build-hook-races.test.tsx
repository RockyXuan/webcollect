import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth-store";
import type {
  KnowledgeBuildState,
  KnowledgeCacheEntry,
  KnowledgeConsentRecord,
} from "@/lib/knowledge-index";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  fetchPublicKnowledge: vi.fn(),
  getCards: vi.fn(),
  getCategories: vi.fn(),
  getKnowledgeBuildState: vi.fn(),
  getKnowledgeConsent: vi.fn(),
  getLocalSnapshotUpdatedAt: vi.fn(),
  getSections: vi.fn(),
  getSyncMetadataVersion: vi.fn(),
  indexKnowledge: vi.fn(),
  invalidateSemanticSearchSessionCache: vi.fn(),
  listKnowledgeCacheEntries: vi.fn(),
  listKnowledgeEmbeddingStates: vi.fn(),
  removeKnowledgeCacheEntry: vi.fn(),
  removeKnowledgeEmbedding: vi.fn(),
  runKnowledgeBuild: vi.fn(),
  saveKnowledgeConsent: vi.fn(),
  withStorageLock: vi.fn(),
}));

vi.mock("@/hooks/use-hybrid-workspace-search", () => ({
  invalidateSemanticSearchSessionCache: mocks.invalidateSemanticSearchSessionCache,
}));

vi.mock("@/lib/knowledge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge-client")>();
  return {
    ...actual,
    fetchPublicKnowledge: mocks.fetchPublicKnowledge,
    indexKnowledge: mocks.indexKnowledge,
    listKnowledgeEmbeddingStates: mocks.listKnowledgeEmbeddingStates,
    removeKnowledgeEmbedding: mocks.removeKnowledgeEmbedding,
  };
});

vi.mock("@/lib/knowledge-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge-builder")>();
  return { ...actual, runKnowledgeBuild: mocks.runKnowledgeBuild };
});

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    getCards: mocks.getCards,
    getCategories: mocks.getCategories,
    getLocalSnapshotUpdatedAt: mocks.getLocalSnapshotUpdatedAt,
    getSections: mocks.getSections,
    getSyncMetadataVersion: mocks.getSyncMetadataVersion,
  };
});

vi.mock("@/lib/knowledge-index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge-index")>();
  return {
    ...actual,
    getKnowledgeBuildState: mocks.getKnowledgeBuildState,
    getKnowledgeConsent: mocks.getKnowledgeConsent,
    listKnowledgeCacheEntries: mocks.listKnowledgeCacheEntries,
    removeKnowledgeCacheEntry: mocks.removeKnowledgeCacheEntry,
    saveKnowledgeConsent: mocks.saveKnowledgeConsent,
  };
});

vi.mock("@/lib/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform")>();
  return { ...actual, isChromeExtension: () => false };
});

vi.mock("@/lib/storage-lock", () => ({
  withStorageLock: mocks.withStorageLock,
}));

import { useKnowledgeBuild } from "@/hooks/use-knowledge-build";
import { useAuthStore } from "@/lib/auth-store";
import {
  KnowledgeWorkspaceChangedError,
  type KnowledgeIndexGuard,
  type KnowledgeIndexItem,
  type RunKnowledgeBuildOptions,
} from "@/lib/knowledge-builder";
import {
  buildKnowledgeDocument,
  buildKnowledgeSourceDocumentTexts,
  hashKnowledgeDocument,
  hashKnowledgeDocumentSet,
  hashKnowledgeSourceDocuments,
} from "@/lib/knowledge-index";
import { useAppStore } from "@/lib/store";
import { buildWorkspaceSearchIndex } from "@/lib/workspace-search";

const CARD_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONTENT_HASH = "a".repeat(64);

function user(id: string): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id,
    avatarUrl: "",
  };
}

function card(id = CARD_ID): WebCard {
  return {
    id,
    title: "Recovered bookmark",
    url: "https://example.com/recovered",
    shortDesc: "A bookmark restored while its derived vector is being removed.",
    fullDesc: "",
    note: "",
    abbreviation: "RB",
    imageUrl: "",
    categoryId: "cat-tools",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  };
}

function completeState(cardIds: readonly string[] = []): KnowledgeBuildState {
  return {
    version: 1,
    consentVersion: 1,
    runId: "run-complete",
    status: "complete",
    jobs: cardIds.map((cardId) => ({
      cardId,
      generation: 1,
      status: "complete",
      attempts: 1,
    })),
    updatedAt: 1,
  };
}

function cacheEntry(cardId = CARD_ID): KnowledgeCacheEntry {
  return {
    schemaVersion: 1,
    scopeId: "user-a",
    cardId,
    sourceUrl: "https://example.com/recovered",
    resolvedUrl: "https://example.com/recovered",
    contentHash: CONTENT_HASH,
    documentText: "标题: Recovered bookmark",
    extractedText: "Public page text",
    extraction: "public-html",
    fetchedAt: 1,
    indexedAt: 1,
  };
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-tools",
    name: "Tools",
    icon: "Wrench",
    color: "#4A6FA5",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function section(overrides: Partial<CollectionSection> = {}): CollectionSection {
  return {
    id: "section-main",
    name: "Main",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function consent(): KnowledgeConsentRecord {
  return { version: 1, consentedAt: 1 };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setWorkspace(
  cards: WebCard[],
  categories: Category[] = [],
  sections: CollectionSection[] = [],
): void {
  useAppStore.setState({
    cards,
    categories,
    sections,
    isLoading: false,
    initialized: true,
  });
}

function setSignedInUser(authUser: AuthUser): void {
  useAuthStore.setState({
    user: authUser,
    isLoggedIn: true,
    isLoading: false,
  });
}

function normalizeSourceUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

async function buildGuard(
  target: WebCard,
  categories: Category[] = [],
  sections: CollectionSection[] = [],
): Promise<KnowledgeIndexGuard> {
  const index = buildWorkspaceSearchIndex({ cards: [target], categories, sections });
  const pathLabels = index.cardEntries.find((entry) => entry.card.id === target.id)?.pathLabels ?? [];
  const text = buildKnowledgeDocument({ card: target, pathLabels });
  return {
    cardId: target.id,
    sourceUrl: normalizeSourceUrl(target.url),
    savedFieldsHash: await hashKnowledgeDocument(text),
  };
}

async function buildIndexItems(
  target: WebCard,
  categories: Category[] = [],
  sections: CollectionSection[] = [],
  extractedText = "",
): Promise<KnowledgeIndexItem[]> {
  const index = buildWorkspaceSearchIndex({ cards: [target], categories, sections });
  const pathLabels = index.cardEntries.find((entry) => entry.card.id === target.id)?.pathLabels ?? [];
  const documents = await hashKnowledgeSourceDocuments(buildKnowledgeSourceDocumentTexts({
    card: target,
    pathLabels,
    extractedText,
  }));
  return documents.map((document) => ({
    cardId: target.id,
    source: document.source,
    contentHash: document.contentHash,
    text: document.text,
  }));
}

async function flushImmediateEffects(): Promise<void> {
  for (let pass = 0; pass < 3; pass += 1) {
    await act(async () => {
      await Promise.resolve();
      if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
    });
  }
}

describe("knowledge build hook race safety", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.fetchPublicKnowledge.mockResolvedValue({ resolvedUrl: "https://example.com", text: "" });
    mocks.getCards.mockImplementation(async () => useAppStore.getState().cards);
    mocks.getCategories.mockImplementation(async () => useAppStore.getState().categories);
    mocks.getKnowledgeBuildState.mockResolvedValue(null);
    mocks.getKnowledgeConsent.mockResolvedValue(null);
    mocks.getLocalSnapshotUpdatedAt.mockResolvedValue(1);
    mocks.getSections.mockImplementation(async () => useAppStore.getState().sections);
    mocks.getSyncMetadataVersion.mockResolvedValue(1);
    mocks.indexKnowledge.mockResolvedValue([]);
    mocks.listKnowledgeCacheEntries.mockResolvedValue([]);
    mocks.listKnowledgeEmbeddingStates.mockResolvedValue([]);
    mocks.removeKnowledgeCacheEntry.mockResolvedValue(undefined);
    mocks.removeKnowledgeEmbedding.mockResolvedValue(undefined);
    mocks.runKnowledgeBuild.mockResolvedValue(completeState());
    mocks.saveKnowledgeConsent.mockResolvedValue(undefined);
    mocks.withStorageLock.mockImplementation(async (_key: string, task: () => Promise<unknown> | unknown) => task());
    setWorkspace([]);
    setSignedInUser(user("user-a"));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    useAuthStore.setState(useAuthStore.getInitialState(), true);
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it("ignores an old account's late consent save after the active account changes", async () => {
    const pendingConsent = deferred<void>();
    mocks.saveKnowledgeConsent.mockReturnValueOnce(pendingConsent.promise);

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));

    let enablePromise!: Promise<void>;
    act(() => {
      enablePromise = result.current.enableSemanticOnly();
    });
    expect(mocks.saveKnowledgeConsent).toHaveBeenCalledWith("user-a", expect.any(Number));

    act(() => setSignedInUser(user("user-b")));
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    expect(result.current.consented).toBe(false);

    await act(async () => {
      pendingConsent.resolve();
      await enablePromise;
    });

    expect(result.current.consentReady).toBe(true);
    expect(result.current.consented).toBe(false);
    expect(mocks.saveKnowledgeConsent).toHaveBeenCalledTimes(1);
    expect(mocks.saveKnowledgeConsent).not.toHaveBeenCalledWith("user-b");
    unmount();
  });

  it("fails closed when derived storage hydration rejects", async () => {
    mocks.getKnowledgeConsent.mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    const { result, unmount } = renderHook(() => useKnowledgeBuild());

    await waitFor(() => expect(result.current.consentReady).toBe(true));
    expect(result.current.consented).toBe(false);
    expect(result.current.buildState).toBeNull();
    expect(result.current.indexedCount).toBe(0);
    expect(result.current.publicTextCount).toBe(0);
    expect(result.current.error).toBe("build-failed");
    unmount();
  });

  it("re-reads the authoritative workspace after acquiring the cross-tab lock", async () => {
    const original = { ...card(), title: "Old title", note: "old note" };
    const latest = { ...original, title: "Latest title", note: "latest note", updatedAt: 2 };
    const embeddingStates = [{
      cardId: CARD_ID,
      contentHash: CONTENT_HASH,
      source: "saved-fields" as const,
    }];
    const pendingBuild = deferred<KnowledgeBuildState>();
    setWorkspace([original]);
    mocks.listKnowledgeEmbeddingStates.mockResolvedValue(embeddingStates);
    mocks.runKnowledgeBuild.mockReturnValueOnce(pendingBuild.promise);
    mocks.withStorageLock.mockImplementationOnce(async (
      _key: string,
      task: () => Promise<unknown> | unknown,
    ) => {
      setWorkspace([latest]);
      return task();
    });

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.startInitialBuild();
    });
    await waitFor(() => expect(mocks.runKnowledgeBuild).toHaveBeenCalledTimes(1));

    const buildOptions = mocks.runKnowledgeBuild.mock.calls[0][0] as RunKnowledgeBuildOptions;
    expect(mocks.listKnowledgeEmbeddingStates).toHaveBeenCalledWith([CARD_ID], {
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    });
    expect(buildOptions).toEqual(expect.objectContaining({
      cards: [latest],
      existingEmbeddingStates: embeddingStates,
    }));
    expect(mocks.runKnowledgeBuild).not.toHaveBeenCalledWith(expect.objectContaining({
      cards: [original],
    }));

    expect(buildOptions.fetchPublicPage).toBeTypeOf("function");
    await buildOptions.fetchPublicPage?.("https://example.com", new AbortController().signal);
    expect(mocks.fetchPublicKnowledge).toHaveBeenCalledWith("https://example.com", {
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    });

    const indexItems = await buildIndexItems(latest);
    const guard = await buildGuard(latest);
    await buildOptions.indexDocuments?.(
      indexItems,
      [guard],
      new AbortController().signal,
    );
    expect(mocks.indexKnowledge).toHaveBeenCalledWith(indexItems, {
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    });

    expect(buildOptions.removeEmbedding).toBeTypeOf("function");
    await buildOptions.removeEmbedding?.(
      CARD_ID,
      "public-html",
      new AbortController().signal,
    );
    expect(mocks.removeKnowledgeEmbedding).toHaveBeenCalledWith(CARD_ID, {
      source: "public-html",
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    });
    await act(async () => {
      pendingBuild.resolve(completeState([CARD_ID]));
      await startPromise;
    });
    unmount();
  });

  it.each([
    {
      label: "title",
      mutate: (original: WebCard, categories: Category[], sections: CollectionSection[]) => {
        setWorkspace([{ ...original, title: "Changed title", updatedAt: 2 }], categories, sections);
      },
    },
    {
      label: "note",
      mutate: (original: WebCard, categories: Category[], sections: CollectionSection[]) => {
        setWorkspace([{ ...original, note: "Changed note", updatedAt: 2 }], categories, sections);
      },
    },
    {
      label: "URL",
      mutate: (original: WebCard, categories: Category[], sections: CollectionSection[]) => {
        setWorkspace([{ ...original, url: "https://example.org/new", updatedAt: 2 }], categories, sections);
      },
    },
    {
      label: "category path",
      mutate: (original: WebCard, categories: Category[], sections: CollectionSection[]) => {
        setWorkspace(
          [original],
          categories.map((item) => ({ ...item, name: "Renamed tools", updatedAt: 2 })),
          sections,
        );
      },
    },
    {
      label: "card deletion",
      mutate: (_original: WebCard, categories: Category[], sections: CollectionSection[]) => {
        setWorkspace([], categories, sections);
      },
    },
  ])("rejects the whole upload batch when $label changes before indexing", async ({ mutate }) => {
    const original = card();
    const originalCategories = [category({ sectionId: "section-main" })];
    const originalSections = [section()];
    const items = await buildIndexItems(
      original,
      originalCategories,
      originalSections,
      "Public page text",
    );
    const guard = await buildGuard(original, originalCategories, originalSections);
    let observedError: unknown;
    let buildSignal: AbortSignal | undefined;
    setWorkspace([original], originalCategories, originalSections);
    mocks.runKnowledgeBuild.mockImplementationOnce(async (options: RunKnowledgeBuildOptions) => {
      buildSignal = options.signal;
      mutate(original, originalCategories, originalSections);
      try {
        await options.indexDocuments?.(items, [guard], options.signal ?? new AbortController().signal);
      } catch (caught) {
        observedError = caught;
        throw caught;
      }
      return completeState([CARD_ID]);
    });

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    await act(async () => result.current.startInitialBuild());

    expect(observedError).toBeInstanceOf(KnowledgeWorkspaceChangedError);
    expect(buildSignal?.aborted).toBe(true);
    expect(mocks.indexKnowledge).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("uploads a stable guarded dual-source batch only for the active account", async () => {
    const target = card();
    const categories = [category({ sectionId: "section-main" })];
    const sections = [section()];
    const items = await buildIndexItems(target, categories, sections, "Public page text");
    const guard = await buildGuard(target, categories, sections);
    setWorkspace([target], categories, sections);
    mocks.indexKnowledge.mockImplementationOnce(async (received: KnowledgeIndexItem[]) => (
      received.map((item, index) => ({
        cardId: item.cardId,
        contentHash: item.contentHash,
        source: item.source,
        indexedAt: index + 1,
      }))
    ));
    mocks.runKnowledgeBuild.mockImplementationOnce(async (options: RunKnowledgeBuildOptions) => {
      await options.indexDocuments?.(items, [guard], options.signal ?? new AbortController().signal);
      return completeState([CARD_ID]);
    });

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    await act(async () => result.current.startInitialBuild());

    expect(mocks.indexKnowledge).toHaveBeenCalledTimes(1);
    expect(mocks.indexKnowledge).toHaveBeenCalledWith(items, {
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    });
    expect(items.map((item) => item.source)).toEqual(["saved-fields", "public-html"]);
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("rejects the first 32-item slice when a guarded card from the later slice is stale", async () => {
    const originalCards = Array.from({ length: 17 }, (_, index) => ({
      ...card(`123e4567-e89b-42d3-a456-426614174${String(index).padStart(3, "0")}`),
      title: `Bookmark ${index + 1}`,
      url: `https://example.com/bookmark-${index + 1}`,
    }));
    const allItems = (await Promise.all(originalCards.map((item) => (
      buildIndexItems(item, [], [], `Public text ${item.title}`)
    )))).flat();
    const allGuards = await Promise.all(originalCards.map((item) => buildGuard(item)));
    const firstSlice = allItems.slice(0, 32);
    const staleCard = originalCards[16];
    expect(allItems).toHaveLength(34);
    expect(firstSlice).toHaveLength(32);
    expect(firstSlice.every((item) => item.cardId !== staleCard.id)).toBe(true);
    let observedError: unknown;
    setWorkspace(originalCards);
    mocks.runKnowledgeBuild.mockImplementationOnce(async (options: RunKnowledgeBuildOptions) => {
      setWorkspace(originalCards.map((item) => (
        item.id === staleCard.id
          ? { ...item, title: "Changed after preparation", updatedAt: 2 }
          : item
      )));
      try {
        await options.indexDocuments?.(
          firstSlice,
          allGuards,
          options.signal ?? new AbortController().signal,
        );
      } catch (caught) {
        observedError = caught;
        throw caught;
      }
      return completeState(originalCards.map((item) => item.id));
    });

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    await act(async () => result.current.startInitialBuild());

    expect(observedError).toBeInstanceOf(KnowledgeWorkspaceChangedError);
    expect(mocks.indexKnowledge).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("does not auto-restart a manually paused build after a workspace change", async () => {
    const original = card();
    const items = await buildIndexItems(original);
    const guard = await buildGuard(original);
    const releaseBuild = deferred<void>();
    setWorkspace([original]);
    mocks.runKnowledgeBuild.mockImplementationOnce(async (options: RunKnowledgeBuildOptions) => {
      await releaseBuild.promise;
      await options.indexDocuments?.(items, [guard], options.signal ?? new AbortController().signal);
      return completeState([CARD_ID]);
    });

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    vi.useFakeTimers();
    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.startInitialBuild();
    });
    await flushImmediateEffects();
    expect(mocks.runKnowledgeBuild).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.pause();
      setWorkspace([{ ...original, title: "Changed after pause", updatedAt: 2 }]);
      window.dispatchEvent(new Event("webcollect:local-change"));
    });
    await act(async () => {
      releaseBuild.resolve();
      await startPromise;
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(mocks.indexKnowledge).not.toHaveBeenCalled();
    expect(mocks.runKnowledgeBuild).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("never uploads account A's pending batch after switching to account B", async () => {
    const accountACard = { ...card(), title: "Account A private title" };
    const accountBCard = { ...card(), title: "Account B title", note: "B only", updatedAt: 2 };
    const accountAItems = await buildIndexItems(accountACard);
    const accountAGuard = await buildGuard(accountACard);
    const accountBItems = await buildIndexItems(accountBCard);
    const accountBGuard = await buildGuard(accountBCard);
    const releaseAccountA = deferred<void>();
    setWorkspace([accountACard]);
    mocks.indexKnowledge.mockImplementation(async (received: KnowledgeIndexItem[]) => (
      received.map((item, index) => ({
        cardId: item.cardId,
        contentHash: item.contentHash,
        source: item.source,
        indexedAt: index + 1,
      }))
    ));
    mocks.runKnowledgeBuild.mockImplementation(async (options: RunKnowledgeBuildOptions) => {
      if (options.scopeId === "user-a") {
        await releaseAccountA.promise;
        await options.indexDocuments?.(
          accountAItems,
          [accountAGuard],
          options.signal ?? new AbortController().signal,
        );
        return completeState([CARD_ID]);
      }
      await options.indexDocuments?.(
        accountBItems,
        [accountBGuard],
        options.signal ?? new AbortController().signal,
      );
      return completeState([CARD_ID]);
    });

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    let accountAStart!: Promise<void>;
    act(() => {
      accountAStart = result.current.startInitialBuild();
    });
    await waitFor(() => expect(mocks.runKnowledgeBuild).toHaveBeenCalledTimes(1));

    act(() => {
      setWorkspace([accountBCard]);
      setSignedInUser(user("user-b"));
    });
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    await act(async () => {
      releaseAccountA.resolve();
      await accountAStart;
    });
    expect(mocks.indexKnowledge).not.toHaveBeenCalled();

    await act(async () => result.current.startInitialBuild());
    expect(mocks.indexKnowledge).toHaveBeenCalledTimes(1);
    expect(mocks.indexKnowledge).toHaveBeenCalledWith(accountBItems, {
      signal: expect.any(AbortSignal),
      expectedUserId: "user-b",
    });
    expect(JSON.stringify(mocks.indexKnowledge.mock.calls)).not.toContain("Account A private title");
    unmount();
  });

  it("does not fetch or index until the local workspace is confirmed for the signed-in user", async () => {
    setWorkspace([card()]);
    mocks.getSyncMetadataVersion.mockResolvedValue(0);

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));
    await act(async () => result.current.startInitialBuild());

    expect(result.current.error).toBe("sync-required");
    expect(mocks.getCards).not.toHaveBeenCalled();
    expect(mocks.fetchPublicKnowledge).not.toHaveBeenCalled();
    expect(mocks.indexKnowledge).not.toHaveBeenCalled();
    expect(mocks.removeKnowledgeEmbedding).not.toHaveBeenCalled();
    expect(mocks.runKnowledgeBuild).not.toHaveBeenCalled();
    unmount();
  });

  it("clears sync-required automatically after local IDs become cloud-ready", async () => {
    setWorkspace([card("card-local-only")]);
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await waitFor(() => expect(result.current.consentReady).toBe(true));

    await act(async () => result.current.startInitialBuild());
    expect(result.current.error).toBe("sync-required");
    expect(mocks.saveKnowledgeConsent).not.toHaveBeenCalled();

    act(() => setWorkspace([card()]));
    await waitFor(() => expect(result.current.error).toBeNull());
    unmount();
  });

  it("rebuilds a bookmark restored while its conditional vector delete is in flight", async () => {
    vi.useFakeTimers();
    const pendingDelete = deferred<void>();
    let entries = [cacheEntry()];
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.getKnowledgeBuildState.mockResolvedValue(completeState([CARD_ID]));
    mocks.listKnowledgeCacheEntries.mockImplementation(async () => [...entries]);
    mocks.removeKnowledgeEmbedding.mockReturnValueOnce(pendingDelete.promise);
    mocks.removeKnowledgeCacheEntry.mockImplementation(async (_scopeId: string, cardId: string) => {
      entries = entries.filter((entry) => entry.cardId !== cardId);
    });
    mocks.runKnowledgeBuild.mockImplementation(async (options: {
      targetCardIds?: readonly string[];
      onProgress?: (state: KnowledgeBuildState) => void;
    }) => {
      const state = completeState(options.targetCardIds ?? []);
      entries = [cacheEntry()];
      options.onProgress?.(state);
      return state;
    });

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.consentReady).toBe(true);
    expect(result.current.consented).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(mocks.removeKnowledgeEmbedding).toHaveBeenCalledWith(CARD_ID, expect.objectContaining({
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    }));

    act(() => setWorkspace([card()]));
    await act(async () => {
      pendingDelete.resolve();
      await Promise.resolve();
    });

    expect(mocks.removeKnowledgeCacheEntry).toHaveBeenCalledWith("user-a", CARD_ID);
    expect(entries).toEqual([]);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(mocks.runKnowledgeBuild).toHaveBeenCalledWith(expect.objectContaining({
      scopeId: "user-a",
      targetCardIds: [CARD_ID],
    }));
    expect(entries.map((entry) => entry.cardId)).toEqual([CARD_ID]);
    unmount();
  });

  it("rebuilds an unchanged restored bookmark when its cloud vector is missing", async () => {
    vi.useFakeTimers();
    const restoredCard = card();
    const documentText = buildKnowledgeDocument({
      card: restoredCard,
      pathLabels: [],
      extractedText: "Public page text",
    });
    const matchingHash = await hashKnowledgeDocument(documentText);
    const matchingEntry: KnowledgeCacheEntry = {
      ...cacheEntry(),
      contentHash: matchingHash,
      documentText,
    };
    setWorkspace([restoredCard]);
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.getKnowledgeBuildState.mockResolvedValue(completeState([CARD_ID]));
    mocks.listKnowledgeCacheEntries.mockResolvedValue([matchingEntry]);
    mocks.listKnowledgeEmbeddingStates.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.consentReady).toBe(true);
    expect(result.current.consented).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await flushImmediateEffects();

    expect(mocks.listKnowledgeEmbeddingStates).toHaveBeenCalledWith([CARD_ID], {
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(mocks.runKnowledgeBuild).toHaveBeenCalledWith(expect.objectContaining({
          scopeId: "user-a",
          targetCardIds: [CARD_ID],
          existingEmbeddingStates: [],
          removeEmbedding: expect.any(Function),
        }));
      }, { timeout: 2_000, interval: 10 });
    });
    unmount();
  });

  it("treats both saved-fields and public-html as required during Web reconciliation", async () => {
    vi.useFakeTimers();
    const target = card();
    const sourceDocuments = await buildIndexItems(target, [], [], "Public page text");
    const savedFields = sourceDocuments.find((item) => item.source === "saved-fields");
    const publicHtml = sourceDocuments.find((item) => item.source === "public-html");
    expect(savedFields).toBeDefined();
    expect(publicHtml).toBeDefined();
    const marker = await hashKnowledgeDocumentSet(sourceDocuments);
    const dualSourceEntry: KnowledgeCacheEntry = {
      ...cacheEntry(),
      contentHash: marker,
      savedFieldsHash: savedFields?.contentHash,
      publicHtmlHash: publicHtml?.contentHash,
      documentText: savedFields?.text ?? "",
      extractedText: "Public page text",
      indexedAt: 5,
    };
    const bothCloudSources = sourceDocuments.map((item) => ({
      cardId: CARD_ID,
      contentHash: item.contentHash,
      source: item.source,
    }));
    setWorkspace([target]);
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.getKnowledgeBuildState.mockResolvedValue(completeState([CARD_ID]));
    mocks.listKnowledgeCacheEntries.mockResolvedValue([dualSourceEntry]);
    mocks.listKnowledgeEmbeddingStates.mockResolvedValue(bothCloudSources);

    const current = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();
    expect(current.result.current.consented).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await flushImmediateEffects();

    expect(mocks.listKnowledgeEmbeddingStates).toHaveBeenCalledWith([CARD_ID], {
      signal: expect.any(AbortSignal),
      expectedUserId: "user-a",
    });
    expect(mocks.runKnowledgeBuild).not.toHaveBeenCalled();
    current.unmount();

    mocks.runKnowledgeBuild.mockClear();
    mocks.listKnowledgeEmbeddingStates.mockClear();
    mocks.listKnowledgeEmbeddingStates.mockResolvedValue(
      bothCloudSources.filter((item) => item.source === "saved-fields"),
    );
    const missingPublic = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await act(async () => {
      await vi.waitFor(() => {
        expect(mocks.runKnowledgeBuild).toHaveBeenCalledTimes(1);
      }, { timeout: 2_000, interval: 10 });
    });
    expect(mocks.runKnowledgeBuild).toHaveBeenCalledWith(expect.objectContaining({
      scopeId: "user-a",
      targetCardIds: [CARD_ID],
      existingEmbeddingStates: [expect.objectContaining({ source: "saved-fields" })],
    }));
    missingPublic.unmount();
  });

  it("caps automatic Web reconciliation retries and lets a manual retry start a fresh budget", async () => {
    vi.useFakeTimers();
    setWorkspace([card()]);
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.getKnowledgeBuildState.mockResolvedValue(completeState([CARD_ID]));
    mocks.listKnowledgeCacheEntries.mockResolvedValue([cacheEntry()]);
    mocks.listKnowledgeEmbeddingStates.mockRejectedValue(new Error("temporary cloud state failure"));

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();
    expect(result.current.consented).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await flushImmediateEffects();
    expect(mocks.listKnowledgeEmbeddingStates).toHaveBeenCalledTimes(1);
    for (const [attempt, retryDelay] of [1_000, 2_000, 4_000, 8_000].entries()) {
      await act(async () => vi.advanceTimersByTimeAsync(retryDelay));
      await flushImmediateEffects();
      await act(async () => vi.advanceTimersByTimeAsync(2_000));
      await flushImmediateEffects();
      expect(mocks.listKnowledgeEmbeddingStates).toHaveBeenCalledTimes(attempt + 2);
    }
    expect(result.current.error).toBe("build-failed");

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(mocks.listKnowledgeEmbeddingStates).toHaveBeenCalledTimes(5);

    await act(async () => result.current.retry());
    expect(result.current.error).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await flushImmediateEffects();

    expect(mocks.listKnowledgeEmbeddingStates).toHaveBeenCalledTimes(6);
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("preserves the last derived cache marker when cloud deletion fails", async () => {
    vi.useFakeTimers();
    const entries = [cacheEntry()];
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.getKnowledgeBuildState.mockResolvedValue(completeState([CARD_ID]));
    mocks.listKnowledgeCacheEntries.mockImplementation(async () => [...entries]);
    mocks.removeKnowledgeEmbedding.mockRejectedValueOnce(new Error("temporary network failure"));

    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.consentReady).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));

    expect(mocks.removeKnowledgeEmbedding).toHaveBeenCalledTimes(1);
    expect(mocks.removeKnowledgeCacheEntry).not.toHaveBeenCalled();
    expect(mocks.runKnowledgeBuild).not.toHaveBeenCalled();
    expect(entries.map((entry) => entry.cardId)).toEqual([CARD_ID]);
    unmount();
  });
});

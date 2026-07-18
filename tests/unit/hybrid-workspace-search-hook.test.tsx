import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticKnowledgeResult } from "@/lib/knowledge-client";
import type { Category, CollectionSection, WebCard } from "@/lib/types";
import { buildWorkspaceSearchIndex } from "@/lib/workspace-search";

vi.mock("@/lib/knowledge-client", () => ({
  semanticSearchKnowledge: vi.fn(),
}));

import { semanticSearchKnowledge } from "@/lib/knowledge-client";
import {
  __resetSemanticSearchSessionCacheForTest,
  invalidateSemanticSearchSessionCache,
  shouldRequestSemanticSearch,
  useHybridWorkspaceSearch,
} from "@/hooks/use-hybrid-workspace-search";

const semanticSearchMock = vi.mocked(semanticSearchKnowledge);
const now = 1_777_777_777;

const section: CollectionSection = {
  id: "section-default",
  name: "主页",
  order: 0,
  createdAt: now,
  updatedAt: now,
};

const category: Category = {
  id: "cat-tools",
  name: "开发工具",
  icon: "Code2",
  color: "#4a7c59",
  order: 0,
  createdAt: now,
  updatedAt: now,
  sectionId: section.id,
};

function card(id: string, title: string, shortDesc = ""): WebCard {
  return {
    id,
    title,
    url: `https://${id}.example.com`,
    shortDesc,
    fullDesc: "",
    note: "",
    abbreviation: title.slice(0, 2),
    imageUrl: "",
    categoryId: category.id,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface HybridHookProps {
  query: string;
  enabled: boolean;
  userId?: string;
}

describe("hybrid workspace search hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetSemanticSearchSessionCacheForTest();
    semanticSearchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it.each([
    ["思维", true],
    ["思", false],
    ["git", true],
    ["gi", false],
    ["ＧＩＴ", true],
    ["a-12", true],
    ["  ", false],
  ])("applies the semantic request minimum to %j", (query, expected) => {
    expect(shouldRequestSemanticSearch(query)).toBe(expected);
  });

  it("returns local fuzzy matches immediately and waits the full 250ms before semantic search", async () => {
    const github = card("card-github", "GitHub", "代码托管与协作");
    const index = buildWorkspaceSearchIndex({ cards: [github], categories: [category], sections: [section] });
    semanticSearchMock.mockResolvedValue([]);

    const { result } = renderHook(() => useHybridWorkspaceSearch({
      query: "githb",
      index,
      semanticEnabled: true,
      userId: "user-a",
    }));

    expect(result.current.cards[0]?.card.id).toBe(github.id);
    expect(result.current.cards[0]?.matchReasons).toContain("fuzzy");
    expect(result.current.semanticStatus).toBe("loading");
    expect(semanticSearchMock).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(249));
    expect(semanticSearchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);
    expect(semanticSearchMock).toHaveBeenCalledWith("githb", expect.objectContaining({
      limit: 20,
      expectedUserId: "user-a",
    }));
    expect(result.current.semanticStatus).toBe("ready");
    expect(result.current.cards[0]?.card.id).toBe(github.id);
  });

  it("lets a semantic hit boost a local candidate ranked between ninth and twentieth", async () => {
    const localCards = Array.from({ length: 20 }, (_, itemIndex) =>
      card(`card-tool-${String(itemIndex).padStart(2, "0")}`, `Tool ${String(itemIndex).padStart(2, "0")}`));
    const boosted = localCards[15];
    const index = buildWorkspaceSearchIndex({ cards: localCards, categories: [category], sections: [section] });
    semanticSearchMock.mockResolvedValue([{
      cardId: boosted.id,
      similarity: 0.99,
      contentHash: "9".repeat(64),
    }]);

    const { result } = renderHook(() => useHybridWorkspaceSearch({
      query: "tool",
      index,
      semanticEnabled: true,
      userId: "user-local-20",
    }));

    expect(result.current.localResults.cards).toHaveLength(20);
    expect(result.current.localResults.cards[15]?.card.id).toBe(boosted.id);
    expect(result.current.cards.some((item) => item.card.id === boosted.id)).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(result.current.cards[0]?.card.id).toBe(boosted.id);
    expect(result.current.cards[0]?.localRank).toBe(15);
    expect(result.current.cards[0]?.matchReasons).toContain("semantic");
  });

  it("normalizes and caches only the first 200 Unicode characters for semantic search", async () => {
    const index = buildWorkspaceSearchIndex({
      cards: [card("card-long", "Long query destination")],
      categories: [category],
      sections: [section],
    });
    const prefix = "思".repeat(200);
    semanticSearchMock.mockResolvedValue([]);
    const { rerender } = renderHook(
      ({ query }) => useHybridWorkspaceSearch({
        query,
        index,
        semanticEnabled: true,
        userId: "user-long-query",
      }),
      { initialProps: { query: `${prefix}第一个忽略尾巴` } },
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);
    expect(semanticSearchMock).toHaveBeenCalledWith(prefix, expect.objectContaining({ limit: 20 }));

    rerender({ query: `${prefix}第二个忽略尾巴` });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts an in-flight old query and never lets its late result replace the new query", async () => {
    const firstCard = card("card-first", "First destination");
    const secondCard = card("card-second", "Second destination");
    const index = buildWorkspaceSearchIndex({
      cards: [firstCard, secondCard],
      categories: [category],
      sections: [section],
    });
    const firstRequest = deferred<SemanticKnowledgeResult[]>();
    const secondRequest = deferred<SemanticKnowledgeResult[]>();
    semanticSearchMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ query }) => useHybridWorkspaceSearch({
        query,
        index,
        semanticEnabled: true,
        userId: "user-b",
      }),
      { initialProps: { query: "unrelated alpha intent" } },
    );

    act(() => vi.advanceTimersByTime(250));
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);
    const firstSignal = semanticSearchMock.mock.calls[0]?.[1]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    rerender({ query: "unrelated beta intent" });
    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.semanticStatus).toBe("loading");

    act(() => vi.advanceTimersByTime(250));
    expect(semanticSearchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstRequest.resolve([{
        cardId: firstCard.id,
        similarity: 0.99,
        contentHash: "a".repeat(64),
      }]);
      await firstRequest.promise;
    });
    expect(result.current.cards.some((item) => item.card.id === firstCard.id)).toBe(false);
    expect(result.current.semanticStatus).toBe("loading");

    await act(async () => {
      secondRequest.resolve([{
        cardId: secondCard.id,
        similarity: 0.99,
        contentHash: "b".repeat(64),
      }]);
      await secondRequest.promise;
    });
    expect(result.current.semanticStatus).toBe("ready");
    expect(result.current.cards.map((item) => item.card.id)).toEqual([secondCard.id]);
  });

  it("keeps an in-flight response from the previous user out of the new user's state", async () => {
    const firstCard = card("card-user-first", "First user destination");
    const secondCard = card("card-user-second", "Second user destination");
    const index = buildWorkspaceSearchIndex({
      cards: [firstCard, secondCard],
      categories: [category],
      sections: [section],
    });
    const firstRequest = deferred<SemanticKnowledgeResult[]>();
    const secondRequest = deferred<SemanticKnowledgeResult[]>();
    semanticSearchMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ userId }) => useHybridWorkspaceSearch({
        query: "opaque account intent",
        index,
        semanticEnabled: true,
        userId,
      }),
      { initialProps: { userId: "user-first" } },
    );

    act(() => vi.advanceTimersByTime(250));
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);

    rerender({ userId: "user-second" });
    act(() => vi.advanceTimersByTime(250));
    expect(semanticSearchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstRequest.resolve([{
        cardId: firstCard.id,
        similarity: 0.99,
        contentHash: "a".repeat(64),
      }]);
      await firstRequest.promise;
    });
    expect(result.current.semanticStatus).toBe("loading");
    expect(result.current.semanticResultCount).toBe(0);

    await act(async () => {
      secondRequest.resolve([{
        cardId: secondCard.id,
        similarity: 0.99,
        contentHash: "b".repeat(64),
      }]);
      await secondRequest.promise;
    });
    expect(result.current.semanticStatus).toBe("ready");
    expect(result.current.cards.map((item) => item.card.id)).toEqual([secondCard.id]);
  });

  it("does not schedule semantic work when disabled, signed out, or below the query minimum", () => {
    const index = buildWorkspaceSearchIndex({
      cards: [card("card-one", "One")],
      categories: [category],
      sections: [section],
    });
    const initialProps: HybridHookProps = {
      query: "semantic query",
      enabled: false,
      userId: "user-c",
    };
    const { rerender } = renderHook(
      (props: HybridHookProps) => useHybridWorkspaceSearch({
        query: props.query,
        index,
        semanticEnabled: props.enabled,
        userId: props.userId,
      }),
      { initialProps },
    );

    act(() => vi.advanceTimersByTime(1_000));
    rerender({ query: "semantic query", enabled: true, userId: undefined });
    act(() => vi.advanceTimersByTime(1_000));
    rerender({ query: "ab", enabled: true, userId: "user-c" });
    act(() => vi.advanceTimersByTime(1_000));

    expect(semanticSearchMock).not.toHaveBeenCalled();
  });

  it("reuses a fresh cache entry and requests semantic results again after five minutes", async () => {
    const match = card("card-cache", "Cached destination");
    const index = buildWorkspaceSearchIndex({
      cards: [match],
      categories: [category],
      sections: [section],
    });
    semanticSearchMock.mockResolvedValue([{
      cardId: match.id,
      similarity: 0.91,
      contentHash: "c".repeat(64),
    }]);

    const renderSearch = () => renderHook(() => useHybridWorkspaceSearch({
      query: "opaque semantic intent",
      index,
      semanticEnabled: true,
      userId: "user-cache",
    }));

    const first = renderSearch();
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(first.result.current.semanticResultCount).toBe(1);
    first.unmount();

    const cached = renderSearch();
    expect(cached.result.current.semanticStatus).toBe("ready");
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);
    cached.unmount();

    act(() => vi.advanceTimersByTime(5 * 60 * 1_000 + 1));
    const expired = renderSearch();
    expect(expired.result.current.semanticStatus).toBe("loading");
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(semanticSearchMock).toHaveBeenCalledTimes(2);
    expect(expired.result.current.semanticResultCount).toBe(1);
  });

  it("filters cached and active semantic hits against the current live card ids", async () => {
    const kept = card("card-kept", "Kept destination");
    const removed = card("card-removed", "Removed destination");
    const fullIndex = buildWorkspaceSearchIndex({
      cards: [kept, removed],
      categories: [category],
      sections: [section],
    });
    const reducedIndex = buildWorkspaceSearchIndex({
      cards: [kept],
      categories: [category],
      sections: [section],
    });
    semanticSearchMock.mockResolvedValue([
      { cardId: kept.id, similarity: 0.93, contentHash: "d".repeat(64) },
      { cardId: removed.id, similarity: 0.92, contentHash: "e".repeat(64) },
    ]);

    const initialProps = { index: fullIndex };
    const { result, rerender } = renderHook(
      ({ index }: { index: typeof fullIndex }) => useHybridWorkspaceSearch({
        query: "opaque semantic intent",
        index,
        semanticEnabled: true,
        userId: "user-filter",
      }),
      { initialProps },
    );
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(result.current.semanticResultCount).toBe(2);

    rerender({ index: reducedIndex });
    expect(result.current.semanticStatus).toBe("ready");
    expect(result.current.semanticResultCount).toBe(1);
    expect(result.current.cards.map((item) => item.card.id)).toEqual([kept.id]);
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);
  });

  it("can invalidate one user's semantic cache without evicting another user's entry", async () => {
    const match = card("card-invalidate", "Invalidation destination");
    const index = buildWorkspaceSearchIndex({
      cards: [match],
      categories: [category],
      sections: [section],
    });
    semanticSearchMock.mockResolvedValue([{
      cardId: match.id,
      similarity: 0.94,
      contentHash: "f".repeat(64),
    }]);
    const renderFor = (userId: string) => renderHook(() => useHybridWorkspaceSearch({
      query: "opaque semantic intent",
      index,
      semanticEnabled: true,
      userId,
    }));

    const userA = renderFor("user-a");
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    userA.unmount();
    const userB = renderFor("user-b");
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    userB.unmount();

    invalidateSemanticSearchSessionCache("user-a");
    const cachedB = renderFor("user-b");
    expect(cachedB.result.current.semanticStatus).toBe("ready");
    cachedB.unmount();

    const invalidatedA = renderFor("user-a");
    expect(invalidatedA.result.current.semanticStatus).toBe("loading");
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(semanticSearchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["one user", "user-epoch"],
    ["all users", undefined],
  ])("does not let an in-flight response repopulate state or cache after invalidating %s", async (_label, invalidatedUserId) => {
    const match = card("card-epoch", "Epoch destination");
    const index = buildWorkspaceSearchIndex({
      cards: [match],
      categories: [category],
      sections: [section],
    });
    const staleRequest = deferred<SemanticKnowledgeResult[]>();
    const freshResult = [{
      cardId: match.id,
      similarity: 0.95,
      contentHash: "1".repeat(64),
    }];
    semanticSearchMock
      .mockReturnValueOnce(staleRequest.promise)
      .mockResolvedValueOnce(freshResult);

    const renderSearch = () => renderHook(() => useHybridWorkspaceSearch({
      query: "opaque epoch intent",
      index,
      semanticEnabled: true,
      userId: "user-epoch",
    }));

    const stale = renderSearch();
    act(() => vi.advanceTimersByTime(250));
    expect(semanticSearchMock).toHaveBeenCalledTimes(1);
    expect(stale.result.current.semanticStatus).toBe("loading");

    act(() => invalidateSemanticSearchSessionCache(invalidatedUserId));
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(semanticSearchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      staleRequest.resolve(freshResult);
      await staleRequest.promise;
    });

    expect(stale.result.current.semanticStatus).toBe("ready");
    expect(stale.result.current.semanticResultCount).toBe(1);
    expect(stale.result.current.cards.map((item) => item.card.id)).toEqual([match.id]);
    stale.unmount();

    const cachedFresh = renderSearch();
    expect(cachedFresh.result.current.semanticStatus).toBe("ready");
    expect(semanticSearchMock).toHaveBeenCalledTimes(2);
    cachedFresh.unmount();
  });
});

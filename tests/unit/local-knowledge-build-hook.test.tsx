import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunKnowledgeBuildOptions } from "@/lib/knowledge-builder";
import type { KnowledgeBuildState, KnowledgeCacheEntry } from "@/lib/knowledge-index";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

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
  name: "工具",
  icon: "Wrench",
  color: "#4a7c59",
  order: 0,
  createdAt: now,
  updatedAt: now,
  sectionId: section.id,
};
const card: WebCard = {
  id: "card-live",
  title: "知识工具",
  url: "https://example.com/page",
  shortDesc: "收藏简介",
  fullDesc: "",
  note: "",
  abbreviation: "ZT",
  imageUrl: "",
  categoryId: category.id,
  order: 0,
  createdAt: now,
  updatedAt: now,
};
const completeState: KnowledgeBuildState = {
  version: 1,
  consentVersion: 1,
  runId: "run-complete",
  status: "complete",
  jobs: [{ cardId: card.id, generation: 1, status: "complete", attempts: 1 }],
  updatedAt: now,
};

function cacheEntry(overrides: Partial<KnowledgeCacheEntry> = {}): KnowledgeCacheEntry {
  return {
    schemaVersion: 1,
    scopeId: "local",
    cardId: card.id,
    sourceUrl: card.url,
    resolvedUrl: card.url,
    contentHash: "a".repeat(64),
    savedFieldsHash: "b".repeat(64),
    publicHtmlHash: "c".repeat(64),
    documentText: "saved fields",
    extractedText: "公开正文中的鱼骨图功能",
    extraction: "public-html",
    fetchedAt: now,
    indexedAt: now,
    ...overrides,
  };
}

const harness = vi.hoisted(() => ({
  auth: { user: null as null | { id: string } },
  store: {
    cards: [] as WebCard[],
    categories: [] as Category[],
    sections: [] as CollectionSection[],
  },
  consent: null as null | { version: 1; consentedAt: number },
  state: null as KnowledgeBuildState | null,
  entries: [] as KnowledgeCacheEntry[],
  runKnowledgeBuild: vi.fn(),
  saveKnowledgeConsent: vi.fn(),
  fetchPublicKnowledge: vi.fn(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (state: typeof harness.auth) => unknown) => selector(harness.auth),
}));

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: (state: typeof harness.store) => unknown) => selector(harness.store),
}));

vi.mock("@/lib/platform", () => ({
  isChromeExtension: () => true,
}));

vi.mock("@/lib/knowledge-index", () => ({
  getKnowledgeBuildState: vi.fn(async () => harness.state),
  getKnowledgeConsent: vi.fn(async () => harness.consent),
  listKnowledgeCacheEntries: vi.fn(async () => harness.entries),
  saveKnowledgeConsent: (...args: unknown[]) => harness.saveKnowledgeConsent(...args),
}));

vi.mock("@/lib/knowledge-builder", () => ({
  runKnowledgeBuild: (...args: unknown[]) => harness.runKnowledgeBuild(...args),
}));

vi.mock("@/lib/knowledge-client", () => ({
  fetchPublicKnowledge: (...args: unknown[]) => harness.fetchPublicKnowledge(...args),
}));

import { useLocalKnowledgeBuild } from "@/hooks/use-local-knowledge-build";

beforeEach(() => {
  vi.useRealTimers();
  harness.auth = { user: null };
  harness.store = {
    cards: [{ ...card }],
    categories: [{ ...category }],
    sections: [{ ...section }],
  };
  harness.consent = null;
  harness.state = null;
  harness.entries = [];
  harness.runKnowledgeBuild.mockReset().mockImplementation(async (options: RunKnowledgeBuildOptions) => {
    options.onProgress?.(completeState);
    return completeState;
  });
  harness.saveKnowledgeConsent.mockReset().mockResolvedValue(undefined);
  harness.fetchPublicKnowledge.mockReset().mockResolvedValue({
    resolvedUrl: card.url,
    text: "公开正文",
    truncated: false,
    segmentCount: 1,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLocalKnowledgeBuild", () => {
  it("exposes public text only for live cards whose source URL still matches", async () => {
    harness.entries = [
      cacheEntry(),
      cacheEntry({ cardId: "card-removed", extractedText: "不应出现" }),
      cacheEntry({ sourceUrl: "https://old.example.com", extractedText: "旧网址正文" }),
    ];
    const { result } = renderHook(() => useLocalKnowledgeBuild());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.knowledgeDocuments).toEqual([{
      cardId: card.id,
      text: "公开正文中的鱼骨图功能",
    }]);
    expect(result.current.indexedCount).toBe(1);
    expect(result.current.publicTextCount).toBe(1);
  });

  it("builds through local receipts without changing collection data", async () => {
    const businessBefore = structuredClone(harness.store);
    const { result } = renderHook(() => useLocalKnowledgeBuild());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.startInitialBuild();
    });

    expect(harness.saveKnowledgeConsent).toHaveBeenCalledWith("local");
    expect(harness.runKnowledgeBuild).toHaveBeenCalledTimes(1);
    const options = harness.runKnowledgeBuild.mock.calls[0][0] as RunKnowledgeBuildOptions;
    expect(options.scopeId).toBe("local");
    expect(options.fetchPublicPage).toBeTypeOf("function");
    expect(options.indexDocuments).toBeTypeOf("function");
    expect(options.removeEmbedding).toBeTypeOf("function");
    await expect(options.indexDocuments?.([{
      cardId: card.id,
      contentHash: "d".repeat(64),
      text: "local text",
      source: "saved-fields",
    }], [], new AbortController().signal)).resolves.toEqual([expect.objectContaining({
      cardId: card.id,
      contentHash: "d".repeat(64),
      source: "saved-fields",
    })]);
    expect(harness.store).toEqual(businessBefore);
  });

  it("updates changed saved fields incrementally without refetching public pages", async () => {
    harness.consent = { version: 1, consentedAt: now };
    harness.state = completeState;
    const { result, rerender } = renderHook(() => useLocalKnowledgeBuild());
    await waitFor(() => expect(result.current.ready).toBe(true));
    rerender();

    vi.useFakeTimers();
    harness.store = {
      ...harness.store,
      cards: [{ ...card, title: "知识工具新版", updatedAt: now + 1 }],
    };
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(harness.runKnowledgeBuild).toHaveBeenCalledTimes(1);
    const options = harness.runKnowledgeBuild.mock.calls[0][0] as RunKnowledgeBuildOptions;
    expect(options.targetCardIds).toEqual([card.id]);
    expect(options.fetchPublicPage).toBeUndefined();
  });
});

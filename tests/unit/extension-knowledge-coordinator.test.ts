import { describe, expect, it, vi } from "vitest";
import {
  reconcileExtensionKnowledge,
  type ExtensionKnowledgeCoordinatorDependencies,
} from "@/lib/extension-knowledge-coordinator";
import type {
  ExtensionKnowledgeEmbeddingState,
  ExtensionKnowledgeLedger,
} from "@/lib/extension-knowledge-ledger";
import type {
  KnowledgeIndexItem,
  KnowledgeIndexResult,
  RemoveKnowledgeEmbeddingOptions,
} from "@/lib/knowledge-client";
import { withStorageLock } from "@/lib/storage-lock";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const USER_ID = "123e4567-e89b-42d3-a456-426614174001";
const OTHER_USER_ID = "123e4567-e89b-42d3-a456-426614174002";
const CARD_A = "123e4567-e89b-42d3-a456-426614174011";
const CARD_B = "123e4567-e89b-42d3-a456-426614174012";
const CARD_C = "123e4567-e89b-42d3-a456-426614174013";

const sections: CollectionSection[] = [{
  id: "section-tools",
  name: "效率工具",
  order: 0,
  createdAt: 1,
  updatedAt: 1,
}];

const categories: Category[] = [
  {
    id: "cat-dev",
    name: "开发",
    icon: "code",
    color: "#4A7C59",
    order: 0,
    createdAt: 1,
    sectionId: "section-tools",
    isParent: true,
  },
  {
    id: "group-code",
    name: "代码工具",
    icon: "code",
    color: "#4A7C59",
    order: 0,
    createdAt: 1,
    sectionId: "section-tools",
    parentId: "cat-dev",
  },
];

function card(id: string, overrides: Partial<WebCard> = {}): WebCard {
  return {
    id,
    url: "https://github.com/openai/codex",
    title: "GitHub",
    shortDesc: "托管代码",
    fullDesc: "协作开发平台",
    note: "常用仓库",
    abbreviation: "GH",
    imageUrl: "https://example.com/favicon.png",
    categoryId: "group-code",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function generatedCard(index: number): WebCard {
  const suffix = index.toString(16).padStart(12, "0");
  return card(`00000000-0000-4000-8000-${suffix}`, {
    url: `https://example.com/${index}`,
    title: `收藏 ${index}`,
    order: index,
  });
}

interface Harness {
  dependencies: Partial<ExtensionKnowledgeCoordinatorDependencies>;
  getCards: ReturnType<typeof vi.fn>;
  getCategories: ReturnType<typeof vi.fn>;
  getSections: ReturnType<typeof vi.fn>;
  getLocalSnapshotUpdatedAt: ReturnType<typeof vi.fn>;
  getLedger: ReturnType<typeof vi.fn>;
  saveLedger: ReturnType<typeof vi.fn>;
  listEmbeddingStates: ReturnType<typeof vi.fn>;
  indexKnowledge: ReturnType<typeof vi.fn>;
  removeKnowledgeEmbedding: ReturnType<typeof vi.fn>;
  getSyncMetadataVersion: ReturnType<typeof vi.fn>;
  ledger: () => ExtensionKnowledgeLedger | null;
  embeddingStates: () => ExtensionKnowledgeEmbeddingState[];
  setCards: (cards: WebCard[]) => void;
  setCategories: (categories: Category[]) => void;
  setSections: (sections: CollectionSection[]) => void;
  setLocalSnapshotUpdatedAt: (revision: number) => void;
  setEmbeddingStates: (states: ExtensionKnowledgeEmbeddingState[]) => void;
}

function harness(
  initialCards: WebCard[],
  options: {
    useRealLock?: boolean;
    embeddingStates?: ExtensionKnowledgeEmbeddingState[];
  } = {},
): Harness {
  let liveCards = initialCards;
  let liveCategories = categories;
  let liveSections = sections;
  let liveLocalSnapshotUpdatedAt = 1;
  let liveEmbeddingStates = options.embeddingStates ?? [];
  let persistedLedger: ExtensionKnowledgeLedger | null = null;
  const getCardsMock = vi.fn(async () => liveCards);
  const getCategoriesMock = vi.fn(async () => liveCategories);
  const getSectionsMock = vi.fn(async () => liveSections);
  const getLocalSnapshotUpdatedAtMock = vi.fn(async () => liveLocalSnapshotUpdatedAt);
  const getLedgerMock = vi.fn(async () => persistedLedger);
  const saveLedgerMock = vi.fn(async (_userId: string, ledger: ExtensionKnowledgeLedger) => {
    persistedLedger = structuredClone(ledger);
  });
  const listEmbeddingStatesMock = vi.fn(async (cardIds: readonly string[]) => {
    const requestedIds = new Set(cardIds);
    return liveEmbeddingStates.filter((state) => requestedIds.has(state.cardId));
  });
  const indexKnowledgeMock = vi.fn(async (items: readonly KnowledgeIndexItem[]): Promise<KnowledgeIndexResult[]> => (
    items.map((item) => {
      liveEmbeddingStates = liveEmbeddingStates.filter((state) => (
        state.cardId !== item.cardId || state.source !== item.source
      ));
      liveEmbeddingStates.push({
        cardId: item.cardId,
        source: item.source,
        contentHash: item.contentHash,
      });
      return {
        cardId: item.cardId,
        source: item.source,
        contentHash: item.contentHash,
        indexedAt: Date.now(),
      };
    })
  ));
  const removeKnowledgeEmbeddingMock = vi.fn(async (
    cardId: string,
    options?: RemoveKnowledgeEmbeddingOptions,
  ) => {
    liveEmbeddingStates = liveEmbeddingStates.filter((state) => (
      state.cardId !== cardId || (options?.source !== undefined && state.source !== options.source)
    ));
  });
  const getSyncMetadataVersionMock = vi.fn(async () => 1);

  return {
    dependencies: {
      withStorageLock: options.useRealLock
        ? withStorageLock
        : async (_name, operation) => operation(),
      getSyncMetadataVersion: getSyncMetadataVersionMock,
      getCards: getCardsMock,
      getCategories: getCategoriesMock,
      getSections: getSectionsMock,
      getLocalSnapshotUpdatedAt: getLocalSnapshotUpdatedAtMock,
      getLedger: getLedgerMock,
      saveLedger: saveLedgerMock,
      listEmbeddingStates: listEmbeddingStatesMock,
      indexKnowledge: indexKnowledgeMock,
      removeKnowledgeEmbedding: removeKnowledgeEmbeddingMock,
      currentSyncMetadataVersion: 1,
    },
    getCards: getCardsMock,
    getCategories: getCategoriesMock,
    getSections: getSectionsMock,
    getLocalSnapshotUpdatedAt: getLocalSnapshotUpdatedAtMock,
    getLedger: getLedgerMock,
    saveLedger: saveLedgerMock,
    listEmbeddingStates: listEmbeddingStatesMock,
    indexKnowledge: indexKnowledgeMock,
    removeKnowledgeEmbedding: removeKnowledgeEmbeddingMock,
    getSyncMetadataVersion: getSyncMetadataVersionMock,
    ledger: () => persistedLedger,
    embeddingStates: () => structuredClone(liveEmbeddingStates),
    setCards: (cards) => { liveCards = cards; },
    setCategories: (nextCategories) => { liveCategories = nextCategories; },
    setSections: (nextSections) => { liveSections = nextSections; },
    setLocalSnapshotUpdatedAt: (revision) => { liveLocalSnapshotUpdatedAt = revision; },
    setEmbeddingStates: (states) => { liveEmbeddingStates = structuredClone(states); },
  };
}

function input(overrides: Partial<Parameters<typeof reconcileExtensionKnowledge>[0]> = {}) {
  return {
    userId: USER_ID,
    isCurrent: () => true,
    getCurrentUserId: () => USER_ID,
    ...overrides,
  };
}

describe("extension knowledge coordinator", () => {
  it("creates a 364-card baseline without any cloud write or input mutation", async () => {
    const cards = Array.from({ length: 364 }, (_, index) => generatedCard(index + 1));
    const before = structuredClone({ cards, categories, sections });
    const test = harness(cards);

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toEqual({
      status: "baseline-created",
      indexedCount: 0,
      deletedCount: 0,
    });

    expect(test.ledger()?.entries).toHaveLength(364);
    expect(test.listEmbeddingStates.mock.calls.map((call) => call[0].length)).toEqual([
      ...Array.from({ length: 11 }, () => 32),
      12,
    ]);
    expect(test.listEmbeddingStates.mock.calls.every((call) => (
      call[1]?.expectedUserId === USER_ID
    ))).toBe(true);
    expect(test.indexKnowledge).not.toHaveBeenCalled();
    expect(test.removeKnowledgeEmbedding).not.toHaveBeenCalled();
    expect({ cards, categories, sections }).toEqual(before);
  });

  it("keeps a vectorless 364-card baseline idle instead of backfilling it later", async () => {
    const cards = Array.from({ length: 364 }, (_, index) => generatedCard(index + 1));
    const test = harness(cards);
    await reconcileExtensionKnowledge(input(), test.dependencies);
    test.listEmbeddingStates.mockClear();

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toEqual({
      status: "idle",
      indexedCount: 0,
      deletedCount: 0,
    });
    expect(test.indexKnowledge).not.toHaveBeenCalled();
    expect(test.removeKnowledgeEmbedding).not.toHaveBeenCalled();
  });

  it("does not absorb cards created or edited after consent into the zero-write baseline", async () => {
    const cutoff = 1_000;
    const test = harness([
      card(CARD_A, { createdAt: 100, updatedAt: 900 }),
      card(CARD_B, { createdAt: 100, updatedAt: 1_001 }),
      card(CARD_C, { createdAt: 1_002, updatedAt: 1_002 }),
    ]);

    await expect(reconcileExtensionKnowledge(input({ baselineCutoffAt: cutoff }), test.dependencies)).resolves.toEqual({
      status: "reconciled",
      indexedCount: 2,
      deletedCount: 0,
    });
    expect(test.indexKnowledge.mock.calls.flatMap((call) => call[0]).map((item) => item.cardId)).toEqual([
      CARD_B,
      CARD_C,
    ]);
    expect(test.indexKnowledge.mock.calls[0][1]).toMatchObject({ expectedUserId: USER_ID });
    expect(test.ledger()?.entries).toHaveLength(3);
  });

  it("rebuilds saved fields when a previously observed cloud vector disappears", async () => {
    const test = harness([card(CARD_A)], {
      embeddingStates: [{
        cardId: CARD_A,
        source: "public-html",
        contentHash: "a".repeat(64),
      }],
    });
    await reconcileExtensionKnowledge(input(), test.dependencies);
    test.setEmbeddingStates([]);

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toMatchObject({
      status: "reconciled",
      indexedCount: 1,
    });
    expect(test.indexKnowledge.mock.calls[0][0][0]).toMatchObject({
      cardId: CARD_A,
      source: "saved-fields",
    });
  });

  it("rebuilds a same-content card restored after its cloud cascade delete", async () => {
    const test = harness([card(CARD_A)], {
      embeddingStates: [{
        cardId: CARD_A,
        source: "saved-fields",
        contentHash: "a".repeat(64),
      }],
    });
    await reconcileExtensionKnowledge(input(), test.dependencies);
    test.indexKnowledge.mockClear();

    // Deletion and restoration both happen between coordinator scans. The
    // active card hash is unchanged, but its server-side vectors are gone.
    test.setEmbeddingStates([]);
    await reconcileExtensionKnowledge(input(), test.dependencies);

    expect(test.indexKnowledge).toHaveBeenCalledTimes(1);
    expect(test.embeddingStates()).toEqual([expect.objectContaining({
      cardId: CARD_A,
      source: "saved-fields",
    })]);
  });

  it("indexes only new, edited, restored, and path-affected cards as saved-fields", async () => {
    const test = harness([card(CARD_A), card(CARD_B)]);
    await reconcileExtensionKnowledge(input(), test.dependencies);

    test.setCards([card(CARD_A), card(CARD_B, { note: "新备注" }), card(CARD_C)]);
    let outcome = await reconcileExtensionKnowledge(input(), test.dependencies);
    expect(outcome).toEqual({ status: "reconciled", indexedCount: 2, deletedCount: 0 });
    expect(test.indexKnowledge.mock.calls.flatMap((call) => call[0]).map((item) => [item.cardId, item.source])).toEqual([
      [CARD_B, "saved-fields"],
      [CARD_C, "saved-fields"],
    ]);

    test.setCards([card(CARD_A), card(CARD_B, { note: "新备注" })]);
    await reconcileExtensionKnowledge(input(), test.dependencies);
    expect(test.ledger()?.entries.find((entry) => entry.cardId === CARD_C)?.status).toBe("deleted");

    test.indexKnowledge.mockClear();
    test.removeKnowledgeEmbedding.mockClear();
    test.setCards([card(CARD_A), card(CARD_B, { note: "新备注" }), card(CARD_C)]);
    outcome = await reconcileExtensionKnowledge(input(), test.dependencies);
    expect(outcome.indexedCount).toBe(1);
    expect(test.indexKnowledge.mock.calls[0][0][0]).toMatchObject({ cardId: CARD_C, source: "saved-fields" });

    test.indexKnowledge.mockClear();
    test.setCategories(categories.map((category) => (
      category.id === "group-code" ? { ...category, name: "AI 编程" } : category
    )));
    outcome = await reconcileExtensionKnowledge(input(), test.dependencies);
    expect(outcome.indexedCount).toBe(3);
    expect(test.indexKnowledge.mock.calls.flatMap((call) => call[0]).every((item) => item.source === "saved-fields")).toBe(true);
  });

  it("indexes saved fields before pruning only public HTML when a card URL changes", async () => {
    const test = harness([card(CARD_A, { url: "https://same.example/old-page" })], {
      embeddingStates: [{
        cardId: CARD_A,
        source: "public-html",
        contentHash: "a".repeat(64),
      }],
    });
    await reconcileExtensionKnowledge(input(), test.dependencies);

    test.setCards([card(CARD_A, { url: "https://same.example/new-page" })]);
    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toEqual({
      status: "reconciled",
      indexedCount: 1,
      deletedCount: 0,
    });

    expect(test.indexKnowledge).toHaveBeenCalledTimes(1);
    expect(test.removeKnowledgeEmbedding).toHaveBeenCalledWith(CARD_A, {
      source: "public-html",
      signal: undefined,
      expectedUserId: USER_ID,
    });
    expect(test.indexKnowledge.mock.invocationCallOrder[0]).toBeLessThan(
      test.removeKnowledgeEmbedding.mock.invocationCallOrder[0],
    );
    expect(test.embeddingStates()).toEqual([expect.objectContaining({
      cardId: CARD_A,
      source: "saved-fields",
    })]);
    expect(test.ledger()?.entries[0].sourceUrl).toBe("https://same.example/new-page");
  });

  it("updates ordinary saved fields without deleting the public HTML source", async () => {
    const publicState: ExtensionKnowledgeEmbeddingState = {
      cardId: CARD_A,
      source: "public-html",
      contentHash: "a".repeat(64),
    };
    const test = harness([card(CARD_A)], { embeddingStates: [publicState] });
    await reconcileExtensionKnowledge(input(), test.dependencies);

    test.setCards([card(CARD_A, { note: "只改备注" })]);
    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toMatchObject({
      status: "reconciled",
      indexedCount: 1,
    });

    expect(test.removeKnowledgeEmbedding).not.toHaveBeenCalled();
    expect(test.embeddingStates()).toEqual(expect.arrayContaining([
      publicState,
      expect.objectContaining({ cardId: CARD_A, source: "saved-fields" }),
    ]));
  });

  it("does not advance the URL ledger after a public prune failure and retries without reindexing", async () => {
    const oldUrl = "https://old-retry.example/page";
    const newUrl = "https://new-retry.example/page";
    const test = harness([card(CARD_A, { url: oldUrl })], {
      embeddingStates: [{
        cardId: CARD_A,
        source: "public-html",
        contentHash: "a".repeat(64),
      }],
    });
    await reconcileExtensionKnowledge(input(), test.dependencies);
    const baselineLedger = structuredClone(test.ledger());
    test.setCards([card(CARD_A, { url: newUrl })]);
    test.removeKnowledgeEmbedding.mockRejectedValueOnce(new Error("temporary public prune failure"));

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).rejects.toThrow(
      "temporary public prune failure",
    );
    expect(test.ledger()).toEqual(baselineLedger);
    expect(test.indexKnowledge).toHaveBeenCalledTimes(1);
    expect(test.embeddingStates()).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: CARD_A, source: "public-html" }),
      expect.objectContaining({ cardId: CARD_A, source: "saved-fields" }),
    ]));

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toMatchObject({
      status: "reconciled",
      indexedCount: 0,
    });
    expect(test.indexKnowledge).toHaveBeenCalledTimes(1);
    expect(test.removeKnowledgeEmbedding).toHaveBeenCalledTimes(2);
    expect(test.ledger()?.entries[0].sourceUrl).toBe(newUrl);
    expect(test.embeddingStates()).toEqual([expect.objectContaining({
      cardId: CARD_A,
      source: "saved-fields",
    })]);
  });

  it("deletes every cloud source once and advances the tombstone only after success", async () => {
    const test = harness([card(CARD_A), card(CARD_B)]);
    await reconcileExtensionKnowledge(input(), test.dependencies);
    test.setCards([card(CARD_A)]);

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toMatchObject({
      status: "reconciled",
      deletedCount: 1,
    });
    expect(test.removeKnowledgeEmbedding).toHaveBeenCalledWith(CARD_B, {
      signal: undefined,
      expectedUserId: USER_ID,
    });
    expect(test.ledger()?.entries.find((entry) => entry.cardId === CARD_B)?.status).toBe("deleted");

    await reconcileExtensionKnowledge(input(), test.dependencies);
    expect(test.removeKnowledgeEmbedding).toHaveBeenCalledTimes(1);
  });

  it("keeps an active ledger entry when deleting its cloud vectors fails", async () => {
    const test = harness([card(CARD_A), card(CARD_B)]);
    await reconcileExtensionKnowledge(input(), test.dependencies);
    const baselineLedger = structuredClone(test.ledger());
    test.setCards([card(CARD_A)]);
    test.removeKnowledgeEmbedding.mockRejectedValueOnce(new Error("delete unavailable"));

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).rejects.toThrow("delete unavailable");
    expect(test.ledger()).toEqual(baselineLedger);
  });

  it("repairs the ledger after delete committed on the server but the request was aborted", async () => {
    const controller = new AbortController();
    const test = harness([card(CARD_A)], {
      embeddingStates: [{
        cardId: CARD_A,
        source: "public-html",
        contentHash: "a".repeat(64),
      }],
    });
    await reconcileExtensionKnowledge(input(), test.dependencies);
    const baselineLedger = structuredClone(test.ledger());
    test.setCards([]);
    test.removeKnowledgeEmbedding.mockImplementationOnce(async () => {
      test.setEmbeddingStates([]);
      controller.abort();
    });

    await expect(reconcileExtensionKnowledge(input({ signal: controller.signal }), test.dependencies)).resolves.toMatchObject({
      status: "aborted",
    });
    expect(test.ledger()).toEqual(baselineLedger);

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toMatchObject({
      status: "reconciled",
      deletedCount: 1,
    });
    expect(test.ledger()?.entries[0].status).toBe("deleted");
  });

  it("uses batches of at most 32 and does not advance the ledger after a cloud failure", async () => {
    const baselineCards = Array.from({ length: 70 }, (_, index) => generatedCard(index + 1));
    const test = harness(baselineCards);
    await reconcileExtensionKnowledge(input(), test.dependencies);
    test.setCards(baselineCards.map((value) => ({ ...value, note: `changed-${value.id}` })));
    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toMatchObject({
      status: "reconciled",
      indexedCount: 70,
    });
    expect(test.indexKnowledge.mock.calls.map((call) => call[0].length)).toEqual([32, 32, 6]);

    test.indexKnowledge.mockClear();
    const baselineLedger = structuredClone(test.ledger());
    test.setCards(baselineCards.map((value) => ({ ...value, note: `changed-again-${value.id}` })));
    test.indexKnowledge.mockImplementationOnce(async (items: readonly KnowledgeIndexItem[]): Promise<KnowledgeIndexResult[]> => (
      items.map((item) => ({
        cardId: item.cardId,
        source: item.source,
        contentHash: item.contentHash,
        indexedAt: Date.now(),
      }))
    )).mockRejectedValueOnce(new Error("temporary cloud failure"));

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).rejects.toThrow("temporary cloud failure");
    expect(test.indexKnowledge.mock.calls.map((call) => call[0].length)).toEqual([32, 32]);
    expect(test.ledger()).toEqual(baselineLedger);
  });

  it("treats a partial index acknowledgement as failure and keeps the old ledger", async () => {
    const test = harness([card(CARD_A)]);
    await reconcileExtensionKnowledge(input(), test.dependencies);
    const baselineLedger = structuredClone(test.ledger());
    test.setCards([card(CARD_A, { url: "https://changed.example/page" })]);
    test.indexKnowledge.mockResolvedValueOnce([]);

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).rejects.toThrow(/incomplete result/i);
    expect(test.ledger()).toEqual(baselineLedger);
    expect(test.removeKnowledgeEmbedding).not.toHaveBeenCalled();
  });

  it("rejects a matching card/source acknowledgement for the wrong content hash", async () => {
    const test = harness([card(CARD_A)]);
    await reconcileExtensionKnowledge(input(), test.dependencies);
    const baselineLedger = structuredClone(test.ledger());
    test.setCards([card(CARD_A, { url: "https://changed.example/page" })]);
    test.indexKnowledge.mockResolvedValueOnce([{
      cardId: CARD_A,
      source: "saved-fields",
      contentHash: "f".repeat(64),
      indexedAt: Date.now(),
    }]);

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).rejects.toThrow(/incomplete result/i);
    expect(test.ledger()).toEqual(baselineLedger);
    expect(test.removeKnowledgeEmbedding).not.toHaveBeenCalled();
  });

  it("fails closed before business reads when metadata ownership is not current", async () => {
    const test = harness([card(CARD_A)]);
    test.getSyncMetadataVersion.mockResolvedValue(0);

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toEqual({
      status: "waiting-workspace",
      indexedCount: 0,
      deletedCount: 0,
    });
    expect(test.getCards).not.toHaveBeenCalled();
    expect(test.getLedger).not.toHaveBeenCalled();
    expect(test.saveLedger).not.toHaveBeenCalled();
    expect(test.indexKnowledge).not.toHaveBeenCalled();
    expect(test.removeKnowledgeEmbedding).not.toHaveBeenCalled();
  });

  it.each([
    {
      mutation: "card",
      apply: (test: Harness) => test.setCards([
        card(CARD_A, {
          url: "https://same.example/new-page",
          note: "changed after cloud read",
        }),
        card(CARD_C),
      ]),
    },
    {
      mutation: "category path",
      apply: (test: Harness) => test.setCategories(categories.map((item) => (
        item.id === "group-code" ? { ...item, name: "Changed after cloud read" } : item
      ))),
    },
    {
      mutation: "section path",
      apply: (test: Harness) => test.setSections(sections.map((item) => ({
        ...item,
        name: "Changed after cloud read",
      }))),
    },
    {
      mutation: "snapshot revision",
      apply: (test: Harness) => test.setLocalSnapshotUpdatedAt(2),
    },
  ])("stops before every cloud write when $mutation changes after the cloud read", async ({ apply }) => {
    const oldUrl = "https://same.example/old-page";
    const newUrl = "https://same.example/new-page";
    const test = harness([
      card(CARD_A, { url: oldUrl }),
      card(CARD_B),
    ], {
      embeddingStates: [
        { cardId: CARD_A, source: "public-html", contentHash: "a".repeat(64) },
        { cardId: CARD_B, source: "saved-fields", contentHash: "b".repeat(64) },
      ],
    });
    await reconcileExtensionKnowledge(input(), test.dependencies);
    const baselineLedger = structuredClone(test.ledger());
    test.saveLedger.mockClear();
    test.indexKnowledge.mockClear();
    test.removeKnowledgeEmbedding.mockClear();
    test.setCards([card(CARD_A, { url: newUrl }), card(CARD_C)]);
    test.listEmbeddingStates.mockImplementationOnce(async () => {
      const cloudState = test.embeddingStates();
      apply(test);
      return cloudState;
    });

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toEqual({
      status: "workspace-changed",
      indexedCount: 0,
      deletedCount: 0,
    });
    expect(test.indexKnowledge).not.toHaveBeenCalled();
    expect(test.removeKnowledgeEmbedding).not.toHaveBeenCalled();
    expect(test.saveLedger).not.toHaveBeenCalled();
    expect(test.ledger()).toEqual(baselineLedger);
  });

  it("runs the post-write fence before any later cloud write or ledger advance", async () => {
    const oldUrl = "https://same.example/old-page";
    const newUrl = "https://same.example/new-page";
    const test = harness([
      card(CARD_A, { url: oldUrl }),
      card(CARD_B),
    ], {
      embeddingStates: [
        { cardId: CARD_A, source: "public-html", contentHash: "a".repeat(64) },
        { cardId: CARD_B, source: "saved-fields", contentHash: "b".repeat(64) },
      ],
    });
    await reconcileExtensionKnowledge(input(), test.dependencies);
    const baselineLedger = structuredClone(test.ledger());
    test.saveLedger.mockClear();
    test.indexKnowledge.mockClear();
    test.removeKnowledgeEmbedding.mockClear();
    test.setCards([card(CARD_A, { url: newUrl }), card(CARD_C)]);
    test.removeKnowledgeEmbedding.mockImplementationOnce(async () => {
      // The card-wide delete reached the cloud. Changing the authoritative
      // revision before its post-write fence must stop indexing and pruning.
      test.setLocalSnapshotUpdatedAt(2);
    });

    await expect(reconcileExtensionKnowledge(input(), test.dependencies)).resolves.toEqual({
      status: "workspace-changed",
      indexedCount: 0,
      deletedCount: 0,
    });
    expect(test.removeKnowledgeEmbedding).toHaveBeenCalledTimes(1);
    expect(test.removeKnowledgeEmbedding).toHaveBeenCalledWith(CARD_B, {
      signal: undefined,
      expectedUserId: USER_ID,
    });
    expect(test.indexKnowledge).not.toHaveBeenCalled();
    expect(test.saveLedger).not.toHaveBeenCalled();
    expect(test.ledger()).toEqual(baselineLedger);
  });

  it("fails closed on abort, obsolete generation, and switched user scope", async () => {
    const test = harness([card(CARD_A)]);
    const controller = new AbortController();
    controller.abort();

    await expect(reconcileExtensionKnowledge(input({ signal: controller.signal }), test.dependencies)).resolves.toMatchObject({
      status: "aborted",
    });
    await expect(reconcileExtensionKnowledge(input({ isCurrent: () => false }), test.dependencies)).resolves.toMatchObject({
      status: "stale-scope",
    });
    await expect(reconcileExtensionKnowledge(input({ getCurrentUserId: () => OTHER_USER_ID }), test.dependencies)).resolves.toMatchObject({
      status: "stale-scope",
    });
    expect(test.getSyncMetadataVersion).not.toHaveBeenCalled();
    expect(test.saveLedger).not.toHaveBeenCalled();
  });

  it("re-reads under the shared lock so two tabs index the same delta once", async () => {
    const test = harness([card(CARD_A)], { useRealLock: true });
    await reconcileExtensionKnowledge(input(), test.dependencies);
    test.setCards([card(CARD_A, { note: "并发修改" })]);
    const outcomes = await Promise.all([
      reconcileExtensionKnowledge(input(), test.dependencies),
      reconcileExtensionKnowledge(input(), test.dependencies),
    ]);

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(["idle", "reconciled"]);
    expect(test.getLedger).toHaveBeenCalledTimes(3);
    expect(test.indexKnowledge).toHaveBeenCalledTimes(1);
  });
});

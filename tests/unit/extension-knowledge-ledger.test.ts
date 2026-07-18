import localforage from "localforage";
import { afterEach, describe, expect, it } from "vitest";
import {
  extensionKnowledgeLedgerKey,
  getExtensionKnowledgeLedger,
  normalizeExtensionKnowledgeLedger,
  planExtensionKnowledgeLedger,
  saveExtensionKnowledgeLedger,
  type ExtensionKnowledgeLedger,
} from "@/lib/extension-knowledge-ledger";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const knowledgeDb = localforage.createInstance({ name: "WebCollectSearch", storeName: "knowledge_index" });
const businessDb = localforage.createInstance({ name: "WebCollect", storeName: "webcollect_data" });
const USER_A = "123e4567-e89b-42d3-a456-426614174001";
const USER_B = "123e4567-e89b-42d3-a456-426614174002";
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
    imageUrl: "https://example.com/favicon-a.png",
    categoryId: "group-code",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all([
    knowledgeDb.removeItem(extensionKnowledgeLedgerKey(USER_A)),
    knowledgeDb.removeItem(extensionKnowledgeLedgerKey(USER_B)),
    businessDb.removeItem("extension-ledger-sentinel"),
  ]);
});

describe("extension knowledge observation ledger", () => {
  it("creates a saved-fields baseline for UUID cards without cloud mutations", async () => {
    const sourceCards = [card(CARD_B), card("local-card"), card(CARD_A)];
    const before = structuredClone({ sourceCards, categories, sections });
    const plan = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: sourceCards,
      categories,
      sections,
      ledger: null,
      embeddingStates: [
        { cardId: CARD_A, source: "public-html", contentHash: "a".repeat(64) },
        { cardId: CARD_B, source: "saved-fields", contentHash: "b".repeat(64) },
      ],
    });

    expect(plan.isInitialBaseline).toBe(true);
    expect(plan.indexItems).toEqual([]);
    expect(plan.deletedCardIds).toEqual([]);
    expect(plan.prunePublicHtmlCardIds).toEqual([]);
    expect(plan.nextLedger.entries.map((entry) => [
      entry.cardId,
      entry.status,
      entry.indexedSavedHash,
      entry.hasEverHadCloudVector,
    ])).toEqual([
      [CARD_A, "active", null, true],
      [CARD_B, "active", "b".repeat(64), true],
    ]);
    expect(plan.nextLedger.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.observedHash))).toBe(true);
    expect(plan.nextLedger.entries.every((entry) => (
      entry.sourceUrl === "https://github.com/openai/codex"
    ))).toBe(true);
    expect({ sourceCards, categories, sections }).toEqual(before);
  });

  it("ignores order, timestamps, sync metadata, favicon, and image-only changes", async () => {
    const baseline = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: null,
      embeddingStates: [],
    });
    const plan = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A, {
        order: 99,
        createdAt: 10,
        updatedAt: 20,
        syncRevision: 5,
        syncDeviceId: "device-b",
        imageUrl: "https://example.com/favicon-b.png",
      })],
      categories: categories.map((category) => ({ ...category, order: category.order + 10, updatedAt: 30 })),
      sections: sections.map((section) => ({ ...section, order: 10, updatedAt: 30 })),
      ledger: baseline.nextLedger,
      embeddingStates: [],
    });

    expect(plan.isInitialBaseline).toBe(false);
    expect(plan.indexItems).toEqual([]);
    expect(plan.deletedCardIds).toEqual([]);
    expect(plan.prunePublicHtmlCardIds).toEqual([]);
    expect(plan.nextLedger.entries).toEqual(baseline.nextLedger.entries);
  });

  it("indexes only new, restored, saved-field, and category-path changes", async () => {
    const baseline = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A), card(CARD_B)],
      categories,
      sections,
      ledger: null,
      embeddingStates: [],
    });
    const deletedOnce = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: baseline.nextLedger,
      embeddingStates: [],
    });
    expect(deletedOnce.deletedCardIds).toEqual([CARD_B]);

    const changedCategories = categories.map((category) => (
      category.id === "group-code" ? { ...category, name: "AI 编程" } : category
    ));
    const changed = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [
        card(CARD_A, { note: "新的个人备注" }),
        card(CARD_B),
        card(CARD_C, { title: "Codex" }),
      ],
      categories: changedCategories,
      sections,
      ledger: deletedOnce.nextLedger,
      embeddingStates: [],
    });

    expect(changed.deletedCardIds).toEqual([]);
    expect(changed.prunePublicHtmlCardIds).toEqual([]);
    expect(changed.indexItems.map((item) => item.cardId)).toEqual([CARD_A, CARD_B, CARD_C]);
    expect(changed.indexItems.find((item) => item.cardId === CARD_A)?.text).toContain("备注: 新的个人备注");
    expect(changed.indexItems.find((item) => item.cardId === CARD_A)?.text).toContain("AI 编程");
    expect(changed.nextLedger.entries.find((entry) => entry.cardId === CARD_B)?.status).toBe("active");
  });

  it("tracks normalized source URLs and prunes public HTML only when the page URL changes", async () => {
    const previousCard = card(CARD_A, {
      url: "https://EXAMPLE.com:443/old-path#fragment",
    });
    const baseline = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [previousCard],
      categories,
      sections,
      ledger: null,
      embeddingStates: [],
    });
    const savedHash = baseline.nextLedger.entries[0].observedHash;

    const samePage = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A, { url: "https://example.com/old-path" })],
      categories,
      sections,
      ledger: baseline.nextLedger,
      embeddingStates: [
        { cardId: CARD_A, source: "saved-fields", contentHash: savedHash },
        { cardId: CARD_A, source: "public-html", contentHash: "a".repeat(64) },
      ],
    });
    expect(samePage.indexItems).toEqual([]);
    expect(samePage.prunePublicHtmlCardIds).toEqual([]);

    const movedPage = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A, { url: "https://example.com/new-path" })],
      categories,
      sections,
      ledger: baseline.nextLedger,
      embeddingStates: [
        { cardId: CARD_A, source: "saved-fields", contentHash: savedHash },
        { cardId: CARD_A, source: "public-html", contentHash: "a".repeat(64) },
      ],
    });

    // The saved document only records the domain, so the hash can legitimately
    // stay equal. A matching cloud row still satisfies the safety prerequisite.
    expect(movedPage.indexItems).toEqual([]);
    expect(movedPage.prunePublicHtmlCardIds).toEqual([CARD_A]);
    expect(movedPage.nextLedger.entries[0].sourceUrl).toBe("https://example.com/new-path");

    const movedWithoutSavedFallback = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A, { url: "https://example.com/new-path" })],
      categories,
      sections,
      ledger: baseline.nextLedger,
      embeddingStates: [
        { cardId: CARD_A, source: "public-html", contentHash: "a".repeat(64) },
      ],
    });
    expect(movedWithoutSavedFallback.indexItems.map((item) => item.cardId)).toEqual([CARD_A]);
    expect(movedWithoutSavedFallback.prunePublicHtmlCardIds).toEqual([CARD_A]);
  });

  it("keeps deleted tombstones so an unchanged startup does not delete twice", async () => {
    const baseline = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: null,
      embeddingStates: [],
    });
    const firstDelete = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [],
      categories,
      sections,
      ledger: baseline.nextLedger,
      embeddingStates: [],
    });
    const secondDelete = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [],
      categories,
      sections,
      ledger: firstDelete.nextLedger,
      embeddingStates: [],
    });

    expect(firstDelete.deletedCardIds).toEqual([CARD_A]);
    expect(secondDelete.deletedCardIds).toEqual([]);
    expect(secondDelete.nextLedger.entries).toEqual(firstDelete.nextLedger.entries);
  });

  it("does not bulk backfill an unchanged baseline that had no cloud vectors", async () => {
    const baseline = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A), card(CARD_B)],
      categories,
      sections,
      ledger: null,
      embeddingStates: [],
    });
    const unchanged = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A), card(CARD_B)],
      categories,
      sections,
      ledger: baseline.nextLedger,
      embeddingStates: [],
    });

    expect(unchanged.indexItems).toEqual([]);
    expect(unchanged.nextLedger.entries.every((entry) => (
      entry.indexedSavedHash === null && !entry.hasEverHadCloudVector
    ))).toBe(true);
  });

  it("repairs cloud loss and same-content delete-restore without a local hash change", async () => {
    const baseline = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: null,
      embeddingStates: [{
        cardId: CARD_A,
        source: "public-html",
        contentHash: "a".repeat(64),
      }],
    });

    // The business card was deleted and restored with identical content
    // between scans. Its cascade-deleted cloud vector is the only evidence.
    const repaired = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: baseline.nextLedger,
      embeddingStates: [],
    });

    expect(repaired.indexItems.map((item) => item.cardId)).toEqual([CARD_A]);
    expect(repaired.nextLedger.entries[0]).toMatchObject({
      indexedSavedHash: repaired.indexItems[0].contentHash,
      hasEverHadCloudVector: true,
      status: "active",
    });
  });

  it("repairs a missing or mismatched expected saved-fields source", async () => {
    const initial = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: null,
      embeddingStates: [{ cardId: CARD_A, source: "saved-fields", contentHash: "a".repeat(64) }],
    });
    const expectedHash = initial.nextLedger.entries[0].observedHash;
    const matchingLedger: ExtensionKnowledgeLedger = {
      ...initial.nextLedger,
      entries: [{
        ...initial.nextLedger.entries[0],
        indexedSavedHash: expectedHash,
      }],
    };

    const missing = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: matchingLedger,
      embeddingStates: [{ cardId: CARD_A, source: "public-html", contentHash: "b".repeat(64) }],
    });
    const mismatched = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [card(CARD_A)],
      categories,
      sections,
      ledger: matchingLedger,
      embeddingStates: [{ cardId: CARD_A, source: "saved-fields", contentHash: "c".repeat(64) }],
    });

    expect(missing.indexItems.map((item) => item.cardId)).toEqual([CARD_A]);
    expect(mismatched.indexItems.map((item) => item.cardId)).toEqual([CARD_A]);
  });

  it("indexes only cards created or modified after consent during the first baseline", async () => {
    const cutoff = 1_000;
    const plan = await planExtensionKnowledgeLedger({
      scopeId: USER_A,
      cards: [
        card(CARD_A, { createdAt: 100, updatedAt: 900 }),
        card(CARD_B, { createdAt: 100, updatedAt: 1_001 }),
        card(CARD_C, { createdAt: 1_002, updatedAt: 1_002 }),
      ],
      categories,
      sections,
      ledger: null,
      embeddingStates: [],
      baselineCutoffAt: cutoff,
    });

    expect(plan.isInitialBaseline).toBe(true);
    expect(plan.indexItems.map((item) => item.cardId)).toEqual([CARD_B, CARD_C]);
    expect(plan.deletedCardIds).toEqual([]);
    expect(plan.prunePublicHtmlCardIds).toEqual([]);
  });

  it("normalizes persisted data and isolates ledgers by user scope without touching business data", async () => {
    await businessDb.setItem("extension-ledger-sentinel", { cards: 364, dirty: false });
    const ledger: ExtensionKnowledgeLedger = {
      version: 2,
      scopeId: USER_A,
      entries: [
        {
          cardId: CARD_B.toUpperCase(),
          sourceUrl: "https://GITHUB.com:443/openai/codex#readme",
          observedHash: "B".repeat(64),
          indexedSavedHash: "D".repeat(64),
          hasEverHadCloudVector: true,
          status: "active",
        },
        {
          cardId: "not-a-uuid",
          sourceUrl: "https://invalid.example",
          observedHash: "c".repeat(64),
          indexedSavedHash: null,
          hasEverHadCloudVector: false,
          status: "active",
        },
        {
          cardId: CARD_A,
          sourceUrl: "https://example.com/deleted",
          observedHash: "a".repeat(64),
          indexedSavedHash: null,
          hasEverHadCloudVector: true,
          status: "deleted",
        },
      ],
    };

    await saveExtensionKnowledgeLedger(USER_A, ledger);

    expect(extensionKnowledgeLedgerKey(USER_A)).toBe(`extension-ledger:v2:${USER_A}`);
    expect((await getExtensionKnowledgeLedger(USER_A))?.entries).toEqual([
      {
        cardId: CARD_A,
        sourceUrl: "https://example.com/deleted",
        observedHash: "a".repeat(64),
        indexedSavedHash: null,
        hasEverHadCloudVector: true,
        status: "deleted",
      },
      {
        cardId: CARD_B,
        sourceUrl: "https://github.com/openai/codex",
        observedHash: "b".repeat(64),
        indexedSavedHash: "d".repeat(64),
        hasEverHadCloudVector: true,
        status: "active",
      },
    ]);
    expect(await getExtensionKnowledgeLedger(USER_B)).toBeNull();
    expect(await businessDb.getItem("extension-ledger-sentinel")).toEqual({ cards: 364, dirty: false });
  });

  it("rejects cross-scope saves and corrupted records", async () => {
    const wrongScope: ExtensionKnowledgeLedger = {
      version: 2,
      scopeId: USER_B,
      entries: [],
    };

    await expect(saveExtensionKnowledgeLedger(USER_A, wrongScope)).rejects.toThrow(/scope mismatch/i);
    expect(normalizeExtensionKnowledgeLedger({
      version: 2,
      scopeId: USER_A,
      entries: "not-an-array",
    }, USER_A)).toBeNull();
    expect(normalizeExtensionKnowledgeLedger({
      version: 2,
      scopeId: USER_B,
      entries: [],
    }, USER_A)).toBeNull();
    expect(normalizeExtensionKnowledgeLedger({
      version: 1,
      scopeId: USER_A,
      entries: [],
    }, USER_A)).toBeNull();
    expect(await getExtensionKnowledgeLedger(USER_A)).toBeNull();
  });
});

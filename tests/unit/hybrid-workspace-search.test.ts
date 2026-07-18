import { describe, expect, it } from "vitest";
import {
  HYBRID_SEARCH_LOCAL_WEIGHT,
  HYBRID_SEARCH_RRF_K,
  HYBRID_SEARCH_SEMANTIC_WEIGHT,
  SEMANTIC_ONLY_MIN_SIMILARITY,
  mergeHybridCardResults,
  type SemanticWorkspaceSearchHit,
} from "../../src/lib/hybrid-workspace-search";
import {
  buildWorkspaceSearchIndex,
  type CardSearchResult,
  type WorkspaceSearchIndex,
} from "../../src/lib/workspace-search";
import type { Category, CollectionSection, WebCard } from "../../src/lib/types";

const now = 1_777_777_777;

const sections: CollectionSection[] = [
  { id: "section-default", name: "主页", order: 0, createdAt: now, updatedAt: now },
];

const categories: Category[] = [
  {
    id: "cat-tools",
    name: "工具",
    icon: "wrench",
    color: "#4a7c59",
    order: 0,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-default",
  },
];

function card(id: string, title: string, url = `https://${id}.example.com`): WebCard {
  return {
    id,
    title,
    url,
    shortDesc: `${title} 的简介`,
    fullDesc: "",
    note: "",
    abbreviation: title.slice(0, 2),
    imageUrl: "",
    categoryId: "cat-tools",
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function buildIndex(cards: WebCard[]): WorkspaceSearchIndex {
  return buildWorkspaceSearchIndex({ cards, categories, sections });
}

function localResult(
  index: WorkspaceSearchIndex,
  cardId: string,
  overrides: Partial<Pick<CardSearchResult, "score" | "matchedTokens" | "matchReasons" | "matchKind" | "exactMatch">> = {},
): CardSearchResult {
  const entry = index.cardEntries.find((candidate) => candidate.card.id === cardId);
  if (!entry) throw new Error(`Missing card ${cardId}`);
  return {
    ...entry,
    score: overrides.score ?? 100,
    matchedTokens: overrides.matchedTokens ?? ["tool"],
    matchReasons: overrides.matchReasons ?? ["title"],
    matchKind: overrides.matchKind ?? "lexical",
    exactMatch: overrides.exactMatch ?? false,
  };
}

describe("hybrid workspace card search", () => {
  it("combines local and semantic ranks with weighted RRF without mutating inputs", () => {
    const index = buildIndex([
      card("card-a", "Alpha Tool"),
      card("card-b", "Beta Tool"),
      card("card-c", "Gamma Tool"),
    ]);
    const localResults = [
      localResult(index, "card-a", { score: 300 }),
      localResult(index, "card-c", { score: 200 }),
    ];
    const semanticResults: SemanticWorkspaceSearchHit[] = [
      { cardId: "card-b", similarity: 0.91, contentHash: "b".repeat(64) },
      { cardId: "card-a", similarity: 0.58, contentHash: "a".repeat(64) },
    ];
    const indexBefore = structuredClone(index);
    const localBefore = structuredClone(localResults);
    const semanticBefore = structuredClone(semanticResults);

    const results = mergeHybridCardResults({
      query: "tool",
      index,
      localResults,
      semanticResults,
    });

    expect(results.map((result) => result.card.id)).toEqual(["card-a", "card-c", "card-b"]);
    expect(results[0]?.rrfScore).toBeCloseTo(
      HYBRID_SEARCH_LOCAL_WEIGHT / (HYBRID_SEARCH_RRF_K + 1)
        + HYBRID_SEARCH_SEMANTIC_WEIGHT / (HYBRID_SEARCH_RRF_K + 2),
      10,
    );
    expect(results[0]?.matchReasons).toEqual(["title", "semantic"]);
    expect(results[0]?.similarity).toBe(0.58);
    expect(results[2]).toMatchObject({
      matchKind: "semantic",
      matchReasons: ["semantic"],
      similarity: 0.91,
      contentHash: "b".repeat(64),
    });
    expect(index).toEqual(indexBefore);
    expect(localResults).toEqual(localBefore);
    expect(semanticResults).toEqual(semanticBefore);
  });

  it.each([
    {
      label: "title",
      query: "Notion",
      exactCard: card("card-notion", "Notion", "https://notion.so"),
    },
    {
      label: "domain",
      query: "www.github.com",
      exactCard: card("card-github", "Code Forge", "https://github.com"),
    },
  ])("forces an exact $label match ahead of a stronger fused result", ({ query, exactCard }) => {
    const strongerCard = card("card-stronger", "Strong semantic result");
    const index = buildIndex([strongerCard, exactCard]);
    const localResults = [
      localResult(index, strongerCard.id, { score: 1_000 }),
      localResult(index, exactCard.id, { score: 10 }),
    ];
    const semanticResults = [{ cardId: strongerCard.id, similarity: 0.99 }];

    const results = mergeHybridCardResults({ query, index, localResults, semanticResults });

    expect(results[0]?.card.id).toBe(exactCard.id);
    expect(results[0]?.exactTitleOrDomain).toBe(true);
    expect(results[0]?.matchKind).toBe("exact");
  });

  const calibrationCases = [
    {
      language: "Chinese",
      query: "做思维导图的工具",
      relevant: card("card-mindmap", "XMind"),
      irrelevant: card("card-calendar", "Calendar"),
      relevantSimilarity: 0.78,
    },
    {
      language: "English",
      query: "download videos",
      relevant: card("card-video", "Video Download Helper"),
      irrelevant: card("card-weather", "Weather"),
      relevantSimilarity: SEMANTIC_ONLY_MIN_SIMILARITY,
    },
  ] as const;

  it.each(calibrationCases)(
    "applies the calibrated semantic-only threshold to $language intent results",
    ({ query, relevant, irrelevant, relevantSimilarity }) => {
      const index = buildIndex([relevant, irrelevant]);
      const results = mergeHybridCardResults({
        query,
        index,
        localResults: [],
        semanticResults: [
          { cardId: relevant.id, similarity: relevantSimilarity },
          { cardId: irrelevant.id, similarity: SEMANTIC_ONLY_MIN_SIMILARITY - 0.001 },
        ],
      });

      expect(results.map((result) => result.card.id)).toEqual([relevant.id]);
      expect(results[0]?.matchReasons).toEqual(["semantic"]);
      expect(results[0]?.similarity).toBe(relevantSimilarity);
    },
  );

  it("filters unknown IDs, considers only each source's first 20 items, and returns at most five cards", () => {
    const knownCards = Array.from({ length: 26 }, (_, index) => card(`card-${index}`, `Card ${index}`));
    const index = buildIndex(knownCards);
    const firstTwentyUnknown = Array.from({ length: 20 }, (_, index) => ({
      cardId: `missing-${index}`,
      similarity: 0.99,
    }));
    const outsideSemanticWindow = mergeHybridCardResults({
      query: "semantic intent",
      index,
      localResults: [],
      semanticResults: [
        ...firstTwentyUnknown,
        { cardId: "card-20", similarity: 0.99 },
      ],
    });
    expect(outsideSemanticWindow).toEqual([]);

    const visible = mergeHybridCardResults({
      query: "semantic intent",
      index,
      localResults: [],
      semanticResults: [
        { cardId: "unknown", similarity: 0.99 },
        ...knownCards.slice(0, 8).map((item, rank) => ({
          cardId: item.id,
          similarity: 0.9 - rank * 0.01,
        })),
      ],
      limit: 100,
    });

    expect(visible).toHaveLength(5);
    expect(visible.some((result) => result.card.id === "unknown")).toBe(false);
  });
});

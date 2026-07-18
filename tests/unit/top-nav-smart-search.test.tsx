import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HybridWorkspaceSearchState } from "@/hooks/use-hybrid-workspace-search";
import type { KnowledgeBuildSummary } from "@/hooks/use-knowledge-build";
import type { HybridCardSearchResult } from "@/lib/hybrid-workspace-search";
import type { Category, CollectionSection, WebCard } from "@/lib/types";
import { buildWorkspaceSearchIndex } from "@/lib/workspace-search";

interface StoreHarness {
  searchQuery: string;
  setSearchQuery: ReturnType<typeof vi.fn>;
  visualScale: number;
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
  activeSectionId: string;
  setActiveSection: ReturnType<typeof vi.fn>;
  addSection: ReturnType<typeof vi.fn>;
  updateSection: ReturnType<typeof vi.fn>;
  reorderSections: ReturnType<typeof vi.fn>;
  deleteSection: ReturnType<typeof vi.fn>;
  loadData: ReturnType<typeof vi.fn>;
  linkOpenMode: "new-background-tab";
  searchEngine: "google";
  setSearchEngine: ReturnType<typeof vi.fn>;
  recycleBin: [];
}

interface AuthHarness {
  user: { id: string };
  isLoggedIn: boolean;
  syncStatus: "idle";
  manualSync: ReturnType<typeof vi.fn>;
}

const harness = vi.hoisted(() => ({
  store: {} as StoreHarness,
  auth: {} as AuthHarness,
  hybrid: {} as HybridWorkspaceSearchState,
  knowledge: {} as KnowledgeBuildSummary,
  openUrl: vi.fn(),
}));

vi.mock("@/lib/store", () => {
  const useAppStore = (selector?: (state: StoreHarness) => unknown) => (
    selector ? selector(harness.store) : harness.store
  );
  useAppStore.getState = () => harness.store;
  return { useAppStore };
});

vi.mock("@/lib/auth-store", () => {
  const useAuthStore = (selector?: (state: AuthHarness) => unknown) => (
    selector ? selector(harness.auth) : harness.auth
  );
  useAuthStore.getState = () => harness.auth;
  return { useAuthStore };
});

vi.mock("@/hooks/use-hybrid-workspace-search", () => ({
  useHybridWorkspaceSearch: () => harness.hybrid,
}));

vi.mock("@/hooks/use-knowledge-build", () => ({
  useKnowledgeBuild: () => harness.knowledge,
}));

vi.mock("@/lib/platform", () => ({
  openWebCollectUrl: harness.openUrl,
}));

vi.mock("@/components/auth/user-menu", () => ({
  SyncStatusBadge: () => <span data-testid="sync-status" />,
  UserMenu: () => <span data-testid="user-menu" />,
}));

vi.mock("@/components/bookmark/bookmark-bar", () => ({
  BookmarkBar: () => null,
}));

vi.mock("@/components/mindmap/read-only-site-icon", () => ({
  ReadOnlySiteIcon: ({ card }: { card: WebCard }) => (
    <span aria-hidden="true" data-testid={`site-icon-${card.id}`} />
  ),
}));

vi.mock("@/components/search/knowledge-consent-alert", () => ({
  KnowledgeConsentAlert: () => null,
}));

vi.mock("@/components/wallpaper/wallpaper-quick-control", () => ({
  WallpaperQuickControl: () => null,
}));

vi.mock("@/components/ui/platform-link", () => ({
  PlatformLink: ({ children, href, className }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => <a href={href} className={className}>{children}</a>,
}));

vi.mock("@/lib/cloud-snapshots", () => ({
  saveCloudWorkspaceSnapshot: vi.fn(),
}));

vi.mock("@/lib/local-snapshots", () => ({
  createLocalDataSnapshot: vi.fn(),
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: function PointerSensor() {},
  closestCenter: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  horizontalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

import { TopNav } from "@/components/nav/top-nav";

const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

const now = 1_777_777_777;
const section: CollectionSection = {
  id: "section-default",
  name: "主页",
  order: 0,
  createdAt: now,
  updatedAt: now,
};
const researchSection: CollectionSection = {
  id: "section-research",
  name: "研究资料",
  order: 1,
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

function makeCard(id: string, title: string): WebCard {
  return {
    id,
    title,
    url: `https://${id}.example.com`,
    shortDesc: `${title} 的功能简介`,
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

function makeHybridResult(
  card: WebCard,
  overrides: Partial<Pick<HybridCardSearchResult, "matchedTokens" | "matchReasons" | "matchKind">> = {},
): HybridCardSearchResult {
  const entry = buildWorkspaceSearchIndex({
    cards: [card],
    categories: [category],
    sections: [section],
  }).cardEntries[0];

  return {
    ...entry,
    score: 1,
    rrfScore: 1,
    localScore: 1,
    localRank: 0,
    matchedTokens: overrides.matchedTokens ?? ["tool"],
    matchReasons: overrides.matchReasons ?? ["title"],
    matchKind: overrides.matchKind ?? "lexical",
    exactMatch: false,
    exactTitleOrDomain: false,
  };
}

function makeCategoryResult() {
  const entry = buildWorkspaceSearchIndex({
    cards: [],
    categories: [category],
    sections: [section],
  }).categoryEntries[0];

  return {
    ...entry,
    score: 1,
    matchedTokens: ["tool"],
    matchReasons: ["title" as const],
    matchKind: "lexical" as const,
    exactMatch: false,
  };
}

function makeSectionResult() {
  const entry = buildWorkspaceSearchIndex({
    cards: [],
    categories: [],
    sections: [section, researchSection],
  }).sectionEntries.find((candidate) => candidate.section.id === researchSection.id);

  if (!entry) throw new Error("Section search entry did not build");
  return {
    ...entry,
    score: 1,
    matchedTokens: ["tool"],
    matchReasons: ["title" as const],
    matchKind: "lexical" as const,
    exactMatch: false,
  };
}

const cards = [
  makeCard("card-alpha", "Alpha Tool"),
  makeCard("card-bravo", "Bravo Tool"),
  makeCard("card-charlie", "Charlie Tool"),
  makeCard("card-delta", "Delta Tool"),
  makeCard("card-echo", "Echo Tool"),
  makeCard("card-foxtrot", "Foxtrot Tool"),
];

function emptyLocalResults() {
  return {
    query: "tool",
    tokens: ["tool"],
    cards: [],
    categories: [],
    sections: [],
    total: 0,
  };
}

beforeEach(() => {
  harness.openUrl.mockReset();
  harness.store = {
    searchQuery: "tool",
    setSearchQuery: vi.fn(),
    visualScale: 100,
    cards,
    categories: [category],
    sections: [section],
    activeSectionId: section.id,
    setActiveSection: vi.fn().mockResolvedValue(undefined),
    addSection: vi.fn(),
    updateSection: vi.fn(),
    reorderSections: vi.fn(),
    deleteSection: vi.fn(),
    loadData: vi.fn().mockResolvedValue(undefined),
    linkOpenMode: "new-background-tab",
    searchEngine: "google",
    setSearchEngine: vi.fn(),
    recycleBin: [],
  };
  harness.auth = {
    user: { id: "user-test" },
    isLoggedIn: true,
    syncStatus: "idle",
    manualSync: vi.fn(),
  };
  harness.hybrid = {
    localResults: emptyLocalResults(),
    cards: [makeHybridResult(cards[0])],
    semanticStatus: "loading",
    semanticResultCount: 0,
  };
  harness.knowledge = {
    consentReady: true,
    consented: true,
    buildSupported: true,
    incrementalSupported: false,
    incrementalStatus: "disabled" as const,
    isBuilding: false,
    buildState: null,
    indexedCount: 0,
    publicTextCount: 0,
    totalCards: cards.length,
    completedJobs: 0,
    failedJobs: 0,
    error: null,
    startInitialBuild: vi.fn().mockResolvedValue(undefined),
    enableSemanticOnly: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    retry: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoViewDescriptor,
    );
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  }
});

describe("TopNav smart search accessibility and keyboard behavior", () => {
  it("does not submit the external search while an IME composition is active", () => {
    render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });

    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });

    expect(harness.openUrl).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });

    expect(harness.openUrl).toHaveBeenCalledTimes(1);
    expect(harness.openUrl).toHaveBeenCalledWith(
      "https://www.google.com/search?q=tool",
      "new-active-tab",
    );
  });

  it("exposes the combobox/listbox relationship and updates aria-activedescendant", () => {
    render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });

    expect(input).toHaveAttribute("aria-controls", "wc-smart-search-results");
    expect(input).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(input);

    const listbox = screen.getByRole("listbox", { name: "搜索结果" });
    const externalOption = screen.getByRole("option", { name: /按 Enter 使用 Google 搜索/ });
    expect(listbox).toHaveAttribute("id", "wc-smart-search-results");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-activedescendant", externalOption.id);
    expect(externalOption).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });

    const cardOption = screen.getByRole("option", { name: /Alpha Tool/ });
    expect(input).toHaveAttribute("aria-activedescendant", cardOption.id);
    expect(cardOption).toHaveAttribute("aria-selected", "true");
    expect(externalOption).toHaveAttribute("aria-selected", "false");
  });

  it("keeps the keyboard-selected result active when later AI results replace the visible top five", () => {
    const { rerender } = render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });

    const selectedBefore = screen.getByRole("option", { name: /Alpha Tool/ });
    const selectedId = selectedBefore.id;
    expect(input).toHaveAttribute("aria-activedescendant", selectedId);

    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: cards.slice(1).map((card) => makeHybridResult(card)),
      semanticStatus: "ready",
      semanticResultCount: 5,
    };
    rerender(<TopNav />);

    const selectedAfter = screen.getByRole("option", { name: /Alpha Tool/ });
    expect(selectedAfter).toHaveAttribute("id", selectedId);
    expect(selectedAfter).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", selectedId);
    expect(screen.getAllByRole("option").filter((option) => option.id.includes("card-"))).toHaveLength(5);
  });

  it.each([
    {
      label: "category",
      optionName: /开发工具/,
      optionId: "wc-search-option-category-cat-tools",
      localResults: () => ({
        ...emptyLocalResults(),
        categories: [makeCategoryResult()],
        total: 1,
      }),
    },
    {
      label: "section",
      optionName: /研究资料/,
      optionId: "wc-search-option-section-section-research",
      localResults: () => ({
        ...emptyLocalResults(),
        sections: [makeSectionResult()],
        total: 1,
      }),
    },
  ])("keeps a keyboard-selected $label in the same visual slot while AI results merge", ({
    optionName,
    optionId,
    localResults,
  }) => {
    harness.store = {
      ...harness.store,
      sections: [section, researchSection],
    };
    harness.hybrid = {
      localResults: localResults(),
      cards: [makeHybridResult(cards[0])],
      semanticStatus: "loading",
      semanticResultCount: 0,
    };

    const { rerender } = render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });

    const listbox = screen.getByRole("listbox", { name: "搜索结果" });
    const selectedBefore = document.getElementById(optionId);
    expect(selectedBefore).toHaveAccessibleName(optionName);
    if (!selectedBefore) throw new Error(`Missing selected option ${optionId}`);
    const initialOptions = within(listbox).getAllByRole("option");
    const initialSlot = initialOptions.indexOf(selectedBefore);
    expect(initialSlot).toBe(2);
    expect(selectedBefore).toHaveAttribute("aria-selected", "true");

    harness.hybrid = {
      localResults: localResults(),
      cards: cards.slice(1).map((card) => makeHybridResult(card, {
        matchReasons: ["semantic"],
        matchKind: "semantic",
      })),
      semanticStatus: "ready",
      semanticResultCount: 5,
    };
    rerender(<TopNav />);

    const selectedAfter = document.getElementById(optionId);
    expect(selectedAfter).toHaveAccessibleName(optionName);
    if (!selectedAfter) throw new Error(`Missing retained option ${optionId}`);
    const updatedOptions = within(listbox).getAllByRole("option");
    expect(updatedOptions.indexOf(selectedAfter)).toBe(initialSlot);
    expect(selectedAfter).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("group", { name: "智能匹配网页" })).getAllByRole("option")).toHaveLength(1);

    fireEvent.mouseEnter(screen.getByRole("option", { name: /按 Enter 使用 Google 搜索/ }));
    expect(within(screen.getByRole("group", { name: "智能匹配网页" })).getAllByRole("option")).toHaveLength(5);
  });

  it("rebuilds a retained result from the latest index, keeps its original slot, and opens only the latest URL", () => {
    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: cards.slice(0, 3).map((card) => makeHybridResult(card)),
      semanticStatus: "loading",
      semanticResultCount: 0,
    };
    const { rerender } = render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });

    const updatedBravo = {
      ...cards[1],
      title: "Bravo Tool Latest",
      url: "https://latest-bravo.example.com",
      shortDesc: "最新简介",
    };
    harness.store = {
      ...harness.store,
      cards: harness.store.cards.map((card) => card.id === updatedBravo.id ? updatedBravo : card),
    };
    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: [cards[3], cards[4], cards[5], cards[0], cards[2]].map((card) => makeHybridResult(card)),
      semanticStatus: "ready",
      semanticResultCount: 5,
    };
    rerender(<TopNav />);

    const smartGroup = screen.getByRole("group", { name: "智能匹配网页" });
    const cardOptions = within(smartGroup).getAllByRole("option");
    expect(cardOptions).toHaveLength(5);
    expect(cardOptions[0]).toHaveAccessibleName(/Delta Tool/);
    expect(cardOptions[1]).toHaveAccessibleName(/Bravo Tool Latest/);
    expect(cardOptions[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", cardOptions[1].id);

    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(harness.openUrl).toHaveBeenCalledWith(
      "https://latest-bravo.example.com",
      "new-background-tab",
    );
    expect(harness.openUrl).not.toHaveBeenCalledWith(
      cards[1].url,
      expect.anything(),
    );
  });

  it("never opens a retained URL after that card disappears from the latest index", () => {
    const { rerender } = render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });

    harness.store = {
      ...harness.store,
      cards: harness.store.cards.filter((card) => card.id !== cards[0].id),
    };
    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: cards.slice(1).map((card) => makeHybridResult(card)),
      semanticStatus: "ready",
      semanticResultCount: 5,
    };
    rerender(<TopNav />);

    expect(screen.queryByRole("option", { name: /Alpha Tool/ })).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(harness.openUrl).toHaveBeenCalledWith(
      "https://www.google.com/search?q=tool",
      "new-active-tab",
    );
    expect(harness.openUrl).not.toHaveBeenCalledWith(cards[0].url, expect.anything());
  });

  it("shows the actual matched description and keeps AI semantic evidence in the accessible reason list", () => {
    const evidenceCard = {
      ...cards[0],
      title: "Alpha",
      shortDesc: "普通简介",
      fullDesc: "另一段介绍",
      note: "tool 只记录在这条用户备注里",
    };
    harness.store = { ...harness.store, cards: [evidenceCard] };
    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: [makeHybridResult(evidenceCard, {
        matchedTokens: ["tool"],
        matchReasons: ["title", "url", "path", "description", "semantic"],
      })],
      semanticStatus: "ready",
      semanticResultCount: 1,
    };

    render(<TopNav />);
    fireEvent.focus(screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" }));

    expect(screen.getByText("tool 只记录在这条用户备注里")).toBeInTheDocument();
    const reasons = screen.getByLabelText("匹配原因：AI 语义、标题匹配、网址匹配");
    expect(within(reasons).getByText("AI 语义")).toHaveAttribute("data-kind", "semantic");
    expect(within(reasons).queryByText("分类路径")).not.toBeInTheDocument();
  });

  it("announces AI merging only when a visible result contains semantic evidence", () => {
    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: [makeHybridResult(cards[0])],
      semanticStatus: "ready",
      semanticResultCount: 5,
    };

    const { rerender } = render(<TopNav />);
    fireEvent.focus(screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" }));
    expect(screen.queryByText("已合并 AI 语义结果")).not.toBeInTheDocument();
    expect(screen.getByText("本地即时匹配")).toBeInTheDocument();

    harness.hybrid = {
      ...harness.hybrid,
      cards: [makeHybridResult(cards[0], {
        matchReasons: ["semantic"],
        matchKind: "semantic",
      })],
    };
    rerender(<TopNav />);

    expect(screen.getByText("已合并 AI 语义结果")).toBeInTheDocument();
  });

  it.each([
    ["loading" as const, "本地暂无匹配，正在等待 AI 语义结果…"],
    ["fallback" as const, "本地暂无匹配，AI 暂不可用；仍可使用外部搜索"],
  ])("keeps an explicit smart-match state when local results are empty and semantic status is %s", (
    semanticStatus,
    expectedEmptyText,
  ) => {
    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: [],
      semanticStatus,
      semanticResultCount: 0,
    };

    render(<TopNav />);
    fireEvent.focus(screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" }));

    const smartGroup = screen.getByRole("group", { name: "智能匹配网页" });
    expect(within(smartGroup).getByText(expectedEmptyText)).toBeInTheDocument();
    expect(screen.queryByText(/^WebCollect 内暂无匹配/)).not.toBeInTheDocument();
  });

  it("scrolls only keyboard-activated options into the search panel viewport", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      frames.delete(frameId);
    });
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const { rerender } = render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });
    fireEvent.focus(input);

    const cardOption = screen.getByRole("option", { name: /Alpha Tool/ });
    fireEvent.mouseEnter(cardOption);
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "ArrowUp", code: "ArrowUp" });
    expect(frames).toHaveLength(1);
    for (const [frameId, callback] of Array.from(frames)) {
      frames.delete(frameId);
      callback(0);
    }

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(screen.getByRole("option", { name: /按 Enter 使用 Google 搜索/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: cards.slice(1).map((card) => makeHybridResult(card)),
      semanticStatus: "ready",
      semanticResultCount: 5,
    };
    rerender(<TopNav />);
    fireEvent.mouseEnter(screen.getByRole("option", { name: /Bravo Tool/ }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("drops a retained card when keyboard selection moves to a non-card option", () => {
    const { rerender } = render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    expect(screen.getByRole("option", { name: /Alpha Tool/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowUp", code: "ArrowUp" });
    harness.hybrid = {
      localResults: emptyLocalResults(),
      cards: cards.slice(1).map((card) => makeHybridResult(card)),
      semanticStatus: "ready",
      semanticResultCount: 5,
    };
    rerender(<TopNav />);

    expect(screen.queryByRole("option", { name: /Alpha Tool/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /按 Enter 使用 Google 搜索/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("drops a retained card when pointer selection moves to a category", () => {
    harness.hybrid = {
      ...harness.hybrid,
      localResults: {
        ...emptyLocalResults(),
        categories: [makeCategoryResult()],
        total: 1,
      },
    };
    const { rerender } = render(<TopNav />);
    const input = screen.getByRole("combobox", { name: "搜索收藏或使用外部搜索引擎" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });

    const categoryOption = document.getElementById("wc-search-option-category-cat-tools");
    expect(categoryOption).not.toBeNull();
    if (!categoryOption) throw new Error("Category search option did not render");
    fireEvent.mouseEnter(categoryOption);
    expect(categoryOption).toHaveAttribute("aria-selected", "true");

    harness.hybrid = {
      localResults: {
        ...emptyLocalResults(),
        categories: [makeCategoryResult()],
        total: 1,
      },
      cards: cards.slice(1).map((card) => makeHybridResult(card)),
      semanticStatus: "ready",
      semanticResultCount: 5,
    };
    rerender(<TopNav />);

    expect(screen.queryByRole("option", { name: /Alpha Tool/ })).not.toBeInTheDocument();
    expect(document.getElementById("wc-search-option-category-cat-tools")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

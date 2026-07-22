"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS as DndKitCSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  Boxes,
  Check,
  Command,
  Database,
  Folder,
  GitFork,
  Globe2,
  Grid2X2,
  GripVertical,
  Home,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { SyncStatusBadge, UserMenu } from "@/components/auth/user-menu";
import { BookmarkBar } from "@/components/bookmark/bookmark-bar";
import { TabPackShelf } from "@/components/tab-packs/tab-pack-shelf";
import { ReadOnlySiteIcon } from "@/components/mindmap/read-only-site-icon";
import { KnowledgeConsentAlert } from "@/components/search/knowledge-consent-alert";
import { WallpaperQuickControl } from "@/components/wallpaper/wallpaper-quick-control";
import { InlineEditableText } from "@/components/ui/inline-editable-text";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PlatformLink } from "@/components/ui/platform-link";
import { useAuthStore } from "@/lib/auth-store";
import { googleDriveSyncProvider } from "@/lib/google-drive-sync";
import { createLocalDataSnapshot } from "@/lib/local-snapshots";
import { useLocalKnowledgeBuild } from "@/hooks/use-local-knowledge-build";
import { useLocalWorkspaceSearch } from "@/hooks/use-local-workspace-search";
import type { HybridCardSearchResult } from "@/lib/hybrid-workspace-search";
import { openWebCollectUrl } from "@/lib/platform";
import {
  SEARCH_ENGINE_OPTIONS,
  buildSearchEngineUrl,
  getSearchEngineOption,
  isSearchEngineId,
  type SearchEngineId,
} from "@/lib/search-engines";
import { useAppStore } from "@/lib/store";
import { getRenderedVisualScale } from "@/lib/visual-scale";
import {
  buildWorkspaceSearchIndex,
  normalizeSearchQuery,
  normalizeSearchText,
  type CardSearchEntry,
} from "@/lib/workspace-search";
import type { CategorySearchSelection } from "@/lib/category-search-target";
import type { CollectionSection } from "@/lib/types";
import type { CollectionViewMode } from "@/components/mindmap/types";

interface TopNavProps {
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  onAddCategory?: () => void;
  onRecycleBin?: () => void;
  onWarehouse?: () => void;
  onShowWallpaper?: () => void;
  collectionViewMode?: CollectionViewMode;
  onCollectionViewModeChange?: (mode: CollectionViewMode) => void;
  onRevealMindmapCategory?: (target: { sectionId: string; categoryId: string }) => void;
  onRevealClassicCategory?: (target: CategorySearchSelection) => void;
}

type SearchPanelItem = {
  key: string;
  type: "search" | "card" | "category" | "section";
  label: string;
  meta: string;
  detail?: string;
  sectionId?: string;
  targetId?: string;
  url?: string;
  cardResult?: HybridCardSearchResult;
  cardSlot?: number;
};

type RetainedKeyboardSelection =
  | {
      type: "card";
      query: string;
      cardId: string;
      slot: number;
    }
  | {
      type: "structure";
      query: string;
      key: string;
      visibleCardCount: number;
    };

const SEARCH_LISTBOX_ID = "wc-smart-search-results";

function searchOptionId(key: string): string {
  return `wc-search-option-${key.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function matchReasonLabel(reason: HybridCardSearchResult["matchReasons"][number]): string {
  switch (reason) {
    case "title": return "标题匹配";
    case "url": return "网址匹配";
    case "path": return "分类路径";
    case "description": return "简介匹配";
    case "knowledge": return "正文匹配";
    case "alias": return "意图匹配";
    case "pinyin": return "拼音匹配";
    case "fuzzy": return "模糊匹配";
    case "semantic": return "语义匹配";
  }
}

function rebuildCardResult(
  entry: CardSearchEntry,
  currentResult?: HybridCardSearchResult,
): HybridCardSearchResult {
  if (currentResult) {
    return {
      ...currentResult,
      ...entry,
      card: entry.card,
    };
  }

  return {
    ...entry,
    score: 0,
    rrfScore: 0,
    matchedTokens: [],
    matchReasons: [],
    matchKind: "fuzzy",
    exactMatch: false,
    exactTitleOrDomain: false,
  };
}

function getVisibleMatchReasons(
  reasons: HybridCardSearchResult["matchReasons"],
): HybridCardSearchResult["matchReasons"] {
  return reasons.slice(0, 3);
}

function matchesSearchEvidence(value: string, query: string, tokens: readonly string[]): boolean {
  const normalizedValue = normalizeSearchText(value);
  if (!normalizedValue) return false;
  if (query && normalizedValue.includes(query)) return true;
  return tokens.some((token) => token && normalizedValue.includes(token));
}

function knowledgeMatchSnippet(value: string, query: string, tokens: readonly string[]): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const normalized = normalizeSearchText(compact);
  const needles = [query, ...tokens].filter(Boolean);
  const matchIndex = needles.reduce((best, needle) => {
    const index = normalized.indexOf(needle);
    if (index < 0) return best;
    return best < 0 ? index : Math.min(best, index);
  }, -1);
  const start = Math.max(0, matchIndex < 0 ? 0 : matchIndex - 42);
  const end = Math.min(compact.length, start + 150);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

function getCardResultSnippet(result: HybridCardSearchResult, rawQuery: string): string {
  const { card, matchReasons, matchedTokens, pathLabels } = result;
  const normalizedQuery = normalizeSearchQuery(rawQuery);
  const normalizedTokens = matchedTokens.map(normalizeSearchQuery).filter(Boolean);
  const descriptions = [card.shortDesc, card.fullDesc, card.note].filter(Boolean);
  const matchedDescription = descriptions.find((value) => (
    matchesSearchEvidence(value, normalizedQuery, normalizedTokens)
  ));

  if (matchReasons.includes("description")) {
    return matchedDescription || descriptions[0] || card.url;
  }
  if (matchReasons.includes("knowledge")) {
    return knowledgeMatchSnippet(result.knowledgeText, normalizedQuery, normalizedTokens)
      || descriptions[0]
      || card.url;
  }
  if (matchReasons.includes("url")) return card.url;
  if (matchReasons.includes("path")) return pathLabels.join(" / ");
  if (matchReasons.includes("fuzzy")) {
    const fuzzyMatch = [card.url, ...descriptions, ...pathLabels].find((value) => (
      matchesSearchEvidence(value, normalizedQuery, normalizedTokens)
    ));
    if (fuzzyMatch) return fuzzyMatch;
  }

  return card.shortDesc || card.fullDesc || card.note || card.url;
}

function WarehouseButton({ onClick }: { onClick?: () => void }) {
  const className = "wc-header-tool wc-header-tool-quiet";

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <Boxes className="h-4 w-4" />
        <span>仓库</span>
      </button>
    );
  }

  return (
    <PlatformLink href="/warehouse" className={className}>
      <Boxes className="h-4 w-4" />
      <span>仓库</span>
    </PlatformLink>
  );
}

interface SortableSectionTabProps {
  section: CollectionSection;
  active: boolean;
  editMode: boolean;
  onSelect: (sectionId: string) => void;
  onRename: (section: CollectionSection, name: string) => void;
  onDeleteRequest: (section: CollectionSection) => void;
}

function SortableSectionTab({
  section,
  active,
  editMode,
  onSelect,
  onRename,
  onDeleteRequest,
}: SortableSectionTabProps) {
  const isDefault = section.id === "section-default";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !editMode || isDefault,
  });
  const style: CSSProperties = {
    transform: DndKitCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="wc-section-tab-wrap">
      <div
        role="button"
        tabIndex={0}
        aria-label={section.name}
        className={`wc-section-tab ${active ? "wc-section-tab-active" : ""} ${editMode ? "wc-section-tab-editable" : ""}`}
        onClick={() => onSelect(section.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(section.id);
          }
        }}
        title={editMode ? "点击文字可重命名" : section.name}
      >
        {editMode && !isDefault && (
          <span
            className="wc-section-drag-handle"
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            title="拖动排序"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        {isDefault && <Home className="h-4 w-4" />}
        {editMode ? (
          <InlineEditableText
            value={section.name}
            className="min-w-[2.5rem] max-w-[8rem] truncate text-sm font-extrabold"
            editMode
            onSave={(name) => onRename(section, name)}
          />
        ) : (
          <span className="truncate">{section.name}</span>
        )}
        {editMode && !isDefault && (
          <button
            type="button"
            className="wc-section-delete-button"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteRequest(section);
            }}
            title="删除分项"
            aria-label={`删除分项 ${section.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function TopNav({
  onAddCard,
  onAddGroup,
  onAddCategory,
  onRecycleBin,
  onWarehouse,
  onShowWallpaper,
  collectionViewMode,
  onCollectionViewModeChange,
  onRevealMindmapCategory,
  onRevealClassicCategory,
}: TopNavProps) {
  const {
    searchQuery,
    setSearchQuery,
    visualScale,
    cards,
    categories,
    sections,
    activeSectionId,
    setActiveSection,
    addSection,
    updateSection,
    reorderSections,
    deleteSection,
    loadData,
    linkOpenMode,
    searchEngine,
    setSearchEngine,
  } = useAppStore();
  const recycleBinCount = useAppStore((s) => s.recycleBin.length);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const syncStatus = useAuthStore((s) => s.syncStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<"idle" | "saved">("idle");
  const [headerNotice, setHeaderNotice] = useState("");
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [activeSearchKey, setActiveSearchKey] = useState("");
  const [retainedKeyboardSelection, setRetainedKeyboardSelection] = useState<RetainedKeyboardSelection | null>(null);
  const [isKnowledgeConsentOpen, setIsKnowledgeConsentOpen] = useState(false);
  const [sectionEditMode, setSectionEditMode] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [sectionDraftName, setSectionDraftName] = useState("");
  const [deleteSectionCandidate, setDeleteSectionCandidate] = useState<CollectionSection | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchOptionRefs = useRef(new Map<string, HTMLButtonElement>());
  const keyboardScrollFrameRef = useRef<number | null>(null);
  const isSearchComposingRef = useRef(false);
  const knowledgeDialogWasOpenRef = useRef(false);
  const sectionDraftInputRef = useRef<HTMLInputElement | null>(null);
  const sectionSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const trimmedSearchQuery = searchQuery.trim();

  useEffect(() => {
    document.documentElement.style.fontSize = `${getRenderedVisualScale(visualScale)}%`;
  }, [visualScale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchPanelOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const cancelPendingKeyboardScroll = useCallback(() => {
    if (keyboardScrollFrameRef.current === null) return;
    window.cancelAnimationFrame(keyboardScrollFrameRef.current);
    keyboardScrollFrameRef.current = null;
  }, []);

  useEffect(() => cancelPendingKeyboardScroll, [cancelPendingKeyboardScroll]);

  useEffect(() => {
    if (isKnowledgeConsentOpen) {
      knowledgeDialogWasOpenRef.current = true;
      return;
    }
    if (!knowledgeDialogWasOpenRef.current) return;
    knowledgeDialogWasOpenRef.current = false;
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      setIsSearchPanelOpen(Boolean(trimmedSearchQuery));
    });
  }, [isKnowledgeConsentOpen, trimmedSearchQuery]);

  const knowledgeBuild = useLocalKnowledgeBuild();
  const workspaceSearchIndex = useMemo(
    () => buildWorkspaceSearchIndex({
      cards,
      categories,
      sections,
      knowledgeDocuments: knowledgeBuild.knowledgeDocuments,
    }),
    [cards, categories, knowledgeBuild.knowledgeDocuments, sections],
  );
  const cardEntryById = useMemo(
    () => new Map(workspaceSearchIndex.cardEntries.map((entry) => [entry.card.id, entry])),
    [workspaceSearchIndex],
  );
  const localSearch = useLocalWorkspaceSearch(trimmedSearchQuery, workspaceSearchIndex);
  const externalSearchKey = `search:${searchEngine}`;
  const currentStructureKeys = useMemo(() => new Set([
    ...localSearch.localResults.categories.map((result) => `category:${result.category.id}`),
    ...localSearch.localResults.sections.map((result) => `section:${result.section.id}`),
  ]), [localSearch.localResults.categories, localSearch.localResults.sections]);

  useEffect(() => {
    if (!retainedKeyboardSelection || retainedKeyboardSelection.query !== trimmedSearchQuery) return;
    const stillExists = retainedKeyboardSelection.type === "card"
      ? cardEntryById.has(retainedKeyboardSelection.cardId)
      : currentStructureKeys.has(retainedKeyboardSelection.key);
    if (!stillExists) setRetainedKeyboardSelection(null);
  }, [cardEntryById, currentStructureKeys, retainedKeyboardSelection, trimmedSearchQuery]);

  const visibleCardResults = useMemo(() => {
    const results = [...localSearch.cards];
    if (
      !retainedKeyboardSelection
      || retainedKeyboardSelection.query !== trimmedSearchQuery
    ) {
      return results;
    }

    if (retainedKeyboardSelection.type === "structure") {
      return results.slice(0, retainedKeyboardSelection.visibleCardCount);
    }

    const latestEntry = cardEntryById.get(retainedKeyboardSelection.cardId);
    if (!latestEntry) return results;

    const currentResult = results.find((result) => result.card.id === retainedKeyboardSelection.cardId);
    const retainedResult = rebuildCardResult(latestEntry, currentResult);
    const nextResults = results.filter((result) => result.card.id !== retainedKeyboardSelection.cardId);
    const slot = Math.min(retainedKeyboardSelection.slot, nextResults.length);
    nextResults.splice(slot, 0, retainedResult);
    return nextResults.slice(0, 5);
  }, [cardEntryById, localSearch.cards, retainedKeyboardSelection, trimmedSearchQuery]);

  const searchItems = useMemo<SearchPanelItem[]>(() => {
    if (!trimmedSearchQuery) return [];
    const searchEngineOption = getSearchEngineOption(searchEngine);

    const items: SearchPanelItem[] = [
      {
        key: `search:${searchEngineOption.id}`,
        type: "search",
        label: `按 Enter 使用 ${searchEngineOption.label} 搜索`,
        meta: searchEngineOption.hint,
        detail: `“${trimmedSearchQuery}”`,
      },
    ];

    visibleCardResults.forEach((result, cardSlot) => {
      items.push({
        key: `card:${result.card.id}`,
        type: "card",
        label: result.card.title,
        meta: result.pathLabels.join(" / "),
        detail: getCardResultSnippet(result, trimmedSearchQuery),
        sectionId: result.section?.id || "section-default",
        targetId: result.card.id,
        url: result.card.url,
        cardResult: result,
        cardSlot,
      });
    });

    for (const result of localSearch.localResults.categories) {
      items.push({
        key: `category:${result.category.id}`,
        type: "category",
        label: result.category.name,
        meta: result.pathLabels.join(" / "),
        detail: result.parentCategory ? "分组" : "分类",
        sectionId: result.section?.id || "section-default",
        targetId: result.category.id,
      });
    }

    for (const result of localSearch.localResults.sections) {
      items.push({
        key: `section:${result.section.id}`,
        type: "section",
        label: result.section.name,
        meta: "分项",
        detail: "切换到这个分项",
        sectionId: result.section.id,
      });
    }

    return items;
  }, [localSearch.localResults.categories, localSearch.localResults.sections, searchEngine, trimmedSearchQuery, visibleCardResults]);

  const activeSearchIndex = searchItems.findIndex((item) => item.key === activeSearchKey);
  const activeSearchItem = searchItems[activeSearchIndex >= 0 ? activeSearchIndex : 0];

  const activateSearchItem = useCallback((item: SearchPanelItem, source: "keyboard" | "pointer") => {
    setActiveSearchKey(item.key);
    if (source !== "keyboard") {
      setRetainedKeyboardSelection(null);
    } else if (item.cardResult && item.cardSlot !== undefined) {
      setRetainedKeyboardSelection({
        type: "card",
        query: trimmedSearchQuery,
        cardId: item.cardResult.card.id,
        slot: item.cardSlot,
      });
    } else if (item.type === "category" || item.type === "section") {
      setRetainedKeyboardSelection({
        type: "structure",
        query: trimmedSearchQuery,
        key: item.key,
        visibleCardCount: visibleCardResults.length,
      });
    } else {
      setRetainedKeyboardSelection(null);
    }

    cancelPendingKeyboardScroll();
    if (source !== "keyboard") return;

    keyboardScrollFrameRef.current = window.requestAnimationFrame(() => {
      keyboardScrollFrameRef.current = null;
      const option = searchOptionRefs.current.get(item.key);
      if (typeof option?.scrollIntoView === "function") {
        option.scrollIntoView({ block: "nearest" });
      }
    });
  }, [cancelPendingKeyboardScroll, trimmedSearchQuery, visibleCardResults.length]);

  useEffect(() => {
    cancelPendingKeyboardScroll();
    setActiveSearchKey(externalSearchKey);
    setRetainedKeyboardSelection(null);
  }, [cancelPendingKeyboardScroll, externalSearchKey, trimmedSearchQuery]);

  const handleSearchItemSelect = useCallback(
    (item: SearchPanelItem) => {
      if (item.type === "search") {
        openWebCollectUrl(
          buildSearchEngineUrl(searchEngine, trimmedSearchQuery),
          "new-active-tab"
        );
        setIsSearchPanelOpen(false);
        return;
      }

      if (item.type === "card" && item.url) {
        openWebCollectUrl(item.url, linkOpenMode);
        setIsSearchPanelOpen(false);
        return;
      }

      if (
        item.type === "category"
        && item.targetId
        && item.sectionId
        && collectionViewMode === "mindmap"
        && onRevealMindmapCategory
      ) {
        const sectionId = item.sectionId;
        const categoryId = item.targetId;
        void (async () => {
          if (sectionId !== activeSectionId) await setActiveSection(sectionId);
          onRevealMindmapCategory({ sectionId, categoryId });
        })();
      } else if (item.type === "category" && item.targetId && item.sectionId && onRevealClassicCategory) {
        const sectionId = item.sectionId;
        const categoryId = item.targetId;
        void (async () => {
          if (sectionId !== activeSectionId) await setActiveSection(sectionId);
          onRevealClassicCategory({ sectionId, categoryId });
        })();
      } else if (item.sectionId) {
        void setActiveSection(item.sectionId);
      }

      setIsSearchPanelOpen(false);
    },
    [activeSectionId, collectionViewMode, linkOpenMode, onRevealClassicCategory, onRevealMindmapCategory, searchEngine, setActiveSection, trimmedSearchQuery]
  );

  const handleSearchEngineChange = (engine: SearchEngineId) => {
    setSearchEngine(engine);
    setActiveSearchKey(`search:${engine}`);
    setRetainedKeyboardSelection(null);
    searchInputRef.current?.focus();
    setIsSearchPanelOpen(Boolean(trimmedSearchQuery));
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || isSearchComposingRef.current || event.keyCode === 229) return;

    if (event.key === "Escape") {
      if (!isSearchPanelOpen) return;
      event.preventDefault();
      setIsSearchPanelOpen(false);
      return;
    }

    if (!trimmedSearchQuery || searchItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsSearchPanelOpen(true);
      const nextIndex = isSearchPanelOpen
        ? ((activeSearchIndex >= 0 ? activeSearchIndex : 0) + 1) % searchItems.length
        : 0;
      const nextItem = searchItems[nextIndex];
      activateSearchItem(nextItem, "keyboard");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsSearchPanelOpen(true);
      const nextIndex = isSearchPanelOpen
        ? ((activeSearchIndex >= 0 ? activeSearchIndex : 0) - 1 + searchItems.length) % searchItems.length
        : searchItems.length - 1;
      const nextItem = searchItems[nextIndex];
      activateSearchItem(nextItem, "keyboard");
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleSearchItemSelect(isSearchPanelOpen ? activeSearchItem : searchItems[0]);
    }
  };

  const handleAddSection = () => {
    setSectionEditMode(true);
    setIsAddingSection(true);
    setSectionDraftName("");
    window.requestAnimationFrame(() => sectionDraftInputRef.current?.focus());
  };

  const handleRenameSection = (section: CollectionSection, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === section.name) return;
    void updateSection({ ...section, name: trimmed });
  };

  const handleConfirmDeleteSection = () => {
    if (!deleteSectionCandidate || deleteSectionCandidate.id === "section-default") return;
    void deleteSection(deleteSectionCandidate.id);
    setDeleteSectionCandidate(null);
  };

  const commitSectionDraft = (draftName = sectionDraftInputRef.current?.value ?? sectionDraftName) => {
    const trimmed = draftName.trim();
    setIsAddingSection(false);
    setSectionDraftName("");
    if (trimmed) {
      void addSection(trimmed);
    }
  };

  const cancelSectionDraft = () => {
    setIsAddingSection(false);
    setSectionDraftName("");
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || active.id === "section-default") return;
    const movableIds = sections.filter((section) => section.id !== "section-default").map((section) => section.id);
    const fromIndex = movableIds.indexOf(String(active.id));
    const overId = String(over.id);
    const toIndex = overId === "section-default" ? 0 : movableIds.indexOf(overId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...movableIds];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);
    void reorderSections(["section-default", ...nextIds]);
  };

  const handleRefreshLocalView = async () => {
    setIsRefreshing(true);
    try {
      if (useAuthStore.getState().isLoggedIn) {
        await useAuthStore.getState().manualSync({ reloadView: false, throwOnError: true });
      }
      await loadData({ showLoading: false, preserveOnCollapse: true });
    } catch (error) {
      console.error("[WebCollect] Refresh failed", error);
      const message = error instanceof Error ? error.message : "刷新失败，请稍后重试。";
      setHeaderNotice(message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveCurrentSnapshot = async () => {
    setIsSavingSnapshot(true);
    let localSaved = false;
    try {
      const snapshot = await createLocalDataSnapshot("manual-snapshot", "手动保存当前版本", { force: true });
      if (!snapshot) {
        throw new Error("当前没有可保存的 WebCollect 数据。");
      }
      localSaved = true;
      const auth = useAuthStore.getState();
      if (auth.user) {
        await googleDriveSyncProvider.saveSnapshot({
          snapshot,
          kind: "manual",
          source: "header-save",
          dayKey: null,
          cloudUpdatedAt: Date.now(),
        });
      } else {
        setHeaderNotice("未连接 Google Drive：当前版本已保存到本地，也可以在“数据与完整备份”中导出 JSON。");
      }
      setSaveFeedback("saved");
      window.setTimeout(() => setSaveFeedback("idle"), 1400);
    } catch (error) {
      console.error("[WebCollect] Save snapshot failed", error);
      const message = error instanceof Error ? error.message : "保存当前版本失败，请稍后再试。";
      setHeaderNotice(localSaved ? `本地已保存，但云端版本保存失败：${message}` : message);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const knowledgeJobTotal = knowledgeBuild.buildState?.jobs.length ?? knowledgeBuild.totalCards;
  const knowledgeStatusText = !knowledgeBuild.ready
    ? "正在读取知识库状态…"
    : knowledgeBuild.error === "build-failed"
      ? "本地知识库更新暂时失败；普通搜索仍可使用"
      : !knowledgeBuild.publicFetchSupported
        ? "本地智能搜索已开启；登录后可补充公开网页正文"
        : !knowledgeBuild.consented
          ? "本地智能搜索已开启；可选择构建公开正文知识库"
          : knowledgeBuild.isBuilding
            ? `正在本机更新知识库 ${knowledgeBuild.completedJobs}/${knowledgeJobTotal}`
            : knowledgeBuild.buildState?.status === "paused"
              ? `本地知识库已暂停 ${knowledgeBuild.completedJobs}/${knowledgeJobTotal}`
              : knowledgeBuild.buildState?.status === "complete-with-errors"
                ? `本地知识库已更新，${knowledgeBuild.failedJobs} 个网页读取失败并已回退`
                : knowledgeBuild.buildState?.status === "complete"
                  ? `本地知识库已就绪 ${knowledgeBuild.indexedCount}/${knowledgeBuild.totalCards}，含 ${knowledgeBuild.publicTextCount} 个公开网页正文`
                  : "本地智能搜索已开启；不使用任何 AI API";

  const knowledgeActionLabel = !knowledgeBuild.ready
    || !knowledgeBuild.publicFetchSupported
    ? null
    : !knowledgeBuild.consented
      ? "构建知识库"
      : knowledgeBuild.isBuilding
        ? "暂停"
        : knowledgeBuild.error === "build-failed"
          || knowledgeBuild.buildState?.status === "paused"
          || knowledgeBuild.buildState?.status === "complete-with-errors"
          ? "重试"
          : knowledgeBuild.buildState?.status === "complete" ? "更新知识库" : "开始构建";

  const handleKnowledgeAction = () => {
    knowledgeBuild.clearError();
    if (!knowledgeBuild.consented) {
      setIsKnowledgeConsentOpen(true);
      return;
    }
    if (knowledgeBuild.isBuilding) {
      knowledgeBuild.pause();
      return;
    }
    if (
      knowledgeBuild.error === "build-failed"
      || knowledgeBuild.buildState?.status === "paused"
      || knowledgeBuild.buildState?.status === "complete-with-errors"
    ) {
      void knowledgeBuild.retry();
      return;
    }
    void knowledgeBuild.update();
  };

  const localSearchStatusText = "本地即时匹配";
  const externalSearchItem = searchItems.find((item) => item.type === "search");
  const cardSearchItems = searchItems.filter((item) => item.type === "card");
  const structureSearchItems = searchItems.filter((item) => item.type === "category" || item.type === "section");
  const showCardSmartSection = cardSearchItems.length > 0;

  const renderSearchItem = (item: SearchPanelItem) => {
    const active = item.key === (activeSearchItem?.key ?? externalSearchKey);
    const Icon = item.type === "search"
      ? Globe2
      : item.type === "category"
        ? Layers
        : Folder;
    const visibleReasons = item.cardResult
      ? getVisibleMatchReasons(item.cardResult.matchReasons)
      : [];

    return (
      <button
        key={item.key}
        ref={(node) => {
          if (node) searchOptionRefs.current.set(item.key, node);
          else searchOptionRefs.current.delete(item.key);
        }}
        id={searchOptionId(item.key)}
        type="button"
        role="option"
        tabIndex={-1}
        aria-selected={active}
        className={`wc-search-result ${active ? "wc-search-result-active" : ""} ${
          item.type === "search" ? "wc-search-result-external" : ""
        }`}
        onMouseEnter={() => {
          activateSearchItem(item, "pointer");
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => handleSearchItemSelect(item)}
      >
        {item.cardResult ? (
          <ReadOnlySiteIcon
            card={item.cardResult.card}
            className="wc-search-result-icon"
            fallbackStyle={{ background: item.cardResult.category?.color || "#64748b" }}
          />
        ) : (
          <span className="wc-search-result-icon">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="wc-smart-result-body">
          <span className="wc-smart-result-title">{item.label}</span>
          {item.cardResult ? (
            <>
              {item.detail && <span className="wc-smart-result-snippet">{item.detail}</span>}
              <span className="wc-smart-result-path">{item.meta}</span>
            </>
          ) : (
            <>
              <span className="wc-smart-result-path">{item.meta}</span>
              {item.detail && <span className="wc-smart-result-snippet">{item.detail}</span>}
            </>
          )}
          {visibleReasons.length > 0 && (
            <span
              className="wc-smart-result-reasons"
              aria-label={`匹配原因：${visibleReasons.map(matchReasonLabel).join("、")}`}
            >
              {visibleReasons.map((reason) => (
                <span
                  key={reason}
                  className="wc-smart-reason-chip"
                  data-kind="local"
                >
                  {matchReasonLabel(reason)}
                </span>
              ))}
            </span>
          )}
        </span>
        {item.type === "search" && <ArrowUpRight className="h-4 w-4 shrink-0 text-blue-500" />}
      </button>
    );
  };

  return (
    <nav className="wc-app-header">
      <div className="wc-shell wc-header-main-shell">
        <div className="wc-header-grid">
          <div className="wc-brand">
            <span
              className="wc-logo-mark"
              aria-hidden="true"
              style={{ backgroundImage: "url('/assets/mascots/chipmunk-head.png')" }}
            />
            <div className="min-w-0 leading-tight">
              <span className="wc-brand-title block text-[1.55rem] font-black tracking-[-0.035em] text-slate-950">
                WebCollect
              </span>
              <span className="wc-brand-subtitle hidden text-[0.76rem] font-semibold tracking-wide text-slate-400 xl:block">
                Smart bookmark workspace
              </span>
            </div>
          </div>

          <div
            className="wc-header-search-wrap"
            onFocus={() => setIsSearchPanelOpen(Boolean(trimmedSearchQuery))}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                setIsSearchPanelOpen(false);
              }
            }}
          >
            <div className="wc-header-search">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索网站、分组或分类..."
                value={searchQuery}
                role="combobox"
                aria-label="搜索收藏或使用外部搜索引擎"
                aria-autocomplete="list"
                aria-expanded={isSearchPanelOpen && Boolean(trimmedSearchQuery)}
                aria-controls={SEARCH_LISTBOX_ID}
                aria-activedescendant={
                  isSearchPanelOpen && activeSearchItem
                    ? searchOptionId(activeSearchItem.key)
                    : undefined
                }
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveSearchKey(externalSearchKey);
                  setRetainedKeyboardSelection(null);
                  setIsSearchPanelOpen(Boolean(e.target.value.trim()));
                }}
                onFocus={() => setIsSearchPanelOpen(Boolean(trimmedSearchQuery))}
                onCompositionStart={() => {
                  isSearchComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isSearchComposingRef.current = false;
                }}
                onKeyDown={handleSearchKeyDown}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"
              />
              <select
                aria-label="选择搜索引擎"
                className="wc-search-engine-select"
                value={searchEngine}
                onChange={(event) => {
                  const nextEngine = event.target.value;
                  if (isSearchEngineId(nextEngine)) {
                    handleSearchEngineChange(nextEngine);
                  }
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                {SEARCH_ENGINE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.shortLabel}
                  </option>
                ))}
              </select>
              <span className="hidden items-center gap-1 rounded-xl bg-slate-100/80 px-2 py-1 text-[11px] font-bold text-slate-400 md:inline-flex">
                <Command className="h-3 w-3" />
                K
              </span>
            </div>

            {isSearchPanelOpen && trimmedSearchQuery && (
              <div className="wc-search-popover">
                <div id={SEARCH_LISTBOX_ID} role="listbox" aria-label="搜索结果">
                  {externalSearchItem && (
                    <div className="wc-smart-section" role="group" aria-label="外部搜索">
                      {renderSearchItem(externalSearchItem)}
                    </div>
                  )}

                  {showCardSmartSection && (
                    <div className="wc-smart-section" role="group" aria-label="智能匹配网页">
                      <div className="wc-smart-section-heading">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          智能匹配
                        </span>
                        <span className="wc-smart-status">
                          {localSearchStatusText}
                        </span>
                      </div>
                      {cardSearchItems.map(renderSearchItem)}
                    </div>
                  )}

                  {structureSearchItems.length > 0 && (
                    <div className="wc-smart-section" role="group" aria-label="分类、分组与分项">
                      <div className="wc-smart-section-heading">
                        <span>分类、分组与分项</span>
                        <span>{structureSearchItems.length} 项</span>
                      </div>
                      {structureSearchItems.map(renderSearchItem)}
                    </div>
                  )}
                </div>

                {!showCardSmartSection && structureSearchItems.length === 0 && (
                  <div className="wc-search-empty">
                    WebCollect 内暂无匹配，按 Enter 可用 {getSearchEngineOption(searchEngine).label} 搜索
                  </div>
                )}

                <div className="wc-smart-footer">
                  <span className="wc-smart-footer-copy">
                    <span className="wc-smart-status">
                      <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {knowledgeStatusText}
                    </span>
                  </span>
                  {knowledgeActionLabel && (
                    <button
                      type="button"
                      className="wc-smart-footer-action"
                      onClick={handleKnowledgeAction}
                    >
                      {knowledgeActionLabel}
                    </button>
                  )}
                </div>
                <span className="sr-only" role="status" aria-live="polite">
                  {localSearchStatusText}。{knowledgeStatusText}
                </span>
              </div>
            )}
          </div>

          <div className="wc-header-actions">
            <SyncStatusBadge />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveCurrentSnapshot}
              disabled={isSavingSnapshot}
              className="wc-header-tool wc-header-save"
              title="保存当前版本"
            >
              <Save className={`h-4 w-4 ${isSavingSnapshot ? "animate-pulse" : ""}`} />
              <span>{saveFeedback === "saved" ? "已保存" : "保存"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshLocalView}
              disabled={isRefreshing || syncStatus === "syncing"}
              className="wc-header-tool"
              title={isLoggedIn ? "从云端同步并刷新视图" : "刷新本地视图"}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>刷新</span>
            </Button>
            {headerNotice && (
              <button
                type="button"
                className="max-w-72 truncate rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                onClick={() => setHeaderNotice("")}
                title="点击关闭提示"
              >
                {headerNotice}
              </button>
            )}
            {onShowWallpaper && (
              <WallpaperQuickControl onShowWallpaper={onShowWallpaper} />
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => onAddCard?.()}
              className="wc-header-primary"
              title="添加网页"
            >
              <Plus className="h-4 w-4" />
              <span>网页</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddGroup?.()}
              className="wc-header-tool"
              title="添加分组"
            >
              <Plus className="h-4 w-4" />
              <span>分组</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddCategory?.()}
              className="wc-header-tool"
              title="添加分类"
            >
              <Plus className="h-4 w-4" />
              <span>分类</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="wc-header-tool wc-header-tool-quiet relative"
              onClick={() => onRecycleBin?.()}
            >
              <Trash2 className="h-4 w-4" />
              <span>回收站</span>
              {recycleBinCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-rose-200">
                  {recycleBinCount}
                </span>
              )}
            </Button>
            <WarehouseButton onClick={onWarehouse} />
            {collectionViewMode && onCollectionViewModeChange && (
              <div className="wc-view-mode-toggle" role="group" aria-label="收藏视图模式">
                <button
                  type="button"
                  className="wc-view-mode-button"
                  aria-pressed={collectionViewMode === "classic"}
                  onClick={() => onCollectionViewModeChange("classic")}
                  title="经典模式"
                >
                  <Grid2X2 aria-hidden="true" />
                  <span>经典</span>
                </button>
                <button
                  type="button"
                  className="wc-view-mode-button"
                  aria-pressed={collectionViewMode === "mindmap"}
                  onClick={() => onCollectionViewModeChange("mindmap")}
                  title="导图模式"
                >
                  <GitFork aria-hidden="true" />
                  <span>导图</span>
                </button>
              </div>
            )}
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="wc-shell wc-header-tabs-shell">
        <div className="wc-section-and-pack-row">
        <div className={`wc-section-tabs ${sectionEditMode ? "wc-section-tabs-editing" : ""}`}>
          <button
            type="button"
            className={`wc-section-edit-toggle ${sectionEditMode ? "wc-section-edit-toggle-active" : ""}`}
            onClick={() => {
              setSectionEditMode((value) => !value);
              setIsAddingSection(false);
              setSectionDraftName("");
            }}
            aria-pressed={sectionEditMode}
            title={sectionEditMode ? "完成分项编辑" : "编辑分项"}
          >
            {sectionEditMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
          <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map((section) => section.id)} strategy={horizontalListSortingStrategy}>
              <div className="wc-section-tab-track">
                {sections.map((section) => (
                  <SortableSectionTab
                    key={section.id}
                    section={section}
                    active={section.id === activeSectionId}
                    editMode={sectionEditMode}
                    onSelect={(sectionId) => void setActiveSection(sectionId)}
                    onRename={handleRenameSection}
                    onDeleteRequest={setDeleteSectionCandidate}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {isAddingSection ? (
            <input
              ref={sectionDraftInputRef}
              className="wc-section-draft-input"
              value={sectionDraftName}
              onChange={(event) => setSectionDraftName(event.target.value)}
              onBlur={(event) => commitSectionDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitSectionDraft(event.currentTarget.value);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelSectionDraft();
                }
              }}
              placeholder="新分项名称"
            />
          ) : (
          <Button
            variant="ghost"
            size="sm"
            className="wc-section-tab wc-section-tab-new"
            onClick={handleAddSection}
            title="添加分项"
          >
            <Plus className="h-4 w-4" />
            <span>分项</span>
          </Button>
          )}
        </div>
        <TabPackShelf />
        </div>
      </div>

      <BookmarkBar />
      <KnowledgeConsentAlert
        open={isKnowledgeConsentOpen}
        mode="local"
        onOpenChange={setIsKnowledgeConsentOpen}
        onConfirm={() => {
          void knowledgeBuild.startInitialBuild();
        }}
      />
      <AlertDialog
        open={Boolean(deleteSectionCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteSectionCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">删除分项「{deleteSectionCandidate?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              为防止误删数据，只会删除这个页签，里面的分类、分组和网页会移动到主页。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteSection}
            >
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}

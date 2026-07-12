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
  FileText,
  Folder,
  Globe2,
  GripVertical,
  Home,
  ImageIcon,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { SyncStatusBadge, UserMenu } from "@/components/auth/user-menu";
import { BookmarkBar } from "@/components/bookmark/bookmark-bar";
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
import { saveCloudWorkspaceSnapshot } from "@/lib/cloud-snapshots";
import { createLocalDataSnapshot } from "@/lib/local-snapshots";
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
import { searchWorkspace } from "@/lib/workspace-search";
import type { CollectionSection } from "@/lib/types";

interface TopNavProps {
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  onAddCategory?: () => void;
  onRecycleBin?: () => void;
  onWarehouse?: () => void;
  onShowWallpaper?: () => void;
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
};

function escapeSelectorValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
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
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [sectionEditMode, setSectionEditMode] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [sectionDraftName, setSectionDraftName] = useState("");
  const [deleteSectionCandidate, setDeleteSectionCandidate] = useState<CollectionSection | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const sectionDraftInputRef = useRef<HTMLInputElement | null>(null);
  const sectionSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  const trimmedSearchQuery = searchQuery.trim();
  const workspaceSearchResults = useMemo(
    () => (
      trimmedSearchQuery
        ? searchWorkspace({ cards, categories, sections }, trimmedSearchQuery)
        : null
    ),
    [cards, categories, sections, trimmedSearchQuery]
  );

  const searchItems = useMemo<SearchPanelItem[]>(() => {
    if (!trimmedSearchQuery) return [];
    const searchEngineOption = getSearchEngineOption(searchEngine);

    const items: SearchPanelItem[] = [
      {
        key: `search:${searchEngineOption.id}`,
        type: "search",
        label: `${searchEngineOption.label} 搜索 ${trimmedSearchQuery}`,
        meta: "外部搜索",
        detail: searchEngineOption.hint,
      },
    ];

    if (!workspaceSearchResults) return items;

    for (const result of workspaceSearchResults.cards) {
      items.push({
        key: `card:${result.card.id}`,
        type: "card",
        label: result.card.title,
        meta: result.pathLabels.join(" / "),
        detail: result.card.shortDesc || result.card.fullDesc || result.card.note || result.card.url,
        sectionId: result.section?.id || "section-default",
        targetId: result.card.id,
        url: result.card.url,
      });
    }

    for (const result of workspaceSearchResults.categories) {
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

    for (const result of workspaceSearchResults.sections) {
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
  }, [searchEngine, trimmedSearchQuery, workspaceSearchResults]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [trimmedSearchQuery, workspaceSearchResults?.total]);

  const revealSearchTarget = useCallback((selector: string) => {
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      target.classList.add("wc-search-highlight");
      window.setTimeout(() => target.classList.remove("wc-search-highlight"), 1600);
    }, 140);
  }, []);

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

      if (item.sectionId) {
        void setActiveSection(item.sectionId);
      }

      if (item.type === "category" && item.targetId) {
        revealSearchTarget(`[data-wc-category-id="${escapeSelectorValue(item.targetId)}"]`);
      }

      setIsSearchPanelOpen(false);
    },
    [linkOpenMode, revealSearchTarget, searchEngine, setActiveSection, trimmedSearchQuery]
  );

  const handleSearchEngineChange = (engine: SearchEngineId) => {
    setSearchEngine(engine);
    searchInputRef.current?.focus();
    setIsSearchPanelOpen(Boolean(trimmedSearchQuery));
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!isSearchPanelOpen || searchItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchIndex((index) => (index + 1) % searchItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchIndex((index) => (index - 1 + searchItems.length) % searchItems.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleSearchItemSelect(searchItems[activeSearchIndex] || searchItems[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsSearchPanelOpen(false);
      searchInputRef.current?.blur();
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
      const user = useAuthStore.getState().user;
      if (user) {
        await saveCloudWorkspaceSnapshot(user.id, snapshot, {
          kind: "manual",
          source: "header-save",
        });
      } else {
        setHeaderNotice("未登录：当前版本已保存到本地。登录后，手动版本会保存到云端并跟随账号。");
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
            onBlur={() => {
              window.setTimeout(() => setIsSearchPanelOpen(false), 120);
            }}
          >
            <label className="wc-header-search" aria-label="搜索网站">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索网站、分组或分类..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchPanelOpen(Boolean(e.target.value.trim()));
                }}
                onFocus={() => setIsSearchPanelOpen(Boolean(trimmedSearchQuery))}
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
            </label>

            {isSearchPanelOpen && trimmedSearchQuery && (
              <div className="wc-search-popover" role="listbox" aria-label="搜索结果">
                {searchItems.map((item, index) => {
                  const active = index === activeSearchIndex;
                  const Icon =
                    item.type === "search"
                      ? Globe2
                      : item.type === "card"
                        ? FileText
                        : item.type === "category"
                          ? Layers
                          : Folder;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`wc-search-result ${active ? "wc-search-result-active" : ""} ${
                        item.type === "search" ? "wc-search-result-external" : ""
                      }`}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSearchItemSelect(item)}
                    >
                      <span className="wc-search-result-icon">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-bold text-slate-800">{item.label}</span>
                        <span className="block truncate text-[11px] font-medium text-slate-500">
                          {item.meta}
                          {item.detail ? ` · ${item.detail}` : ""}
                        </span>
                      </span>
                      {item.type === "search" && <ArrowUpRight className="h-4 w-4 text-blue-500" />}
                    </button>
                  );
                })}
                {workspaceSearchResults && workspaceSearchResults.total === 0 && (
                  <div className="wc-search-empty">
                    WebCollect 内暂无匹配，按 Enter 可用 {getSearchEngineOption(searchEngine).label} 搜索
                  </div>
                )}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowWallpaper}
                className="wc-header-tool wc-header-tool-quiet"
                title="进入壁纸模式"
              >
                <ImageIcon className="h-4 w-4" />
                <span>壁纸</span>
              </Button>
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
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="wc-shell wc-header-tabs-shell">
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
      </div>

      <BookmarkBar />
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

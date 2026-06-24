"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowUpRight,
  Boxes,
  Command,
  FileText,
  Folder,
  Globe2,
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
import { Button } from "@/components/ui/button";
import { PlatformLink } from "@/components/ui/platform-link";
import { useAuthStore } from "@/lib/auth-store";
import { saveCloudWorkspaceSnapshot } from "@/lib/cloud-snapshots";
import { createLocalDataSnapshot } from "@/lib/local-snapshots";
import { openWebCollectUrl } from "@/lib/platform";
import { useAppStore } from "@/lib/store";
import { getRenderedVisualScale } from "@/lib/visual-scale";
import { searchWorkspace } from "@/lib/workspace-search";

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
  type: "google" | "card" | "category" | "section";
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
    deleteSection,
    editMode,
    loadData,
    linkOpenMode,
  } = useAppStore();
  const recycleBinCount = useAppStore((s) => s.recycleBin.length);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const syncStatus = useAuthStore((s) => s.syncStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<"idle" | "saved">("idle");
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

    const items: SearchPanelItem[] = [
      {
        key: "google",
        type: "google",
        label: `Google 搜索 ${trimmedSearchQuery}`,
        meta: "外部搜索",
        detail: "先查全网，再看 WebCollect 内部收藏",
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
  }, [trimmedSearchQuery, workspaceSearchResults]);

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
      if (item.type === "google") {
        openWebCollectUrl(
          `https://www.google.com/search?q=${encodeURIComponent(trimmedSearchQuery)}`,
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
    [linkOpenMode, revealSearchTarget, setActiveSection, trimmedSearchQuery]
  );

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
    const name = window.prompt("新分项名称", "常用 AI");
    if (name?.trim()) {
      void addSection(name.trim());
    }
  };

  const handleRenameSection = (sectionId: string, currentName: string) => {
    const name = window.prompt("重命名分项", currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    void updateSection({ ...section, name: name.trim() });
  };

  const handleDeleteSection = (sectionId: string, sectionName: string) => {
    if (sectionId === "section-default") return;
    const ok = window.confirm(
      `删除分项“${sectionName}”？为防止误删数据，只会删除这个页签，里面的分类、分组和网页会移动到主页。`
    );
    if (ok) void deleteSection(sectionId);
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
      window.alert(message);
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
        window.alert("未登录：当前版本已保存到本地。登录后，手动版本会保存到云端并跟随账号。");
      }
      setSaveFeedback("saved");
      window.setTimeout(() => setSaveFeedback("idle"), 1400);
    } catch (error) {
      console.error("[WebCollect] Save snapshot failed", error);
      const message = error instanceof Error ? error.message : "保存当前版本失败，请稍后再试。";
      window.alert(localSaved ? `本地已保存，但云端版本保存失败：${message}` : message);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  return (
    <nav className="wc-app-header">
      <div className="wc-shell wc-header-main-shell">
        <div className="wc-header-grid">
          <div className="wc-brand">
            <span className="wc-logo-mark" aria-hidden="true">
              W
            </span>
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
                    item.type === "google"
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
                        item.type === "google" ? "wc-search-result-google" : ""
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
                      {item.type === "google" && <ArrowUpRight className="h-4 w-4 text-blue-500" />}
                    </button>
                  );
                })}
                {workspaceSearchResults && workspaceSearchResults.total === 0 && (
                  <div className="wc-search-empty">
                    WebCollect 内暂无匹配，按 Enter 可 Google 搜索
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
        <div className="wc-section-tabs">
          {sections.map((section) => {
            const active = section.id === activeSectionId;
            const canDelete = section.id !== "section-default";
            return (
              <div key={section.id} className="group relative flex shrink-0 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className={`wc-section-tab ${active ? "wc-section-tab-active" : ""} ${editMode ? "wc-section-tab-editable" : ""}`}
                  onClick={() => void setActiveSection(section.id)}
                  onDoubleClick={() => editMode && handleRenameSection(section.id, section.name)}
                  title={editMode ? "点击切换，双击重命名" : section.name}
                >
                  {section.id === "section-default" && <Home className="h-4 w-4" />}
                  <span>{section.name}</span>
                </Button>
                {editMode && (
                  <div className="absolute left-full top-1/2 z-20 ml-1 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="wc-tab-mini"
                      onClick={() => handleRenameSection(section.id, section.name)}
                      title="重命名分项"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="wc-tab-mini wc-tab-mini-danger"
                        onClick={() => handleDeleteSection(section.id, section.name)}
                        title="删除分项"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
        </div>
      </div>

      <BookmarkBar />
    </nav>
  );
}

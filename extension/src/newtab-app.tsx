/**
 * NewTabApp - Root component for the Chrome Extension
 * 
 * Implements state-based routing between Main and Warehouse views.
 * Reuses the same components from the web version.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { useWarehouseStore } from "@/lib/store-warehouse";
import { saveCards, saveCategories, setInitialized } from "@/lib/db";
import { restoreLatestHealthyWorkspaceIfNeeded } from "@/lib/emergency-restore";
import { drainFloatingCaptureQueue, publishCaptureDestinationCache } from "@/lib/floating-capture";
import { isChromeExtension } from "@/lib/platform";
import { SortableGrid } from "@/components/layout/sortable-grid";
import { WarehouseGrid } from "@/components/layout/warehouse-grid";
import { TopNav } from "@/components/nav/top-nav";
import { HotRecommendation } from "@/components/hot-recommendation";
import { CardDialog } from "@/components/dialogs/card-dialog";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { RecycleBinDialog } from "@/components/dialogs/recycle-bin-dialog";
import { ImportDialog } from "@/components/dialogs/import-dialog";
import { SectionShipDialog } from "@/components/dialogs/section-ship-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import type { WebCard, Category } from "@/lib/types";
import { RefreshCw, Trash2, XCircle } from "lucide-react";

type View = "main" | "warehouse";

export function NewTabApp() {
  const [view, setView] = useState<View>("main");

  // 鈹€鈹€ Main page state 鈹€鈹€
  const { loadData, isLoading, softDeleteCard, updateCard, categories, sections } = useAppStore();

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [sectionShipOpen, setSectionShipOpen] = useState(false);
  const [sectionShipItem, setSectionShipItem] = useState<
    { type: "category"; category: Category } | { type: "card"; card: WebCard } | null
  >(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<WebCard | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>();
  const [isCreatingParent, setIsCreatingParent] = useState(false);
  const [isWarehouseRefreshing, setIsWarehouseRefreshing] = useState(false);

  // 鈹€鈹€ Warehouse state 鈹€鈹€
  const {
    loadData: loadWarehouseData,
    clearAllWarehouse,
    deleteExistingWarehouseItems,
    cards: warehouseCards,
    categories: warehouseCategories,
  } = useWarehouseStore();

  const handleRefreshWarehouse = useCallback(async () => {
    setIsWarehouseRefreshing(true);
    try {
      await loadWarehouseData();
    } finally {
      setTimeout(() => setIsWarehouseRefreshing(false), 250);
    }
  }, [loadWarehouseData]);

  // 鈹€鈹€ Load data on mount 鈹€鈹€
  useEffect(() => {
    const init = async () => {
      try {
        const restore = await restoreLatestHealthyWorkspaceIfNeeded();
        if (restore.restored) {
          console.warn("[WebCollect] Emergency workspace restore applied before auth sync", restore);
        }
      } catch (error) {
        console.error("[WebCollect] Emergency workspace restore failed", error);
      }

      try {
        await useAuthStore.getState().initialize();
      } catch (error) {
        console.error("[WebCollect] Auth initialization failed", error);
      }

      try {
        await loadData();
        const state = useAppStore.getState();
        if (!state.initialized) {
          await setInitialized();
          if (state.cards.length === 0 && state.categories.length === 0) {
            await saveCategories([
              {
                id: "cat-inbox",
                name: "\u6536\u96c6\u7bb1",
                icon: "inbox",
                color: "#888888",
                order: 99,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                sectionId: state.activeSectionId,
              },
            ]);
            await saveCards([]);
            await loadData();
          } else {
            useAppStore.setState({ initialized: true });
          }
        }
        await publishCaptureDestinationCache();
        await drainFloatingCaptureQueue();
      } catch (error) {
        console.error("[WebCollect] Local data initialization failed", error);
        useAppStore.setState({ isLoading: false });
      }
      void loadWarehouseData().catch((error) => {
        console.error("[WebCollect] Warehouse initialization failed", error);
      });
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void publishCaptureDestinationCache();
  }, [categories, sections]);

  useEffect(() => {
    if (!isChromeExtension() || typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    const handleQueueMessage = (message: { type?: string }) => {
      if (message?.type === "CAPTURE_QUEUE_UPDATED") {
        void drainFloatingCaptureQueue();
      }
    };
    const handleFocus = () => {
      void drainFloatingCaptureQueue();
    };
    chrome.runtime.onMessage.addListener(handleQueueMessage);
    window.addEventListener("focus", handleFocus);
    return () => {
      chrome.runtime.onMessage.removeListener(handleQueueMessage);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // 鈹€鈹€ Card handlers 鈹€鈹€
  const handleAddCard = useCallback((categoryId?: string) => {
    setEditingCard(null);
    setDefaultCategoryId(categoryId || "");
    setCardDialogOpen(true);
  }, []);

  const handleEditCard = useCallback((card: WebCard) => {
    setEditingCard(card);
    setDefaultCategoryId("");
    setCardDialogOpen(true);
  }, []);

  // 鈹€鈹€ Category handlers 鈹€鈹€
  const handleAddCategory = useCallback(() => {
    setEditingCategory(null);
    setDefaultParentId(undefined);
    setIsCreatingParent(true);
    setCategoryDialogOpen(true);
  }, []);

  const handleAddGroup = useCallback((parentId?: string) => {
    setEditingCategory(null);
    setDefaultParentId(parentId);
    setIsCreatingParent(false);
    setCategoryDialogOpen(true);
  }, []);

  const handleEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setDefaultParentId(undefined);
    setIsCreatingParent(false);
    setCategoryDialogOpen(true);
  }, []);

  // 鈹€鈹€ Loading state 鈹€鈹€
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="wc-glass flex flex-col items-center gap-4 rounded-[28px] px-10 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">正在整理收藏夹...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {view === "main" ? (
        <>
          <TopNav
            onAddCard={handleAddCard}
            onAddGroup={handleAddGroup}
            onAddCategory={handleAddCategory}
            onRecycleBin={() => setRecycleBinOpen(true)}
            onWarehouse={() => setView("warehouse")}
          />

          <main className="wc-shell wc-page-main space-y-7 px-5 py-7">
            <ErrorBoundary>
              <SortableGrid
                onAddCard={handleAddCard}
                onEditCard={handleEditCard}
                onDeleteCard={(card) => softDeleteCard(card.id)}
                onEditCategory={handleEditCategory}
                onAddGroup={handleAddGroup}
                onUpdateCard={updateCard}
                onShipCategory={(category) => {
                  setSectionShipItem({ type: "category", category });
                  setSectionShipOpen(true);
                }}
                onShipCard={(card) => {
                  setSectionShipItem({ type: "card", card });
                  setSectionShipOpen(true);
                }}
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <HotRecommendation />
            </ErrorBoundary>
          </main>

          <footer className="mt-6 py-7">
            <div className="wc-shell px-5 text-center text-xs text-slate-400">
              <p>WebCollect</p>
            </div>
          </footer>

          <ErrorBoundary>
            <CardDialog
              open={cardDialogOpen}
              onOpenChange={setCardDialogOpen}
              editingCard={editingCard}
              defaultCategoryId={defaultCategoryId}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <CategoryDialog
              open={categoryDialogOpen}
              onOpenChange={setCategoryDialogOpen}
              editingCategory={editingCategory}
              defaultParentId={defaultParentId}
              isParent={isCreatingParent}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <RecycleBinDialog
              open={recycleBinOpen}
              onOpenChange={setRecycleBinOpen}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <SectionShipDialog
              open={sectionShipOpen}
              onOpenChange={setSectionShipOpen}
              item={sectionShipItem}
            />
          </ErrorBoundary>
        </>
      ) : (
        <>
          <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur-2xl">
            <div className="wc-shell flex h-16 items-center justify-between px-5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("main")}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
                >
                  {"\u2190 \u8fd4\u56de\u4e3b\u9875"}
                </button>
                <span className="text-xl font-semibold text-slate-950">{"\u4ed3\u5e93"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshWarehouse}
                  disabled={isWarehouseRefreshing}
                  className="wc-action-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition-colors"
                  title="Refresh warehouse"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isWarehouseRefreshing ? "animate-spin" : ""}`} />
                  {"\u5237\u65b0"}
                </button>
                <button
                  onClick={async () => {
                    const removed = await deleteExistingWarehouseItems();
                    if (removed === 0) {
                      window.alert("No existing or duplicate warehouse items found.");
                    }
                  }}
                  disabled={warehouseCards.length === 0}
                  className="wc-action-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition-colors disabled:opacity-40"
                  title="Delete existing and duplicate pages"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {"\u5220\u9664\u5df2\u5b58\u5728"}
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Clear ${warehouseCategories.length} warehouse categories and ${warehouseCards.length} pages? Main page data will not be changed.`)) return;
                    await clearAllWarehouse();
                  }}
                  disabled={warehouseCards.length === 0 && warehouseCategories.length === 0}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white/75 px-4 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-40"
                  title="Clear warehouse"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {"\u6e05\u7a7a"}
                </button>
                <button
                onClick={() => setImportDialogOpen(true)}
                className="wc-action-primary inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm transition-colors"
              >
                {"\u5bfc\u5165"}
              </button>
              </div>
            </div>
          </nav>
          <main className="wc-shell px-5 py-7">
            <ErrorBoundary>
              <WarehouseGrid />
            </ErrorBoundary>
          </main>
          <ImportDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
          />
        </>
      )}
    </div>
  );
}

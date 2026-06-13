"use client";

import { useEffect, useState, useCallback } from "react";
import { TopNav } from "@/components/nav/top-nav";
import { SortableGrid } from "@/components/layout/sortable-grid";
import { CardDialog } from "@/components/dialogs/card-dialog";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { RecycleBinDialog } from "@/components/dialogs/recycle-bin-dialog";
import { SectionShipDialog } from "@/components/dialogs/section-ship-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import { HotRecommendation } from "@/components/hot-recommendation";
import { WallpaperShell } from "@/components/wallpaper/wallpaper-shell";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { saveCards, saveCategories, setInitialized, withoutLocalChangeEvents } from "@/lib/db";
import { restoreLatestHealthyWorkspaceIfNeeded } from "@/lib/emergency-restore";
import { useWallpaperStore } from "@/lib/wallpaper-store";
import type { WebCard, Category } from "@/lib/types";

export default function HomePage() {
  const { loadData, isLoading, softDeleteCard, updateCard } = useAppStore();
  const wallpaperMode = useWallpaperStore((state) => state.mode);
  const enterCollection = useWallpaperStore((state) => state.enterCollection);
  const returnToWallpaper = useWallpaperStore((state) => state.returnToWallpaper);

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [sectionShipOpen, setSectionShipOpen] = useState(false);
  const [sectionShipItem, setSectionShipItem] = useState<
    { type: "category"; category: Category } | { type: "card"; card: WebCard } | null
  >(null);
  const [editingCard, setEditingCard] = useState<WebCard | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>();
  const [isCreatingParent, setIsCreatingParent] = useState(false);

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
        await loadData();
        const state = useAppStore.getState();
        if (!state.initialized) {
          if (state.cards.length === 0 && state.categories.length === 0) {
            await withoutLocalChangeEvents(async () => {
              await setInitialized();
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
            });
            await loadData();
          } else {
            await withoutLocalChangeEvents(() => setInitialized());
            useAppStore.setState({ initialized: true });
          }
        }
      } catch (error) {
        console.error("[WebCollect] Local data initialization failed", error);
        useAppStore.setState({ isLoading: false });
      }

      void useAuthStore.getState().initialize().catch((error) => {
        console.error("[WebCollect] Auth initialization failed", error);
      });
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleEnterCollection = useCallback(() => {
    enterCollection();
  }, [enterCollection]);

  const handleReturnToWallpaper = useCallback(() => {
    returnToWallpaper();
  }, [returnToWallpaper]);

  if (wallpaperMode === "wallpaper") {
    return (
      <WallpaperShell
        mode={wallpaperMode}
        onEnterCollection={handleEnterCollection}
      />
    );
  }

  if (isLoading) {
    return (
      <WallpaperShell
        mode={wallpaperMode}
        onEnterCollection={handleEnterCollection}
      >
        <div className="flex min-h-screen items-center justify-center">
        <div className="wc-glass flex flex-col items-center gap-4 rounded-[28px] px-10 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">正在整理收藏夹...</p>
        </div>
        </div>
      </WallpaperShell>
    );
  }

  return (
    <WallpaperShell
      mode={wallpaperMode}
      onEnterCollection={handleEnterCollection}
    >
    <div className="min-h-screen">
      <TopNav
        onAddCard={handleAddCard}
        onAddGroup={handleAddGroup}
        onAddCategory={handleAddCategory}
        onRecycleBin={() => setRecycleBinOpen(true)}
        onShowWallpaper={handleReturnToWallpaper}
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
          <p>WebCollect - 你的个人网页收藏墙</p>
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
    </div>
    </WallpaperShell>
  );
}

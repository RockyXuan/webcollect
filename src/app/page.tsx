"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TopNav } from "@/components/nav/top-nav";
import { SortableGrid } from "@/components/layout/sortable-grid";
import { CardDialog } from "@/components/dialogs/card-dialog";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { RecycleBinDialog } from "@/components/dialogs/recycle-bin-dialog";
import { SectionShipDialog } from "@/components/dialogs/section-ship-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import { HotRecommendation } from "@/components/hot-recommendation";
import { WallpaperShell } from "@/components/wallpaper/wallpaper-shell";
import { MindmapView, type MindmapSearchTarget } from "@/components/mindmap/mindmap-view";
import type { CollectionViewMode } from "@/components/mindmap/types";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { saveCards, saveCategories, setInitialized, withoutLocalChangeEvents } from "@/lib/db";
import {
  restoreEmergencyWorkspaceSnapshot,
  restoreLatestHealthyWorkspaceIfNeeded,
  type EmergencyRestoreResult,
} from "@/lib/emergency-restore";
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
import { useWallpaperStore } from "@/lib/wallpaper-store";
import type { WebCard, Category } from "@/lib/types";

type EmergencyRestorePrompt = Extract<EmergencyRestoreResult, { shouldPrompt: true }>;

function formatSnapshotDate(timestamp: number | undefined): string {
  if (!timestamp) return "较早";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

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
  const [emergencyRestorePrompt, setEmergencyRestorePrompt] = useState<EmergencyRestorePrompt | null>(null);
  const [collectionViewMode, setCollectionViewMode] = useState<CollectionViewMode>("classic");
  const [requestedViewMode, setRequestedViewMode] = useState<CollectionViewMode>("classic");
  const [viewTransitionPhase, setViewTransitionPhase] = useState<"idle" | "exiting" | "entering">("idle");
  const [mindmapSearchTarget, setMindmapSearchTarget] = useState<MindmapSearchTarget | null>(null);
  const viewTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewTransitionFrameRef = useRef<number | null>(null);
  const viewTransitionTokenRef = useRef(0);
  const mindmapSearchRequestRef = useRef(0);

  useEffect(() => {
    const init = async () => {
      try {
        const restore = await restoreLatestHealthyWorkspaceIfNeeded();
        if (restore.shouldPrompt) {
          console.warn("[WebCollect] Emergency workspace restore candidate found", restore);
          setEmergencyRestorePrompt(restore);
        }
      } catch (error) {
        console.error("[WebCollect] Emergency workspace restore check failed", error);
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

  const handleCollectionViewModeChange = useCallback((mode: CollectionViewMode) => {
    setRequestedViewMode(mode);
    const token = ++viewTransitionTokenRef.current;
    if (viewTransitionTimerRef.current) clearTimeout(viewTransitionTimerRef.current);
    if (viewTransitionFrameRef.current !== null) cancelAnimationFrame(viewTransitionFrameRef.current);
    if (mode === collectionViewMode) {
      setViewTransitionPhase("idle");
      return;
    }
    setViewTransitionPhase("exiting");
    viewTransitionTimerRef.current = setTimeout(() => {
      if (viewTransitionTokenRef.current !== token) return;
      setCollectionViewMode(mode);
      setViewTransitionPhase("entering");
      viewTransitionFrameRef.current = requestAnimationFrame(() => {
        viewTransitionFrameRef.current = requestAnimationFrame(() => {
          if (viewTransitionTokenRef.current === token) setViewTransitionPhase("idle");
        });
      });
    }, 180);
  }, [collectionViewMode]);

  const handleRevealMindmapCategory = useCallback((target: { sectionId: string; categoryId: string }) => {
    setMindmapSearchTarget({ ...target, requestId: ++mindmapSearchRequestRef.current });
  }, []);

  useEffect(() => () => {
    if (viewTransitionTimerRef.current) clearTimeout(viewTransitionTimerRef.current);
    if (viewTransitionFrameRef.current !== null) cancelAnimationFrame(viewTransitionFrameRef.current);
  }, []);

  const handleConfirmEmergencyRestore = useCallback(async () => {
    const prompt = emergencyRestorePrompt;
    if (!prompt?.snapshotId) return;
    try {
      const restored = await restoreEmergencyWorkspaceSnapshot(prompt.snapshotId);
      console.warn("[WebCollect] Emergency workspace restore applied after confirmation", restored);
      setEmergencyRestorePrompt(null);
      await loadData({ showLoading: false });
    } catch (error) {
      console.error("[WebCollect] Emergency workspace restore failed", error);
      setEmergencyRestorePrompt(null);
    }
  }, [emergencyRestorePrompt, loadData]);

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
    <div className={`wc-resolution-viewport${collectionViewMode === "mindmap" ? " wc-resolution-viewport-mindmap" : ""}`}>
    <div className={`wc-resolution-canvas ${collectionViewMode === "classic" ? "min-h-screen" : "wc-resolution-canvas-header-only"}`}>
      <TopNav
        onAddCard={handleAddCard}
        onAddGroup={handleAddGroup}
        onAddCategory={handleAddCategory}
        onRecycleBin={() => setRecycleBinOpen(true)}
        onShowWallpaper={handleReturnToWallpaper}
        collectionViewMode={requestedViewMode}
        onCollectionViewModeChange={handleCollectionViewModeChange}
        onRevealMindmapCategory={handleRevealMindmapCategory}
      />

      {collectionViewMode === "classic" && <div className={`wc-collection-view is-${viewTransitionPhase}`} data-testid="collection-view-classic">
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
      </div>}
    </div>

      {collectionViewMode === "mindmap" && (
        <div className={`wc-collection-view is-${viewTransitionPhase}`} data-testid="collection-view-mindmap">
          <ErrorBoundary>
            <MindmapView searchTarget={mindmapSearchTarget} />
          </ErrorBoundary>
        </div>
      )}

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
      <AlertDialog
        open={!!emergencyRestorePrompt}
        onOpenChange={(open) => {
          if (!open) setEmergencyRestorePrompt(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>检测到布局可能异常</AlertDialogTitle>
            <AlertDialogDescription>
              可从 {formatSnapshotDate(emergencyRestorePrompt?.snapshotCreatedAt)} 的本地快照恢复：
              {emergencyRestorePrompt?.sections || 0} 个分项、{emergencyRestorePrompt?.categories || 0} 个分类、
              {emergencyRestorePrompt?.cards || 0} 个网页。取消不会修改任何数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>暂不恢复</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleConfirmEmergencyRestore(); }}>
              恢复快照
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </WallpaperShell>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { TopNav } from "@/components/nav/top-nav";
import { SortableGrid } from "@/components/layout/sortable-grid";
import { CardDialog } from "@/components/dialogs/card-dialog";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { RecycleBinDialog } from "@/components/dialogs/recycle-bin-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import { HotRecommendation } from "@/components/hot-recommendation";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { saveCards, saveCategories, setInitialized } from "@/lib/db";
import { defaultCards, defaultCategories } from "@/lib/seed";
import type { WebCard, Category } from "@/lib/types";

export default function HomePage() {
  const { loadData, isLoading, cards, categories, deleteCard, softDeleteCard, updateCard } = useAppStore();

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<WebCard | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>();
  const [isCreatingParent, setIsCreatingParent] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Initialize auth store first (restores session, triggers sync if logged in)
      await useAuthStore.getState().initialize();

      await loadData();
      const state = useAppStore.getState();
      if (!state.initialized) {
        await saveCategories(defaultCategories);
        await saveCards(defaultCards);
        await setInitialized();
        await loadData();
      }
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-serif">正在整理收藏夹...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        onAddCard={handleAddCard}
        onAddGroup={handleAddGroup}
        onAddCategory={handleAddCategory}
        onRecycleBin={() => setRecycleBinOpen(true)}
      />

      <main className="w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4">
        <ErrorBoundary>
          <SortableGrid
            onAddCard={handleAddCard}
            onEditCard={handleEditCard}
            onDeleteCard={(card) => softDeleteCard(card.id)}
            onEditCategory={handleEditCategory}
            onAddGroup={handleAddGroup}
            onUpdateCard={updateCard}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <HotRecommendation />
        </ErrorBoundary>
      </main>

      <footer className="border-t border-border/40 mt-4 py-4">
        <div className="px-3 sm:px-5 lg:px-6 text-center text-xs text-muted-foreground/60">
          <p className="font-serif">WebCollect — 你的个人网页收藏墙</p>
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
    </div>
  );
}

/**
 * NewTabApp - Root component for the Chrome Extension
 * 
 * Implements state-based routing between Main and Warehouse views.
 * Reuses the same components from the web version.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { useWarehouseStore } from "@/lib/store-warehouse";
import { saveCards, saveCategories, setInitialized } from "@/lib/db";
import { defaultCards, defaultCategories } from "@/lib/seed";
import { SortableGrid } from "@/components/layout/sortable-grid";
import { WarehouseGrid } from "@/components/layout/warehouse-grid";
import { TopNav } from "@/components/nav/top-nav";
import { HotRecommendation } from "@/components/hot-recommendation";
import { CardDialog } from "@/components/dialogs/card-dialog";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { RecycleBinDialog } from "@/components/dialogs/recycle-bin-dialog";
import { ImportDialog } from "@/components/dialogs/import-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import type { WebCard, Category } from "@/lib/types";

type View = "main" | "warehouse";

export function NewTabApp() {
  const [view, setView] = useState<View>("main");

  // ── Main page state ──
  const { loadData, isLoading, softDeleteCard, updateCard } = useAppStore();

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<WebCard | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>();
  const [isCreatingParent, setIsCreatingParent] = useState(false);

  // ── Warehouse state ──
  const { loadData: loadWarehouseData } = useWarehouseStore();

  // ── Load data on mount ──
  useEffect(() => {
    const init = async () => {
      await loadData();
      const state = useAppStore.getState();
      if (!state.initialized) {
        await saveCategories(defaultCategories);
        await saveCards(defaultCards);
        await setInitialized();
        await loadData();
      }
      await loadWarehouseData();
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Card handlers ──
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

  // ── Category handlers ──
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

  // ── Loading state ──
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
      {view === "main" ? (
        <>
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
        </>
      ) : (
        <>
          <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("main")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← 返回主页
                </button>
                <span className="text-lg font-serif font-semibold">仓库</span>
              </div>
              <button
                onClick={() => setImportDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                导入
              </button>
            </div>
          </nav>
          <main className="max-w-[1400px] mx-auto px-4 py-4">
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

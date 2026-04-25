"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/nav/top-nav";
import { CategoryTabs } from "@/components/nav/category-tabs";
import { SortableGrid } from "@/components/layout/sortable-grid";
import { CardDialog } from "@/components/dialogs/card-dialog";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { useAppStore } from "@/lib/store";
import { saveCards, saveCategories, setInitialized } from "@/lib/db";
import { defaultCards, defaultCategories } from "@/lib/seed";
import type { WebCard, Category } from "@/lib/types";

export default function HomePage() {
  const { loadData, initialized, isLoading } = useAppStore();

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<WebCard | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

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
    };
    init();
  }, [loadData]);

  const handleAddCard = () => {
    setEditingCard(null);
    setCardDialogOpen(true);
  };

  const handleEditCard = (card: WebCard) => {
    setEditingCard(card);
    setCardDialogOpen(true);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryDialogOpen(true);
  };

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
      <TopNav onAddCard={handleAddCard} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <CategoryTabs
          onAddCategory={handleAddCategory}
          onEditCategory={handleEditCategory}
        />
        <SortableGrid onEditCard={handleEditCard} />
      </main>

      <footer className="border-t border-border/60 mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p className="font-serif">WebCollect — 你的个人网页收藏墙</p>
          <p className="mt-1">数据仅存储在本地浏览器中</p>
        </div>
      </footer>

      <CardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        editingCard={editingCard}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        editingCategory={editingCategory}
      />
    </div>
  );
}

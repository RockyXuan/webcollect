"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { Category } from "@/lib/types";
import { getLucideIcon } from "@/lib/icons";

interface CategoryTabsProps {
  onAddCategory: () => void;
  onEditCategory: (cat: Category) => void;
}

export function CategoryTabs({ onAddCategory, onEditCategory }: CategoryTabsProps) {
  const { categories, activeCategoryId, setActiveCategory, deleteCategory } = useAppStore();
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Category | null>(null);

  const getIcon = getLucideIcon;

  const allCategories = [{ id: "all", name: "全部", icon: "layout-grid", color: "", order: -1, createdAt: 0 }, ...categories];

  return (
    <>
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {allCategories.map((cat) => {
        const IconEl = getIcon(cat.icon || "circle");
        const isActive = activeCategoryId === cat.id;
        const isHovered = hoveredCat === cat.id;

        return (
          <div
            key={cat.id}
            className="relative shrink-0"
            onMouseEnter={() => setHoveredCat(cat.id)}
            onMouseLeave={() => setHoveredCat(null)}
          >
            <button
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-card-foreground border-border hover:border-muted-foreground/40 hover:shadow-sm"
              )}
            >
              <IconEl className="w-4 h-4" />
              <span>{cat.name}</span>
            </button>

            {/* Hover actions for custom categories */}
            {isHovered && cat.id !== "all" && (
              <div className="absolute -top-2 -right-2 flex gap-0.5 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCategory(cat);
                  }}
                  className="p-1 rounded-full bg-secondary text-secondary-foreground shadow-sm hover:scale-110 transition-transform"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteCandidate(cat as Category);
                  }}
                  className="p-1 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:scale-110 transition-transform"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        onClick={onAddCategory}
        className="shrink-0 gap-1 text-muted-foreground hover:text-foreground"
      >
        <Plus className="w-4 h-4" />
        分类
      </Button>
    </div>
    <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => {
      if (!open) setDeleteCandidate(null);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除分类「{deleteCandidate?.name}」？</AlertDialogTitle>
          <AlertDialogDescription>
            其中的卡片将被保留，但会变为未分类。这个操作不会删除网页卡片。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (deleteCandidate) deleteCategory(deleteCandidate.id);
              setDeleteCandidate(null);
            }}
          >
            确定
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

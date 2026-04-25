"use client";

import React, { useCallback } from "react";
import { Plus, LayoutGrid, Pencil, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface TopNavProps {
  onAddCard: (categoryId?: string) => void;
  onManageCategories: () => void;
}

export function TopNav({ onAddCard, onManageCategories }: TopNavProps) {
  const { editMode, toggleEditMode, searchQuery, setSearchQuery } = useAppStore();

  const handleAdd = useCallback(() => {
    onAddCard();
  }, [onAddCard]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-3 sm:px-5 lg:px-6 h-12">
        {/* Logo */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <LayoutGrid className="w-4 h-4 text-primary" />
          <span className="font-serif text-base font-bold tracking-tight">WebCollect</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索网站..."
            className="w-full h-7 px-2.5 text-xs rounded-md border border-border/60 bg-muted/30 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">添加网页</span>
          </button>

          <button
            onClick={onManageCategories}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-border/60 hover:bg-muted/50 transition-colors"
          >
            <span className="hidden sm:inline">添加分类</span>
          </button>

          <button
            onClick={toggleEditMode}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border transition-colors",
              editMode
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 hover:bg-muted/50"
            )}
          >
            {editMode ? (
              <>
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">完成</span>
              </>
            ) : (
              <>
                <Pencil className="w-3 h-3" />
                <span className="hidden sm:inline">编辑</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

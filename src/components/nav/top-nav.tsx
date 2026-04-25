"use client";

import { useAppStore } from "@/lib/store";
import { Plus, FolderPlus, Layers, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopNavProps {
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  onAddCategory?: () => void;
}

export function TopNav({ onAddCard, onAddGroup, onAddCategory }: TopNavProps) {
  const { editMode, toggleEditMode, searchQuery, setSearchQuery } =
    useAppStore();

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between px-4 h-12">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg font-bold text-foreground">
            WebCollect
          </span>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-xs mx-4">
          <input
            type="text"
            placeholder="搜索网站..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Right: Add buttons + Edit toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => onAddCard?.()}
            className="h-7 text-xs gap-1 px-2"
          >
            <Plus className="h-3 w-3" />
            添加网页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddGroup?.()}
            className="h-7 text-xs gap-1 px-2"
          >
            <Layers className="h-3 w-3" />
            添加分组
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddCategory?.()}
            className="h-7 text-xs gap-1 px-2"
          >
            <FolderPlus className="h-3 w-3" />
            添加分类
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={toggleEditMode}
            className="h-7 text-xs gap-1 px-2"
          >
            <Pencil className="h-3 w-3" />
            编辑
          </Button>
        </div>
      </div>
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Plus, FolderPlus, Layers, Package, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformLink } from "@/components/ui/platform-link";
import { SyncStatusBadge, UserMenu } from "@/components/auth/user-menu";

interface TopNavProps {
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  onAddCategory?: () => void;
  onRecycleBin?: () => void;
  onWarehouse?: () => void;
}

export function TopNav({ onAddCard, onAddGroup, onAddCategory, onRecycleBin, onWarehouse }: TopNavProps) {
  const {
    searchQuery,
    setSearchQuery,
    visualScale,
    sections,
    activeSectionId,
    setActiveSection,
    addSection,
    updateSection,
    deleteSection,
    editMode,
    loadData,
  } = useAppStore();
  const recycleBinCount = useAppStore((s) => s.recycleBin.length);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = `${visualScale}%`;
  }, [visualScale]);

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
      `删除分项“${sectionName}”？为防止丢数据，只会删除这个页签，里面的分类、分组和网页会移到首页。`
    );
    if (ok) void deleteSection(sectionId);
  };

  const handleRefreshLocalView = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

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
          <SyncStatusBadge />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshLocalView}
            disabled={isRefreshing}
            className="h-7 text-xs gap-1 px-2"
            title={"\u5237\u65b0\u672c\u5730\u89c6\u56fe"}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
            {"\u5237\u65b0"}
          </Button>
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
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 px-2 relative"
            onClick={() => onRecycleBin?.()}
          >
            <Trash2 className="h-3 w-3" />
            回收站
            {recycleBinCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center rounded-full">
                {recycleBinCount}
              </span>
            )}
          </Button>
          {onWarehouse ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 px-2"
              onClick={() => onWarehouse()}
            >
              <Package className="h-3 w-3" />
              仓库
            </Button>
          ) : (
            <PlatformLink href="/warehouse">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 px-2"
              >
                <Package className="h-3 w-3" />
                仓库
              </Button>
            </PlatformLink>
          )}
          <div className="w-px h-5 bg-border mx-1" />
          <UserMenu />
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto border-t border-border/40 bg-background/70">
        {sections.map((section) => {
          const active = section.id === activeSectionId;
          const canDelete = section.id !== "section-default";
          return (
            <div key={section.id} className="flex shrink-0 items-center gap-0.5">
              <Button
                variant={active ? "default" : "outline"}
                size="sm"
                className="h-7 shrink-0 rounded-md px-3 text-xs"
                onClick={() => void setActiveSection(section.id)}
                title={section.name}
              >
                {section.name}
              </Button>
              {editMode && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-primary"
                    onClick={() => handleRenameSection(section.id, section.name)}
                    title="重命名分项"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteSection(section.id, section.name)}
                      title="删除分项"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleAddSection}
          title="添加分项"
        >
          <Plus className="h-3 w-3 mr-1" />
          分项
        </Button>
      </div>
    </nav>
  );
}

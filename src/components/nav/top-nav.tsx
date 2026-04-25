"use client";

import { Search, Plus, Download, Upload, FolderCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { exportData, importData } from "@/lib/db";

interface TopNavProps {
  onAddCard: () => void;
  onManageCategories?: () => void;
}

export function TopNav({ onAddCard, onManageCategories }: TopNavProps) {
  const { searchQuery, setSearchQuery, editMode, setEditMode } = useAppStore();

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webcollect-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importData(data);
        window.location.reload();
      } catch {
        alert("导入失败，请检查文件格式");
      }
    };
    input.click();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="flex items-center justify-between h-14 px-3 sm:px-5 lg:px-6 gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-serif font-bold text-sm">W</span>
          </div>
          <h1 className="font-serif text-lg font-semibold text-foreground hidden sm:block tracking-tight">
            WebCollect
          </h1>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索网站..."
            className="pl-8 h-8 text-sm bg-muted/40 border-muted-foreground/15 focus:border-primary/40"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleImport} title="导入数据">
            <Upload className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleExport} title="导出数据">
            <Download className="w-3.5 h-3.5" />
          </Button>
          {onManageCategories && (
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onManageCategories} title="管理分类">
              <FolderCog className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className="h-8 text-xs gap-1"
          >
            <PencilIcon className="w-3 h-3" />
            {editMode ? "退出编辑" : "编辑"}
          </Button>
          <Button onClick={onAddCard} size="sm" className="h-8 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">添加</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* Inline small icon component to avoid import conflict */
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

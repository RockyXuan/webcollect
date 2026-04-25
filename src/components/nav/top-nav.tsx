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
  const { searchQuery, setSearchQuery } = useAppStore();

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
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between h-16 px-4 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-serif font-bold text-lg">W</span>
          </div>
          <h1 className="font-serif text-xl font-semibold hidden sm:block">WebCollect</h1>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索网站..."
            className="pl-9 bg-muted/50 border-muted-foreground/20"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={handleImport} title="导入数据">
            <Upload className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport} title="导出数据">
            <Download className="w-4 h-4" />
          </Button>
          {onManageCategories && (
            <Button variant="ghost" size="icon" onClick={onManageCategories} title="管理分类">
              <FolderCog className="w-4 h-4" />
            </Button>
          )}
          <Button onClick={onAddCard} className="gap-1">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">添加</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

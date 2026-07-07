"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { WarehouseGrid } from "@/components/layout/warehouse-grid";
import { ImportDialog } from "@/components/dialogs/import-dialog";
import { useWarehouseStore } from "@/lib/store-warehouse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Package,
  Upload,
  Trash2,
  ArrowLeft,
  Home,
  Clock,
  FileText,
  RefreshCw,
  XCircle,
} from "lucide-react";

export default function WarehousePage() {
  const {
    loadData,
    isLoading,
    batches,
    selectedBatchId,
    setSelectedBatch,
    deleteBatch,
    clearAllWarehouse,
    deleteExistingWarehouseItems,
    cards,
    categories,
  } = useWarehouseStore();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState("");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 250);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Batch stats
  const batchStats = React.useMemo(() => {
    const stats: Record<string, { cats: number; cards: number }> = {};
    for (const batch of batches) {
      const batchCats = categories.filter((c) => c.importBatchId === batch.id);
      const batchCards = cards.filter((c) => c.importBatchId === batch.id);
      stats[batch.id] = { cats: batchCats.length, cards: batchCards.length };
    }
    return stats;
  }, [batches, categories, cards]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-serif">正在加载仓库...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-serif text-lg font-bold text-foreground">仓库</span>
            </div>
            {batches.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {batches.length} 次导入
              </Badge>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 px-2"
              disabled={isRefreshing}
              onClick={handleRefresh}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 px-2"
              disabled={cards.length === 0}
              onClick={async () => {
                const removed = await deleteExistingWarehouseItems();
                if (removed === 0) {
                  setNotice("没有找到已存在或重复的仓库网页。");
                } else {
                  setNotice(`已删除 ${removed} 个已存在或重复的仓库网页。`);
                }
              }}
            >
              <XCircle className="h-3 w-3" />
              删除已存在
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1 px-2"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="h-3 w-3" />
              导入
            </Button>
            {batches.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                    清空仓库
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清空仓库</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作将删除仓库中所有导入的书签和分类数据，且不可恢复。主页数据不受影响。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        await clearAllWarehouse();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="w-px h-5 bg-border mx-1" />
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {notice && (
        <div className="mx-4 mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          {notice}
        </div>
      )}

      <main className="w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4">
        {/* Batch filter tabs */}
        {batches.length > 1 && (
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !selectedBatchId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setSelectedBatch(null)}
            >
              全部
            </button>
            {batches.map((batch) => (
              <button
                key={batch.id}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  selectedBatchId === batch.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setSelectedBatch(batch.id)}
              >
                <FileText className="h-3 w-3" />
                {batch.sourceFileName}
                <span className="opacity-60">
                  ({batchStats[batch.id]?.cards ?? 0})
                </span>
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBatch(batch.id);
                  }}
                  title="删除此批次"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </button>
            ))}
          </div>
        )}

        {/* Single batch info bar */}
        {batches.length === 1 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <FileText className="h-3 w-3" />
            <span>{batches[0].sourceFileName}</span>
            <span className="opacity-50">|</span>
            <Clock className="h-3 w-3" />
            <span>{new Date(batches[0].importedAt).toLocaleString("zh-CN")}</span>
            <span className="opacity-50">|</span>
            <span>{batchStats[batches[0].id]?.cards ?? 0} 个书签</span>
            <div className="flex-1" />
            <button
              className="text-destructive hover:text-destructive/80 flex items-center gap-1"
              onClick={() => deleteBatch(batches[0].id)}
            >
              <Trash2 className="h-3 w-3" />
              删除此批次
            </button>
          </div>
        )}

        {/* Grid */}
        <WarehouseGrid />
      </main>

      {/* Import Dialog */}
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}

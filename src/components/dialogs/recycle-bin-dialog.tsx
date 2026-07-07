"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, FolderOpen, FileText } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { RecycleBinItem } from "@/lib/types";

interface RecycleBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecycleBinDialog({ open, onOpenChange }: RecycleBinDialogProps) {
  const recycleBin = useAppStore((s) => s.recycleBin);
  const loadRecycleBin = useAppStore((s) => s.loadRecycleBin);
  const restoreFromBin = useAppStore((s) => s.restoreFromBin);
  const permanentDelete = useAppStore((s) => s.permanentDelete);
  const emptyBin = useAppStore((s) => s.emptyBin);

  useEffect(() => {
    if (open) {
      void loadRecycleBin();
    }
  }, [open, loadRecycleBin]);

  const handleRestore = async (id: string) => {
    await restoreFromBin(id);
  };

  const handlePermanentDelete = async (id: string) => {
    await permanentDelete(id);
  };

  const handleEmptyBin = async () => {
    await emptyBin();
  };

  const getTypeLabel = (item: RecycleBinItem) => {
    if (item.type === "category") return "分类";
    if (item.type === "group") return "分组";
    return "网页";
  };

  const getTypeIcon = (item: RecycleBinItem) => {
    if (item.type === "category" || item.type === "group")
      return <FolderOpen className="w-4 h-4 text-muted-foreground" />;
    return <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            回收站
          </DialogTitle>
          <DialogDescription>
            删除的分类、分组和网页会暂存在这里。您可以恢复或永久删除。
          </DialogDescription>
        </DialogHeader>

        {recycleBin.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            回收站是空的
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    清空回收站
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清空回收站？</AlertDialogTitle>
                    <AlertDialogDescription>
                      所有回收站中的内容将被永久删除，此操作不可恢复。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void handleEmptyBin()}
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {recycleBin.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded-md border bg-card"
                >
                  {getTypeIcon(item)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                        {getTypeLabel(item)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.type === "category" && `含 ${item.categories.length - 1} 个分组、${item.cards.length} 个网页`}
                      {item.type === "group" && `含 ${item.cards.length} 个网页`}
                      {item.type === "card" && item.cards[0]?.url?.slice(0, 40)}
                      {" · "}
                      {new Date(item.deletedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => void handleRestore(item.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      恢复
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>永久删除「{item.name}」？</AlertDialogTitle>
                          <AlertDialogDescription>
                            此操作不可恢复，该内容将从回收站中永久删除。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handlePermanentDelete(item.id)}
                          >
                            永久删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

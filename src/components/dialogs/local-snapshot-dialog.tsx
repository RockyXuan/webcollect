"use client";

import { useEffect, useState } from "react";
import { Clock3, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createLocalDataSnapshot,
  getLocalDataSnapshots,
  restoreLocalDataSnapshot,
  type LocalSnapshotEntry,
} from "@/lib/local-snapshots";
import { useAppStore } from "@/lib/store";

interface LocalSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatSnapshotTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCounts(snapshot: LocalSnapshotEntry): string {
  const { counts } = snapshot;
  return `${counts.sections} \u5206\u9879 / ${counts.categories} \u5206\u7c7b\u5206\u7ec4 / ${counts.cards} \u7f51\u9875 / \u4ed3\u5e93 ${counts.warehouseCards}`;
}

export function LocalSnapshotDialog({ open, onOpenChange }: LocalSnapshotDialogProps) {
  const [snapshots, setSnapshots] = useState<LocalSnapshotEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      setSnapshots(await getLocalDataSnapshots());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadSnapshots();
    }
  }, [open]);

  const handleSaveNow = async () => {
    setSaving(true);
    try {
      await createLocalDataSnapshot("manual-snapshot", "\u624b\u52a8\u4fdd\u5b58\u5f53\u524d\u7248\u672c", { force: true });
      await loadSnapshots();
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (snapshot: LocalSnapshotEntry) => {
    const ok = window.confirm(
      `\u6062\u590d\u5230 ${formatSnapshotTime(snapshot.createdAt)} \u7684\u672c\u5730\u7248\u672c\uff1f\u5f53\u524d\u7248\u672c\u4f1a\u5148\u81ea\u52a8\u5907\u4efd\u3002`
    );
    if (!ok) return;
    setRestoringId(snapshot.id);
    try {
      await restoreLocalDataSnapshot(snapshot.id);
      await useAppStore.getState().loadData();
      onOpenChange(false);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{"\u7248\u672c\u56de\u6863"}</DialogTitle>
          <DialogDescription>
            {"\u672c\u5730\u4fdd\u7559\u6700\u8fd1\u7684\u5b8c\u6574\u6570\u636e\u7248\u672c\u3002\u6062\u590d\u524d\u4f1a\u518d\u81ea\u52a8\u5907\u4efd\u4e00\u6b21\u5f53\u524d\u72b6\u6001\uff0c\u907f\u514d\u4e8c\u6b21\u4e22\u5931\u3002"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {"\u8986\u76d6\u8303\u56f4\uff1a\u5206\u9879\u3001\u5206\u7c7b\u3001\u5206\u7ec4\u3001\u7f51\u9875\u3001\u56de\u6536\u7ad9\u3001\u4ed3\u5e93\u548c\u504f\u597d\u8bbe\u7f6e\u3002"}
          </p>
          <Button variant="outline" size="sm" onClick={handleSaveNow} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {"\u4fdd\u5b58\u5f53\u524d\u7248\u672c"}
          </Button>
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              {"\u6b63\u5728\u8bfb\u53d6\u672c\u5730\u7248\u672c..."}
            </div>
          ) : snapshots.length === 0 ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              {"\u8fd8\u6ca1\u6709\u53ef\u56de\u6863\u7248\u672c\u3002\u4e4b\u540e\u6bcf\u6b21\u540c\u6b65\u6216\u624b\u52a8\u4fdd\u5b58\u90fd\u4f1a\u751f\u6210\u7248\u672c\u3002"}
            </div>
          ) : (
            snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{formatSnapshotTime(snapshot.createdAt)}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {snapshot.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatCounts(snapshot)}</p>
                    {snapshot.sectionNames.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {"\u5206\u9879\uff1a"}
                        {snapshot.sectionNames.join("\u3001")}
                      </p>
                    )}
                    {snapshot.sampleCategoryNames.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {"\u5206\u7c7b\uff1a"}
                        {snapshot.sampleCategoryNames.join("\u3001")}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleRestore(snapshot)}
                    disabled={restoringId === snapshot.id}
                    className="shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {"\u6062\u590d"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {"\u5173\u95ed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

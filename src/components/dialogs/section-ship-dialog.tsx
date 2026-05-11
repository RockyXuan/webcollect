"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { Category, WebCard } from "@/lib/types";

type ShipItem =
  | { type: "category"; category: Category }
  | { type: "card"; card: WebCard };

interface SectionShipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ShipItem | null;
}

export function SectionShipDialog({ open, onOpenChange, item }: SectionShipDialogProps) {
  const {
    sections,
    activeSectionId,
    categories,
    moveCategoryToSection,
    moveCardToSection,
  } = useAppStore();

  const [targetSectionId, setTargetSectionId] = useState("");
  const [targetCategoryId, setTargetCategoryId] = useState("");

  const availableSections = useMemo(
    () => sections.filter((section) => section.id !== activeSectionId),
    [sections, activeSectionId]
  );

  const targetCategories = useMemo(
    () =>
      categories
        .filter((category) => (category.sectionId || "section-default") === targetSectionId)
        .filter((category) => !category.isParent)
        .sort((a, b) => a.order - b.order),
    [categories, targetSectionId]
  );

  useEffect(() => {
    if (!open) return;
    setTargetSectionId(availableSections[0]?.id || "");
    setTargetCategoryId("");
  }, [open, availableSections]);

  useEffect(() => {
    if (item?.type !== "card") return;
    setTargetCategoryId(targetCategories[0]?.id || "");
  }, [item?.type, targetCategories]);

  const itemName = item?.type === "category" ? item.category.name : item?.card.title;

  const handleShip = async () => {
    if (!item || !targetSectionId) return;
    if (item.type === "category") {
      await moveCategoryToSection(item.category.id, targetSectionId);
    } else {
      await moveCardToSection(item.card.id, targetSectionId, targetCategoryId || undefined);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            飞到其他分项
          </DialogTitle>
          <DialogDescription>
            将“{itemName || ""}”移动到另一个分项。不会删除网页数据。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">目标分项</div>
            {availableSections.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableSections.map((section) => {
                  const selected = targetSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setTargetSectionId(section.id)}
                      className={cn(
                        "flex min-h-11 items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <span className="truncate">{section.name}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                还没有其他分项。先在顶部新增一个分项后再移动。
              </div>
            )}
          </div>

          {item?.type === "card" && (
            <div className="space-y-2">
              <div className="text-sm font-medium">目标分组</div>
              {targetCategories.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {targetCategories.map((category) => {
                    const selected = targetCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setTargetCategoryId(category.id)}
                        className={cn(
                          "flex min-h-10 items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-1 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="truncate">{category.name}</span>
                        </span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                  目标分项没有可用分组时，会自动放入“收集箱”。
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleShip} disabled={!targetSectionId}>
            <Send className="h-4 w-4 mr-1" />
            确认飞过去
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

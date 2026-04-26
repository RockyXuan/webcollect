"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, Plus, CheckCircle } from "lucide-react";
import { useWarehouseStore } from "@/lib/store-warehouse";
import { useAppStore } from "@/lib/store";
import type { WarehouseCategory, WarehouseCard } from "@/lib/db-warehouse";
import { addCard as dbAddCard, addCategory as dbAddCategory } from "@/lib/db";

interface ShipToMainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseCategory: WarehouseCategory;
  subGroups: WarehouseCategory[];
  allCards: WarehouseCard[];
}

export function ShipToMainDialog({
  open,
  onOpenChange,
  warehouseCategory,
  subGroups,
  allCards,
}: ShipToMainDialogProps) {
  const { shipToMain } = useWarehouseStore();
  const { loadData: loadMainData } = useAppStore();

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<"new" | "existing">("new");
  const [selectedMainCatId, setSelectedMainCatId] = useState<string>("");

  const mainCategories = useAppStore((s) => s.categories);
  const parentMainCats = useMemo(
    () => mainCategories.filter((c) => !c.parentId && (c.isParent || mainCategories.some((sg) => sg.parentId === c.id))),
    [mainCategories]
  );

  // Count cards in this warehouse category
  const cardCount = useMemo(() => {
    const catIds = [warehouseCategory.id, ...subGroups.map((sg) => sg.id)];
    return allCards.filter((c) => catIds.includes(c.categoryId)).length;
  }, [warehouseCategory, subGroups, allCards]);

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      let mainCatId: string;

      if (targetMode === "existing" && selectedMainCatId) {
        mainCatId = selectedMainCatId;
      } else {
        // Create a new parent category on the main page
        const newCatId = `cat-${Date.now()}`;
        const newCat = {
          id: newCatId,
          name: warehouseCategory.name,
          icon: warehouseCategory.icon,
          color: warehouseCategory.color,
          order: mainCategories.length,
          createdAt: Date.now(),
          isParent: true,
        };
        await dbAddCategory(newCat);
        mainCatId = newCatId;
      }

      // Ship from warehouse to main
      const result = await shipToMain(warehouseCategory.id, mainCatId);

      // Add shipped categories and cards to main page DB
      for (const cat of result.categories) {
        // Skip the parent we just created
        if (cat.id === mainCatId) continue;
        await dbAddCategory(cat);
      }
      for (const card of result.cards) {
        await dbAddCard(card);
      }

      // Reload main page data
      await loadMainData();
      setShipped(true);
    } catch (err) {
      console.error("Ship failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseCategory, mainCategories, shipToMain, loadMainData]);

  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      setShipped(false);
      setShipping(false);
      setTargetMode("new");
      setSelectedMainCatId("");
    }
    onOpenChange(open);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            发货到主页
          </DialogTitle>
          <DialogDescription>
            将仓库中的分类及其所有书签发送到主页
          </DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="p-3 rounded-md bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: warehouseCategory.color }} />
                <span className="font-medium text-foreground">{warehouseCategory.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                包含 {subGroups.length} 个分组，{cardCount} 个书签
              </div>
            </div>

            {/* Target mode */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">发送到</div>
              <div className="space-y-2">
                <button
                  className={`w-full p-3 rounded-md border text-left transition-colors ${
                    targetMode === "new"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setTargetMode("new")}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">新建分类</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    在主页创建一个新的顶级分类
                  </p>
                </button>
                {parentMainCats.length > 0 && (
                  <button
                    className={`w-full p-3 rounded-md border text-left transition-colors ${
                      targetMode === "existing"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setTargetMode("existing")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Send className="h-4 w-4" />
                      <span className="text-sm font-medium">合并到已有分类</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      将书签合并到主页已有分类中
                    </p>
                  </button>
                )}
              </div>

              {targetMode === "existing" && (
                <div className="space-y-1 pl-2">
                  {parentMainCats.map((cat) => (
                    <button
                      key={cat.id}
                      className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                        selectedMainCatId === cat.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedMainCatId(cat.id)}
                    >
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">发货成功</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cardCount} 个书签已发送到主页
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!shipped ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                onClick={handleShip}
                disabled={shipping || (targetMode === "existing" && !selectedMainCatId)}
              >
                {shipping ? (
                  <>
                    <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
                    发货中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    确认发货
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

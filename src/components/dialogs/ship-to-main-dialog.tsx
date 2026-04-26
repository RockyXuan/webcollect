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

/* ── Shared target selector logic ── */

function useMainCategories() {
  const mainCategories = useAppStore((s) => s.categories);
  const parentMainCats = useMemo(
    () => mainCategories.filter((c) => !c.parentId && (c.isParent || mainCategories.some((sg) => sg.parentId === c.id))),
    [mainCategories]
  );
  const allMainCats = useMemo(
    () => mainCategories.filter((c) => !c.isParent),
    [mainCategories]
  );
  return { parentMainCats, allMainCats, mainCategories };
}

function TargetSelector({
  targetMode,
  setTargetMode,
  selectedMainCatId,
  setSelectedMainCatId,
  parentMainCats,
  allMainCats,
  allowExistingSubGroup,
}: {
  targetMode: "new" | "existing" | "existing_sub";
  setTargetMode: (m: "new" | "existing" | "existing_sub") => void;
  selectedMainCatId: string;
  setSelectedMainCatId: (id: string) => void;
  parentMainCats: ReturnType<typeof useMainCategories>["parentMainCats"];
  allMainCats: ReturnType<typeof useMainCategories>["allMainCats"];
  allowExistingSubGroup?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">发送到</div>
      <div className="space-y-2">
        <button
          className={`w-full p-3 rounded-md border text-left transition-colors ${
            targetMode === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => setTargetMode("new")}
        >
          <div className="flex items-center gap-2 mb-1">
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">新建分组</span>
          </div>
          <p className="text-[11px] text-muted-foreground">在主页创建一个新的分组</p>
        </button>

        {parentMainCats.length > 0 && (
          <button
            className={`w-full p-3 rounded-md border text-left transition-colors ${
              targetMode === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => setTargetMode("existing")}
          >
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4" />
              <span className="text-sm font-medium">合并到已有分类下</span>
            </div>
            <p className="text-[11px] text-muted-foreground">将书签合并到主页已有分类中作为子分组</p>
          </button>
        )}

        {allowExistingSubGroup && allMainCats.length > 0 && (
          <button
            className={`w-full p-3 rounded-md border text-left transition-colors ${
              targetMode === "existing_sub" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => setTargetMode("existing_sub")}
          >
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4" />
              <span className="text-sm font-medium">放入已有分组</span>
            </div>
            <p className="text-[11px] text-muted-foreground">将书签直接添加到主页已有分组中</p>
          </button>
        )}
      </div>

      {targetMode === "existing" && (
        <div className="space-y-1 pl-2">
          {parentMainCats.map((cat) => (
            <button
              key={cat.id}
              className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                selectedMainCatId === cat.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              }`}
              onClick={() => setSelectedMainCatId(cat.id)}
            >
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {targetMode === "existing_sub" && (
        <div className="space-y-1 pl-2 max-h-48 overflow-y-auto">
          {allMainCats.map((cat) => (
            <button
              key={cat.id}
              className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                selectedMainCatId === cat.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              }`}
              onClick={() => setSelectedMainCatId(cat.id)}
            >
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
              {cat.parentId ? (
                <span className="text-muted-foreground text-[10px]">
                  {parentMainCats.find((p) => p.id === cat.parentId)?.name}/
                </span>
              ) : null}
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Ship Parent Category Dialog (existing) ── */

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
  const { parentMainCats, mainCategories } = useMainCategories();

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<"new" | "existing" | "existing_sub">("new");
  const [selectedMainCatId, setSelectedMainCatId] = useState<string>("");

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

      const result = await shipToMain(warehouseCategory.id, mainCatId);

      for (const cat of result.categories) {
        if (cat.id === mainCatId) continue;
        await dbAddCategory(cat);
      }
      for (const card of result.cards) {
        await dbAddCard(card);
      }

      await loadMainData();
      setShipped(true);
    } catch (err) {
      console.error("Ship failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseCategory, mainCategories, shipToMain, loadMainData]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setShipped(false);
        setShipping(false);
        setTargetMode("new");
        setSelectedMainCatId("");
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            发货到主页
          </DialogTitle>
          <DialogDescription>将仓库中的分类及其所有书签发送到主页</DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-md bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: warehouseCategory.color }} />
                <span className="font-medium text-foreground">{warehouseCategory.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                包含 {subGroups.length} 个分组，{cardCount} 个书签
              </div>
            </div>

            <TargetSelector
              targetMode={targetMode}
              setTargetMode={setTargetMode}
              selectedMainCatId={selectedMainCatId}
              setSelectedMainCatId={setSelectedMainCatId}
              parentMainCats={parentMainCats}
              allMainCats={[]}
            />
          </div>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">发货成功</p>
              <p className="text-sm text-muted-foreground mt-1">{cardCount} 个书签已发送到主页</p>
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
            <Button onClick={() => handleClose(false)}>完成</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Ship Sub-Group Dialog ── */

interface ShipToMainSubGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseSubGroup: WarehouseCategory;
  cards: WarehouseCard[];
}

export function ShipToMainSubGroupDialog({
  open,
  onOpenChange,
  warehouseSubGroup,
  cards,
}: ShipToMainSubGroupDialogProps) {
  const { shipSubGroupToMain } = useWarehouseStore();
  const { loadData: loadMainData } = useAppStore();
  const { parentMainCats, mainCategories } = useMainCategories();

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<"new" | "existing" | "existing_sub">("new");
  const [selectedMainCatId, setSelectedMainCatId] = useState<string>("");

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      if (targetMode === "existing" && selectedMainCatId) {
        // Ship as sub-group under existing parent category
        const result = await shipSubGroupToMain(warehouseSubGroup.id, selectedMainCatId);
        await dbAddCategory(result.category);
        for (const card of result.cards) {
          await dbAddCard(card);
        }
      } else {
        // Create a new parent category on main page
        const newParentId = `cat-${Date.now()}`;
        const newParent = {
          id: newParentId,
          name: warehouseSubGroup.name,
          icon: warehouseSubGroup.icon,
          color: warehouseSubGroup.color,
          order: mainCategories.length,
          createdAt: Date.now(),
          isParent: true,
        };
        await dbAddCategory(newParent);

        const result = await shipSubGroupToMain(warehouseSubGroup.id, newParentId);
        await dbAddCategory(result.category);
        for (const card of result.cards) {
          await dbAddCard(card);
        }
      }

      await loadMainData();
      setShipped(true);
    } catch (err) {
      console.error("Ship sub-group failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseSubGroup, mainCategories, shipSubGroupToMain, loadMainData]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setShipped(false);
        setShipping(false);
        setTargetMode("new");
        setSelectedMainCatId("");
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            发送分组到主页
          </DialogTitle>
          <DialogDescription>将仓库中的分组及其 {cards.length} 个书签发送到主页</DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-md bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: warehouseSubGroup.color }} />
                <span className="font-medium text-foreground">{warehouseSubGroup.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">{cards.length} 个书签</div>
            </div>

            <TargetSelector
              targetMode={targetMode}
              setTargetMode={setTargetMode}
              selectedMainCatId={selectedMainCatId}
              setSelectedMainCatId={setSelectedMainCatId}
              parentMainCats={parentMainCats}
              allMainCats={[]}
            />
          </div>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">发送成功</p>
              <p className="text-sm text-muted-foreground mt-1">{cards.length} 个书签已发送到主页</p>
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
                    发送中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    确认发送
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>完成</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Ship Single Card Dialog ── */

interface ShipToMainCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseCard: WarehouseCard;
}

export function ShipToMainCardDialog({
  open,
  onOpenChange,
  warehouseCard,
}: ShipToMainCardDialogProps) {
  const { shipCardToMain } = useWarehouseStore();
  const { loadData: loadMainData } = useAppStore();
  const { parentMainCats, allMainCats, mainCategories } = useMainCategories();

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<"new" | "existing" | "existing_sub">("existing_sub");
  const [selectedMainCatId, setSelectedMainCatId] = useState<string>("");

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      if (targetMode === "existing_sub" && selectedMainCatId) {
        // Add card to existing sub-group
        const mainCard = await shipCardToMain(warehouseCard.id, selectedMainCatId);
        await dbAddCard(mainCard);
      } else if (targetMode === "existing" && selectedMainCatId) {
        // Create new sub-group under existing parent, then add card
        const newSubId = `cat-${Date.now()}`;
        const newSub = {
          id: newSubId,
          name: warehouseCard.title,
          icon: "BookMarked",
          color: "#888888",
          order: mainCategories.filter((c) => c.parentId === selectedMainCatId).length,
          createdAt: Date.now(),
          parentId: selectedMainCatId,
        };
        await dbAddCategory(newSub);
        const mainCard = await shipCardToMain(warehouseCard.id, newSubId);
        await dbAddCard(mainCard);
      } else {
        // New standalone category
        const newCatId = `cat-${Date.now()}`;
        const newCat = {
          id: newCatId,
          name: warehouseCard.title,
          icon: "BookMarked",
          color: "#888888",
          order: mainCategories.length,
          createdAt: Date.now(),
        };
        await dbAddCategory(newCat);
        const mainCard = await shipCardToMain(warehouseCard.id, newCatId);
        await dbAddCard(mainCard);
      }

      await loadMainData();
      setShipped(true);
    } catch (err) {
      console.error("Ship card failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseCard, mainCategories, shipCardToMain, loadMainData]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setShipped(false);
        setShipping(false);
        setTargetMode("existing_sub");
        setSelectedMainCatId("");
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            发送书签到主页
          </DialogTitle>
          <DialogDescription>将&ldquo;{warehouseCard.title}&rdquo;发送到主页</DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <TargetSelector
              targetMode={targetMode}
              setTargetMode={setTargetMode}
              selectedMainCatId={selectedMainCatId}
              setSelectedMainCatId={setSelectedMainCatId}
              parentMainCats={parentMainCats}
              allMainCats={allMainCats}
              allowExistingSubGroup
            />
          </div>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">发送成功</p>
              <p className="text-sm text-muted-foreground mt-1">
                &ldquo;{warehouseCard.title}&rdquo;已发送到主页
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
                disabled={
                  shipping ||
                  (targetMode === "existing" && !selectedMainCatId) ||
                  (targetMode === "existing_sub" && !selectedMainCatId)
                }
              >
                {shipping ? (
                  <>
                    <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
                    发送中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    确认发送
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>完成</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

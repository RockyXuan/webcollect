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
import { Send, Inbox, Layers, CheckCircle } from "lucide-react";
import { useWarehouseStore } from "@/lib/store-warehouse";
import { useAppStore } from "@/lib/store";
import type { WarehouseCategory, WarehouseCard } from "@/lib/db-warehouse";
import { addCard as dbAddCard, addCategory as dbAddCategory } from "@/lib/db";

/* ── Shared logic: get main page parent categories ── */

function useMainParentCategories() {
  const mainCategories = useAppStore((s) => s.categories);
  const parentMainCats = useMemo(
    () =>
      mainCategories.filter(
        (c) => !c.parentId && (c.isParent || mainCategories.some((sg) => sg.parentId === c.id))
      ),
    [mainCategories]
  );
  return { parentMainCats, mainCategories };
}

/* ── Step 2: Select parent category (only shown when targetMode=existing) ── */

function ParentCategorySelector({
  parentMainCats,
  selectedMainCatId,
  setSelectedMainCatId,
}: {
  parentMainCats: ReturnType<typeof useMainParentCategories>["parentMainCats"];
  selectedMainCatId: string;
  setSelectedMainCatId: (id: string) => void;
}) {
  return (
    <div className="space-y-1 pl-2 mt-2 max-h-48 overflow-y-auto">
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
  );
}

/* ── Step indicator ── */

function StepIndicator({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
        {step}
      </span>
      {label}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Ship Parent Category Dialog
   ══════════════════════════════════════════════════════ */

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
  const { parentMainCats } = useMainParentCategories();

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<"inbox" | "existing">("inbox");
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
        // Merge into existing parent category
        mainCatId = selectedMainCatId;
      } else {
        // Send to inbox: create same-name sub-group under inbox (cat-inbox)
        const inboxId = "cat-inbox";
        mainCatId = inboxId;
      }

      const result = await shipToMain(warehouseCategory.id, mainCatId);

      for (const cat of result.categories) {
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
  }, [targetMode, selectedMainCatId, warehouseCategory, shipToMain, loadMainData]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setShipped(false);
        setShipping(false);
        setTargetMode("inbox");
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
          <DialogDescription>
            将「{warehouseCategory.name}」及其 {subGroups.length} 个分组、{cardCount} 个书签发送到主页
          </DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <StepIndicator step={1} label="选择发送方式" />

            {/* Option A: Send to inbox */}
            <button
              className={`w-full p-3 rounded-md border text-left transition-colors ${
                targetMode === "inbox" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => setTargetMode("inbox")}
            >
              <div className="flex items-center gap-2 mb-1">
                <Inbox className="h-4 w-4" />
                <span className="text-sm font-medium">发送到收集箱</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                在主页「收集箱」分类下新建同名分组「{warehouseCategory.name}」
              </p>
            </button>

            {/* Option B: Merge into existing parent category */}
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
                  <Layers className="h-4 w-4" />
                  <span className="text-sm font-medium">合并到已有分类</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  将所有分组合并到主页某个已有分类下，作为其子分组
                </p>
              </button>
            )}

            {targetMode === "existing" && (
              <>
                <StepIndicator step={2} label="选择目标分类" />
                <ParentCategorySelector
                  parentMainCats={parentMainCats}
                  selectedMainCatId={selectedMainCatId}
                  setSelectedMainCatId={setSelectedMainCatId}
                />
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">发货成功</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cardCount} 个书签已发送到主页
                {targetMode === "inbox" ? "收集箱" : ""}
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
            <Button onClick={() => handleClose(false)}>完成</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════
   Ship Sub-Group Dialog
   ══════════════════════════════════════════════════════ */

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
  const { parentMainCats } = useMainParentCategories();

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<"inbox" | "existing">("inbox");
  const [selectedMainCatId, setSelectedMainCatId] = useState<string>("");

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      let parentId: string;

      if (targetMode === "existing" && selectedMainCatId) {
        parentId = selectedMainCatId;
      } else {
        // Send to inbox
        parentId = "cat-inbox";
      }

      const result = await shipSubGroupToMain(warehouseSubGroup.id, parentId);
      await dbAddCategory(result.category);
      for (const card of result.cards) {
        await dbAddCard(card);
      }

      await loadMainData();
      setShipped(true);
    } catch (err) {
      console.error("Ship sub-group failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseSubGroup, shipSubGroupToMain, loadMainData]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setShipped(false);
        setShipping(false);
        setTargetMode("inbox");
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
          <DialogDescription>
            将「{warehouseSubGroup.name}」及其 {cards.length} 个书签发送到主页
          </DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <StepIndicator step={1} label="选择发送方式" />

            {/* Option A: Send to inbox */}
            <button
              className={`w-full p-3 rounded-md border text-left transition-colors ${
                targetMode === "inbox" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => setTargetMode("inbox")}
            >
              <div className="flex items-center gap-2 mb-1">
                <Inbox className="h-4 w-4" />
                <span className="text-sm font-medium">发送到收集箱</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                在主页「收集箱」分类下新建同名分组「{warehouseSubGroup.name}」
              </p>
            </button>

            {/* Option B: Merge into existing parent category */}
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
                  <Layers className="h-4 w-4" />
                  <span className="text-sm font-medium">合并到已有分类</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  将此分组合并到主页某个已有分类下，作为其子分组
                </p>
              </button>
            )}

            {targetMode === "existing" && (
              <>
                <StepIndicator step={2} label="选择目标分类" />
                <ParentCategorySelector
                  parentMainCats={parentMainCats}
                  selectedMainCatId={selectedMainCatId}
                  setSelectedMainCatId={setSelectedMainCatId}
                />
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">发送成功</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cards.length} 个书签已发送到主页
                {targetMode === "inbox" ? "收集箱" : ""}
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

/* ══════════════════════════════════════════════════════
   Ship Single Card Dialog
   ══════════════════════════════════════════════════════ */

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
  const { parentMainCats, mainCategories } = useMainParentCategories();

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<"inbox" | "existing">("inbox");

  // When merging into existing category, we need to pick a sub-group within that category
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedSubGroupId, setSelectedSubGroupId] = useState<string>("");

  const subGroupsOfSelectedParent = useMemo(() => {
    if (!selectedParentId) return [];
    return mainCategories.filter((c) => c.parentId === selectedParentId);
  }, [selectedParentId, mainCategories]);

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      if (targetMode === "existing" && selectedSubGroupId) {
        // Add card to an existing sub-group
        const mainCard = await shipCardToMain(warehouseCard.id, selectedSubGroupId);
        await dbAddCard(mainCard);
      } else if (targetMode === "existing" && selectedParentId) {
        // Add card to the parent category directly (as ungrouped card)
        const mainCard = await shipCardToMain(warehouseCard.id, selectedParentId);
        await dbAddCard(mainCard);
      } else {
        // Send to inbox: create a new same-name sub-group under inbox
        const inboxId = "cat-inbox";
        // Find or create a sub-group with the card title in inbox
        const existingInboxSub = mainCategories.find(
          (c) => c.parentId === inboxId && c.name === warehouseCard.title
        );
        let targetCatId: string;
        if (existingInboxSub) {
          targetCatId = existingInboxSub.id;
        } else {
          // Create new sub-group in inbox
          targetCatId = `cat-${Date.now()}`;
          const newSub = {
            id: targetCatId,
            name: warehouseCard.title,
            icon: "BookMarked",
            color: "#888888",
            order: mainCategories.filter((c) => c.parentId === inboxId).length,
            createdAt: Date.now(),
            parentId: inboxId,
          };
          await dbAddCategory(newSub);
        }
        const mainCard = await shipCardToMain(warehouseCard.id, targetCatId);
        await dbAddCard(mainCard);
      }

      await loadMainData();
      setShipped(true);
    } catch (err) {
      console.error("Ship card failed:", err);
    } finally {
      setShipping(false);
    }
  }, [
    targetMode,
    selectedSubGroupId,
    selectedParentId,
    warehouseCard,
    mainCategories,
    shipCardToMain,
    loadMainData,
  ]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setShipped(false);
        setShipping(false);
        setTargetMode("inbox");
        setSelectedParentId("");
        setSelectedSubGroupId("");
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
          <DialogDescription>将「{warehouseCard.title}」发送到主页</DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <StepIndicator step={1} label="选择发送方式" />

            {/* Option A: Send to inbox */}
            <button
              className={`w-full p-3 rounded-md border text-left transition-colors ${
                targetMode === "inbox" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => {
                setTargetMode("inbox");
                setSelectedParentId("");
                setSelectedSubGroupId("");
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Inbox className="h-4 w-4" />
                <span className="text-sm font-medium">发送到收集箱</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                在主页「收集箱」分类下新建同名分组「{warehouseCard.title}」
              </p>
            </button>

            {/* Option B: Merge into existing category */}
            {parentMainCats.length > 0 && (
              <button
                className={`w-full p-3 rounded-md border text-left transition-colors ${
                  targetMode === "existing"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => {
                  setTargetMode("existing");
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="h-4 w-4" />
                  <span className="text-sm font-medium">合并到已有分类</span>
                </div>
                <p className="text-[11px] text-muted-foreground">选择主页已有分类下的分组，直接添加进去</p>
              </button>
            )}

            {targetMode === "existing" && (
              <>
                <StepIndicator step={2} label="选择分类" />
                <div className="space-y-1 pl-2 max-h-36 overflow-y-auto">
                  {parentMainCats.map((cat) => (
                    <button
                      key={cat.id}
                      className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                        selectedParentId === cat.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedParentId(cat.id);
                        setSelectedSubGroupId("");
                      }}
                    >
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </button>
                  ))}
                </div>

                {selectedParentId && subGroupsOfSelectedParent.length > 0 && (
                  <>
                    <StepIndicator step={3} label="选择分组" />
                    <div className="space-y-1 pl-4 max-h-36 overflow-y-auto">
                      {subGroupsOfSelectedParent.map((sg) => (
                        <button
                          key={sg.id}
                          className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                            selectedSubGroupId === sg.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                          }`}
                          onClick={() => setSelectedSubGroupId(sg.id)}
                        >
                          <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: sg.color }} />
                          {sg.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">发送成功</p>
              <p className="text-sm text-muted-foreground mt-1">
                「{warehouseCard.title}」已发送到主页
                {targetMode === "inbox" ? "收集箱" : ""}
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
                  (targetMode === "existing" && !selectedParentId) ||
                  (targetMode === "existing" &&
                    !!selectedParentId &&
                    subGroupsOfSelectedParent.length > 0 &&
                    !selectedSubGroupId)
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

"use client";

import React, { useMemo } from "react";
import { useWarehouseStore } from "@/lib/store-warehouse";
import type { WarehouseCard, WarehouseCategory } from "@/lib/db-warehouse";
import { WarehouseCardItem } from "@/components/card/warehouse-card";
import { Package, Trash2, Send, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShipToMainDialog } from "@/components/dialogs/ship-to-main-dialog";

/* ── Warehouse Grid ── */
export function WarehouseGrid() {
  const { cards, categories, batches, selectedBatchId, deleteWarehouseCategory, setSelectedBatch } = useWarehouseStore();

  // Filter by selected batch
  const filteredCategories = useMemo(() => {
    if (!selectedBatchId) return categories;
    return categories.filter((c) => c.importBatchId === selectedBatchId);
  }, [categories, selectedBatchId]);

  const filteredCards = useMemo(() => {
    if (!selectedBatchId) return cards;
    return cards.filter((c) => c.importBatchId === selectedBatchId);
  }, [cards, selectedBatchId]);

  // Build hierarchy
  const parentCategories = useMemo(() => {
    return filteredCategories
      .filter((c) => !c.parentId && (c.isParent || filteredCategories.some((sg) => sg.parentId === c.id)))
      .sort((a, b) => a.order - b.order);
  }, [filteredCategories]);

  const standaloneCategories = useMemo(() => {
    return filteredCategories
      .filter((c) => !c.parentId && !c.isParent && !filteredCategories.some((sg) => sg.parentId === c.id))
      .sort((a, b) => a.order - b.order);
  }, [filteredCategories]);

  const getSubGroups = (parentId: string) =>
    filteredCategories.filter((c) => c.parentId === parentId).sort((a, b) => a.order - b.order);

  const getCardsForCategory = (categoryId: string) =>
    filteredCards.filter((c) => c.categoryId === categoryId).sort((a, b) => a.order - b.order);

  if (filteredCategories.length === 0 && batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Package className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-serif">仓库是空的</p>
        <p className="text-sm mt-1">点击上方&ldquo;导入&rdquo;按钮，上传 Homely JSON 文件</p>
      </div>
    );
  }

  if (filteredCategories.length === 0 && selectedBatchId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Package className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-serif">该批次已清空</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedBatch(null)}>
          查看全部
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Parent categories */}
      {parentCategories.map((parent) => (
        <ParentCategoryBlock
          key={parent.id}
          category={parent}
          subGroups={getSubGroups(parent.id)}
          getCardsForCategory={getCardsForCategory}
          allCards={filteredCards}
          onDeleteCategory={deleteWarehouseCategory}
        />
      ))}

      {/* Standalone categories */}
      {standaloneCategories.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {standaloneCategories.map((cat) => (
            <StandaloneCategoryBlock
              key={cat.id}
              category={cat}
              cards={getCardsForCategory(cat.id)}
              onDeleteCategory={deleteWarehouseCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Parent Category Block ── */
function ParentCategoryBlock({
  category,
  subGroups,
  getCardsForCategory,
  allCards,
  onDeleteCategory,
}: {
  category: WarehouseCategory;
  subGroups: WarehouseCategory[];
  getCardsForCategory: (id: string) => WarehouseCard[];
  allCards: WarehouseCard[];
  onDeleteCategory: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [shipDialogOpen, setShipDialogOpen] = React.useState(false);
  const totalCards = subGroups.reduce((sum, sg) => sum + getCardsForCategory(sg.id).length, 0);

  return (
    <div
      className="w-full rounded-lg border border-border bg-card overflow-hidden"
      style={{ width: "100%" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: category.color }} />
        <span className="font-serif font-semibold text-foreground">{category.name}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          {totalCards} 个网站
        </Badge>
        <div className="flex-1" />
        <ShipToMainButton warehouseCategory={category} onOpenDialog={() => setShipDialogOpen(true)} />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDeleteCategory(category.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Sub-groups */}
      {!collapsed && (
        <div className="flex flex-wrap gap-3 p-3">
          {subGroups.map((sg) => {
            const sgCards = getCardsForCategory(sg.id);
            return (
              <div
                key={sg.id}
                className="rounded-md border border-border/60 bg-background p-2"
                style={{ flex: sgCards.length <= 4 ? "1 1 0%" : "0 0 100%" }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sg.color }} />
                  <span className="text-sm font-medium text-foreground">{sg.name}</span>
                  <span className="text-[10px] text-muted-foreground">{sgCards.length}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sgCards.map((card) => (
                    <WarehouseCardItem key={card.id} card={card} categoryColor={sg.color} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ShipToMainDialog
        open={shipDialogOpen}
        onOpenChange={setShipDialogOpen}
        warehouseCategory={category}
        subGroups={subGroups}
        allCards={allCards}
      />
    </div>
  );
}

/* ── Standalone Category Block ── */
function StandaloneCategoryBlock({
  category,
  cards,
  onDeleteCategory,
}: {
  category: WarehouseCategory;
  cards: WarehouseCard[];
  onDeleteCategory: (id: string) => void;
}) {
  const [shipDialogOpen, setShipDialogOpen] = React.useState(false);
  const widthPercent = cards.length <= 4 ? 50 : 100;

  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden"
      style={{ width: `${widthPercent}%` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: category.color }} />
        <span className="font-serif font-semibold text-foreground">{category.name}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          {cards.length} 个网站
        </Badge>
        <div className="flex-1" />
        <ShipToMainButton warehouseCategory={category} onOpenDialog={() => setShipDialogOpen(true)} />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDeleteCategory(category.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap gap-1 p-3">
        {cards.map((card) => (
          <WarehouseCardItem key={card.id} card={card} categoryColor={category.color} />
        ))}
      </div>

      <ShipToMainDialog
        open={shipDialogOpen}
        onOpenChange={setShipDialogOpen}
        warehouseCategory={category}
        subGroups={[]}
        allCards={cards}
      />
    </div>
  );
}

/* ── Ship To Main Button ── */
function ShipToMainButton({
  onOpenDialog,
}: {
  warehouseCategory: WarehouseCategory;
  onOpenDialog: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-[10px] gap-1 px-2"
      onClick={onOpenDialog}
    >
      <Send className="h-3 w-3" />
      发货到主页
    </Button>
  );
}

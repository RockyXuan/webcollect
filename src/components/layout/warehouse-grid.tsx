"use client";

import React, { useMemo } from "react";
import { useWarehouseStore } from "@/lib/store-warehouse";
import type { WarehouseCard, WarehouseCategory } from "@/lib/db-warehouse";
import { WarehouseCardItem } from "@/components/card/warehouse-card";
import {
  Package,
  Trash2,
  Send,
  ChevronRight,
  ChevronDown,
  ArrowUpFromLine,
  ArrowDownFromLine,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShipToMainDialog,
  ShipToMainSubGroupDialog,
} from "@/components/dialogs/ship-to-main-dialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InlineEditableText } from "@/components/ui/inline-editable-text";

/* ── Warehouse Grid ── */
export function WarehouseGrid() {
  const { cards, categories, batches, selectedBatchId, setSelectedBatch } =
    useWarehouseStore();

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
        />
      ))}

      {/* Standalone categories (ungrouped sub-groups) */}
      {standaloneCategories.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {standaloneCategories.map((cat) => (
            <StandaloneCategoryBlock key={cat.id} category={cat} cards={getCardsForCategory(cat.id)} />
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
}: {
  category: WarehouseCategory;
  subGroups: WarehouseCategory[];
  getCardsForCategory: (id: string) => WarehouseCard[];
  allCards: WarehouseCard[];
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [shipDialogOpen, setShipDialogOpen] = React.useState(false);
  const [demoteDialogOpen, setDemoteDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(category.name);
  const { deleteWarehouseCategory, demoteWarehouseCategory, updateWarehouseCategory } = useWarehouseStore();

  const totalCards = subGroups.reduce((sum, sg) => sum + getCardsForCategory(sg.id).length, 0);

  const handleEditSave = async () => {
    if (editName.trim()) {
      await updateWarehouseCategory({ ...category, name: editName.trim() });
      setEditDialogOpen(false);
    }
  };

  return (
    <div className="w-full rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: category.color }} />
        <InlineEditableText
          value={category.name}
          onSave={(v) => updateWarehouseCategory({ ...category, name: v })}
          editMode={true}
          className="font-serif font-semibold text-foreground"
        />
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          {totalCards} 个网站
        </Badge>

        {/* Action buttons - aligned right after title */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => { setEditName(category.name); setEditDialogOpen(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">编辑分类</TooltipContent>
        </Tooltip>

        {/* Demote button */}
        <AlertDialog open={demoteDialogOpen} onOpenChange={setDemoteDialogOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <ArrowDownFromLine className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">降级为分组</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认降级</AlertDialogTitle>
              <AlertDialogDescription>
                将分类&ldquo;{category.name}&rdquo;降级为分组后，其下所有子分组将脱离成为独立分组。此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={() => demoteWarehouseCategory(category.id)}>
                确认降级
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Send to main page */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
              onClick={() => setShipDialogOpen(true)}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">导入此分类到主页</TooltipContent>
        </Tooltip>

        {/* Delete */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">删除分类</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                将删除分类&ldquo;{category.name}&rdquo;及其所有子分组和 {totalCards} 个书签，此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteWarehouseCategory(category.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Sub-groups */}
      {!collapsed && (
        <div className="flex flex-wrap gap-3 p-3">
          {subGroups.map((sg) => {
            const sgCards = getCardsForCategory(sg.id);
            return (
              <SubGroupBlock
                key={sg.id}
                category={sg}
                cards={sgCards}
              />
            );
          })}
        </div>
      )}

      {/* Ship dialog */}
      <ShipToMainDialog
        open={shipDialogOpen}
        onOpenChange={setShipDialogOpen}
        warehouseCategory={category}
        subGroups={subGroups}
        allCards={allCards}
      />

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="font-serif">编辑分类</DialogTitle>
            <DialogDescription>修改分类名称</DialogDescription>
          </DialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="分类名称"
            onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEditSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Sub-Group Block (inside parent category) ── */
function SubGroupBlock({
  category,
  cards,
}: {
  category: WarehouseCategory;
  cards: WarehouseCard[];
}) {
  const [shipDialogOpen, setShipDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(category.name);
  const { deleteWarehouseCategory, promoteWarehouseCategory, updateWarehouseCategory, updateWarehouseCard } = useWarehouseStore();

  const handleUpdateCard = async (updatedCard: WarehouseCard) => {
    await updateWarehouseCard(updatedCard);
  };

  const handleEditSave = async () => {
    if (editName.trim()) {
      await updateWarehouseCategory({ ...category, name: editName.trim() });
      setEditDialogOpen(false);
    }
  };

  return (
    <div
      className="rounded-md border border-border/60 bg-background p-2"
      style={{ flex: cards.length <= 4 ? "1 1 0%" : "0 0 100%" }}
    >
      {/* Sub-group header */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: category.color }} />
        <InlineEditableText
          value={category.name}
          onSave={(v) => updateWarehouseCategory({ ...category, name: v })}
          editMode={true}
          className="text-sm font-medium text-foreground"
        />
        <span className="text-[10px] text-muted-foreground">{cards.length}</span>

        {/* Action buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => { setEditName(category.name); setEditDialogOpen(true); }}
            >
              <Pencil className="h-2.5 w-2.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">编辑分组</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => promoteWarehouseCategory(category.id)}
            >
              <ArrowUpFromLine className="h-2.5 w-2.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">升级为顶级分类</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
              onClick={() => setShipDialogOpen(true)}
            >
              <Send className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">导入此分组到主页</TooltipContent>
        </Tooltip>

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">删除分组</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                将删除分组&ldquo;{category.name}&rdquo;及其 {cards.length} 个书签，此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteWarehouseCategory(category.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap gap-1">
        {cards.map((card) => (
          <WarehouseCardItem key={card.id} card={card} categoryColor={category.color} onUpdateCard={handleUpdateCard} />
        ))}
      </div>

      {/* Ship sub-group dialog */}
      <ShipToMainSubGroupDialog
        open={shipDialogOpen}
        onOpenChange={setShipDialogOpen}
        warehouseSubGroup={category}
        cards={cards}
      />

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="font-serif">编辑分组</DialogTitle>
            <DialogDescription>修改分组名称</DialogDescription>
          </DialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="分组名称"
            onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEditSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Standalone Category Block (ungrouped sub-groups) ── */
function StandaloneCategoryBlock({
  category,
  cards,
}: {
  category: WarehouseCategory;
  cards: WarehouseCard[];
}) {
  const [shipDialogOpen, setShipDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(category.name);
  const { deleteWarehouseCategory, promoteWarehouseCategory, updateWarehouseCategory, updateWarehouseCard } = useWarehouseStore();
  const widthPercent = cards.length <= 4 ? 50 : 100;

  const handleUpdateCard = async (updatedCard: WarehouseCard) => {
    await updateWarehouseCard(updatedCard);
  };

  const handleEditSave = async () => {
    if (editName.trim()) {
      await updateWarehouseCategory({ ...category, name: editName.trim() });
      setEditDialogOpen(false);
    }
  };

  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden"
      style={{ width: `${widthPercent}%` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: category.color }} />
        <InlineEditableText
          value={category.name}
          onSave={(v) => updateWarehouseCategory({ ...category, name: v })}
          editMode={true}
          className="font-serif font-semibold text-foreground"
        />
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          {cards.length} 个网站
        </Badge>

        {/* Action buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => { setEditName(category.name); setEditDialogOpen(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">编辑分组</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => promoteWarehouseCategory(category.id)}
            >
              <ArrowUpFromLine className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">升级为顶级分类</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
              onClick={() => setShipDialogOpen(true)}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">导入此分组到主页</TooltipContent>
        </Tooltip>

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">删除分组</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                将删除分组&ldquo;{category.name}&rdquo;及其 {cards.length} 个书签，此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteWarehouseCategory(category.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap gap-1 p-3">
        {cards.map((card) => (
          <WarehouseCardItem key={card.id} card={card} categoryColor={category.color} onUpdateCard={handleUpdateCard} />
        ))}
      </div>

      {/* Ship dialog */}
      <ShipToMainDialog
        open={shipDialogOpen}
        onOpenChange={setShipDialogOpen}
        warehouseCategory={category}
        subGroups={[]}
        allCards={cards}
      />

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="font-serif">编辑分组</DialogTitle>
            <DialogDescription>修改分组名称</DialogDescription>
          </DialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="分组名称"
            onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEditSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

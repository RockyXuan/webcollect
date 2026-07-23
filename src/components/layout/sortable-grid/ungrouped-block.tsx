
"use client";

import React, { memo, useCallback, useRef, useState } from "react";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpFromLine, GripVertical, Layers, MoreHorizontal, Pencil, Plus, Send, Settings2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EditActionDock, type EditAction } from "@/components/ui/edit-action-dock";
import { InlineEditableText } from "@/components/ui/inline-editable-text";
import { useAppStore } from "@/lib/store";
import { useAdaptiveLayoutMetrics } from "@/components/layout/adaptive-resolution-viewport";
import type { Category, WebCard } from "@/lib/types";
import {
  cardId,
  getCardGridStyle,
  getSmartChildStyle,
  getStableLayoutColumns,
  inferLayoutColumns,
  ungroupId,
} from "./layout-math";
import { SortableCard } from "./sortable-card";

// ============ Sortable Ungrouped Block ============
export interface SortableUngroupedBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  onPromoteToParent?: (categoryId: string) => void;
  onUpdateCard?: (card: WebCard) => void;
  onShipCategory?: (category: Category) => void;
  onShipCard?: (card: WebCard) => void;
}

export const SortableUngroupedBlock = memo(function SortableUngroupedBlock({
  category,
  cards,
  editMode,
  onEditCategory,
  onAddCard,
  onAddGroup,
  onEditCard,
  onDeleteCard,
  onPromoteToParent,
  onUpdateCard,
  onShipCategory,
  onShipCard,
}: SortableUngroupedBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ungroupId(category.id) });
  const { density } = useAdaptiveLayoutMetrics();

  const categoryWidths = useAppStore((s) => s.categoryWidths);
  const categoryLayouts = useAppStore((s) => s.categoryLayouts);
  const setCategoryWidth = useAppStore((s) => s.setCategoryWidth);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const globalEditMode = useAppStore((s) => s.editMode);
  const toggleEditMode = useAppStore((s) => s.toggleEditMode);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  const layoutPreference = categoryLayouts[category.id];
  const widthPercent = localWidth ?? categoryWidths[category.id] ?? layoutPreference?.widthPercent ?? null;
  const cardColumns = localWidth !== null
    ? inferLayoutColumns(localWidth, cards.length)
    : getStableLayoutColumns(layoutPreference, widthPercent, cards.length);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = container.parentElement?.offsetWidth ?? 1;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newWidth = Math.max(120 * density, startWidth + dx);
        const logicalWidth = newWidth / density;
        const newPercent = Math.max(15, Math.min(100, (logicalWidth / parentWidth) * 100));
        setLocalWidth(newPercent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) setCategoryWidth(category.id, prev, inferLayoutColumns(prev, cards.length));
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [cards.length, category.id, density, setCategoryWidth]
  );

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const groupActions: EditAction[] = [
    {
      id: "edit",
      label: "轻量编辑",
      icon: Pencil,
      onSelect: () => {
        if (!globalEditMode) toggleEditMode();
      },
    },
    {
      id: "advanced-settings",
      label: "高级设置",
      icon: Settings2,
      onSelect: () => {
        if (!globalEditMode) toggleEditMode();
        onEditCategory?.(category);
      },
    },
    { id: "add-card", label: "添加网页", icon: Plus, onSelect: () => onAddCard?.(category.id) },
    { id: "promote", label: "升级为分类", icon: ArrowUpFromLine, onSelect: () => onPromoteToParent?.(category.id) },
    { id: "ship", label: "飞到其他分项", icon: Send, onSelect: () => onShipCategory?.(category) },
    { id: "delete", label: "删除分组", icon: Trash2, tone: "danger", onSelect: () => setConfirmDeleteOpen(true) },
  ];

  const handleDockTriggerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    ...getSmartChildStyle(widthPercent, cards.length, cardColumns, density),
    ...getCardGridStyle(cardColumns),
  };

  return (
    <div
      ref={setRef}
      style={style}
      data-wc-category-id={category.id}
      className="wc-soft-card wc-group-panel relative min-w-0 overflow-hidden"
    >
      {/* Header - buttons right next to title */}
      <div
        className="wc-group-header flex items-center gap-2 px-4 py-3"
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
      >
        <span
          className="cursor-grab active:cursor-grabbing text-slate-400/70 hover:text-blue-600 transition-colors"
          {...attributes}
          {...listeners}
          title="拖动排序"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <div
          className="h-4 w-1 rounded-full flex-shrink-0 shadow-sm shadow-blue-300/30"
          style={{ backgroundColor: category.color }}
        />
        <Layers
          className="h-3.5 w-3.5 shrink-0 text-blue-500/70"
          aria-hidden="true"
        />
        <InlineEditableText
          value={category.name}
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
          editMode={editMode}
          onSave={(newName) => updateCategory({ ...category, name: newName })}
        />
        <span className="shrink-0 text-xs text-slate-400">
          ({cards.length})
        </span>

        {(isHeaderHovered || globalEditMode) && (
          <EditActionDock
            actions={groupActions}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="wc-edit-dock-trigger h-7 w-7 rounded-full p-0 text-slate-500 hover:bg-white/80 hover:text-blue-600 animate-in fade-in duration-200"
                onClick={handleDockTriggerClick}
                title={globalEditMode ? "分组更多操作" : "进入编辑模式"}
                aria-label={globalEditMode ? "分组更多操作" : "进入编辑模式"}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            }
          />
        )}
      </div>

      {/* Cards */}
      <SortableContext
        items={cards.map((c) => cardId(c.id))}
        strategy={rectSortingStrategy}
      >
        <div className={`wc-group-card-list gap-2 px-4 pb-4 ${editMode ? "wc-group-card-list-editing" : ""}`}>
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              categoryColor={category.color}
              editMode={editMode}
              onEdit={() => onEditCard?.(card)}
              onDelete={() => onDeleteCard?.(card)}
              onUpdateCard={onUpdateCard}
              onShip={() => onShipCard?.(card)}
              onCreateGroup={() => onAddGroup?.()}
            />
          ))}
          {cards.length === 0 && (
            <p className="py-1 text-[10px] text-slate-400">暂无网站</p>
          )}
        </div>
      </SortableContext>

      {/* Resize handle - right edge, always available */}
      <div
        className="absolute right-0 top-0 bottom-0 z-20 w-3 cursor-col-resize
          rounded-r-2xl transition-colors hover:bg-blue-400/20 active:bg-blue-500/25"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={handleResizeStart}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分组「{category.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              该分组下的 {cards.length} 个网页将一起移入回收站，可随时恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { useAppStore.getState().softDeleteSubGroup(category.id); setConfirmDeleteOpen(false); }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

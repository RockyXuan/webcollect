"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil, Check } from "lucide-react";
import type { WebCard, Category } from "@/lib/types";
import { WebCardItem } from "@/components/card/web-card";
import { useAppStore } from "@/lib/store";
/* ── CategoryIcon: static switch-based rendering ── */
function CategoryIcon({ iconName, className }: { iconName: string; className?: string }) {
  switch (iconName) {
    case "star": return <Star className={className} />;
    case "wrench": return <Wrench className={className} />;
    case "palette": return <Palette className={className} />;
    case "code": return <Code className={className} />;
    case "book-open": return <BookOpen className={className} />;
    case "music": return <Music className={className} />;
    case "video": return <Video className={className} />;
    case "shopping-bag": return <ShoppingBag className={className} />;
    case "graduation-cap": return <GraduationCap className={className} />;
    case "briefcase": return <Briefcase className={className} />;
    case "coffee": return <Coffee className={className} />;
    case "gamepad-2": return <Gamepad2 className={className} />;
    default: return <Circle className={className} />;
  }
}

import {
  Star, Wrench, Palette, Code, BookOpen, Music, Video,
  ShoppingBag, GraduationCap, Briefcase, Coffee, Gamepad2, Circle,
} from "lucide-react";

/* ── Types ── */
interface SortableGridProps {
  cards: WebCard[];
  categories: Category[];
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  onAdd: (categoryId?: string) => void;
}

/* ── Main Component ── */
export function SortableGrid({ cards, categories, onEdit, onDelete, onAdd }: SortableGridProps) {
  const { editMode, toggleEditMode, reorderCards, reorderCategories } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categories]
  );

  const categoryIds = useMemo(
    () => sortedCategories.map((c) => c.id),
    [sortedCategories]
  );

  /* ── Drag handlers ── */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);

      // Category drag: reorder categories
      if (categoryIds.includes(activeIdStr) && categoryIds.includes(overIdStr)) {
        const oldIdx = categoryIds.indexOf(activeIdStr);
        const newIdx = categoryIds.indexOf(overIdStr);
        if (oldIdx !== -1 && newIdx !== -1) {
          const newOrder = [...categoryIds];
          newOrder.splice(oldIdx, 1);
          newOrder.splice(newIdx, 0, activeIdStr);
          reorderCategories(newOrder);
        }
        return;
      }

      // Card drag: find card and handle cross-category or within-category reorder
      const activeCard = cards.find((c) => c.id === activeIdStr);
      if (!activeCard) return;

      // Check if dropped on a category header (move to that category)
      if (categoryIds.includes(overIdStr)) {
        reorderCards(
          activeCard.id,
          overIdStr,
          cards.filter((c) => c.categoryId === overIdStr).length
        );
        return;
      }

      // Dropped on another card
      const overCard = cards.find((c) => c.id === overIdStr);
      if (!overCard) return;

      if (activeCard.categoryId !== overCard.categoryId) {
        // Cross-category move
        reorderCards(activeCard.id, overCard.categoryId, overCard.order);
      } else {
        // Same-category reorder
        const sameCatCards = cards
          .filter((c) => c.categoryId === activeCard.categoryId)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const oldIdx = sameCatCards.findIndex((c) => c.id === activeCard.id);
        const newIdx = sameCatCards.findIndex((c) => c.id === overCard.id);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = [...sameCatCards];
          reordered.splice(oldIdx, 1);
          reordered.splice(newIdx, 0, activeCard);
          // Update orders
          reordered.forEach((c, i) => {
            if (c.order !== i) {
              reorderCards(c.id, c.categoryId, i);
            }
          });
        }
      }
    },
    [cards, categoryIds, reorderCards, reorderCategories]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap gap-3">
          {sortedCategories.map((category) => (
            <SortableCategoryBlock
              key={category.id}
              category={category}
              cards={cards.filter((c) => c.categoryId === category.id)}
              editMode={editMode}
              editingCategoryId={editingCategoryId}
              setEditingCategoryId={setEditingCategoryId}
              onEdit={onEdit}
              onDelete={onDelete}
              onAdd={onAdd}
              toggleEditMode={toggleEditMode}
              onCategoryDragStart={setActiveId}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId && categoryIds.includes(activeId) ? (
          <div className="bg-card/90 rounded-xl border-2 border-primary p-3 shadow-xl opacity-80">
            <p className="text-sm font-medium">移动分类...</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Sortable Category Block ── */
interface SortableCategoryBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  editingCategoryId: string | null;
  setEditingCategoryId: (id: string | null) => void;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  onAdd: (categoryId?: string) => void;
  toggleEditMode: () => void;
  onCategoryDragStart: (id: string) => void;
}

function SortableCategoryBlock({
  category,
  cards,
  editMode,
  editingCategoryId,
  setEditingCategoryId,
  onEdit,
  onDelete,
  onAdd,
  toggleEditMode,
  onCategoryDragStart,
}: SortableCategoryBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const [widthPercent, setWidthPercent] = useState(50);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [isResizingH, setIsResizingH] = useState(false);
  const [isResizingV, setIsResizingV] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [cards]
  );

  const cardIds = useMemo(() => sortedCards.map((c) => c.id), [sortedCards]);

  /* ── Horizontal resize handlers ── */
  const handleHResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizingH(true);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = widthPercent;

      const handleMove = (ev: MouseEvent) => {
        const containerWidth = blockRef.current?.parentElement?.clientWidth || 1;
        const delta = ev.clientX - resizeStartX.current;
        const deltaPercent = (delta / containerWidth) * 100;
        const newWidth = Math.min(100, Math.max(30, resizeStartWidth.current + deltaPercent));
        setWidthPercent(Math.round(newWidth));
      };

      const handleUp = () => {
        setIsResizingH(false);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [widthPercent]
  );

  /* ── Vertical resize handlers ── */
  const handleVResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizingV(true);
      resizeStartY.current = e.clientY;
      resizeStartHeight.current = maxHeight || blockRef.current?.scrollHeight || 300;

      const handleMove = (ev: MouseEvent) => {
        const delta = ev.clientY - resizeStartY.current;
        const newHeight = Math.max(120, resizeStartHeight.current + delta);
        setMaxHeight(Math.round(newHeight));
      };

      const handleUp = () => {
        setIsResizingV(false);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [maxHeight]
  );

  /* ── Double-click to reset height ── */
  const handleResetHeight = useCallback(() => {
    setMaxHeight(null);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${widthPercent}%`,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative rounded-xl border bg-card transition-shadow
        ${editMode ? "border-primary/20" : "border-border/60"}
        ${isResizingH || isResizingV ? "ring-2 ring-primary/30" : ""}
        hover:shadow-md
      `}
    >
      {/* Category color accent strip */}
      <div
        className="h-1 rounded-t-xl"
        style={{ backgroundColor: category.color }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        {editMode && (
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground p-0.5"
            {...attributes}
            {...listeners}
            onPointerDown={(e) => {
              onCategoryDragStart(category.id);
              listeners?.onPointerDown?.(e);
            }}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        <CategoryIcon iconName={category.icon} className="w-3.5 h-3.5 text-muted-foreground" />

        <h3 className="font-serif text-sm font-semibold text-foreground">
          {category.name}
        </h3>

        <span className="text-xs text-muted-foreground/60 tabular-nums">
          {cards.length}
        </span>

        {/* Edit toggle + Add buttons - inline after title */}
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => {
              if (editingCategoryId === category.id) {
                setEditingCategoryId(null);
              } else {
                setEditingCategoryId(category.id);
                if (!editMode) toggleEditMode();
              }
            }}
            className={`
              text-[11px] px-1.5 py-0.5 rounded transition-colors
              ${editingCategoryId === category.id
                ? "text-primary bg-primary/10"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
              }
            `}
          >
            {editingCategoryId === category.id ? (
              <Check className="w-3 h-3" />
            ) : (
              <Pencil className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={() => onAdd(category.id)}
            className="text-[11px] px-1.5 py-0.5 rounded text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Card grid - flex-wrap for auto reflow */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          className="flex flex-wrap gap-1.5 px-3 pb-3 content-start"
          style={{
            maxHeight: maxHeight ? `${maxHeight}px` : undefined,
            overflowY: maxHeight ? "auto" : undefined,
          }}
          onDoubleClick={handleResetHeight}
        >
          {sortedCards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              categoryColor={category.color}
              editMode={editingCategoryId === category.id}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {sortedCards.length === 0 && (
            <div className="w-full py-4 text-center text-xs text-muted-foreground/50">
              暂无网站，点击 + 添加
            </div>
          )}
        </div>
      </SortableContext>

      {/* Horizontal resize handle (right edge) */}
      <div
        onMouseDown={handleHResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group"
        title="拖拽调整宽度"
      >
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-border group-hover:bg-primary/60 transition-colors rounded-full" />
      </div>

      {/* Vertical resize handle (bottom edge) */}
      <div
        onMouseDown={handleVResizeStart}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize group"
        title="拖拽调整高度（双击重置）"
      >
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-border group-hover:bg-primary/60 transition-colors rounded-full" />
      </div>
    </div>
  );
}

/* ── Sortable Card ── */
interface SortableCardProps {
  card: WebCard;
  categoryColor: string;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
}

function SortableCard({ card, categoryColor, editMode, onEdit, onDelete }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <WebCardItem
        card={card}
        categoryColor={categoryColor}
        editMode={editMode}
        onEdit={() => onEdit(card)}
        onDelete={() => onDelete(card.id)}
        dragListeners={listeners}
      />
    </div>
  );
}

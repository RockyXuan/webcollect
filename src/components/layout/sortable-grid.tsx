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
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil, Check } from "lucide-react";
import type { WebCard, Category } from "@/lib/types";
import { WebCardItem } from "@/components/card/web-card";
import { useAppStore } from "@/lib/store";

/* ── CategoryIcon: static switch-based rendering ── */
import {
  Star, Wrench, Palette, Code, BookOpen, Music, Video,
  ShoppingBag, GraduationCap, Briefcase, Coffee, Gamepad2, Circle,
} from "lucide-react";

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

/* ── ID helpers ── */
const CAT_PREFIX = "cat:";
const CARD_PREFIX = "card:";
const catId = (id: string) => `${CAT_PREFIX}${id}`;
const cardId = (id: string) => `${CARD_PREFIX}${id}`;
const stripPrefix = (id: string) => id.replace(/^(cat:|card:)/, "");
const isCatId = (id: string) => id.startsWith(CAT_PREFIX);
const isCardId = (id: string) => id.startsWith(CARD_PREFIX);

/* ── Custom collision detection: cards can drop on cards or category headers ── */
const typedCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers } = args;
  const activeData = active.data.current;
  const activeType = activeData?.type as string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = droppableContainers.filter((container: any) => {
    const containerData = container.data.current;
    const containerType = containerData?.type as string | undefined;

    // Category can only be dropped on another category
    if (activeType === "category") return containerType === "category";
    // Card can be dropped on another card or on a category header
    if (activeType === "card") return containerType === "card" || containerType === "category";
    return false;
  });

  if (filtered.length === 0) return [];

  return closestCenter({ ...args, droppableContainers: filtered });
};

/* ── Types ── */
interface SortableGridProps {
  cards: WebCard[];
  categories: Category[];
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  onAdd: (categoryId?: string) => void;
  onEditCategory: (category: Category) => void;
}

/* ── Main Component ── */
export function SortableGrid({ cards, categories, onEdit, onDelete, onAdd, onEditCategory }: SortableGridProps) {
  const { editMode, reorderCards, reorderCategories } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedCategories = useMemo(
    () =>
      [...categories]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .sort((a, b) => {
          // 收集箱永远排最后
          if (a.id === "cat-inbox") return 1;
          if (b.id === "cat-inbox") return -1;
          return 0;
        }),
    [categories]
  );

  // Build sortable item IDs for categories
  const categorySortableIds = useMemo(
    () => sortedCategories.map((c) => catId(c.id)),
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

      const activeStr = String(active.id);
      const overStr = String(over.id);
      const activeType = active.data.current?.type;

      /* ── Category reordering ── */
      if (activeType === "category" && isCatId(activeStr) && isCatId(overStr)) {
        const activeCatId = stripPrefix(activeStr);
        const overCatId = stripPrefix(overStr);
        const oldIdx = sortedCategories.findIndex((c) => c.id === activeCatId);
        const newIdx = sortedCategories.findIndex((c) => c.id === overCatId);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const newOrder = sortedCategories.map((c) => c.id);
          newOrder.splice(oldIdx, 1);
          newOrder.splice(newIdx, 0, activeCatId);
          reorderCategories(newOrder);
        }
        return;
      }

      /* ── Card reordering / cross-category move ── */
      if (activeType === "card" && isCardId(activeStr)) {
        const activeCardId = stripPrefix(activeStr);
        const activeCard = cards.find((c) => c.id === activeCardId);
        if (!activeCard) return;

        // Dropped on a category header → move to that category
        if (isCatId(overStr)) {
          const targetCatId = stripPrefix(overStr);
          const targetCards = cards.filter((c) => c.categoryId === targetCatId);
          reorderCards(activeCardId, targetCatId, targetCards.length);
          return;
        }

        // Dropped on another card → reorder
        if (isCardId(overStr)) {
          const overCardId = stripPrefix(overStr);
          const overCard = cards.find((c) => c.id === overCardId);
          if (!overCard) return;

          if (activeCard.categoryId !== overCard.categoryId) {
            // Cross-category move: insert at over card's position
            reorderCards(activeCardId, overCard.categoryId, overCard.order);
          } else {
            // Same-category reorder: just move the card to the over card's position
            reorderCards(activeCardId, activeCard.categoryId, overCard.order);
          }
        }
      }
    },
    [cards, sortedCategories, reorderCards, reorderCategories]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Find the active item for the DragOverlay
  const activeItem = useMemo(() => {
    if (!activeId) return null;
    if (isCatId(activeId)) {
      const id = stripPrefix(activeId);
      return { type: "category" as const, data: sortedCategories.find((c) => c.id === id) };
    }
    if (isCardId(activeId)) {
      const id = stripPrefix(activeId);
      return { type: "card" as const, data: cards.find((c) => c.id === id) };
    }
    return null;
  }, [activeId, sortedCategories, cards]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={typedCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Group categories by superCategoryId */}
      {(() => {
        const superCats = useAppStore.getState().superCategories;
        // Group categories by superCategoryId
        const groups: Record<string, Category[]> = {};
        const ungrouped: Category[] = [];
        for (const cat of sortedCategories) {
          if (cat.superCategoryId && cat.superCategoryId !== "none") {
            if (!groups[cat.superCategoryId]) groups[cat.superCategoryId] = [];
            groups[cat.superCategoryId].push(cat);
          } else {
            ungrouped.push(cat);
          }
        }
        // Render: super-category groups first (ordered), then ungrouped
        type GroupItem = 
          | { type: "super"; id: string; name: string; categories: Category[] }
          | { type: "single"; id: string; name: string; categories: Category[] };
        const renderedGroups: GroupItem[] = [
          ...superCats
            .filter((sc) => groups[sc.id] && groups[sc.id].length > 0)
            .map((sc) => ({ type: "super" as const, id: sc.id, name: sc.name, categories: groups[sc.id] })),
          ...ungrouped.map((cat) => ({ type: "single" as const, id: cat.id, name: "", categories: [cat] })),
        ];

        return (
          <SortableContext items={categorySortableIds} strategy={rectSortingStrategy}>
            <div className="space-y-10">
              {renderedGroups.map((group) => (
                <div key={group.id}>
                  {group.type === "super" && (
                    <div className="mb-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border/40" />
                      <h2 className="text-sm font-serif font-semibold tracking-widest text-muted-foreground uppercase px-2">
                        {group.name}
                      </h2>
                      <div className="h-px flex-1 bg-border/40" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-6">
                    {group.categories.map((category) => (
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
                        onEditCategory={onEditCategory}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>
        );
      })()}

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeItem?.type === "category" && activeItem.data ? (
          <div className="bg-card/90 rounded-xl border-2 border-primary/50 p-3 shadow-xl opacity-80 max-w-xs">
            <div className="flex items-center gap-2">
              <CategoryIcon iconName={activeItem.data.icon} className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{activeItem.data.name}</span>
            </div>
          </div>
        ) : activeItem?.type === "card" && activeItem.data ? (
          <div className="bg-card/90 rounded-lg border border-primary/50 px-2.5 py-1.5 shadow-xl opacity-80">
            <span className="text-xs font-medium">{activeItem.data.title}</span>
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
  onEditCategory: (category: Category) => void;
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
  onEditCategory,
}: SortableCategoryBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: catId(category.id),
    data: { type: "category" },
  });

  /* Auto-fit width based on card count:
     - 0-2 cards → ~50% (small block, fits 2 per row)
     - 3-5 cards → ~50% (medium block, fits 2 per row)
     - 6+ cards → ~100% (large block, needs full width)
     Gap is gap-3 (12px), so two 50% blocks need calc(50% - 6px) each
     User can still manually resize via handle */
  const defaultWidth = useMemo(() => {
    if (cards.length >= 6) return "calc(100% - 0px)";
    return "calc(50% - 6px)";
  }, [cards.length]);

  const [widthPercent, setWidthPercent] = useState<number | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [isResizingH, setIsResizingH] = useState(false);
  const [isResizingV, setIsResizingV] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  /* If user hasn't manually resized, follow auto width */
  const effectiveWidth: string = widthPercent != null ? `${widthPercent}%` : defaultWidth;

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [cards]
  );

  const cardSortableIds = useMemo(
    () => sortedCards.map((c) => cardId(c.id)),
    [sortedCards]
  );

  /* ── Horizontal resize ── */
  const handleHResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizingH(true);
      resizeStartX.current = e.clientX;
      /* Use actual rendered width as starting point */
      resizeStartWidth.current = blockRef.current?.offsetWidth || 0;

      const handleMove = (ev: MouseEvent) => {
        const containerWidth = blockRef.current?.parentElement?.clientWidth || 1;
        const delta = ev.clientX - resizeStartX.current;
        const currentWidth = resizeStartWidth.current + delta;
        const newPercent = Math.min(100, Math.max(30, (currentWidth / containerWidth) * 100));
        setWidthPercent(Math.round(newPercent));
      };

      const handleUp = () => {
        setIsResizingH(false);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    []
  );

  /* ── Vertical resize ── */
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

  const handleResetHeight = useCallback(() => {
    setMaxHeight(null);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: effectiveWidth,
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
      {/* Category color accent */}
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: category.color }} />

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        {/* Grip handle for category drag (edit mode only) */}
        {editMode && (
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground p-0.5"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        <CategoryIcon iconName={category.icon} className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="font-serif text-sm font-semibold text-foreground">{category.name}</h3>
        <span className="text-xs text-muted-foreground/60 tabular-nums">{cards.length}</span>

        {/* Edit toggle + Add (inline after title) */}
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (editingCategoryId === category.id) {
                setEditingCategoryId(null);
              } else {
                setEditingCategoryId(category.id);
              }
              onEditCategory(category);
            }}
            className={`
              text-[11px] px-1.5 py-0.5 rounded transition-colors
              ${editingCategoryId === category.id
                ? "text-primary bg-primary/10"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
              }
            `}
          >
            {editingCategoryId === category.id ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(category.id); }}
            className="text-[11px] px-1.5 py-0.5 rounded text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Cards - flex-wrap with SortableContext for cross-category drag */}
      <SortableContext items={cardSortableIds} strategy={rectSortingStrategy}>
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
              editMode={editMode || editingCategoryId === category.id}
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

      {/* Horizontal resize handle */}
      <div
        onMouseDown={handleHResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group"
        title="拖拽调整宽度"
      >
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-border group-hover:bg-primary/60 transition-colors rounded-full" />
      </div>

      {/* Vertical resize handle */}
      <div
        onMouseDown={handleVResizeStart}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize group"
        title="拖拽调整高度（双击内容区重置）"
      >
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-border group-hover:bg-primary/60 transition-colors rounded-full" />
      </div>
    </div>
  );
}

/* ── Sortable Card (drag within and across categories) ── */
interface SortableCardProps {
  card: WebCard;
  categoryColor: string;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
}

function SortableCard({ card, categoryColor, editMode, onEdit, onDelete }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cardId(card.id),
    data: { type: "card", categoryId: card.categoryId },
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
        dragListeners={editMode ? listeners : null}
      />
    </div>
  );
}

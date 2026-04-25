"use client";

import React, { useState, useMemo, useCallback } from "react";
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
  onEditSuperCategory: (id: string) => void;
}

/* ── Main Component ── */
export function SortableGrid({ cards, categories, onEdit, onDelete, onAdd, onEditCategory, onEditSuperCategory }: SortableGridProps) {
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

  /* ── Group categories by superCategoryId ── */
  const superCats = useAppStore((s) => s.superCategories);

  const { superGroups, ungrouped } = useMemo(() => {
    const groups: Record<string, Category[]> = {};
    const ungroupedCats: Category[] = [];
    for (const cat of sortedCategories) {
      if (cat.superCategoryId && cat.superCategoryId !== "none" && cat.superCategoryId !== "") {
        if (!groups[cat.superCategoryId]) groups[cat.superCategoryId] = [];
        groups[cat.superCategoryId].push(cat);
      } else {
        ungroupedCats.push(cat);
      }
    }
    const orderedSuperGroups = superCats
      .filter((sc) => groups[sc.id] && groups[sc.id].length > 0)
      .map((sc) => ({ id: sc.id, name: sc.name, categories: groups[sc.id] }));
    return { superGroups: orderedSuperGroups, ungrouped: ungroupedCats };
  }, [sortedCategories, superCats]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={typedCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={categorySortableIds} strategy={rectSortingStrategy}>
        <div className="space-y-8">
          {/* Super category groups — visible bordered containers */}
          {superGroups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl border border-border/40 bg-muted/10 px-5 pt-4 pb-5"
            >
              {/* Super category header with edit button */}
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-serif font-bold text-foreground/90 tracking-wide">
                  {group.name}
                </h2>
                <button
                  onClick={() => onEditSuperCategory(group.id)}
                  className="text-muted-foreground/40 hover:text-foreground p-0.5 rounded hover:bg-muted/50 transition-colors"
                  title="编辑分类名称"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <div className="h-px flex-1 bg-border/25" />
              </div>

              {/* Sub-category blocks in 2-column layout */}
              <div className="flex flex-wrap gap-4">
                {group.categories.map((category) => {
                  const catCards = cards.filter((c) => c.categoryId === category.id);
                  return (
                    <SortableCategoryBlock
                      key={category.id}
                      category={category}
                      cards={catCards}
                      editMode={editMode}
                      editingCategoryId={editingCategoryId}
                      setEditingCategoryId={setEditingCategoryId}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onAdd={onAdd}
                      onEditCategory={onEditCategory}
                      fullWidth={catCards.length >= 6}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Ungrouped categories (e.g. 收集箱) */}
          {ungrouped.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {ungrouped.map((category) => (
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
                  fullWidth={false}
                />
              ))}
            </div>
          )}
        </div>
      </SortableContext>

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
  fullWidth: boolean;
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
  fullWidth,
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

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [cards]
  );

  const cardSortableIds = useMemo(
    () => sortedCards.map((c) => cardId(c.id)),
    [sortedCards]
  );

  /* Auto width: fullWidth (>=6 cards) → 100%, otherwise ~50% */
  const blockWidth = fullWidth ? "100%" : "calc(50% - 8px)";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: blockWidth,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative rounded-xl border bg-card transition-shadow
        ${editMode ? "border-primary/20" : "border-border/60"}
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
        <div className="flex flex-wrap gap-1.5 px-3 pb-3 content-start">
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

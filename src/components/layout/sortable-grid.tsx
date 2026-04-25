"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { WebCardItem } from "@/components/card/web-card";
import { Pencil, Plus, GripVertical, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Category, WebCard } from "@/lib/types";

// ============ Type-prefixed ID helpers ============
const catId = (id: string) => `cat:${id}`;
const cardId = (id: string) => `card:${id}`;
const ungroupId = (id: string) => `ungrouped:${id}`;

// ============ Custom collision detection ============
// Use rectIntersection which works across all droppables in the DndContext,
// not just within a single SortableContext.
const collisionDetection: CollisionDetection = (args) => {
  // First try pointerWithin for precise pointer-over detection
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  // Fallback to rectIntersection for broader detection
  return rectIntersection(args);
};

// ============ Props ============
interface SortableGridProps {
  onAddCard?: (categoryId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  onEditCategory?: (category: Category) => void;
  onAddGroup?: (parentId?: string) => void;
}

export function SortableGrid({
  onAddCard,
  onEditCard,
  onDeleteCard,
  onEditCategory,
  onAddGroup,
}: SortableGridProps) {
  const {
    cards,
    categories,
    editMode,
    searchQuery,
    moveCard,
    moveCategoryToParent,
    detachCategoryFromParent,
  } = useAppStore();

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Build hierarchy
  // Parent categories: no parentId AND has sub-groups pointing to it
  const parentCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && categories.some((sg) => sg.parentId === c.id))
      .sort((a, b) => a.order - b.order);
  }, [categories]);

  // Standalone categories: no parentId AND no sub-groups pointing to it
  const standaloneCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && !categories.some((sg) => sg.parentId === c.id))
      .sort((a, b) => a.order - b.order);
  }, [categories]);

  const getSubGroups = useCallback(
    (parentId: string) =>
      categories
        .filter((c) => c.parentId === parentId)
        .sort((a, b) => a.order - b.order),
    [categories]
  );

  const getCardsForCategory = useCallback(
    (categoryId: string) => {
      const filtered = cards
        .filter((c) => c.categoryId === categoryId)
        .sort((a, b) => a.order - b.order);
      if (!searchQuery) return filtered;
      const q = searchQuery.toLowerCase();
      return filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.url.toLowerCase().includes(q) ||
          (c.shortDesc && c.shortDesc.toLowerCase().includes(q))
      );
    },
    [cards, searchQuery]
  );

  // All top-level sortable IDs: parent categories + ungrouped categories
  // SINGLE SortableContext so collision detection works across all of them
  const allTopLevelIds = useMemo(() => {
    const ids: string[] = [];
    for (const parent of parentCategories) {
      ids.push(catId(parent.id));
    }
    for (const standalone of standaloneCategories) {
      ids.push(ungroupId(standalone.id));
    }
    return ids;
  }, [parentCategories, standaloneCategories]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // Track which parent category is being hovered over (for visual highlight)
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setHoveredParentId(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    // When an ungrouped item hovers over a parent category, highlight it
    if (activeId.startsWith("ungrouped:") && overId.startsWith("cat:")) {
      const parentId = overId.replace("cat:", "");
      setHoveredParentId(parentId);
    } else {
      setHoveredParentId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setHoveredParentId(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // ===== Ungrouped → Parent category: demotion =====
    if (activeIdStr.startsWith("ungrouped:") && overIdStr.startsWith("cat:")) {
      const categoryId = activeIdStr.replace("ungrouped:", "");
      const parentId = overIdStr.replace("cat:", "");
      moveCategoryToParent(categoryId, parentId);
      return;
    }

    // ===== Ungrouped → Ungrouped: reorder within "未分类" =====
    if (activeIdStr.startsWith("ungrouped:") && overIdStr.startsWith("ungrouped:")) {
      const activeCatId = activeIdStr.replace("ungrouped:", "");
      const overCatId = overIdStr.replace("ungrouped:", "");
      const ordered = [...standaloneCategories];
      const oldIndex = ordered.findIndex((c) => c.id === activeCatId);
      const newIndex = ordered.findIndex((c) => c.id === overCatId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const [moved] = ordered.splice(oldIndex, 1);
        ordered.splice(newIndex, 0, moved);
        const { reorderCategories } = useAppStore.getState();
        reorderCategories(ordered.map((c) => c.id));
      }
      return;
    }

    // ===== Parent → Parent: reorder parent categories =====
    if (activeIdStr.startsWith("cat:") && overIdStr.startsWith("cat:")) {
      const activeCatId = activeIdStr.replace("cat:", "");
      const overCatId = overIdStr.replace("cat:", "");
      const orderedCats = [...parentCategories];
      const oldIndex = orderedCats.findIndex((c) => c.id === activeCatId);
      const newIndex = orderedCats.findIndex((c) => c.id === overCatId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const [moved] = orderedCats.splice(oldIndex, 1);
        orderedCats.splice(newIndex, 0, moved);
        const { reorderCategories } = useAppStore.getState();
        reorderCategories(orderedCats.map((c) => c.id));
      }
      return;
    }

    // ===== Card → Card: reorder / cross-category =====
    if (activeIdStr.startsWith("card:") && overIdStr.startsWith("card:")) {
      const activeCardId = activeIdStr.replace("card:", "");
      const overCardId = overIdStr.replace("card:", "");
      const overCard = cards.find((c) => c.id === overCardId);
      if (overCard) {
        moveCard(activeCardId, overCard.categoryId, overCard.order);
      }
      return;
    }

    // ===== Card → Category header (parent or ungrouped) =====
    if (activeIdStr.startsWith("card:") && (overIdStr.startsWith("cat:") || overIdStr.startsWith("ungrouped:"))) {
      const activeCardId = activeIdStr.replace("card:", "");
      const targetCatId = overIdStr.replace("cat:", "").replace("ungrouped:", "");
      moveCard(activeCardId, targetCatId, 0);
      return;
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setHoveredParentId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Single SortableContext for ALL top-level items (parents + ungrouped) */}
      <SortableContext items={allTopLevelIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 p-4">
          {/* ====== Top section: Parent categories with sub-groups ====== */}
          {parentCategories.map((parent) => {
            const subGroups = getSubGroups(parent.id);

            return (
              <SortableCategoryBlock
                key={parent.id}
                category={parent}
                isParent
                editMode={editMode}
                isHovered={hoveredParentId === parent.id}
                isDraggingActive={activeId !== null}
                onEditCategory={onEditCategory}
                onAddCard={onAddCard}
                onAddGroup={onAddGroup}
              >

                <div className="space-y-3">
                  {subGroups.map((sub) => (
                    <SubGroupBlock
                      key={sub.id}
                      category={sub}
                      cards={getCardsForCategory(sub.id)}
                      editMode={editMode}
                      editingCategoryId={editingCategoryId}
                      onEditCategory={onEditCategory}
                      onAddCard={onAddCard}
                      onEditCard={onEditCard}
                      onDeleteCard={onDeleteCard}
                      setEditingCategoryId={setEditingCategoryId}
                      onDetach={() => detachCategoryFromParent(sub.id)}
                    />
                  ))}
                  {subGroups.length === 0 && !editMode && (
                    <p className="text-[10px] text-muted-foreground py-1">暂无分组</p>
                  )}

                </div>
              </SortableCategoryBlock>
            );
          })}

          {/* ====== Bottom section: "未分类" with standalone categories ====== */}
          {standaloneCategories.length > 0 && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20">
              {/* Section header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                <span className="text-xs font-semibold text-muted-foreground">
                  未分类
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  ({standaloneCategories.length} 个分组)
                </span>
                {editMode && (
                  <span className="text-[10px] text-muted-foreground/50 ml-1">
                    — 拖入上方分类即可降级为分组
                  </span>
                )}
              </div>

              {/* Standalone categories */}
              <div className="p-3 space-y-2">
                {standaloneCategories.map((cat) => {
                  const catCards = getCardsForCategory(cat.id);
                  return (
                    <SortableUngroupedBlock
                      key={cat.id}
                      category={cat}
                      cards={catCards}
                      editMode={editMode}
                      editingCategoryId={editingCategoryId}
                      onEditCategory={onEditCategory}
                      onAddCard={onAddCard}
                      onEditCard={onEditCard}
                      onDeleteCard={onDeleteCard}
                      setEditingCategoryId={setEditingCategoryId}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ============ Sortable Parent Category Block ============
interface SortableCategoryBlockProps {
  category: Category;
  isParent?: boolean;
  editMode: boolean;
  isHovered?: boolean;
  isDraggingActive?: boolean;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  children: React.ReactNode;
}

function SortableCategoryBlock({
  category,
  isParent,
  editMode,
  isHovered,
  isDraggingActive,
  onEditCategory,
  onAddCard,
  onAddGroup,
  children,
}: SortableCategoryBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: catId(category.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        rounded-lg border bg-card
        ${isHovered ? "border-primary/60 shadow-sm bg-primary/[0.03]" : "border-border"}
        transition-all duration-300 ease-out
      `}
    >
      {/* Category header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        {editMode && (
          <span
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Color dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />

        <span className="text-sm font-semibold text-foreground font-serif">
          {category.name}
        </span>

        {/* Smooth drop hint when dragging an ungrouped item over this parent */}
        {isHovered && isParent && (
          <span className="text-[10px] text-primary/70 font-medium ml-1 animate-in fade-in duration-300">
            释放以降级到此分类
          </span>
        )}
        {/* Subtle hint when dragging but not hovering */}
        {isDraggingActive && isParent && !isHovered && (
          <span className="text-[10px] text-muted-foreground/30 ml-1 transition-opacity duration-300">
            拖入分组到此分类
          </span>
        )}

        {/* Action buttons */}
        {editMode && (
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onEditCategory?.(category)}
              title="编辑分类"
            >
              <Pencil className="w-3 h-3" />
            </Button>
            {isParent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onAddGroup?.(category.id)}
                title="添加分组"
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onAddCard?.()}
              title="添加网页"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Category body */}
      <div className="p-3">{children}</div>
    </div>
  );
}

// ============ Sub-Group Block (inside a parent category) ============
interface SubGroupBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  editingCategoryId: string | null;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  setEditingCategoryId: (id: string | null) => void;
  onDetach?: () => void;
}

function SubGroupBlock({
  category,
  cards,
  editMode,
  editingCategoryId,
  onEditCategory,
  onAddCard,
  onEditCard,
  onDeleteCard,
  setEditingCategoryId,
  onDetach,
}: SubGroupBlockProps) {
  const isEditing = editingCategoryId === category.id;

  return (
    <div className="rounded-md border border-border/40 bg-background">
      {/* Sub-group header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        {/* Color bar */}
        <div
          className="w-1 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span className="text-xs font-medium text-foreground">
          {category.name}
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({cards.length})
        </span>

        {editMode && (
          <div className="flex items-center gap-0.5 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => {
                setEditingCategoryId(isEditing ? null : category.id);
                onEditCategory?.(category);
              }}
              title="编辑分组"
            >
              <Pencil className="w-2.5 h-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => onAddCard?.(category.id)}
              title="添加网页"
            >
              <Plus className="w-2.5 h-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={onDetach}
              title="升级为分类（移到未分类）"
            >
              <ArrowUpFromLine className="w-2.5 h-2.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Cards */}
      <SortableContext
        items={cards.map((c) => cardId(c.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-wrap gap-1 px-2.5 pb-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              categoryColor={category.color}
              editMode={editMode}
              isEditing={isEditing}
              onEdit={() => onEditCard?.(card)}
              onDelete={() => onDeleteCard?.(card)}
            />
          ))}
          {cards.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-1">
              暂无网站
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ============ Sortable Ungrouped Block (standalone category in "未分类") ============
interface SortableUngroupedBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  editingCategoryId: string | null;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  setEditingCategoryId: (id: string | null) => void;
}

function SortableUngroupedBlock({
  category,
  cards,
  editMode,
  editingCategoryId,
  onEditCategory,
  onAddCard,
  onEditCard,
  onDeleteCard,
  setEditingCategoryId,
}: SortableUngroupedBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ungroupId(category.id) });

  const isEditing = editingCategoryId === category.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-border/40 bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        {editMode && (
          <span
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3 h-3" />
          </span>
        )}
        {/* Color bar */}
        <div
          className="w-1 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span className="text-xs font-medium text-foreground">
          {category.name}
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({cards.length})
        </span>

        {editMode && (
          <div className="flex items-center gap-0.5 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => {
                setEditingCategoryId(isEditing ? null : category.id);
                onEditCategory?.(category);
              }}
              title="编辑"
            >
              <Pencil className="w-2.5 h-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => onAddCard?.(category.id)}
              title="添加网页"
            >
              <Plus className="w-2.5 h-2.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Cards */}
      <SortableContext
        items={cards.map((c) => cardId(c.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-wrap gap-1 px-2.5 pb-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              categoryColor={category.color}
              editMode={editMode}
              isEditing={isEditing}
              onEdit={() => onEditCard?.(card)}
              onDelete={() => onDeleteCard?.(card)}
            />
          ))}
          {cards.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-1">
              暂无网站
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ============ Sortable Card ============
interface SortableCardProps {
  card: WebCard;
  categoryColor: string;
  editMode: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableCard({
  card,
  categoryColor,
  editMode,
  isEditing,
  onEdit,
  onDelete,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardId(card.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <WebCardItem
        card={card}
        categoryColor={categoryColor}
        editMode={editMode && isEditing}
        onEdit={onEdit}
        onDelete={onDelete}
        dragListeners={editMode ? { ...attributes, ...listeners } : null}
      />
    </div>
  );
}

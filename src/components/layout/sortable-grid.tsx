"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { WebCardItem } from "@/components/card/web-card";
import { Pencil, Plus, GripVertical, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
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
const dropParentId = (id: string) => `drop-parent:${id}`;

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

  // Sortable IDs
  const parentCatIds = useMemo(
    () => parentCategories.map((c) => catId(c.id)),
    [parentCategories]
  );

  const ungroupedCatIds = useMemo(
    () => standaloneCategories.map((c) => ungroupId(c.id)),
    [standaloneCategories]
  );

  const allCardIds = useMemo(
    () => cards.map((c) => cardId(c.id)),
    [cards]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Ungrouped category dropped on parent drop zone → demotion
    if (activeId.startsWith("ungrouped:") && overId.startsWith("drop-parent:")) {
      const categoryId = activeId.replace("ungrouped:", "");
      const parentId = overId.replace("drop-parent:", "");
      moveCategoryToParent(categoryId, parentId);
      return;
    }

    // Ungrouped category reorder within "未分类"
    if (activeId.startsWith("ungrouped:") && overId.startsWith("ungrouped:")) {
      const activeCatId = activeId.replace("ungrouped:", "");
      const overCatId = overId.replace("ungrouped:", "");
      const ordered = [...standaloneCategories];
      const oldIndex = ordered.findIndex((c) => c.id === activeCatId);
      const newIndex = ordered.findIndex((c) => c.id === overCatId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const [moved] = ordered.splice(oldIndex, 1);
        ordered.splice(newIndex, 0, moved);
        // Update order
        const { reorderCategories } = useAppStore.getState();
        reorderCategories(ordered.map((c) => c.id));
      }
      return;
    }

    // Parent category reorder
    if (activeId.startsWith("cat:") && overId.startsWith("cat:")) {
      const activeCatId = activeId.replace("cat:", "");
      const overCatId = overId.replace("cat:", "");
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

    // Card reorder / cross-category
    if (activeId.startsWith("card:") && overId.startsWith("card:")) {
      const activeCardId = activeId.replace("card:", "");
      const overCardId = overId.replace("card:", "");
      const overCard = cards.find((c) => c.id === overCardId);
      if (overCard) {
        moveCard(activeCardId, overCard.categoryId, overCard.order);
      }
      return;
    }

    // Card dropped on category title (parent or ungrouped)
    if (activeId.startsWith("card:") && (overId.startsWith("cat:") || overId.startsWith("ungrouped:"))) {
      const activeCardId = activeId.replace("card:", "");
      const targetCatId = overId.replace("cat:", "").replace("ungrouped:", "");
      moveCard(activeCardId, targetCatId, 0);
      return;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4 p-4">
        {/* ====== Top section: Parent categories with sub-groups ====== */}
        <SortableContext items={parentCatIds} strategy={verticalListSortingStrategy}>
          {parentCategories.map((parent) => {
            const subGroups = getSubGroups(parent.id);

            return (
              <SortableCategoryBlock
                key={parent.id}
                category={parent}
                isParent
                editMode={editMode}
                onEditCategory={onEditCategory}
                onAddCard={onAddCard}
                onAddGroup={onAddGroup}
                onDetachCategory={detachCategoryFromParent}
              >
                {/* Droppable zone for demotion */}
                {editMode && <ParentDropZone parentId={parent.id} />}

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
        </SortableContext>

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

            {/* Standalone categories as cards */}
            <div className="p-3 space-y-2">
              <SortableContext items={ungroupedCatIds} strategy={verticalListSortingStrategy}>
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
                      allCardIds={allCardIds}
                      setEditingCategoryId={setEditingCategoryId}
                    />
                  );
                })}
              </SortableContext>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}

// ============ Droppable zone for demotion (inside parent category) ============
function ParentDropZone({ parentId }: { parentId: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropParentId(parentId),
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-md border-2 border-dashed transition-colors mb-2
        flex items-center justify-center py-1.5
        ${isOver
          ? "border-primary bg-primary/10 text-primary"
          : "border-muted-foreground/20 text-muted-foreground/40"
        }
      `}
    >
      <span className="text-[10px]">拖入分组到此处</span>
    </div>
  );
}

// ============ Sortable Parent Category Block ============
interface SortableCategoryBlockProps {
  category: Category;
  isParent?: boolean;
  editMode: boolean;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  onDetachCategory?: (categoryId: string) => void;
  children: React.ReactNode;
}

function SortableCategoryBlock({
  category,
  isParent,
  editMode,
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card"
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
  allCardIds: string[];
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
    opacity: isDragging ? 0.5 : 1,
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
    opacity: isDragging ? 0.5 : 1,
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

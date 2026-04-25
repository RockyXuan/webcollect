"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { WebCardItem } from "@/components/card/web-card";
import { Pencil, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
    reorderCards,
    reorderCategories,
  } = useAppStore();

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Build hierarchy: parent categories → sub-groups → cards
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId).sort((a, b) => a.order - b.order),
    [categories]
  );

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

  // Also get orphan categories (no parentId, no sub-groups with cards)
  const standaloneCategories = useMemo(() => {
    return categories.filter(
      (c) => !c.parentId && !categories.some((sg) => sg.parentId === c.id)
    );
  }, [categories]);

  // All category IDs for sortable (parents + sub-groups + standalone)
  const allSortableCatIds = useMemo(() => {
    const ids: string[] = [];
    for (const parent of parentCategories) {
      if (categories.some((sg) => sg.parentId === parent.id)) {
        ids.push(catId(parent.id));
      }
    }
    for (const standalone of standaloneCategories) {
      ids.push(catId(standalone.id));
    }
    return ids;
  }, [parentCategories, standaloneCategories, categories]);

  // All card IDs for sortable
  const allCardIds = useMemo(
    () => cards.map((c) => cardId(c.id)),
    [cards]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Category reorder
    if (activeId.startsWith("cat:") && overId.startsWith("cat:")) {
      const activeCatId = activeId.replace("cat:", "");
      const overCatId = overId.replace("cat:", "");
      // Find current order of categories
      const orderedCats = categories
        .filter((c) => !c.parentId)
        .sort((a, b) => a.order - b.order);
      const oldIndex = orderedCats.findIndex((c) => c.id === activeCatId);
      const newIndex = orderedCats.findIndex((c) => c.id === overCatId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrdered = [...orderedCats];
        const [moved] = newOrdered.splice(oldIndex, 1);
        newOrdered.splice(newIndex, 0, moved);
        reorderCategories(newOrdered.map((c) => c.id));
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

    // Card dropped on category title
    if (activeId.startsWith("card:") && overId.startsWith("cat:")) {
      const activeCardId = activeId.replace("card:", "");
      const targetCatId = overId.replace("cat:", "");
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
        {/* Parent categories with sub-groups */}
        {parentCategories.map((parent) => {
          const subGroups = getSubGroups(parent.id);
          if (subGroups.length === 0) return null; // Skip empty parents

          return (
            <SortableCategoryBlock
              key={parent.id}
              category={parent}
              isParent
              editMode={editMode}
              editingCategoryId={editingCategoryId}
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
                    allCardIds={allCardIds}
                    setEditingCategoryId={setEditingCategoryId}
                  />
                ))}
              </div>
            </SortableCategoryBlock>
          );
        })}

        {/* Standalone categories (no parent, no sub-groups) */}
        {standaloneCategories.map((cat) => {
          const catCards = getCardsForCategory(cat.id);
          return (
            <SortableCategoryBlock
              key={cat.id}
              category={cat}
              editMode={editMode}
              editingCategoryId={editingCategoryId}
              onEditCategory={onEditCategory}
              onAddCard={onAddCard}
              onAddGroup={onAddGroup}
            >
              <SortableContext
                items={catCards.map((c) => cardId(c.id))}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-wrap gap-1.5">
                  {catCards.map((card) => (
                    <SortableCard
                      key={card.id}
                      card={card}
                      categoryColor={cat.color}
                      editMode={editMode}
                      isEditing={editingCategoryId === cat.id}
                      onEdit={() => onEditCard?.(card)}
                      onDelete={() => onDeleteCard?.(card)}
                      onToggleEdit={() =>
                        setEditingCategoryId(
                          editingCategoryId === cat.id ? null : cat.id
                        )
                      }
                    />
                  ))}
                  {catCards.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">
                      暂无网站，点击 + 添加
                    </p>
                  )}
                </div>
              </SortableContext>
            </SortableCategoryBlock>
          );
        })}
      </div>
    </DndContext>
  );
}

// ============ Sortable Parent Category Block ============
interface SortableCategoryBlockProps {
  category: Category;
  isParent?: boolean;
  editMode: boolean;
  editingCategoryId: string | null;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  children: React.ReactNode;
}

function SortableCategoryBlock({
  category,
  isParent,
  editMode,
  editingCategoryId,
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

// ============ Sub-Group Block ============
interface SubGroupBlockProps {
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

function SubGroupBlock({
  category,
  cards,
  editMode,
  editingCategoryId,
  onEditCategory,
  onAddCard,
  onEditCard,
  onDeleteCard,
  allCardIds,
  setEditingCategoryId,
}: SubGroupBlockProps) {
  const isEditing = editingCategoryId === category.id;

  return (
    <div className="rounded-md border border-border/40 bg-background">
      {/* Sub-group header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        {/* Color bar at top */}
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
              onToggleEdit={() =>
                setEditingCategoryId(isEditing ? null : category.id)
              }
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
  onToggleEdit: () => void;
}

function SortableCard({
  card,
  categoryColor,
  editMode,
  isEditing,
  onEdit,
  onDelete,
  onToggleEdit,
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

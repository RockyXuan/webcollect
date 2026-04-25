"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
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
  DragOverlay,
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
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

// ============ Default width calculation ============
function getDefaultWidthPercent(cardCount: number): number {
  if (cardCount <= 2) return 25;
  if (cardCount <= 4) return 33;
  if (cardCount <= 6) return 50;
  return 100;
}

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
    categoryWidths,
  } = useAppStore();

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Build hierarchy
  const parentCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && categories.some((sg) => sg.parentId === c.id))
      .sort((a, b) => a.order - b.order);
  }, [categories]);

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

  // All top-level sortable IDs
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

  // Drag overlay label
  const getOverlayLabel = useCallback(
    (id: string): { name: string; color: string } | null => {
      if (id.startsWith("cat:")) {
        const cat = categories.find((c) => c.id === id.replace("cat:", ""));
        return cat ? { name: cat.name, color: cat.color } : null;
      }
      if (id.startsWith("ungrouped:")) {
        const cat = categories.find((c) => c.id === id.replace("ungrouped:", ""));
        return cat ? { name: cat.name, color: cat.color } : null;
      }
      if (id.startsWith("card:")) {
        const card = cards.find((c) => c.id === id.replace("card:", ""));
        return card ? { name: card.title, color: "#888" } : null;
      }
      return null;
    },
    [categories, cards]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setHoveredParentId(null);
      return;
    }
    const aid = String(active.id);
    const oid = String(over.id);
    if (aid.startsWith("ungrouped:") && oid.startsWith("cat:")) {
      setHoveredParentId(oid.replace("cat:", ""));
    } else {
      setHoveredParentId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setHoveredParentId(null);
    if (!over || active.id === over.id) return;

    const aid = String(active.id);
    const oid = String(over.id);

    // Ungrouped → Parent category: demotion
    if (aid.startsWith("ungrouped:") && oid.startsWith("cat:")) {
      const categoryId = aid.replace("ungrouped:", "");
      const parentId = oid.replace("cat:", "");
      moveCategoryToParent(categoryId, parentId);
      return;
    }

    // Ungrouped → Ungrouped: reorder
    if (aid.startsWith("ungrouped:") && oid.startsWith("ungrouped:")) {
      const activeCatId = aid.replace("ungrouped:", "");
      const overCatId = oid.replace("ungrouped:", "");
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

    // Parent → Parent: reorder
    if (aid.startsWith("cat:") && oid.startsWith("cat:")) {
      const activeCatId = aid.replace("cat:", "");
      const overCatId = oid.replace("cat:", "");
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

    // Card → Card: reorder / cross-category
    if (aid.startsWith("card:") && oid.startsWith("card:")) {
      const activeCardId = aid.replace("card:", "");
      const overCardId = oid.replace("card:", "");
      const overCard = cards.find((c) => c.id === overCardId);
      if (overCard) {
        moveCard(activeCardId, overCard.categoryId, overCard.order);
      }
      return;
    }

    // Card → Category header
    if (aid.startsWith("card:") && (oid.startsWith("cat:") || oid.startsWith("ungrouped:"))) {
      const activeCardId = aid.replace("card:", "");
      const targetCatId = oid.replace("cat:", "").replace("ungrouped:", "");
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
      <SortableContext items={allTopLevelIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 p-4">
          {/* ====== Top section: Parent categories ====== */}
          {parentCategories.map((parent) => {
            const subGroups = getSubGroups(parent.id);
            const totalCards = subGroups.reduce(
              (sum, sg) => sum + getCardsForCategory(sg.id).length,
              0
            );

            return (
              <SortableCategoryBlock
                key={parent.id}
                category={parent}
                isParent
                editMode={editMode}
                isHovered={hoveredParentId === parent.id}
                isDraggingActive={activeId !== null}
                widthPercent={categoryWidths[parent.id]}
                defaultWidthPercent={getDefaultWidthPercent(totalCards)}
                onEditCategory={onEditCategory}
                onAddCard={onAddCard}
                onAddGroup={onAddGroup}
              >
                {/* Sub-groups in flex-wrap so they can sit side by side */}
                <div className="flex flex-wrap gap-3">
                  {subGroups.map((sub) => {
                    const subCards = getCardsForCategory(sub.id);
                    return (
                      <SubGroupBlock
                        key={sub.id}
                        category={sub}
                        cards={subCards}
                        editMode={editMode}
                        editingCategoryId={editingCategoryId}
                        widthPercent={categoryWidths[sub.id]}
                        defaultWidthPercent={getDefaultWidthPercent(subCards.length)}
                        onEditCategory={onEditCategory}
                        onAddCard={onAddCard}
                        onEditCard={onEditCard}
                        onDeleteCard={onDeleteCard}
                        setEditingCategoryId={setEditingCategoryId}
                        onDetach={() => detachCategoryFromParent(sub.id)}
                      />
                    );
                  })}
                  {subGroups.length === 0 && !editMode && (
                    <p className="text-[10px] text-muted-foreground py-1">暂无分组</p>
                  )}
                </div>
              </SortableCategoryBlock>
            );
          })}

          {/* ====== Bottom section: "未分类" ====== */}
          {standaloneCategories.length > 0 && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20">
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
              <div className="p-3 flex flex-wrap gap-3">
                {standaloneCategories.map((cat) => {
                  const catCards = getCardsForCategory(cat.id);
                  return (
                    <SortableUngroupedBlock
                      key={cat.id}
                      category={cat}
                      cards={catCards}
                      editMode={editMode}
                      editingCategoryId={editingCategoryId}
                      widthPercent={categoryWidths[cat.id]}
                      defaultWidthPercent={getDefaultWidthPercent(catCards.length)}
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

      {/* ====== Drag Overlay: compact badge ====== */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeId ? (
          (() => {
            const info = getOverlayLabel(activeId);
            if (!info) return null;
            return (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md
                  bg-card/95 border border-border/40 shadow-sm backdrop-blur-sm
                  text-xs font-medium text-foreground"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: info.color }}
                />
                {info.name}
              </div>
            );
          })()
        ) : null}
      </DragOverlay>
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
  widthPercent?: number;
  defaultWidthPercent: number;
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
  widthPercent: storedWidth,
  defaultWidthPercent,
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

  const { setCategoryWidth } = useAppStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localWidth, setLocalWidth] = useState<number | null>(null);

  const widthPercent = localWidth ?? storedWidth ?? defaultWidthPercent;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: `${widthPercent}%`,
  };

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const parentEl = container.parentElement;
      if (!parentEl) return;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = parentEl.offsetWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newPercent = Math.max(15, Math.min(100, ((startWidth + dx) / parentWidth) * 100));
        setLocalWidth(newPercent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) setCategoryWidth(category.id, prev);
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [category.id, setCategoryWidth]
  );

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  return (
    <div
      ref={setRef}
      style={style}
      className={`
        relative rounded-lg border bg-card
        ${isHovered ? "border-primary/60 shadow-sm bg-primary/[0.03]" : "border-border"}
        transition-[border-color,background-color,box-shadow] duration-300 ease-out
      `}
    >
      {/* Category header - buttons right next to title */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 flex-wrap">
        {editMode && (
          <span
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        )}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span className="text-sm font-semibold text-foreground font-serif">
          {category.name}
        </span>

        {/* Smooth drop hint */}
        {isHovered && isParent && (
          <span className="text-[10px] text-primary/70 font-medium animate-in fade-in duration-300">
            释放以降级到此分类
          </span>
        )}
        {isDraggingActive && isParent && !isHovered && (
          <span className="text-[10px] text-muted-foreground/30 transition-opacity duration-300">
            拖入分组到此分类
          </span>
        )}

        {/* Action buttons - right next to title, no ml-auto */}
        {editMode && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-0.5"
              onClick={() => onEditCategory?.(category)}
              title="编辑分类"
            >
              <Pencil className="w-2.5 h-2.5" />
            </Button>
            {isParent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => onAddGroup?.(category.id)}
                title="添加分组"
              >
                <Plus className="w-2.5 h-2.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => onAddCard?.()}
              title="添加网页"
            >
              <Plus className="w-2.5 h-2.5" />
            </Button>
          </>
        )}
      </div>

      {/* Category body */}
      <div className="p-3">{children}</div>

      {/* Resize handle - right edge */}
      {editMode && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
            hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r-lg"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}

// ============ Sub-Group Block (inside a parent category) ============
interface SubGroupBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  editingCategoryId: string | null;
  widthPercent?: number;
  defaultWidthPercent: number;
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
  widthPercent: storedWidth,
  defaultWidthPercent,
  onEditCategory,
  onAddCard,
  onEditCard,
  onDeleteCard,
  setEditingCategoryId,
  onDetach,
}: SubGroupBlockProps) {
  const isEditing = editingCategoryId === category.id;
  const { setCategoryWidth } = useAppStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localWidth, setLocalWidth] = useState<number | null>(null);

  const widthPercent = localWidth ?? storedWidth ?? defaultWidthPercent;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const parentEl = container.parentElement;
      if (!parentEl) return;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = parentEl.offsetWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newPercent = Math.max(15, Math.min(100, ((startWidth + dx) / parentWidth) * 100));
        setLocalWidth(newPercent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) setCategoryWidth(category.id, prev);
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [category.id, setCategoryWidth]
  );

  return (
    <div
      ref={containerRef}
      style={{ width: `${widthPercent}%` }}
      className="relative rounded-md border border-border/40 bg-background"
    >
      {/* Sub-group header - buttons right next to title */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 flex-wrap">
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
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-0.5"
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
          </>
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
            <p className="text-[10px] text-muted-foreground py-1">暂无网站</p>
          )}
        </div>
      </SortableContext>

      {/* Resize handle - right edge */}
      {editMode && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
            hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r-md"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}

// ============ Sortable Ungrouped Block ============
interface SortableUngroupedBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  editingCategoryId: string | null;
  widthPercent?: number;
  defaultWidthPercent: number;
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
  widthPercent: storedWidth,
  defaultWidthPercent,
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
  const { setCategoryWidth } = useAppStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localWidth, setLocalWidth] = useState<number | null>(null);

  const widthPercent = localWidth ?? storedWidth ?? defaultWidthPercent;

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: `${widthPercent}%`,
  };

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const parentEl = container.parentElement;
      if (!parentEl) return;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = parentEl.offsetWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newPercent = Math.max(15, Math.min(100, ((startWidth + dx) / parentWidth) * 100));
        setLocalWidth(newPercent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) setCategoryWidth(category.id, prev);
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [category.id, setCategoryWidth]
  );

  return (
    <div
      ref={setRef}
      style={style}
      className="relative rounded-md border border-border/40 bg-background"
    >
      {/* Header - buttons right next to title */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 flex-wrap">
        {editMode && (
          <span
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3 h-3" />
          </span>
        )}
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
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-0.5"
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
          </>
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
            <p className="text-[10px] text-muted-foreground py-1">暂无网站</p>
          )}
        </div>
      </SortableContext>

      {/* Resize handle - right edge */}
      {editMode && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
            hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r-md"
          onMouseDown={handleResizeStart}
        />
      )}
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

"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { InlineEditableText } from "@/components/ui/inline-editable-text";
import { EditActionDock, type EditAction } from "@/components/ui/edit-action-dock";
import { WebCardItem } from "@/components/card/web-card";
import {
  getSearchMatchedCardIds,
  getSearchMatchedCategoryIds,
  searchWorkspace,
} from "@/lib/workspace-search";
import { Pencil, PencilOff, Plus, GripVertical, ArrowUpFromLine, ArrowDownFromLine, Folder, Layers, Trash2, Send, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Category, WebCard } from "@/lib/types";
import type { CategoryLayoutPreference } from "@/lib/types";
import {
  calculateColumnsForWidth,
  clampLayoutColumns,
  getDefaultLayoutColumns,
  getGroupWidthRemForColumns,
} from "@/lib/category-layouts";

// ============ Type-prefixed ID helpers ============
const catId = (id: string) => `cat:${id}`;
const cardId = (id: string) => `card:${id}`;
const ungroupId = (id: string) => `ungrouped:${id}`;
const subId = (id: string) => `sub:${id}`;

// ============ Custom collision detection ============
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

// ============ Default width calculation ============
function getDefaultWidthPercent(cardCount: number, groupCount: number): number {
  if (groupCount <= 1) {
    if (cardCount <= 4) return 33;
    if (cardCount <= 12) return 50;
    return 66;
  }
  if (cardCount <= 2) return 33;
  if (cardCount <= 8) return 50;
  if (cardCount <= 16) return 66;
  return 100;
}

export function getSmartParentWidthPercent(rawWidth: number, defaultWidth: number): number {
  const safeWidth = Number.isFinite(rawWidth) ? rawWidth : defaultWidth;
  return Math.max(30, Math.min(100, safeWidth));
}

function getDefaultChildBasis(cardCount: number): string {
  return `${getGroupWidthRemForColumns(getDefaultLayoutColumns(cardCount))}rem`;
}

function getMaxChildWidth(cardCount: number): string {
  return `${getGroupWidthRemForColumns(Math.min(4, Math.max(1, cardCount)))}rem`;
}

export function getSmartChildStyle(
  widthPercent: number | null,
  cardCount: number,
  columns?: number
): React.CSSProperties {
  const maxWidth = getMaxChildWidth(cardCount);
  const columnWidth = `${getGroupWidthRemForColumns(clampLayoutColumns(columns, cardCount))}rem`;

  if (widthPercent !== null) {
    const minPercent = cardCount <= 4 ? 8 : 14;
    const maxPercent = 100;
    const smartWidth = Math.max(minPercent, Math.min(maxPercent, widthPercent));
    const preferredWidth = columns
      ? `min(100%, max(${columnWidth}, calc(${smartWidth}% - 0.75rem)))`
      : `calc(${smartWidth}% - 0.75rem)`;
    return {
      flex: `0 1 ${preferredWidth}`,
      width: preferredWidth,
      minWidth: columns ? `min(100%, ${columnWidth})` : "min(100%, 16.75rem)",
      maxWidth,
    };
  }

  const basis = columns ? columnWidth : getDefaultChildBasis(cardCount);
  return {
    flex: `0 1 ${basis}`,
    width: basis,
    minWidth: "min(100%, 16.75rem)",
    maxWidth,
  };
}

function DirectEditButton({
  label,
  onClick,
}: {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="wc-direct-edit-trigger h-7 w-7 shrink-0 rounded-full p-0 text-slate-500 hover:bg-white/80 hover:text-blue-600 animate-in fade-in duration-200"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Pencil className="w-2.5 h-2.5" />
    </Button>
  );
}

// ============ Props ============
interface SortableGridProps {
  onAddCard?: (categoryId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  onEditCategory?: (category: Category) => void;
  onAddGroup?: (parentId?: string) => void;
  onUpdateCard?: (card: WebCard) => void;
  onShipCategory?: (category: Category) => void;
  onShipCard?: (card: WebCard) => void;
}

export function SortableGrid({
  onAddCard,
  onEditCard,
  onDeleteCard,
  onEditCategory,
  onAddGroup,
  onUpdateCard,
  onShipCategory,
  onShipCard,
}: SortableGridProps) {
  const {
    cards,
    categories,
    sections,
    activeSectionId,
    editMode,
    searchQuery,
    moveCard,
    moveCategoryToParent,
    detachCategoryFromParent,
    promoteToParent,
    categoryWidths,
    toggleEditMode,
  } = useAppStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const visibleCategories = useMemo(() => {
    return categories.filter((c) => (c.sectionId || "section-default") === activeSectionId);
  }, [categories, activeSectionId]);

  const trimmedSearchQuery = searchQuery.trim();
  const searchResults = useMemo(
    () => (
      trimmedSearchQuery
        ? searchWorkspace({ cards, categories, sections }, trimmedSearchQuery)
        : null
    ),
    [cards, categories, sections, trimmedSearchQuery]
  );
  const matchedCardIds = useMemo(
    () => (searchResults ? getSearchMatchedCardIds(searchResults) : new Set<string>()),
    [searchResults]
  );
  const matchedCategoryIds = useMemo(
    () => (searchResults ? getSearchMatchedCategoryIds(searchResults) : new Set<string>()),
    [searchResults]
  );

  const categoryHasSearchMatch = useCallback(
    (category: Category) => {
      if (!searchResults) return true;
      if (matchedCategoryIds.has(category.id)) return true;
      if (cards.some((card) => card.categoryId === category.id && matchedCardIds.has(card.id))) return true;
      return visibleCategories.some(
        (child) =>
          child.parentId === category.id &&
          (matchedCategoryIds.has(child.id) ||
            cards.some((card) => card.categoryId === child.id && matchedCardIds.has(card.id)))
      );
    },
    [cards, matchedCardIds, matchedCategoryIds, searchResults, visibleCategories]
  );

  // Build hierarchy
  // Parent categories: explicitly marked isParent OR has sub-groups
  const parentCategories = useMemo(() => {
    return visibleCategories
      .filter((c) => !c.parentId && (c.isParent || visibleCategories.some((sg) => sg.parentId === c.id)))
      .filter(categoryHasSearchMatch)
      .sort((a, b) => a.order - b.order);
  }, [categoryHasSearchMatch, visibleCategories]);

  // Standalone (ungrouped): no parentId, not a parent, no sub-groups
  const standaloneCategories = useMemo(() => {
    return visibleCategories
      .filter((c) => !c.parentId && !c.isParent && !visibleCategories.some((sg) => sg.parentId === c.id))
      .filter(categoryHasSearchMatch)
      .sort((a, b) => a.order - b.order);
  }, [categoryHasSearchMatch, visibleCategories]);

  const getSubGroups = useCallback(
    (parentId: string) =>
      visibleCategories
        .filter((c) => c.parentId === parentId)
        .filter((category) => !searchResults || matchedCategoryIds.has(parentId) || categoryHasSearchMatch(category))
        .sort((a, b) => a.order - b.order),
    [categoryHasSearchMatch, matchedCategoryIds, searchResults, visibleCategories]
  );

  const getCardsForCategory = useCallback(
    (categoryId: string) => {
      const filtered = cards
        .filter((c) => c.categoryId === categoryId)
        .sort((a, b) => a.order - b.order);
      if (!searchResults) return filtered;
      if (matchedCategoryIds.has(categoryId)) return filtered;
      const category = categories.find((item) => item.id === categoryId);
      if (category?.parentId && matchedCategoryIds.has(category.parentId)) return filtered;
      return filtered.filter((card) => matchedCardIds.has(card.id));
    },
    [cards, categories, matchedCardIds, matchedCategoryIds, searchResults]
  );

  const parentSortableIds = useMemo(
    () => parentCategories.map((parent) => catId(parent.id)),
    [parentCategories]
  );
  const standaloneSortableIds = useMemo(
    () => standaloneCategories.map((standalone) => ungroupId(standalone.id)),
    [standaloneCategories]
  );

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
      if (id.startsWith("sub:")) {
        const cat = categories.find((c) => c.id === id.replace("sub:", ""));
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

  const getContainingParentId = useCallback(
    (id: string): string | null => {
      if (id.startsWith("cat:")) return id.replace("cat:", "");
      if (id.startsWith("sub:")) {
        const category = categories.find((c) => c.id === id.replace("sub:", ""));
        return category?.parentId || null;
      }
      if (id.startsWith("card:")) {
        const card = cards.find((c) => c.id === id.replace("card:", ""));
        const category = card ? categories.find((c) => c.id === card.categoryId) : null;
        return category?.parentId || (category?.isParent ? category.id : null);
      }
      return null;
    },
    [categories, cards]
  );

  const getSubGroupDropTarget = useCallback(
    (id: string): { parentId: string; overSubId?: string } | null => {
      if (id.startsWith("cat:")) {
        return { parentId: id.replace("cat:", "") };
      }
      if (id.startsWith("sub:")) {
        const category = categories.find((c) => c.id === id.replace("sub:", ""));
        return category?.parentId ? { parentId: category.parentId, overSubId: category.id } : null;
      }
      if (id.startsWith("card:")) {
        const card = cards.find((c) => c.id === id.replace("card:", ""));
        const category = card ? categories.find((c) => c.id === card.categoryId) : null;
        if (category?.parentId) return { parentId: category.parentId, overSubId: category.id };
        if (category?.isParent) return { parentId: category.id };
      }
      return null;
    },
    [categories, cards]
  );

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setHoveredParentId(null);
      return;
    }
    const aid = String(active.id);
    const oid = String(over.id);

    if (!aid.startsWith("ungrouped:") && !aid.startsWith("sub:")) {
      setHoveredParentId(null);
      return;
    }

    if (oid.startsWith("cat:")) {
      setHoveredParentId(oid.replace("cat:", ""));
      return;
    }

    if (oid.startsWith("sub:")) {
      const subCatId = oid.replace("sub:", "");
      const subCat = categories.find((c) => c.id === subCatId);
      if (subCat?.parentId) {
        if (aid.startsWith("sub:")) {
          const activeSubId = aid.replace("sub:", "");
          const activeSub = categories.find((c) => c.id === activeSubId);
          if (activeSub?.parentId === subCat.parentId) {
            setHoveredParentId(null);
            return;
          }
        }
        setHoveredParentId(subCat.parentId);
        return;
      }
    }

    if (oid.startsWith("card:")) {
      const cardData = cards.find((c) => c.id === oid.replace("card:", ""));
      if (cardData) {
        const cat = categories.find((c) => c.id === cardData.categoryId);
        if (cat?.parentId) {
          setHoveredParentId(cat.parentId);
          return;
        }
      }
    }

    setHoveredParentId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setHoveredParentId(null);
    if (!over || active.id === over.id) return;

    const aid = String(active.id);
    const oid = String(over.id);

    // Ungrouped → Parent category: demotion (direct hit or hit inside parent)
    if (aid.startsWith("ungrouped:")) {
      let targetParentId: string | null = null;

      if (oid.startsWith("cat:")) {
        targetParentId = oid.replace("cat:", "");
      } else if (oid.startsWith("sub:")) {
        const subCat = categories.find((c) => c.id === oid.replace("sub:", ""));
        if (subCat?.parentId) targetParentId = subCat.parentId;
      } else if (oid.startsWith("card:")) {
        const cardData = cards.find((c) => c.id === oid.replace("card:", ""));
        if (cardData) {
          const cat = categories.find((c) => c.id === cardData.categoryId);
          if (cat?.parentId) targetParentId = cat.parentId;
        }
      }

      if (targetParentId) {
        const categoryId = aid.replace("ungrouped:", "");
        await moveCategoryToParent(categoryId, targetParentId);
        return;
      }
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
        await reorderCategories(ordered.map((c) => c.id));
      }
      return;
    }

    // Parent → Parent: reorder
    if (aid.startsWith("cat:")) {
      const activeCatId = aid.replace("cat:", "");
      const overCatId = getContainingParentId(oid);
      if (!overCatId || activeCatId === overCatId) return;
      const orderedCats = [...parentCategories];
      const oldIndex = orderedCats.findIndex((c) => c.id === activeCatId);
      const newIndex = orderedCats.findIndex((c) => c.id === overCatId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const [moved] = orderedCats.splice(oldIndex, 1);
        orderedCats.splice(newIndex, 0, moved);
        const { reorderCategories } = useAppStore.getState();
        await reorderCategories(orderedCats.map((c) => c.id));
      }
      return;
    }

    // Sub-group → Sub-group / parent / child card: reorder within same parent or cross-parent
    if (aid.startsWith("sub:")) {
      const activeSubId = aid.replace("sub:", "");
      const activeSub = categories.find((c) => c.id === activeSubId);
      const target = getSubGroupDropTarget(oid);
      if (activeSub && target) {
        const targetSiblings = categories
          .filter((c) => c.parentId === target.parentId && c.id !== activeSubId)
          .sort((a, b) => a.order - b.order);
        const overSiblingIndex = target.overSubId
          ? targetSiblings.findIndex((c) => c.id === target.overSubId)
          : -1;
        const insertIndex = overSiblingIndex >= 0 ? overSiblingIndex : targetSiblings.length;

        // Same parent, reorder within parent
        if (activeSub.parentId === target.parentId) {
          const siblings = categories
            .filter((c) => c.parentId === target.parentId)
            .sort((a, b) => a.order - b.order);
          const oldIndex = siblings.findIndex((c) => c.id === activeSubId);
          const newIndex = target.overSubId
            ? siblings.findIndex((c) => c.id === target.overSubId)
            : siblings.length - 1;
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const [moved] = siblings.splice(oldIndex, 1);
            siblings.splice(newIndex, 0, moved);
            await useAppStore.getState().reorderCategories(siblings.map((c) => c.id));
          }
          return;
        }

        await moveCategoryToParent(activeSubId, target.parentId, insertIndex);
      }
      return;
    }

    // Card → Card: reorder / cross-category
    if (aid.startsWith("card:") && oid.startsWith("card:")) {
      const activeCardId = aid.replace("card:", "");
      const overCardId = oid.replace("card:", "");
      const overCard = cards.find((c) => c.id === overCardId);
      if (overCard) {
        await moveCard(activeCardId, overCard.categoryId, overCard.order);
      }
      return;
    }

    // Card → Category header
    if (aid.startsWith("card:") && (oid.startsWith("cat:") || oid.startsWith("ungrouped:") || oid.startsWith("sub:"))) {
      const activeCardId = aid.replace("card:", "");
      const targetCatId = oid.replace("cat:", "").replace("ungrouped:", "").replace("sub:", "");
      await moveCard(activeCardId, targetCatId, 0);
      return;
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setHoveredParentId(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Only exit edit on double-click of empty/background areas
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'A' ||
      target.closest('button, a, input, textarea, [contenteditable="true"], [data-card], [data-drag-handle]')
    ) {
      return;
    }
    if (editMode) {
      toggleEditMode();
    }
  };

  return (
    <div onDoubleClick={handleDoubleClick}>
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="wc-dashboard-grid flex flex-wrap items-start gap-6">
        <SortableContext items={parentSortableIds} strategy={rectSortingStrategy}>
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
                defaultWidthPercent={getDefaultWidthPercent(totalCards, subGroups.length)}
                onEditCategory={onEditCategory}
                onAddCard={onAddCard}
                onAddGroup={onAddGroup}
                onShipCategory={onShipCategory}
              >
                {/* Sub-groups in flex-wrap so they can sit side by side */}
                <SortableSubGroupContainer parentId={parent.id}>
                  <div className="wc-group-flow flex flex-wrap items-start gap-4">
                    {subGroups.map((sub) => {
                      const subCards = getCardsForCategory(sub.id);
                      return (
                        <SortableSubGroupBlock
                          key={sub.id}
                          category={sub}
                          cards={subCards}
                          editMode={editMode}
                          onEditCategory={onEditCategory}
                          onAddCard={onAddCard}
                          onEditCard={onEditCard}
                          onDeleteCard={onDeleteCard}
                          onDetach={() => detachCategoryFromParent(sub.id)}
                          onUpdateCard={onUpdateCard}
                          onShipCategory={onShipCategory}
                          onShipCard={onShipCard}
                        />
                      );
                    })}
                    {subGroups.length === 0 && !editMode && (
                      <p className="py-1 text-[10px] text-slate-400">暂无分组</p>
                    )}
                  </div>
                </SortableSubGroupContainer>
              </SortableCategoryBlock>
            );
          })}

          {/* ====== Bottom section: "未分类" ====== */}
        </SortableContext>
          {standaloneCategories.length > 0 && (
            <div className="wc-glass-card wc-ungrouped-panel w-full overflow-hidden">
              <div className="wc-category-header flex items-center gap-2 border-b border-white/60 px-5 py-4">
                <span className="text-sm font-semibold text-slate-700">
                  未分类
                </span>
                <span className="text-xs text-slate-400">
                  ({standaloneCategories.length} 个分组)
                </span>
                {editMode && (
                  <span className="ml-1 text-xs text-slate-400">
                    — 拖入上方分类即可降级为分组
                  </span>
                )}
                {!editMode && (
                  <span className="ml-1 text-xs text-slate-400">
                    — 拖拽分组到上方分类可降级
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`ml-auto h-8 rounded-xl px-3 text-xs ${
                    editMode ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600" : "text-slate-500 hover:bg-white/80 hover:text-blue-600"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleEditMode();
                  }}
                  title={editMode ? "\u9000\u51fa\u672a\u5206\u7c7b\u7f16\u8f91" : "\u7f16\u8f91\u672a\u5206\u7c7b"}
                >
                  {editMode ? (
                    <>
                      <PencilOff className="w-2.5 h-2.5" />
                      {"\u9000\u51fa\u7f16\u8f91"}
                    </>
                  ) : (
                    <>
                      <Pencil className="w-2.5 h-2.5" />
                      {"\u7f16\u8f91"}
                    </>
                  )}
                </Button>
              </div>
              <SortableContext items={standaloneSortableIds} strategy={rectSortingStrategy}>
              <div className="wc-group-flow flex flex-wrap items-start gap-4 p-5">
                {standaloneCategories.map((cat) => {
                  const catCards = getCardsForCategory(cat.id);
                  return (
                    <SortableUngroupedBlock
                      key={cat.id}
                      category={cat}
                      cards={catCards}
                      editMode={editMode}
                      onEditCategory={onEditCategory}
                      onAddCard={onAddCard}
                      onEditCard={onEditCard}
                      onDeleteCard={onDeleteCard}
                      onPromoteToParent={promoteToParent}
                      onUpdateCard={onUpdateCard}
                      onShipCategory={onShipCategory}
                      onShipCard={onShipCard}
                    />
                  );
                })}
              </div>
              </SortableContext>
            </div>
          )}
        </div>

      {/* ====== Drag Overlay: compact badge ====== */}
      <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeId ? (
          (() => {
            const info = getOverlayLabel(activeId);
            if (!info) return null;
            return (
              <div
                className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg backdrop-blur-xl"
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
    </div>
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
  onShipCategory?: (category: Category) => void;
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
  onShipCategory,
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

  const { setCategoryLayout, demoteParentCategory, updateCategory, editMode: globalEditMode, toggleEditMode, softDeleteCategory } = useAppStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDemoteOpen, setConfirmDemoteOpen] = useState(false);

  const rawWidthPercent = localWidth ?? storedWidth ?? defaultWidthPercent;
  const widthPercent = getSmartParentWidthPercent(rawWidthPercent, defaultWidthPercent);

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? transition : `${transition}, min-height 0.3s ease-out`,
    opacity: isDragging ? 0.2 : 1,
    flex: `0 1 calc(${widthPercent}% - 1rem)`,
    width: `calc(${widthPercent}% - 1rem)`,
    minWidth: "min(100%, 360px)",
    maxWidth: "100%",
    minHeight: isDraggingActive ? '60px' : undefined,
  };

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
        const newWidth = Math.max(180, startWidth + dx);
        const newPercent = Math.max(8, Math.min(100, (newWidth / parentWidth) * 100));
        setLocalWidth(newPercent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) setCategoryLayout(category.id, { widthPercent: prev });
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [category.id, setCategoryLayout]
  );

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const categoryActions: EditAction[] = [
    ...(isParent ? [{ id: "add-group", label: "添加分组", icon: Layers, onSelect: () => onAddGroup?.(category.id) }] : []),
    { id: "add-card", label: "添加网页", icon: Plus, onSelect: () => onAddCard?.() },
    { id: "ship", label: "飞到其他分项", icon: Send, onSelect: () => onShipCategory?.(category) },
    { id: "delete", label: "删除分类", icon: Trash2, tone: "danger" as const, onSelect: () => setConfirmDeleteOpen(true) },
    ...(isParent ? [{ id: "demote", label: "降级为分组", icon: ArrowDownFromLine, tone: "danger" as const, onSelect: () => setConfirmDemoteOpen(true) }] : []),
  ];

  const handleDockTriggerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!globalEditMode) toggleEditMode();
  };

  return (
    <div
      ref={setRef}
      style={style}
      data-wc-category-id={category.id}
      className={`
        wc-glass-card wc-category-panel relative overflow-hidden
        ${isHovered ? "ring-2 ring-blue-400/35 shadow-[0_28px_70px_rgba(59,130,246,0.18)]" : ""}
        transition-all duration-300 ease-out
      `}
    >
      {/* Category header - buttons right next to title */}
      <div
        className="wc-category-header relative z-10 flex items-center gap-2 border-b border-white/60 px-5 py-4"
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
      >
        <span
          className="cursor-grab active:cursor-grabbing text-slate-400/70 hover:text-blue-600 transition-colors"
          {...attributes}
          {...listeners}
          title="拖动排序"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <div
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-sm shadow-blue-300/40"
          style={{ backgroundColor: category.color }}
        />
        <Folder
          className="h-4 w-4 shrink-0 text-blue-500/70"
          aria-hidden="true"
        />
        <InlineEditableText
          value={category.name}
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-semibold text-slate-900 font-serif hover:text-blue-600 transition-colors"
          editMode={editMode}
          onSave={(newName) => updateCategory({ ...category, name: newName })}
        />
        {(isHeaderHovered || globalEditMode) && (
          <DirectEditButton
            label="编辑分类"
            onClick={(event) => {
              event.stopPropagation();
              onEditCategory?.(category);
            }}
          />
        )}
        {(isHeaderHovered || globalEditMode) && (
          <EditActionDock
            actions={categoryActions}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="wc-edit-dock-trigger h-7 w-7 rounded-full p-0 text-slate-500 hover:bg-white/80 hover:text-blue-600 animate-in fade-in duration-200"
                onClick={handleDockTriggerClick}
                title={globalEditMode ? "分类更多操作" : "进入编辑模式"}
                aria-label={globalEditMode ? "分类更多操作" : "进入编辑模式"}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            }
          />
        )}
        {/* Smooth drop hint */}
        {isHovered && isParent && (
          <span className="text-[10px] text-primary/70 font-medium animate-in fade-in duration-300">
            释放以降级到此分类
          </span>
        )}
        {isDraggingActive && isParent && !isHovered && (
          <span className="text-[10px] text-slate-400/60 transition-opacity duration-300">
            拖入分组到此分类
          </span>
        )}

        {globalEditMode && (
          <Button
            variant="ghost"
            size="sm"
            className="wc-edit-exit-chip h-8 gap-1 rounded-full px-3 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            onClick={(e) => { e.stopPropagation(); toggleEditMode(); }}
            title="退出编辑模式"
          >
            <PencilOff className="w-2.5 h-2.5" />
            退出编辑
          </Button>
        )}
      </div>

      {/* Category body */}
      <div className="wc-category-body relative z-10 p-5">{children}</div>

      {/* Resize handle - right edge, always available */}
      <div
        className="absolute right-0 top-0 bottom-0 z-20 w-2 cursor-col-resize
          rounded-r-[28px] transition-colors hover:bg-blue-400/20 active:bg-blue-500/25"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={handleResizeStart}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">确认删除「{category.name}」</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，此分类及其下属所有分组和网页将移入回收站。
              你可以随时从回收站恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { softDeleteCategory(category.id); setConfirmDeleteOpen(false); }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote confirmation dialog */}
      {isParent && (
        <AlertDialog open={confirmDemoteOpen} onOpenChange={setConfirmDemoteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif">确认降级「{category.name}」</AlertDialogTitle>
              <AlertDialogDescription>
                降级后，此分类将变为分组移入「未分类」区域，
                其下属的所有分组也会被拆散为独立分组。
                此操作不会删除任何网站数据。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { demoteParentCategory(category.id); setConfirmDemoteOpen(false); }}
              >
                确认降级
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ============ Sortable Sub-Group Container (provides SortableContext for sub-groups within a parent) ============
interface SortableSubGroupContainerProps {
  parentId: string;
  children: React.ReactNode;
}

function SortableSubGroupContainer({ parentId, children }: SortableSubGroupContainerProps) {
  const categories = useAppStore((s) => s.categories);
  const subGroups = useMemo(
    () => categories.filter((c) => c.parentId === parentId).sort((a, b) => a.order - b.order),
    [categories, parentId]
  );
  const subIds = useMemo(() => subGroups.map((sg) => subId(sg.id)), [subGroups]);

  return (
    <SortableContext items={subIds} strategy={rectSortingStrategy}>
      {children}
    </SortableContext>
  );
}

// ============ Sortable Sub-Group Block (inside a parent category) ============
interface SortableSubGroupBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  onDetach?: () => void;
  onUpdateCard?: (card: WebCard) => void;
  onShipCategory?: (category: Category) => void;
  onShipCard?: (card: WebCard) => void;
}

function SortableSubGroupBlock({
  category,
  cards,
  editMode,
  onEditCategory,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDetach,
  onUpdateCard,
  onShipCategory,
  onShipCard,
}: SortableSubGroupBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subId(category.id) });

  const categoryWidths = useAppStore((s) => s.categoryWidths);
  const categoryLayouts = useAppStore((s) => s.categoryLayouts);
  const setCategoryLayout = useAppStore((s) => s.setCategoryLayout);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const globalEditMode = useAppStore((s) => s.editMode);
  const toggleEditMode = useAppStore((s) => s.toggleEditMode);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const [localColumns, setLocalColumns] = useState<number | null>(null);
  const localColumnsRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  const savedLayout: CategoryLayoutPreference | undefined = categoryLayouts[category.id];
  const widthPercent = localWidth ?? savedLayout?.widthPercent ?? categoryWidths[category.id] ?? null;
  const columns = localColumns ?? savedLayout?.columns ?? undefined;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = container.parentElement?.offsetWidth ?? 1;
      localColumnsRef.current = calculateColumnsForWidth(startWidth, cards.length);

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newWidth = Math.max(180, startWidth + dx);
        const newPercent = Math.max(8, Math.min(100, (newWidth / parentWidth) * 100));
        const nextColumns = calculateColumnsForWidth(newWidth, cards.length);
        localColumnsRef.current = nextColumns;
        setLocalWidth(newPercent);
        setLocalColumns(nextColumns);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) {
            setCategoryLayout(category.id, {
              widthPercent: prev,
              columns: localColumnsRef.current ?? calculateColumnsForWidth(startWidth, cards.length),
            });
          }
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [cards.length, category.id, setCategoryLayout]
  );

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const groupActions: EditAction[] = [
    { id: "add-card", label: "添加网页", icon: Plus, onSelect: () => onAddCard?.(category.id) },
    { id: "promote", label: "升级为分类", icon: ArrowUpFromLine, onSelect: () => onDetach?.() },
    { id: "ship", label: "飞到其他分项", icon: Send, onSelect: () => onShipCategory?.(category) },
    { id: "delete", label: "删除分组", icon: Trash2, tone: "danger", onSelect: () => setConfirmDeleteOpen(true) },
  ];

  const handleDockTriggerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!globalEditMode) toggleEditMode();
  };

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    ...getSmartChildStyle(widthPercent, cards.length, columns),
  };

  return (
    <div
      ref={setRef}
      style={style}
      data-wc-category-id={category.id}
      className="wc-soft-card wc-group-panel relative min-w-0 overflow-hidden"
    >
      {/* Sub-group header - buttons right next to title */}
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
          <DirectEditButton
            label="编辑分组"
            onClick={(event) => {
              event.stopPropagation();
              onEditCategory?.(category);
            }}
          />
        )}

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
        <div className={`wc-group-card-list flex flex-wrap gap-2 px-4 pb-4 ${editMode ? "wc-group-card-list-editing" : ""}`}>
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
}

// ============ Sortable Ungrouped Block ============
interface SortableUngroupedBlockProps {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  onPromoteToParent?: (categoryId: string) => void;
  onUpdateCard?: (card: WebCard) => void;
  onShipCategory?: (category: Category) => void;
  onShipCard?: (card: WebCard) => void;
}

function SortableUngroupedBlock({
  category,
  cards,
  editMode,
  onEditCategory,
  onAddCard,
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

  const categoryWidths = useAppStore((s) => s.categoryWidths);
  const categoryLayouts = useAppStore((s) => s.categoryLayouts);
  const setCategoryLayout = useAppStore((s) => s.setCategoryLayout);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const globalEditMode = useAppStore((s) => s.editMode);
  const toggleEditMode = useAppStore((s) => s.toggleEditMode);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const [localColumns, setLocalColumns] = useState<number | null>(null);
  const localColumnsRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  const savedLayout: CategoryLayoutPreference | undefined = categoryLayouts[category.id];
  const widthPercent = localWidth ?? savedLayout?.widthPercent ?? categoryWidths[category.id] ?? null;
  const columns = localColumns ?? savedLayout?.columns ?? undefined;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = container.parentElement?.offsetWidth ?? 1;
      localColumnsRef.current = calculateColumnsForWidth(startWidth, cards.length);

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newWidth = Math.max(120, startWidth + dx);
        const newPercent = Math.max(15, Math.min(100, (newWidth / parentWidth) * 100));
        const nextColumns = calculateColumnsForWidth(newWidth, cards.length);
        localColumnsRef.current = nextColumns;
        setLocalWidth(newPercent);
        setLocalColumns(nextColumns);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) {
            setCategoryLayout(category.id, {
              widthPercent: prev,
              columns: localColumnsRef.current ?? calculateColumnsForWidth(startWidth, cards.length),
            });
          }
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [cards.length, category.id, setCategoryLayout]
  );

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const groupActions: EditAction[] = [
    { id: "add-card", label: "添加网页", icon: Plus, onSelect: () => onAddCard?.(category.id) },
    { id: "promote", label: "升级为分类", icon: ArrowUpFromLine, onSelect: () => onPromoteToParent?.(category.id) },
    { id: "ship", label: "飞到其他分项", icon: Send, onSelect: () => onShipCategory?.(category) },
    { id: "delete", label: "删除分组", icon: Trash2, tone: "danger", onSelect: () => setConfirmDeleteOpen(true) },
  ];

  const handleDockTriggerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!globalEditMode) toggleEditMode();
  };

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    ...getSmartChildStyle(widthPercent, cards.length, columns),
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
          <DirectEditButton
            label="编辑分组"
            onClick={(event) => {
              event.stopPropagation();
              onEditCategory?.(category);
            }}
          />
        )}

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
        <div className={`wc-group-card-list flex flex-wrap gap-2 px-4 pb-4 ${editMode ? "wc-group-card-list-editing" : ""}`}>
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
}

// ============ Sortable Card ============
interface SortableCardProps {
  card: WebCard;
  categoryColor: string;
  editMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateCard?: (card: WebCard) => void;
  onShip?: () => void;
}

function SortableCard({
  card,
  categoryColor,
  editMode,
  onEdit,
  onDelete,
  onUpdateCard,
  onShip,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardId(card.id) });

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} data-wc-card-id={card.id}>
      <WebCardItem
        card={card}
        categoryColor={categoryColor}
        editMode={editMode}
        onEdit={onEdit}
        onDelete={onDelete}
        onShip={onShip}
        onUpdateCard={onUpdateCard}
        dragListeners={{ ...attributes, ...listeners }}
      />
    </div>
  );
}


"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Pencil, PencilOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CategorySearchTarget } from "@/lib/category-search-target";
import { useAppStore } from "@/lib/store";
import { requestCreateTabPackFromCard } from "@/lib/tab-pack-events";
import { useTabPackStore } from "@/lib/tab-pack-store";
import type { Category, WebCard } from "@/lib/types";
import { SortableCategoryBlock } from "./category-block";
import { useAdaptiveLayoutMetrics } from "@/components/layout/adaptive-resolution-viewport";
import {
  catId,
  collisionDetection,
  getChildBasisRemForColumns,
  getDefaultWidthPercent,
  getParentContentWidthRem,
  getStableLayoutColumns,
  LOCKED_LAYOUT_HINT_EVENT,
  LOCKED_LAYOUT_HINT_TEXT,
  type LockedLayoutHint,
  ungroupId,
} from "./layout-math";
import { SortableSubGroupBlock, SortableSubGroupContainer } from "./sub-group-block";
import { SortableUngroupedBlock } from "./ungrouped-block";

// ============ Props ============
export interface SortableGridProps {
  onAddCard?: (categoryId?: string) => void;
  onEditCard?: (card: WebCard) => void;
  onDeleteCard?: (card: WebCard) => void;
  onEditCategory?: (category: Category) => void;
  onAddGroup?: (parentId?: string) => void;
  onUpdateCard?: (card: WebCard) => void;
  onShipCategory?: (category: Category) => void;
  onShipCard?: (card: WebCard) => void;
  searchTarget?: CategorySearchTarget | null;
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
  searchTarget = null,
}: SortableGridProps) {
  const {
    cards,
    categories,
    activeSectionId,
    editMode,
    moveCard,
    moveCategoryToParent,
    detachCategoryFromParent,
    promoteToParent,
    categoryWidths,
    categoryLayouts,
    toggleEditMode,
  } = useAppStore();
  const { density } = useAdaptiveLayoutMetrics();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);
  const [lockedHint, setLockedHint] = useState<LockedLayoutHint | null>(null);
  const lockedHintTimerRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tabPackDropTargetRef = useRef<HTMLElement | null>(null);
  const dragPointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const searchFrameRef = useRef<number | null>(null);
  const searchHighlightTimerRef = useRef<number | null>(null);
  const highlightedSearchTargetRef = useRef<HTMLElement | null>(null);
  const lastSearchRequestRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleHint = (event: Event) => {
      const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail || {};
      const x = Number.isFinite(detail.x) ? Number(detail.x) : window.innerWidth / 2;
      const y = Number.isFinite(detail.y) ? Number(detail.y) : window.innerHeight / 2;
      setLockedHint({ id: Date.now(), x, y });
      if (lockedHintTimerRef.current !== null) {
        window.clearTimeout(lockedHintTimerRef.current);
      }
      lockedHintTimerRef.current = window.setTimeout(() => {
        setLockedHint(null);
        lockedHintTimerRef.current = null;
      }, 1800);
    };
    window.addEventListener(LOCKED_LAYOUT_HINT_EVENT, handleHint);
    return () => {
      window.removeEventListener(LOCKED_LAYOUT_HINT_EVENT, handleHint);
      if (lockedHintTimerRef.current !== null) {
        window.clearTimeout(lockedHintTimerRef.current);
        lockedHintTimerRef.current = null;
      }
    };
  }, []);

  const visibleCategories = useMemo(() => {
    return categories.filter((c) => (c.sectionId || "section-default") === activeSectionId);
  }, [categories, activeSectionId]);

  useEffect(() => {
    if (!searchTarget || searchTarget.sectionId !== activeSectionId) return undefined;
    if (lastSearchRequestRef.current === searchTarget.requestId) return undefined;

    if (searchFrameRef.current !== null) {
      window.cancelAnimationFrame(searchFrameRef.current);
    }
    searchFrameRef.current = window.requestAnimationFrame(() => {
      searchFrameRef.current = null;
      const target = Array.from(
        gridRef.current?.querySelectorAll<HTMLElement>("[data-wc-category-id]") || []
      ).find((element) => element.dataset.wcCategoryId === searchTarget.categoryId);
      if (!target) return;

      lastSearchRequestRef.current = searchTarget.requestId;
      const previousTarget = highlightedSearchTargetRef.current;
      previousTarget?.classList.remove("wc-search-highlight");
      if (previousTarget) delete previousTarget.dataset.wcSearchRequestId;
      if (searchHighlightTimerRef.current !== null) {
        window.clearTimeout(searchHighlightTimerRef.current);
      }

      target.dataset.wcSearchRequestId = String(searchTarget.requestId);
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "center",
      });
      target.classList.add("wc-search-highlight");
      highlightedSearchTargetRef.current = target;
      searchHighlightTimerRef.current = window.setTimeout(() => {
        target.classList.remove("wc-search-highlight");
        delete target.dataset.wcSearchRequestId;
        if (highlightedSearchTargetRef.current === target) {
          highlightedSearchTargetRef.current = null;
        }
        searchHighlightTimerRef.current = null;
      }, 1600);
    });

    return () => {
      if (searchFrameRef.current !== null) {
        window.cancelAnimationFrame(searchFrameRef.current);
        searchFrameRef.current = null;
      }
    };
  }, [activeSectionId, searchTarget, visibleCategories]);

  useEffect(() => () => {
    if (searchFrameRef.current !== null) window.cancelAnimationFrame(searchFrameRef.current);
    if (searchHighlightTimerRef.current !== null) window.clearTimeout(searchHighlightTimerRef.current);
    highlightedSearchTargetRef.current?.classList.remove("wc-search-highlight");
    if (highlightedSearchTargetRef.current) {
      delete highlightedSearchTargetRef.current.dataset.wcSearchRequestId;
    }
  }, []);

  // Build hierarchy
  // Parent categories: explicitly marked isParent OR has sub-groups
  const parentCategories = useMemo(() => {
    return visibleCategories
      .filter((c) => !c.parentId && (c.isParent || visibleCategories.some((sg) => sg.parentId === c.id)))
      .sort((a, b) => a.order - b.order);
  }, [visibleCategories]);

  // Standalone (ungrouped): no parentId, not a parent, no sub-groups
  const standaloneCategories = useMemo(() => {
    return visibleCategories
      .filter((c) => !c.parentId && !c.isParent && !visibleCategories.some((sg) => sg.parentId === c.id))
      .sort((a, b) => a.order - b.order);
  }, [visibleCategories]);

  const getSubGroups = useCallback(
    (parentId: string) =>
      visibleCategories
        .filter((c) => c.parentId === parentId)
        .sort((a, b) => a.order - b.order),
    [visibleCategories]
  );

  const getCardsForCategory = useCallback(
    (categoryId: string) =>
      cards
        .filter((c) => c.categoryId === categoryId)
        .sort((a, b) => a.order - b.order),
    [cards]
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
    const id = String(event.active.id);
    setActiveId(id);
    if (id.startsWith("card:")) {
      const activator = event.activatorEvent;
      dragPointerOriginRef.current = "clientX" in activator
        && "clientY" in activator
        && typeof activator.clientX === "number"
        && typeof activator.clientY === "number"
        ? { x: activator.clientX, y: activator.clientY }
        : null;
      document.documentElement.classList.add("wc-card-dragging-to-pack");
    }
  };

  const clearTabPackDropTarget = () => {
    tabPackDropTargetRef.current?.removeAttribute("data-drag-over");
    tabPackDropTargetRef.current = null;
    dragPointerOriginRef.current = null;
    document.documentElement.classList.remove("wc-card-dragging-to-pack");
  };

  useEffect(() => () => {
    tabPackDropTargetRef.current?.removeAttribute("data-drag-over");
    document.documentElement.classList.remove("wc-card-dragging-to-pack");
  }, []);

  const findTabPackDropTarget = (event: Pick<DragMoveEvent, "active" | "delta">): HTMLElement | null => {
    if (!String(event.active.id).startsWith("card:")) return null;
    const rect = event.active.rect.current.translated;
    const pointerOrigin = dragPointerOriginRef.current;
    const x = pointerOrigin ? pointerOrigin.x + event.delta.x : rect ? rect.left + rect.width / 2 : null;
    const y = pointerOrigin ? pointerOrigin.y + event.delta.y : rect ? rect.top + rect.height / 2 : null;
    if (x === null || y === null) return null;
    for (const element of document.elementsFromPoint(x, y)) {
      const target = element.closest<HTMLElement>("[data-tab-pack-drop-id]");
      if (target) return target;
    }
    return null;
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const target = findTabPackDropTarget(event);
    if (target === tabPackDropTargetRef.current) return;
    tabPackDropTargetRef.current?.removeAttribute("data-drag-over");
    tabPackDropTargetRef.current = target;
    target?.setAttribute("data-drag-over", "true");
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
    const tabPackTarget = findTabPackDropTarget(event);
    setActiveId(null);
    setHoveredParentId(null);
    clearTabPackDropTarget();
    if (tabPackTarget) {
      const card = cards.find((item) => item.id === String(active.id).replace("card:", ""));
      const packId = tabPackTarget.dataset.tabPackDropId;
      if (card && packId === "__new__") requestCreateTabPackFromCard(card);
      else if (card && packId) await useTabPackStore.getState().addCard(packId, card);
      return;
    }
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
    clearTabPackDropTarget();
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
    <div ref={gridRef} onDoubleClick={handleDoubleClick} data-wc-classic-grid-section-id={activeSectionId}>
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragMove={handleDragMove}
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
            const contentWidthRem = getParentContentWidthRem(subGroups.map((sub) => {
              const subCards = getCardsForCategory(sub.id);
              const layoutPreference = categoryLayouts[sub.id];
              const widthPercent = categoryWidths[sub.id] ?? layoutPreference?.widthPercent ?? null;
              const columns = getStableLayoutColumns(layoutPreference, widthPercent, subCards.length);
              return getChildBasisRemForColumns(columns, density);
            }), density);

            return (
              <SortableCategoryBlock
                key={parent.id}
                category={parent}
                isParent
                editMode={editMode}
                isHovered={hoveredParentId === parent.id}
                isDraggingActive={activeId !== null}
                widthPercent={categoryWidths[parent.id]}
                layoutPreference={categoryLayouts[parent.id]}
                contentWidthRem={contentWidthRem}
                defaultWidthPercent={getDefaultWidthPercent(totalCards, subGroups.length)}
                onEditCategory={onEditCategory}
                onAddCard={onAddCard}
                onAddGroup={onAddGroup}
                onShipCategory={onShipCategory}
              >
                {/* Sub-groups in flex-wrap so they can sit side by side */}
                <SortableSubGroupContainer parentId={parent.id}>
                  <div className="wc-group-flow flex flex-wrap items-start gap-3">
                    {subGroups.map((sub) => {
                      const subCards = getCardsForCategory(sub.id);
                      return (
                        <SortableSubGroupBlock
                          key={sub.id}
                          category={sub}
                          cards={subCards}
                          editMode={editMode}
                          parentLayoutLocked={categoryLayouts[parent.id]?.locked === true}
                          onEditCategory={onEditCategory}
                          onAddCard={onAddCard}
                          onAddGroup={onAddGroup}
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
              <div className="wc-group-flow flex flex-wrap items-start gap-3 p-4">
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
                      onAddGroup={onAddGroup}
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
    {lockedHint && (
      <div
        key={lockedHint.id}
        className="wc-layout-lock-hint pointer-events-none fixed z-[9999] max-w-[18rem] rounded-2xl border border-amber-200/70 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        style={{
          left: Math.min(Math.max(lockedHint.x + 14, 16), Math.max(16, window.innerWidth - 300)),
          top: Math.min(Math.max(lockedHint.y + 12, 16), Math.max(16, window.innerHeight - 72)),
        }}
      >
        {LOCKED_LAYOUT_HINT_TEXT}
      </div>
    )}
    </div>
  );
}

export {
  getCardGridStyle,
  getParentContentWidthRem,
  getParentLayoutRowWidthsRem,
  getSmartChildStyle,
  getSmartParentWidthPercent,
  getStableLayoutColumns,
  inferLayoutColumns,
} from "./layout-math";

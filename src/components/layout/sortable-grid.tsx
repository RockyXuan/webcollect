"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { WebCardItem } from "@/components/card/web-card";
import { Pencil, Plus, GripVertical, ArrowUpFromLine, ArrowDownFromLine, Layers } from "lucide-react";
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
  AlertDialogTrigger,
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Category, WebCard } from "@/lib/types";

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
function getDefaultWidthPercent(cardCount: number): number {
  if (cardCount <= 2) return 33;
  if (cardCount <= 4) return 50;
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
    promoteToParent,
    categoryWidths,
  } = useAppStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Build hierarchy
  // Parent categories: explicitly marked isParent OR has sub-groups
  const parentCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && (c.isParent || categories.some((sg) => sg.parentId === c.id)))
      .sort((a, b) => a.order - b.order);
  }, [categories]);

  // Standalone (ungrouped): no parentId, not a parent, no sub-groups
  const standaloneCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && !c.isParent && !categories.some((sg) => sg.parentId === c.id))
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

  // All top-level sortable IDs (parent cats + ungrouped)
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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setHoveredParentId(null);
      return;
    }
    const aid = String(active.id);
    const oid = String(over.id);

    // Use requestAnimationFrame to batch state update outside render
    requestAnimationFrame(() => {
      // Only care about ungrouped/sub items being dragged toward parent categories
      if (!aid.startsWith("ungrouped:") && !aid.startsWith("sub:")) {
        setHoveredParentId(null);
        return;
      }

      // Direct hit on a parent category
      if (oid.startsWith("cat:")) {
        setHoveredParentId(oid.replace("cat:", ""));
        return;
      }

      // Hit something inside a parent category (sub-group or card) — find the parent
      if (oid.startsWith("sub:")) {
        const subCatId = oid.replace("sub:", "");
        const subCat = categories.find((c) => c.id === subCatId);
        if (subCat?.parentId) {
          // For sub-group drags, only highlight if it's a different parent
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
    });

    setHoveredParentId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
        moveCategoryToParent(categoryId, targetParentId);
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

    // Sub-group → Sub-group: reorder within same parent or cross-parent
    if (aid.startsWith("sub:") && oid.startsWith("sub:")) {
      const activeSubId = aid.replace("sub:", "");
      const overSubId = oid.replace("sub:", "");
      const activeSub = categories.find((c) => c.id === activeSubId);
      const overSub = categories.find((c) => c.id === overSubId);
      if (activeSub && overSub) {
        // Cross-parent: move sub-group to different parent
        if (activeSub.parentId !== overSub.parentId) {
          const targetParentId = overSub.parentId;
          if (targetParentId) {
            moveCategoryToParent(activeSubId, targetParentId);
          }
          return;
        }
        // Same parent, reorder within parent
        if (activeSub.parentId && activeSub.parentId === overSub.parentId) {
          const siblings = categories
            .filter((c) => c.parentId === activeSub.parentId)
            .sort((a, b) => a.order - b.order);
          const oldIndex = siblings.findIndex((c) => c.id === activeSubId);
          const newIndex = siblings.findIndex((c) => c.id === overSubId);
          if (oldIndex !== -1 && newIndex !== -1) {
            const [moved] = siblings.splice(oldIndex, 1);
            siblings.splice(newIndex, 0, moved);
            for (let i = 0; i < siblings.length; i++) {
              useAppStore.getState().updateCategory({ ...siblings[i], order: i });
            }
          }
        }
      }
      return;
    }

    // Sub-group → Parent category header: move to different parent
    if (aid.startsWith("sub:") && oid.startsWith("cat:")) {
      const activeSubId = aid.replace("sub:", "");
      const targetParentId = oid.replace("cat:", "");
      moveCategoryToParent(activeSubId, targetParentId);
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
    if (aid.startsWith("card:") && (oid.startsWith("cat:") || oid.startsWith("ungrouped:") || oid.startsWith("sub:"))) {
      const activeCardId = aid.replace("card:", "");
      const targetCatId = oid.replace("cat:", "").replace("ungrouped:", "").replace("sub:", "");
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
                <SortableSubGroupContainer parentId={parent.id}>
                  <div className="flex flex-wrap gap-3">
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
                        />
                      );
                    })}
                    {subGroups.length === 0 && !editMode && (
                      <p className="text-[10px] text-muted-foreground py-1">暂无分组</p>
                    )}
                  </div>
                </SortableSubGroupContainer>
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
                {!editMode && (
                  <span className="text-[10px] text-muted-foreground/40 ml-1">
                    — 拖拽分组到上方分类可降级
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
                      onEditCategory={onEditCategory}
                      onAddCard={onAddCard}
                      onEditCard={onEditCard}
                      onDeleteCard={onDeleteCard}
                      onPromoteToParent={promoteToParent}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SortableContext>

      {/* ====== Drag Overlay: compact badge ====== */}
      <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
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

  const { setCategoryWidth, demoteParentCategory } = useAppStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localWidth, setLocalWidth] = useState<number | null>(null);

  const widthPercent = localWidth ?? storedWidth ?? defaultWidthPercent;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? transition : `${transition}, min-height 0.3s ease-out`,
    opacity: isDragging ? 0.4 : 1,
    width: `${widthPercent}%`,
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
        const newWidth = Math.max(120, startWidth + dx);
        const newPercent = Math.max(15, Math.min(100, (newWidth / parentWidth) * 100));
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
        relative rounded-lg border bg-card overflow-hidden
        ${isHovered ? "border-primary/60 shadow-sm bg-primary/[0.03]" : "border-border"}
        transition-[border-color,background-color,box-shadow,min-height] duration-300 ease-out
      `}
    >
      {/* Category header - buttons right next to title */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 flex-wrap">
        <span
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors"
          {...attributes}
          {...listeners}
          title="拖动排序"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span
          className="text-sm font-semibold text-foreground font-serif cursor-grab active:cursor-grabbing hover:text-primary/80 transition-colors"
          {...attributes}
          {...listeners}
        >
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

        {/* Action buttons - right next to title */}
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
                <Layers className="w-2.5 h-2.5" />
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
            {isParent && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    title="降级为分组"
                  >
                    <ArrowDownFromLine className="w-2.5 h-2.5" />
                  </Button>
                </AlertDialogTrigger>
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
                      onClick={() => demoteParentCategory(category.id)}
                    >
                      确认降级
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>

      {/* Category body */}
      <div className="p-3">{children}</div>

      {/* Resize handle - right edge, always available */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
          hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r-lg"
        onMouseDown={handleResizeStart}
      />
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
    <SortableContext items={subIds} strategy={verticalListSortingStrategy}>
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
  const setCategoryWidth = useAppStore((s) => s.setCategoryWidth);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const widthPercent = localWidth ?? categoryWidths[category.id] ?? null;

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
        const newWidth = Math.max(120, startWidth + dx);
        const newPercent = Math.max(15, Math.min(100, (newWidth / parentWidth) * 100));
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...(widthPercent !== null ? { flex: `0 0 ${widthPercent}%` } : {}),
  };

  return (
    <div
      ref={setRef}
      style={style}
      className="relative rounded-md border border-border/40 bg-background overflow-hidden"
    >
      {/* Sub-group header - buttons right next to title */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 flex-wrap">
        <span
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors"
          {...attributes}
          {...listeners}
          title="拖动排序"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <div
          className="w-1 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span
          className="text-xs font-medium text-foreground cursor-grab active:cursor-grabbing hover:text-primary/80 transition-colors"
          {...attributes}
          {...listeners}
        >
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
              onClick={() => onEditCategory?.(category)}
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
              title="升级为分类"
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
              onEdit={() => onEditCard?.(card)}
              onDelete={() => onDeleteCard?.(card)}
            />
          ))}
          {cards.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-1">暂无网站</p>
          )}
        </div>
      </SortableContext>

      {/* Resize handle - right edge, always available */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
          hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r-md"
        onMouseDown={handleResizeStart}
      />
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
  const setCategoryWidth = useAppStore((s) => s.setCategoryWidth);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const widthPercent = localWidth ?? categoryWidths[category.id] ?? null;

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
        const newWidth = Math.max(120, startWidth + dx);
        const newPercent = Math.max(15, Math.min(100, (newWidth / parentWidth) * 100));
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...(widthPercent !== null ? { flex: `0 0 ${widthPercent}%` } : {}),
  };

  return (
    <div
      ref={setRef}
      style={style}
      className="relative rounded-md border border-border/40 bg-background overflow-hidden"
    >
      {/* Header - buttons right next to title */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 flex-wrap">
        <span
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors"
          {...attributes}
          {...listeners}
          title="拖动排序"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <div
          className="w-1 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span
          className="text-xs font-medium text-foreground cursor-grab active:cursor-grabbing hover:text-primary/80 transition-colors"
          {...attributes}
          {...listeners}
        >
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
              onClick={() => onEditCategory?.(category)}
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
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onPromoteToParent?.(category.id)}
              title="升级为分类"
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
              onEdit={() => onEditCard?.(card)}
              onDelete={() => onDeleteCard?.(card)}
            />
          ))}
          {cards.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-1">暂无网站</p>
          )}
        </div>
      </SortableContext>

      {/* Resize handle - right edge, always available */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize
          hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r-md"
        onMouseDown={handleResizeStart}
      />
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
}

function SortableCard({
  card,
  categoryColor,
  editMode,
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
        editMode={editMode}
        onEdit={onEdit}
        onDelete={onDelete}
        dragListeners={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Star,
  Wrench,
  Palette,
  Code,
  BookOpen,
  Music,
  Video,
  ShoppingBag,
  GraduationCap,
  Briefcase,
  Coffee,
  Gamepad2,
  Circle,
} from "lucide-react";
import { WebCard, Category } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { WebCardItem } from "@/components/card/web-card";

/* ─── Category Icon ─── */

function CategoryIcon({ iconName, color }: { iconName: string; color: string }) {
  switch (iconName) {
    case "star": return <Star className="w-4 h-4 shrink-0" style={{ color }} />;
    case "wrench": return <Wrench className="w-4 h-4 shrink-0" style={{ color }} />;
    case "palette": return <Palette className="w-4 h-4 shrink-0" style={{ color }} />;
    case "code": return <Code className="w-4 h-4 shrink-0" style={{ color }} />;
    case "book-open": return <BookOpen className="w-4 h-4 shrink-0" style={{ color }} />;
    case "music": return <Music className="w-4 h-4 shrink-0" style={{ color }} />;
    case "video": return <Video className="w-4 h-4 shrink-0" style={{ color }} />;
    case "shopping-bag": return <ShoppingBag className="w-4 h-4 shrink-0" style={{ color }} />;
    case "graduation-cap": return <GraduationCap className="w-4 h-4 shrink-0" style={{ color }} />;
    case "briefcase": return <Briefcase className="w-4 h-4 shrink-0" style={{ color }} />;
    case "coffee": return <Coffee className="w-4 h-4 shrink-0" style={{ color }} />;
    case "gamepad-2": return <Gamepad2 className="w-4 h-4 shrink-0" style={{ color }} />;
    default: return <Circle className="w-4 h-4 shrink-0" style={{ color }} />;
  }
}

/* ─── Row Header ─── */

function RowHeader({
  category,
  cardCount,
  editMode,
  onToggleEdit,
  onAdd,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  category: Category;
  cardCount: number;
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {

  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2">
      <div className="flex items-center gap-2">
        <CategoryIcon iconName={category.icon} color={category.color} />
        <h2 className="text-base font-serif font-semibold text-foreground tracking-tight">
          {category.name}
        </h2>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {cardCount}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {editMode && onMoveUp && (
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1 rounded-md border border-border hover:border-primary/30 hover:text-primary transition-colors text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            title="上移"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
        {editMode && onMoveDown && (
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1 rounded-md border border-border hover:border-primary/30 hover:text-primary transition-colors text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            title="下移"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onToggleEdit}
          className={cn(
            "text-xs px-2 py-1 rounded-md border transition-colors",
            editMode
              ? "bg-primary/10 text-primary border-primary/20"
              : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
          )}
        >
          {editMode ? "完成" : "编辑"}
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:border-primary/30 hover:text-primary transition-colors text-muted-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">添加</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Sortable Card Wrapper ─── */

function SortableCard({
  card,
  editMode,
  onEdit,
  onDelete,
  categoryColor,
}: {
  card: WebCard;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  categoryColor: string;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", categoryId: card.categoryId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandleProps = { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style}>
      <WebCardItem
        card={card}
        editMode={editMode}
        onEdit={onEdit}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        categoryColor={categoryColor}
      />
    </div>
  );
}

/* ─── Card List with flex-wrap ─── */

function CardList({
  cards,
  editMode,
  onEdit,
  onDelete,
  categoryColor,
  maxHeight,
}: {
  cards: WebCard[];
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  categoryColor: string;
  maxHeight?: number | null;
}) {
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const containerStyle: React.CSSProperties = maxHeight
    ? { maxHeight, overflowY: "auto" }
    : {};

  return (
    <div
      className="flex flex-wrap gap-2 px-3 pb-3"
      style={{ ...containerStyle, scrollbarWidth: "thin" }}
    >
      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        {cards.map((card) => (
          <SortableCard
            key={card.id}
            card={card}
            editMode={editMode}
            onEdit={onEdit}
            onDelete={onDelete}
            categoryColor={categoryColor}
          />
        ))}
      </SortableContext>
    </div>
  );
}

/* ─── Category Block with dual resize handles ─── */

function CategoryBlock({
  category,
  cards,
  editMode,
  onToggleEdit,
  onAdd,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  fullWidth = false,
}: {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  fullWidth?: boolean;
}) {
  const blockRef = useRef<HTMLDivElement>(null);

  // Width state: percentage-based for fill behavior
  const [widthPct, setWidthPct] = useState(fullWidth ? 100 : 50);
  // Height state: null = auto, number = fixed max-height for vertical scroll
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState<"h" | "v" | null>(null);

  /* ─── Horizontal resize (right edge) ─── */
  const startHResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing("h");
      const startX = e.clientX;
      const containerWidth = blockRef.current?.parentElement?.clientWidth || 1200;
      const startPct = widthPct;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const deltaPct = (delta / containerWidth) * 100;
        const newPct = Math.max(fullWidth ? 50 : 30, Math.min(100, startPct + deltaPct));
        setWidthPct(newPct);
      };
      const onUp = () => {
        setIsResizing(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [widthPct, fullWidth]
  );

  /* ─── Vertical resize (bottom edge) ─── */
  const startVResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing("v");
      const startY = e.clientY;
      const startH = maxHeight || blockRef.current?.scrollHeight || 300;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        const newH = Math.max(120, startH + delta);
        setMaxHeight(newH);
      };
      const onUp = () => {
        setIsResizing(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [maxHeight]
  );

  /* ─── Double-click to reset height ─── */
  const resetHeight = useCallback(() => {
    setMaxHeight(null);
  }, []);

  return (
    <section
      ref={blockRef}
      className={cn(
        "relative rounded-2xl border bg-card/60 backdrop-blur-sm transition-colors",
        fullWidth ? "w-full" : "shrink-0",
        editMode ? "border-primary/20" : "border-border",
        isResizing && "select-none"
      )}
      style={fullWidth ? undefined : { width: `${widthPct}%`, minWidth: 320, maxWidth: "100%" }}
    >
      <RowHeader
        category={category}
        cardCount={cards.length}
        editMode={editMode}
        onToggleEdit={onToggleEdit}
        onAdd={onAdd}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {cards.length > 0 ? (
        <CardList
          cards={cards}
          editMode={editMode}
          onEdit={onEdit}
          onDelete={onDelete}
          categoryColor={category.color}
          maxHeight={maxHeight}
        />
      ) : (
        <div className="px-3 pb-3">
          <button
            onClick={onAdd}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-xl border border-dashed border-border hover:border-primary/30 w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            在此分类添加网站
          </button>
        </div>
      )}

      {/* Right resize handle - always visible */}
      {!fullWidth && (
        <div
          className="absolute top-0 right-0 w-2 h-full cursor-e-resize group flex items-center justify-end pr-0.5"
          onMouseDown={startHResize}
          title="拖动调整宽度"
        >
          <div className="w-0.5 h-8 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors" />
        </div>
      )}

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize group flex items-end justify-center pb-0.5"
        onMouseDown={startVResize}
        onDoubleClick={resetHeight}
        title="拖动调整高度，双击重置"
      >
        <div className="w-8 h-0.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors" />
      </div>

      {/* Resize indicator when actively resizing */}
      {isResizing && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/20 pointer-events-none" />
      )}
    </section>
  );
}

/* ─── Drag Overlay ─── */

function CardOverlay({ card, editMode, categoryColor }: { card: WebCard; editMode: boolean; categoryColor: string }) {
  return (
    <div className="opacity-90 rotate-2 scale-105">
      <WebCardItem
        card={card}
        editMode={editMode}
        onEdit={() => {}}
        onDelete={() => {}}
        categoryColor={categoryColor}
      />
    </div>
  );
}

/* ─── Main Grid ─── */

export function SortableGrid({
  cards,
  categories,
  onEdit,
  onDelete,
  onAdd,
}: {
  cards: WebCard[];
  categories: Category[];
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  onAdd: (categoryId: string) => void;
}) {
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const reorderCards = useAppStore((s) => s.reorderCards);
  const moveCard = useAppStore((s) => s.moveCard);
  const reorderCategories = useAppStore((s) => s.reorderCategories);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  /* split into "常用" and others */
  const favoriteCategory = sortedCategories.find((c) => c.name === "常用");
  const otherCategories = sortedCategories.filter((c) => c.name !== "常用");

  const favoriteCards = useMemo(() => {
    if (!favoriteCategory) return [];
    return cards
      .filter((c) => c.categoryId === favoriteCategory.id)
      .sort((a, b) => a.order - b.order);
  }, [favoriteCategory, cards]);

  const otherRows = useMemo(() => {
    return otherCategories.map((cat) => ({
      category: cat,
      cards: cards
        .filter((c) => c.categoryId === cat.id)
        .sort((a, b) => a.order - b.order),
    }));
  }, [otherCategories, cards]);

  const activeCard = useMemo(() => {
    if (!activeId) return null;
    return cards.find((c) => c.id === activeId) || null;
  }, [activeId, cards]);

  /* ─── Block reorder helpers ─── */
  const moveCategoryUp = useCallback(
    (catId: string) => {
      const ids = sortedCategories.map((c) => c.id);
      const idx = ids.indexOf(catId);
      if (idx > 0) {
        reorderCategories(arrayMove(ids, idx, idx - 1));
      }
    },
    [sortedCategories, reorderCategories]
  );

  const moveCategoryDown = useCallback(
    (catId: string) => {
      const ids = sortedCategories.map((c) => c.id);
      const idx = ids.indexOf(catId);
      if (idx < ids.length - 1) {
        reorderCategories(arrayMove(ids, idx, idx + 1));
      }
    },
    [sortedCategories, reorderCategories]
  );

  /* ─── drag handlers ─── */

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragOver(_event: DragOverEvent) {
    // visual feedback handled by DragOverlay
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const activeType = active.data.current?.type as string;
    const overType = over.data.current?.type as string;
    const activeCatId = active.data.current?.categoryId as string;
    const overCatId = over.data.current?.categoryId as string;

    if (activeType !== "card") return;

    // ── Cross-row drop ──
    if (overType === "header" && overCatId && activeCatId !== overCatId) {
      moveCard(activeIdStr, overCatId, 999);
      return;
    }

    if (overType === "card" && overCatId && activeCatId !== overCatId) {
      const targetCards = cards
        .filter((c) => c.categoryId === overCatId)
        .sort((a, b) => a.order - b.order);
      const insertIndex = targetCards.findIndex((c) => c.id === overIdStr);
      moveCard(activeIdStr, overCatId, insertIndex >= 0 ? insertIndex : 999);
      return;
    }

    // ── Same-row reorder ──
    if (overType === "card" && overCatId && activeCatId === overCatId) {
      const rowCards = cards
        .filter((c) => c.categoryId === activeCatId)
        .sort((a, b) => a.order - b.order);
      const items = rowCards.map((c) => c.id);
      const oldIdx = items.indexOf(activeIdStr);
      const newIdx = items.indexOf(overIdStr);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        reorderCards(activeCatId, arrayMove(items, oldIdx, newIdx));
      }
    }
  }

  /* ─── render ─── */

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-4">
        {/* Favorite row - full width */}
        {favoriteCategory && (
          <CategoryBlock
            category={favoriteCategory}
            cards={favoriteCards}
            editMode={editMode}
            onToggleEdit={() => setEditMode(!editMode)}
            onAdd={() => onAdd(favoriteCategory.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveUp={() => moveCategoryUp(favoriteCategory.id)}
            onMoveDown={() => moveCategoryDown(favoriteCategory.id)}
            canMoveUp={sortedCategories.indexOf(favoriteCategory) > 0}
            canMoveDown={sortedCategories.indexOf(favoriteCategory) < sortedCategories.length - 1}
            fullWidth
          />
        )}

        {/* Other categories - flex wrap blocks that fill rows */}
        <div className="flex flex-wrap gap-4">
          {otherRows.map((row) => (
            <CategoryBlock
              key={row.category.id}
              category={row.category}
              cards={row.cards}
              editMode={editMode}
              onToggleEdit={() => setEditMode(!editMode)}
              onAdd={() => onAdd(row.category.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveUp={() => moveCategoryUp(row.category.id)}
              onMoveDown={() => moveCategoryDown(row.category.id)}
              canMoveUp={sortedCategories.indexOf(row.category) > 0}
              canMoveDown={sortedCategories.indexOf(row.category) < sortedCategories.length - 1}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <CardOverlay
            card={activeCard}
            editMode={editMode}
            categoryColor={
              categories.find((c) => c.id === activeCard.categoryId)?.color || "#888"
            }
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

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
  closestCenter,
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
  GripVertical,
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

/* ─── Sortable Category Block ─── */

function SortableCategoryBlock({
  category,
  cards,
  editMode,
  onToggleEdit,
  onAdd,
  onEdit,
  onDelete,
  fullWidth = false,
}: {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  fullWidth?: boolean;
}) {
  const blockRef = useRef<HTMLElement | null>(null);

  // Width state: percentage-based
  const [widthPct, setWidthPct] = useState(fullWidth ? 100 : 50);
  // Height state: null = auto, number = fixed max-height
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState<"h" | "v" | null>(null);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    data: { type: "category" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(fullWidth ? {} : { width: `${widthPct}%`, minWidth: 320, maxWidth: "100%" }),
  };

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

  const resetHeight = useCallback(() => {
    setMaxHeight(null);
  }, []);

  return (
    <section
      ref={(node) => {
        setNodeRef(node);
        blockRef.current = node;
      }}
      style={style}
      className={cn(
        "relative rounded-xl border bg-card/60 backdrop-blur-sm transition-shadow",
        fullWidth ? "w-full" : "shrink-0",
        editMode && !isDragging && "border-primary/15",
        !editMode && "border-border/70",
        isDragging && "opacity-60 shadow-xl ring-2 ring-primary/20",
        isResizing && "select-none",
        !isDragging && !isResizing && "hover:shadow-sm"
      )}
    >
      {/* Top accent bar - category color */}
      <div
        className="h-1 rounded-t-xl"
        style={{ backgroundColor: category.color, opacity: 0.7 }}
      />

      {/* Header: drag handle + title + inline action buttons */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 min-w-0">
        {/* Drag handle for block - visible in edit mode */}
        {editMode && (
          <span
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary transition-colors"
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}
        <CategoryIcon iconName={category.icon} color={category.color} />
        <h2 className="text-sm font-serif font-semibold text-foreground tracking-tight truncate">
          {category.name}
        </h2>
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
          {cards.length}
        </span>
        {/* Inline action buttons - right after title */}
        <button
          onClick={onToggleEdit}
          className={cn(
            "text-[11px] px-1.5 py-0.5 rounded transition-colors shrink-0",
            editMode
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/60 hover:text-foreground"
          )}
        >
          {editMode ? "完成" : "编辑"}
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded text-muted-foreground/60 hover:text-primary transition-colors shrink-0"
        >
          <Plus className="w-3 h-3" />
          添加
        </button>
      </div>

      {/* Card content */}
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
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/30 w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            在此分类添加网站
          </button>
        </div>
      )}

      {/* Right resize handle */}
      {!fullWidth && (
        <div
          className="absolute top-4 right-0 w-2 h-[calc(100%-2rem)] cursor-e-resize group flex items-center justify-end pr-0.5"
          onMouseDown={startHResize}
          title="拖动调整宽度"
        >
          <div className="w-0.5 h-6 rounded-full bg-muted-foreground/15 group-hover:bg-primary/40 transition-colors" />
        </div>
      )}

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize group flex items-end justify-center pb-0.5"
        onMouseDown={startVResize}
        onDoubleClick={resetHeight}
        title="拖动调整高度，双击重置"
      >
        <div className="w-6 h-0.5 rounded-full bg-muted-foreground/15 group-hover:bg-primary/40 transition-colors" />
      </div>

      {/* Resize indicator */}
      {isResizing && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary/15 pointer-events-none" />
      )}
    </section>
  );
}

/* ─── Drag Overlays ─── */

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

function CategoryBlockOverlay({ category, cardCount }: { category: Category; cardCount: number }) {
  return (
    <div className="w-64 rounded-xl border bg-card/80 backdrop-blur-sm shadow-xl opacity-80 rotate-1">
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: category.color, opacity: 0.7 }} />
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
        <CategoryIcon iconName={category.icon} color={category.color} />
        <h2 className="text-sm font-serif font-semibold text-foreground tracking-tight">
          {category.name}
        </h2>
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">{cardCount}</span>
      </div>
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
  const [activeType, setActiveType] = useState<"card" | "category" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  const categoryIds = useMemo(
    () => sortedCategories.map((c) => c.id),
    [sortedCategories]
  );

  /* ─── drag handlers ─── */

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveId(id);
    setActiveType(event.active.data.current?.type as "card" | "category");
  }

  function onDragOver(_event: DragOverEvent) {
    // visual feedback handled by DragOverlay
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const aType = active.data.current?.type as string;
    const oType = over.data.current?.type as string;

    // ── Category block drag: reorder categories ──
    if (aType === "category") {
      if (oType === "category" && activeIdStr !== overIdStr) {
        const ids = sortedCategories.map((c) => c.id);
        const oldIdx = ids.indexOf(activeIdStr);
        const newIdx = ids.indexOf(overIdStr);
        if (oldIdx !== -1 && newIdx !== -1) {
          reorderCategories(arrayMove(ids, oldIdx, newIdx));
        }
      }
      return;
    }

    // ── Card drag ──
    if (aType !== "card") return;

    const activeCatId = active.data.current?.categoryId as string;
    const overCatId = over.data.current?.categoryId as string;

    // Drop on category header → move to that category
    if (oType === "category" && activeCatId !== overIdStr) {
      moveCard(activeIdStr, overIdStr, 999);
      return;
    }

    // Cross-category drop on a card
    if (oType === "card" && overCatId && activeCatId !== overCatId) {
      const targetCards = cards
        .filter((c) => c.categoryId === overCatId)
        .sort((a, b) => a.order - b.order);
      const insertIndex = targetCards.findIndex((c) => c.id === overIdStr);
      moveCard(activeIdStr, overCatId, insertIndex >= 0 ? insertIndex : 999);
      return;
    }

    // Same-category reorder
    if (oType === "card" && overCatId && activeCatId === overCatId) {
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

  const activeCard = activeId && activeType === "card"
    ? cards.find((c) => c.id === activeId)
    : null;

  const activeCategory = activeId && activeType === "category"
    ? categories.find((c) => c.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={categoryIds} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-3">
          {sortedCategories.map((cat) => {
            const catCards = cards
              .filter((c) => c.categoryId === cat.id)
              .sort((a, b) => a.order - b.order);

            return (
              <SortableCategoryBlock
                key={cat.id}
                category={cat}
                cards={catCards}
                editMode={editMode}
                onToggleEdit={() => setEditMode(!editMode)}
                onAdd={() => onAdd(cat.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                fullWidth={cat.name === "常用"}
              />
            );
          })}
        </div>
      </SortableContext>

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
        {activeCategory && (
          <CategoryBlockOverlay
            category={activeCategory}
            cardCount={cards.filter((c) => c.categoryId === activeCategory.id).length}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

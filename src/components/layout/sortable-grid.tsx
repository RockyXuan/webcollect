"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
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
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { WebCard, Category } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { getLucideIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  WebCardItem,
} from "@/components/card/web-card";

/* ─── Scroll arrows for horizontal overflow ─── */

function ScrollButtons({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const id = setInterval(check, 500);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      clearInterval(id);
    };
  }, [scrollRef, check]);

  const scroll = (dir: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  return (
    <>
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </>
  );
}

/* ─── Row Header ─── */

function RowHeader({
  category,
  cardCount,
  editMode,
  onToggleEdit,
  onAdd,
}: {
  category: Category;
  cardCount: number;
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
}) {
  // eslint-disable-next-line react-hooks/static-components
  const IconComponent = getLucideIcon(category.icon);

  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2">
      <div className="flex items-center gap-2">
        {IconComponent && (
          // eslint-disable-next-line react-hooks/static-components
          <IconComponent
            className="w-4 h-4 shrink-0"
            style={{ color: category.color }}
          />
        )}
        <h2 className="text-base font-serif font-semibold text-foreground tracking-tight">
          {category.name}
        </h2>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {cardCount}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
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
}: {
  card: WebCard;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
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
      />
    </div>
  );
}

/* ─── Card List with scroll buttons ─── */

function CardList({
  cards,
  editMode,
  onEdit,
  onDelete,
}: {
  cards: WebCard[];
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  return (
    <div className="relative">
      <ScrollButtons scrollRef={scrollRef} />
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto pb-2 px-1 scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        <SortableContext
          items={cardIds}
          strategy={horizontalListSortingStrategy}
        >
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              editMode={editMode}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

/* ─── Category Block with resize handle ─── */

function CategoryBlock({
  category,
  cards,
  editMode,
  onToggleEdit,
  onAdd,
  onEdit,
  onDelete,
  defaultWidth = 520,
}: {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  defaultWidth?: number;
}) {
  const [width, setWidth] = useState(defaultWidth);
  const blockRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = width;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newW = Math.max(320, Math.min(1400, startW + delta));
        setWidth(newW);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width]
  );

  return (
    <section
      ref={blockRef}
      className={cn(
        "relative rounded-2xl border bg-card/50 backdrop-blur-sm transition-colors flex-shrink-0",
        editMode ? "border-primary/20" : "border-border"
      )}
      style={{ width, maxWidth: "100%" }}
    >
      <RowHeader
        category={category}
        cardCount={cards.length}
        editMode={editMode}
        onToggleEdit={onToggleEdit}
        onAdd={onAdd}
      />

      {cards.length > 0 ? (
        <CardList
          cards={cards}
          editMode={editMode}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <div className="px-1 pb-3">
          <button
            onClick={onAdd}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-xl border border-dashed border-border hover:border-primary/30 w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            在此分类添加网站
          </button>
        </div>
      )}

      {/* Resize handle */}
      <div
        className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize flex items-center justify-center rounded hover:bg-muted transition-colors"
        onMouseDown={startResize}
        title="拖动调整宽度"
      >
        <Maximize2 className="w-3 h-3 text-muted-foreground/40" />
      </div>
    </section>
  );
}

/* ─── Drag Overlay ─── */

function CardOverlay({ card, editMode }: { card: WebCard; editMode: boolean }) {
  return (
    <div className="opacity-90 rotate-2 scale-105">
      <WebCardItem
        card={card}
        editMode={editMode}
        onEdit={() => {}}
        onDelete={() => {}}
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

  /* ─── drag handlers ─── */

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    // No-op: visual feedback handled by DragOverlay
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
      <div className="space-y-5">
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
            defaultWidth={1200}
          />
        )}

        {/* Other categories - flex wrap, resizable blocks */}
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
              defaultWidth={520}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && <CardOverlay card={activeCard} editMode={editMode} />}
      </DragOverlay>
    </DndContext>
  );
}

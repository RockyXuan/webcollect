"use client";

import { useMemo, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
  useDroppable,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, PencilLine } from "lucide-react";
import type { WebCard, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { WebCardItem } from "@/components/card/web-card";
import { getLucideIcon } from "@/lib/icons";

/* ─── helpers ─── */

function DynamicIcon({
  icon,
  color,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }> | null;
  color: string;
}) {
  if (!icon) return null;
  const Icon = icon;
  return <Icon className="w-4 h-4" style={{ color }} />;
}

/* ─── Row Header ─── */

interface RowHeaderProps {
  category: Category;
  cardCount: number;
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
}

function RowHeader({
  category,
  cardCount,
  editMode,
  onToggleEdit,
  onAdd,
}: RowHeaderProps) {
  const { setNodeRef } = useDroppable({
    id: `header-${category.id}`,
    data: { type: "header", categoryId: category.id },
  });

  const iconEl = getLucideIcon(category.icon);

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-3 px-1 py-2 select-none"
    >
      <div className="flex items-center gap-2">
        <DynamicIcon icon={iconEl} color={category.color} />
        <h2 className="text-base font-serif font-semibold text-foreground tracking-tight">
          {category.name}
        </h2>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md min-w-[1.5rem] text-center">
          {cardCount}
        </span>
      </div>

      <div className="flex-1" />

      <button
        onClick={onToggleEdit}
        className={cn(
          "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
          editMode
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground"
        )}
      >
        <PencilLine className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">修改</span>
      </button>

      <button
        onClick={onAdd}
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">添加</span>
      </button>
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

/* ─── Card List (horizontal scroll) ─── */

function CardList({
  cards,
  categoryId,
  editMode,
  onEdit,
  onDelete,
}: {
  cards: WebCard[];
  categoryId: string;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
}) {
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide px-1">
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
  );
}

/* ─── Category Block ─── */

function CategoryBlock({
  category,
  cards,
  editMode,
  onToggleEdit,
  onAdd,
  onEdit,
  onDelete,
  className,
}: {
  category: Category;
  cards: WebCard[];
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card/50 backdrop-blur-sm transition-colors",
        editMode ? "border-primary/20" : "border-border",
        className
      )}
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
          categoryId={category.id}
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

  /*
   * onDragOver is used for visual feedback during drag.
   * We do NOT mutate store here to avoid re-render tearing.
   */
  function onDragOver(event: DragOverEvent) {
    // No-op: visual feedback handled by DragOverlay
    // Store mutations happen only in onDragEnd for safety
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
            className="w-full"
          />
        )}

        {/* Other categories - grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && <CardOverlay card={activeCard} editMode={editMode} />}
      </DragOverlay>

      {/* Hide scrollbar utility */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </DndContext>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  PencilLine,
} from "lucide-react";
import type { WebCard, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { WebCardItem } from "@/components/card/web-card";
import { getLucideIcon } from "@/lib/icons";

function DynamicIcon({ icon, color }: { icon: ComponentType<{ className?: string; style?: CSSProperties }> | null; color: string }) {
  if (!icon) return null;
  const Icon = icon;
  return <Icon className="w-4 h-4" style={{ color }} />;
}

interface SortableGridProps {
  cards: WebCard[];
  categories: Category[];
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  onAdd: (categoryId: string) => void;
}

/* ───────────── Category Row Header ───────────── */

interface RowHeaderProps {
  category: Category;
  cardCount: number;
  editMode: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function RowHeader({
  category,
  cardCount,
  editMode,
  onToggleEdit,
  onAdd,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
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
      {/* Icon + Name + Count */}
      <div className="flex items-center gap-2">
        <DynamicIcon icon={iconEl} color={category.color} />
        <h2 className="text-base font-serif font-semibold text-foreground tracking-tight">
          {category.name}
        </h2>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md min-w-[1.5rem] text-center">
          {cardCount}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Edit mode: reorder buttons */}
      {editMode && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1 rounded-md hover:bg-secondary disabled:opacity-30 transition-colors"
            title="上移"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1 rounded-md hover:bg-secondary disabled:opacity-30 transition-colors"
            title="下移"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit toggle */}
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

      {/* Add */}
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

/* ───────────── Horizontal Card List ───────────── */

interface CardListProps {
  cards: WebCard[];
  categoryId: string;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
}

function CardList({ cards, categoryId, editMode, onEdit, onDelete }: CardListProps) {
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
            categoryId={categoryId}
            editMode={editMode}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </SortableContext>
    </div>
  );
}

/* ───────────── Sortable Card Wrapper ───────────── */

function SortableCard({
  card,
  categoryId,
  editMode,
  onEdit,
  onDelete,
}: {
  card: WebCard;
  categoryId: string;
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
    data: { type: "card", categoryId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <WebCardItem
        card={card}
        editMode={editMode}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

/* ───────────── Drag Overlay ───────────── */

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

/* ───────────── Main Grid ───────────── */

export function SortableGrid({
  cards,
  categories,
  onEdit,
  onDelete,
  onAdd,
}: SortableGridProps) {
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const reorderCategories = useAppStore((s) => s.reorderCategories);
  const reorderCards = useAppStore((s) => s.reorderCards);
  const moveCard = useAppStore((s) => s.moveCard);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  const rows = useMemo(() => {
    return sortedCategories.map((cat) => ({
      category: cat,
      cards: cards
        .filter((c) => c.categoryId === cat.id)
        .sort((a, b) => a.order - b.order),
    }));
  }, [sortedCategories, cards]);

  const activeCard = useMemo(() => {
    if (!activeId) return null;
    return cards.find((c) => c.id === activeId) || null;
  }, [activeId, cards]);

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
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

    // Cross-row drop
    if (overType === "header" && overCatId && activeCatId !== overCatId) {
      moveCard(activeIdStr, overCatId, 999);
      return;
    }

    if (overType === "card" && overCatId && activeCatId !== overCatId) {
      const targetCards = rows.find((r) => r.category.id === overCatId)?.cards || [];
      const insertIndex = targetCards.findIndex((c) => c.id === overIdStr);
      moveCard(activeIdStr, overCatId, insertIndex >= 0 ? insertIndex : 999);
      return;
    }

    // Same-row reorder
    if (overType === "card" && overCatId && activeCatId === overCatId) {
      const rowCards = rows.find((r) => r.category.id === activeCatId)?.cards || [];
      const items = rowCards.map((c) => c.id);
      const oldIdx = items.indexOf(activeIdStr);
      const newIdx = items.indexOf(overIdStr);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        reorderCards(activeCatId, arrayMove(items, oldIdx, newIdx));
      }
    }
  }

  function handleMoveRow(categoryId: string, direction: -1 | 1) {
    const idx = sortedCategories.findIndex((c) => c.id === categoryId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sortedCategories.length) return;
    const newIds = arrayMove(sortedCategories.map((c) => c.id), idx, newIdx);
    reorderCategories(newIds);
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-6">
        {rows.map((row, idx) => (
          <section
            key={row.category.id}
            className={cn(
              "rounded-2xl border bg-card/50 backdrop-blur-sm transition-colors",
              editMode ? "border-primary/20" : "border-border"
            )}
          >
            <RowHeader
              category={row.category}
              cardCount={row.cards.length}
              editMode={editMode}
              onToggleEdit={() => setEditMode(!editMode)}
              onAdd={() => onAdd(row.category.id)}
              onMoveUp={() => handleMoveRow(row.category.id, -1)}
              onMoveDown={() => handleMoveRow(row.category.id, 1)}
              isFirst={idx === 0}
              isLast={idx === rows.length - 1}
            />

            {row.cards.length > 0 ? (
              <CardList
                cards={row.cards}
                categoryId={row.category.id}
                editMode={editMode}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : (
              <div className="px-1 pb-3">
                <button
                  onClick={() => onAdd(row.category.id)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-xl border border-dashed border-border hover:border-primary/30 w-full justify-center"
                >
                  <Plus className="w-4 h-4" />
                  在此分类添加网站
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <CardOverlay card={activeCard} editMode={editMode} />
        )}
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

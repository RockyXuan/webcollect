"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { WebCardItem } from "@/components/card/web-card";
import { useAppStore } from "@/lib/store";
import type { WebCard, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getLucideIcon } from "@/lib/icons";

interface SortableGridProps {
  onEditCard: (card: WebCard) => void;
}

export function SortableGrid({ onEditCard }: SortableGridProps) {
  const { cards, categories, activeCategoryId, searchQuery, deleteCard, reorderCards } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const searchFilteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.shortDesc.toLowerCase().includes(q) ||
        c.url.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q)
    );
  }, [cards, searchQuery]);

  const grouped = useMemo(() => {
    if (activeCategoryId !== "all") {
      const catCards = searchFilteredCards
        .filter((c) => c.categoryId === activeCategoryId)
        .sort((a, b) => a.order - b.order);
      return [{ category: null, cards: catCards }];
    }
    const groups: { category: Category | null; cards: WebCard[] }[] = [];
    categories.forEach((cat) => {
      const catCards = searchFilteredCards
        .filter((c) => c.categoryId === cat.id)
        .sort((a, b) => a.order - b.order);
      groups.push({ category: cat, cards: catCards });
    });
    // uncategorized
    const uncategorized = searchFilteredCards.filter(
      (c) => !categories.find((cat) => cat.id === c.categoryId)
    );
    if (uncategorized.length > 0) {
      groups.push({ category: null, cards: uncategorized });
    }
    return groups;
  }, [searchFilteredCards, categories, activeCategoryId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    // Find which category the overId belongs to
    // overId could be a card or a category container
    // We don't change category on drag over to avoid jitter, only on drag end
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const activeCardId = active.id as string;
      const overId = over.id as string;

      const activeCard = cards.find((c) => c.id === activeCardId);
      if (!activeCard) return;

      // Determine target category and new order
      let targetCategoryId = activeCard.categoryId;
      let newOrder = activeCard.order;

      // Check if dropped over a category container
      const overCategory = categories.find((c) => c.id === overId);
      if (overCategory) {
        targetCategoryId = overCategory.id;
        const catCards = cards.filter((c) => c.categoryId === targetCategoryId);
        newOrder = catCards.length;
      } else {
        // Dropped over another card
        const overCard = cards.find((c) => c.id === overId);
        if (overCard) {
          targetCategoryId = overCard.categoryId;
          const catCards = cards
            .filter((c) => c.categoryId === targetCategoryId && c.id !== activeCardId)
            .sort((a, b) => a.order - b.order);
          const overIndex = catCards.findIndex((c) => c.id === overId);
          newOrder = overIndex >= 0 ? overIndex : catCards.length;
        }
      }

      if (targetCategoryId !== activeCard.categoryId || newOrder !== activeCard.order) {
        const catCards = cards
          .filter((c) => c.categoryId === targetCategoryId && c.id !== activeCardId)
          .sort((a, b) => a.order - b.order);
        const reordered = [
          ...catCards.slice(0, newOrder),
          activeCard,
          ...catCards.slice(newOrder),
        ];
        reorderCards(targetCategoryId, reordered.map((c) => c.id));
      }
    },
    [cards, categories, reorderCards]
  );

  const getIcon = getLucideIcon;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8">
        {grouped.map((group) => {
          const catId = group.category?.id || "uncategorized";
          const catCards = group.cards;
          const IconEl = group.category ? getIcon(group.category.icon) : null;

          return (
            <section key={catId} className="space-y-3">
              {/* Category header */}
              {activeCategoryId === "all" && (
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  {group.category && IconEl && (
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: group.category.color + "20" }}
                    >
                      <IconEl
                        className="w-4 h-4"
                        style={{ color: group.category.color }}
                      />
                    </div>
                  )}
                  <h2 className="font-serif text-lg font-semibold text-foreground">
                    {group.category?.name || "未分类"}
                  </h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {catCards.length}
                  </span>
                </div>
              )}

              {/* Cards grid */}
              <SortableContext
                items={catCards.map((c) => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {catCards.map((card) => (
                    <WebCardItem
                      key={card.id}
                      card={card}
                      onEdit={onEditCard}
                      onDelete={(id) => {
                        if (confirm("确定删除这个网站卡片吗？")) {
                          deleteCard(id);
                        }
                      }}
                    />
                  ))}
                </div>
              </SortableContext>

              {catCards.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  该分类暂无网站，点击右上角「添加」开始收集
                </div>
              )}
            </section>
          );
        })}
      </div>
    </DndContext>
  );
}

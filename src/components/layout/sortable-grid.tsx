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
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { WebCardItem } from "@/components/card/web-card";
import { useAppStore } from "@/lib/store";
import type { WebCard, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getLucideIcon } from "@/lib/icons";

interface SortableGridProps {
  onEditCard: (card: WebCard) => void;
  onAddCard: (categoryId?: string) => void;
}

export function SortableGrid({ onEditCard, onAddCard }: SortableGridProps) {
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const activeCardId = active.id as string;
      const overId = over.id as string;

      const activeCard = cards.find((c) => c.id === activeCardId);
      if (!activeCard) return;

      let targetCategoryId = activeCard.categoryId;
      let newOrder = activeCard.order;

      const overCategory = categories.find((c) => c.id === overId);
      if (overCategory) {
        targetCategoryId = overCategory.id;
        const catCards = cards.filter((c) => c.categoryId === targetCategoryId);
        newOrder = catCards.length;
      } else {
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {grouped.map((group) => {
          const catId = group.category?.id || "uncategorized";
          const catCards = group.cards;
          const IconEl = group.category ? getLucideIcon(group.category.icon) : null;
          const isAllView = activeCategoryId === "all";

          return (
            <section
              key={catId}
              className={cn(
                "rounded-xl border border-border/60 bg-card/30 overflow-hidden",
                isAllView && "bg-card/50"
              )}
            >
              {/* Category header */}
              {isAllView && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    {group.category && IconEl && (
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: group.category.color + "20" }}
                      >
                        <IconEl
                          className="w-3.5 h-3.5"
                          style={{ color: group.category.color }}
                        />
                      </div>
                    )}
                    <h2 className="font-serif text-base font-semibold text-foreground">
                      {group.category?.name || "未分类"}
                    </h2>
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {catCards.length}
                    </span>
                  </div>

                  <button
                    onClick={() => onAddCard(group.category?.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-1 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加
                  </button>
                </div>
              )}

              {/* Cards grid - compact */}
              <SortableContext
                items={catCards.map((c) => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className={cn(
                  "grid gap-2 p-3",
                  "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                )}>
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

                  {/* Inline add button at end of grid */}
                  <button
                    onClick={() => onAddCard(group.category?.id)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80",
                      "text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
                      "transition-all duration-200 min-h-[48px]",
                      !isAllView && "py-2.5"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs">添加</span>
                  </button>
                </div>
              </SortableContext>

              {catCards.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  该分类暂无网站，点击上方「添加」开始收集
                </div>
              )}
            </section>
          );
        })}
      </div>
    </DndContext>
  );
}

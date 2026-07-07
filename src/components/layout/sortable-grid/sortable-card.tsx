
"use client";

import React, { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WebCardItem } from "@/components/card/web-card";
import type { WebCard } from "@/lib/types";
import { cardId, handleLockedLayoutPointerDown } from "./layout-math";

// ============ Sortable Card ============
export interface SortableCardProps {
  card: WebCard;
  categoryColor: string;
  editMode: boolean;
  layoutLocked?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateCard?: (card: WebCard) => void;
  onShip?: () => void;
  onCreateGroup?: () => void;
}

export const SortableCard = memo(function SortableCard({
  card,
  categoryColor,
  editMode,
  layoutLocked = false,
  onEdit,
  onDelete,
  onUpdateCard,
  onShip,
  onCreateGroup,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardId(card.id), disabled: layoutLocked });

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
        dragListeners={layoutLocked
          ? {
              className: "cursor-not-allowed text-slate-300 transition-colors",
              onPointerDown: handleLockedLayoutPointerDown,
              title: "所属分类布局已固定，先点击分类右上角固定按钮解除固定",
            }
          : { ...attributes, ...listeners }}
        onCreateGroup={onCreateGroup}
      />
    </div>
  );
});

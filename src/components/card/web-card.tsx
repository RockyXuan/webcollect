"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, Pencil, Trash2, GripVertical } from "lucide-react";
import type { WebCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WebCardProps {
  card: WebCard;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
}

export function WebCardItem({ card, onEdit, onDelete }: WebCardProps) {
  const [showActions, setShowActions] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  // Try to get favicon from imageUrl if it's a favicon
  const hasImage = !!card.imageUrl;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
        "hover:border-primary/40 hover:shadow-sm transition-all duration-200",
        isDragging && "opacity-60 rotate-1 scale-[1.02] shadow-lg ring-2 ring-primary/20"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Icon / Favicon / Abbreviation */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center overflow-hidden">
        {hasImage ? (
          <img
            src={card.imageUrl}
            alt={card.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-xs font-serif font-bold text-muted-foreground/50 select-none">
            {card.abbreviation?.slice(0, 2) || card.title.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate leading-tight">
          {card.title}
        </h3>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {card.shortDesc || card.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}
        </p>
      </div>

      {/* Hover actions */}
      <div
        className={cn(
          "flex items-center gap-1 shrink-0 transition-opacity duration-200",
          showActions ? "opacity-100" : "opacity-0"
        )}
      >
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
          title="访问"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button
          onClick={() => onEdit(card)}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
          title="编辑"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(card.id)}
          className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="删除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded tooltip on hover */}
      {showActions && (card.fullDesc || card.note) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border border-border rounded-lg shadow-lg p-3 text-xs space-y-1 max-w-xs mx-auto">
          {card.note && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/70">备注：</span>
              {card.note}
            </p>
          )}
          {card.fullDesc && (
            <p className="text-muted-foreground line-clamp-3">
              <span className="font-medium text-foreground/70">详情：</span>
              {card.fullDesc}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

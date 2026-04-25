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
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-card p-0 overflow-hidden",
        "shadow-sm hover:shadow-lg transition-all duration-300 ease-out",
        "hover:-translate-y-1",
        isDragging && "opacity-60 rotate-2 scale-105 shadow-2xl ring-2 ring-primary/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-background/80 backdrop-blur-sm"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Image area */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-muted">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-3xl font-serif font-bold text-muted-foreground/40 select-none">
              {card.abbreviation?.slice(0, 2) || card.title.slice(0, 2)}
            </span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div
          className={cn(
            "absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center gap-3 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:scale-110 transition-transform shadow-md"
            title="访问网站"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => onEdit(card)}
            className="p-2.5 rounded-full bg-secondary text-secondary-foreground hover:scale-110 transition-transform shadow-md"
            title="编辑"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(card.id)}
            className="p-2.5 rounded-full bg-destructive text-destructive-foreground hover:scale-110 transition-transform shadow-md"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-col gap-1 p-4">
        <h3 className="font-serif text-base font-semibold text-card-foreground truncate leading-tight">
          {card.title}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          {card.shortDesc || "暂无简介"}
        </p>

        {/* Expanded info on hover */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            isHovered ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"
          )}
        >
          <div className="pt-2 border-t border-border space-y-1.5">
            {card.note && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">备注：</span>
                {card.note}
              </p>
            )}
            {card.fullDesc && (
              <p className="text-xs text-muted-foreground line-clamp-3">
                <span className="font-medium text-foreground/70">详情：</span>
                {card.fullDesc}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

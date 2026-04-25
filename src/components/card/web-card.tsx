"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, Pencil, Trash2, GripVertical } from "lucide-react";
import type { WebCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WebCardProps {
  card: WebCard;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function getFaviconUrl(url: string): string {
  const domain = getDomain(url);
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export function WebCardItem({ card, editMode, onEdit, onDelete }: WebCardProps) {
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

  const [imgFailed, setImgFailed] = useState(false);
  const faviconUrl = getFaviconUrl(card.url);
  const showImg = !!card.imageUrl && !imgFailed;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 w-[220px] shrink-0 select-none",
        editMode
          ? "border-primary/30 shadow-sm"
          : "border-border hover:border-primary/40 hover:shadow-sm",
        isDragging && "opacity-60 rotate-1 scale-[1.02] shadow-lg ring-2 ring-primary/20"
      )}
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
      <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {showImg ? (
          <img
            src={card.imageUrl}
            alt={card.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : faviconUrl && !imgFailed ? (
          <img
            src={faviconUrl}
            alt={card.title}
            className="w-5 h-5 object-contain"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-xs font-serif font-bold text-muted-foreground/50 select-none">
            {card.abbreviation?.slice(0, 2) || card.title.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Content - no truncation */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground leading-tight whitespace-normal">
          {card.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal">
          {card.shortDesc || card.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}
        </p>
      </div>

      {/* Edit mode actions */}
      {editMode && (
        <div className="flex items-center gap-0.5 shrink-0">
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
      )}
    </div>
  );
}

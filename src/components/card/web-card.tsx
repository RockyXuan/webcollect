"use client";

import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ExternalLink, Pencil, Trash2, GripVertical } from "lucide-react";
import type { WebCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WebCardProps {
  card: WebCard;
  editMode: boolean;
  onEdit: (card: WebCard) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  categoryColor?: string;
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

export function WebCardItem({
  card,
  editMode,
  onEdit,
  onDelete,
  isDragging,
  dragHandleProps,
  categoryColor,
}: WebCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const faviconUrl = getFaviconUrl(card.url);
  const showImg = !!card.imageUrl && !imgFailed;
  const accentColor = categoryColor || "#888";

  // Non-edit mode: whole card is draggable
  const cardDragProps = !editMode ? dragHandleProps : {};
  // Edit mode: only the grip handle is draggable
  const handleDragProps = editMode ? dragHandleProps : {};

  const hasDetail = !!(card.fullDesc || card.note);

  const cardContent = (
    <div
      {...cardDragProps}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 w-[200px] shrink-0 select-none",
        "border-l-[3px]",
        editMode
          ? "border-t-primary/30 border-r-primary/30 border-b-primary/30 shadow-sm"
          : "border-t-border border-r-border border-b-border hover:shadow-md",
        isDragging && "opacity-60 rotate-1 scale-[1.02] shadow-lg ring-2 ring-primary/20",
        !editMode && "cursor-grab active:cursor-grabbing"
      )}
      style={{ borderLeftColor: accentColor }}
    >
      {/* Drag handle - edit mode only */}
      {editMode && (
        <div
          {...handleDragProps}
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3 h-3" />
        </div>
      )}

      {/* Icon / Favicon / Abbreviation */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-muted/80 flex items-center justify-center overflow-hidden">
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
            className="w-4.5 h-4.5 object-contain"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span
            className="text-[10px] font-serif font-bold select-none"
            style={{ color: accentColor }}
          >
            {card.abbreviation?.slice(0, 2) || card.title.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground leading-tight truncate">
          {card.title}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight truncate">
          {card.shortDesc}
        </p>
      </div>

      {/* Actions - only in edit mode */}
      {editMode && (
        <div className="flex items-center gap-0 shrink-0">
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="访问"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="编辑"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("确定要删除这个网站吗？")) {
                onDelete(card.id);
              }
            }}
            className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );

  // Wrap with HoverCard for detail tooltip (non-edit, has detail)
  if (!editMode && hasDetail) {
    return (
      <HoverCard openDelay={400} closeDelay={100}>
        <HoverCardTrigger asChild>{cardContent}</HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          className="w-64 p-3 text-sm shadow-lg border-border"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <h4 className="font-serif font-semibold text-foreground">{card.title}</h4>
            </div>
            {card.fullDesc && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {card.fullDesc}
              </p>
            )}
            {card.note && (
              <p className="text-xs text-primary/80 italic">
                备注: {card.note}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/60 truncate">
              {card.url}
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  return cardContent;
}

"use client";

import React, { useState, useCallback } from "react";
import { Pencil, Trash2, ExternalLink, GripVertical } from "lucide-react";
import type { WebCard } from "@/lib/types";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface WebCardItemProps {
  card: WebCard;
  categoryColor: string;
  editMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  dragListeners?: React.HTMLAttributes<HTMLElement> | null;
}

export function WebCardItem({
  card,
  categoryColor,
  editMode,
  onEdit,
  onDelete,
  dragListeners,
}: WebCardItemProps) {
  const [imgError, setImgError] = useState(false);

  // Resolve the best image URL: prefer card.imageUrl, fallback to Google Favicon API
  const faviconUrl = React.useMemo(() => {
    if (!card.url) return "";
    try {
      const hostname = new URL(card.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      return "";
    }
  }, [card.url]);
  const displayImageUrl = card.imageUrl || faviconUrl;

  const handleClick = useCallback(() => {
    if (editMode) return;
    try {
      window.open(card.url, "_blank", "noopener,noreferrer");
    } catch {
      // Fallback
      window.location.href = card.url;
    }
  }, [editMode, card.url]);

  const displayAbbr = card.abbreviation || card.title?.slice(0, 2) || "?";

  const cardContent = (
    <div
      className={`
        group relative flex items-center gap-2 px-2.5 py-1.5
        rounded-lg border transition-all select-none w-[170px]
        ${editMode ? "cursor-default" : "cursor-pointer hover:bg-muted/50"}
        hover:shadow-sm
      `}
      style={{ borderLeftWidth: "3px", borderLeftColor: categoryColor }}
      onClick={handleClick}
    >
      {/* Drag handle in edit mode */}
      {editMode && (
        <span
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground"
          {...(dragListeners || {})}
        >
          <GripVertical className="w-3 h-3" />
        </span>
      )}

      {/* Icon / Abbreviation */}
      <div className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center bg-muted/80 text-[10px] font-bold overflow-hidden">
        {displayImageUrl && !imgError ? (
          <img
            src={displayImageUrl}
            alt={card.title}
            className="w-full h-full object-cover rounded"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <span className="text-muted-foreground">{displayAbbr}</span>
        )}
      </div>

      {/* Text content */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-medium text-foreground leading-tight truncate">
          {card.title}
        </span>
        {card.shortDesc && (
          <span className="text-[10px] text-muted-foreground leading-tight truncate">
            {card.shortDesc}
          </span>
        )}
      </div>

      {/* Action buttons in edit mode */}
      {editMode && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="编辑"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* External link icon on hover (non-edit mode) */}
      {!editMode && (
        <ExternalLink className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
      )}
    </div>
  );

  // Only show hover card in non-edit mode and when there's extra info
  if (!editMode && (card.fullDesc || card.note)) {
    return (
      <HoverCard openDelay={400} closeDelay={100}>
        <HoverCardTrigger asChild>
          {cardContent}
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-64 p-3" sideOffset={4}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{card.title}</span>
              <span className="text-[10px] text-muted-foreground truncate">{card.url}</span>
            </div>
            {card.fullDesc && (
              <p className="text-xs text-muted-foreground leading-relaxed">{card.fullDesc}</p>
            )}
            {card.note && (
              <p className="text-[11px] text-primary/80 italic">备注: {card.note}</p>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  return cardContent;
}

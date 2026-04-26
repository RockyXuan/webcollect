"use client";

import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { WarehouseCard } from "@/lib/db-warehouse";

interface WarehouseCardItemProps {
  card: WarehouseCard;
  categoryColor: string;
}

export function WarehouseCardItem({ card, categoryColor }: WarehouseCardItemProps) {
  const [imgError, setImgError] = useState(false);

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
  const displayAbbr = card.abbreviation || card.title?.slice(0, 2) || "?";

  const handleClick = () => {
    try {
      window.open(card.url, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = card.url;
    }
  };

  return (
    <div
      className="group relative flex items-center gap-1.5 px-2 py-1 rounded border transition-all select-none min-w-[140px] flex-1 cursor-pointer hover:bg-muted/50 hover:shadow-sm"
      style={{ borderLeftWidth: "2px", borderLeftColor: categoryColor }}
      onClick={handleClick}
    >
      {/* Favicon */}
      <div className="h-5 w-5 shrink-0 flex items-center justify-center">
        {displayImageUrl && !imgError ? (
          <img
            src={displayImageUrl}
            alt=""
            className="h-4 w-4 rounded-sm"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-[9px] font-bold text-muted-foreground bg-muted rounded px-0.5">
            {displayAbbr}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate leading-tight">
          {card.title}
        </div>
        {card.shortDesc && (
          <div className="text-[10px] text-muted-foreground truncate leading-tight">
            {card.shortDesc}
          </div>
        )}
      </div>

      {/* External link indicator */}
      <ExternalLink className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

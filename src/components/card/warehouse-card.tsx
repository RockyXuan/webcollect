"use client";

import React, { useState } from "react";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import type { WarehouseCard } from "@/lib/db-warehouse";
import { useWarehouseStore } from "@/lib/store-warehouse";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShipToMainCardDialog } from "@/components/dialogs/ship-to-main-dialog";

interface WarehouseCardItemProps {
  card: WarehouseCard;
  categoryColor: string;
}

export function WarehouseCardItem({ card, categoryColor }: WarehouseCardItemProps) {
  const [imgError, setImgError] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const { deleteWarehouseCard } = useWarehouseStore();

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

  const handleClick = (e: React.MouseEvent) => {
    // Don't open link if clicking action buttons
    const target = e.target as HTMLElement;
    if (target.closest("[data-action]")) return;

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

      {/* Action buttons - visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" data-action="true">
        {/* Send single card */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
          onClick={(e) => { e.stopPropagation(); setShipDialogOpen(true); }}
          title="发送到主页"
        >
          <Send className="h-2.5 w-2.5" />
        </Button>

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => e.stopPropagation()}
              title="删除"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                将删除书签&ldquo;{card.title}&rdquo;，此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteWarehouseCard(card.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* External link indicator (hidden when action buttons visible) */}
      <ExternalLink className="h-3 w-3 text-muted-foreground/40 opacity-100 group-hover:opacity-0 transition-opacity shrink-0" />

      {/* Ship single card dialog */}
      <ShipToMainCardDialog
        open={shipDialogOpen}
        onOpenChange={setShipDialogOpen}
        warehouseCard={card}
      />
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShipToMainCardDialog } from "@/components/dialogs/ship-to-main-dialog";

interface WarehouseDuplicateMatch {
  sectionName: string;
  categoryName: string;
  cardTitle: string;
}

interface WarehouseCardItemProps {
  card: WarehouseCard;
  categoryColor: string;
  onUpdateCard?: (card: WarehouseCard) => void;
  duplicateMatch?: WarehouseDuplicateMatch;
}

export function WarehouseCardItem({ card, categoryColor, onUpdateCard, duplicateMatch }: WarehouseCardItemProps) {
  const [imgError, setImgError] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const { deleteWarehouseCard } = useWarehouseStore();

  // Inline editing state
  const [editingField, setEditingField] = useState<"title" | "shortDesc" | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Inline editing handlers
  const startEdit = useCallback((field: "title" | "shortDesc", e: React.MouseEvent) => {
    if (!onUpdateCard) return;
    e.stopPropagation();
    setEditingField(field);
    setEditValue(field === "title" ? card.title : (card.shortDesc || ""));
  }, [onUpdateCard, card.title, card.shortDesc]);

  const saveEdit = useCallback(() => {
    if (!editingField || !onUpdateCard) return;
    const trimmed = editValue.trim();
    if (editingField === "title" && trimmed && trimmed !== card.title) {
      onUpdateCard({ ...card, title: trimmed, updatedAt: Date.now() });
    } else if (editingField === "shortDesc" && trimmed !== (card.shortDesc || "")) {
      onUpdateCard({ ...card, shortDesc: trimmed, updatedAt: Date.now() });
    }
    setEditingField(null);
    setEditValue("");
  }, [editingField, editValue, card, onUpdateCard]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue("");
  }, []);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
    e.stopPropagation();
  }, [saveEdit, cancelEdit]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't open link if clicking action buttons or editing
    const target = e.target as HTMLElement;
    if (target.closest("[data-action]") || editingField) return;

    try {
      window.open(card.url, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = card.url;
    }
  };

  return (
    <div
      className={`group relative flex items-center gap-1.5 px-2 py-1 rounded border transition-all select-none min-w-[140px] flex-1 cursor-pointer hover:shadow-sm ${
        duplicateMatch ? "bg-red-50/70 border-red-200 text-muted-foreground hover:bg-red-50" : "hover:bg-muted/50"
      }`}
      style={{ borderLeftWidth: "2px", borderLeftColor: duplicateMatch ? "#ef4444" : categoryColor }}
      onClick={handleClick}
      title={duplicateMatch ? `已存在于 ${duplicateMatch.sectionName} / ${duplicateMatch.categoryName}，可删除仓库副本或仍然发送` : undefined}
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
        {duplicateMatch && (
          <div className="text-[9px] text-red-600 truncate leading-tight">
            已在 {duplicateMatch.sectionName}/{duplicateMatch.categoryName}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {editingField === "title" ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs font-medium text-foreground leading-tight w-full bg-transparent border-b border-primary outline-none px-0 py-0"
          />
        ) : (
          <div
            className={`text-xs font-medium text-foreground truncate leading-tight ${onUpdateCard ? "cursor-text hover:bg-muted/30 rounded px-0.5 -mx-0.5" : ""}`}
            onClick={onUpdateCard ? (e) => startEdit("title", e) : undefined}
            title={onUpdateCard ? "点击编辑名称" : undefined}
          >
            {card.title}
          </div>
        )}
        {editingField === "shortDesc" ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-[10px] text-muted-foreground leading-tight w-full bg-transparent border-b border-primary outline-none px-0 py-0"
          />
        ) : (
          <div
            className={`text-[10px] text-muted-foreground truncate leading-tight ${onUpdateCard ? "cursor-text hover:bg-muted/30 rounded px-0.5 -mx-0.5" : ""}`}
            onClick={onUpdateCard && card.shortDesc ? (e) => startEdit("shortDesc", e) : undefined}
            title={onUpdateCard && card.shortDesc ? "点击编辑简介" : undefined}
          >
            {card.shortDesc || (onUpdateCard ? <span className="text-muted-foreground/40 italic">添加简介...</span> : null)}
          </div>
        )}
      </div>

      {/* Action buttons - visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" data-action="true">
        {/* Send single card */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); setShipDialogOpen(true); }}
            >
              <Send className="h-2.5 w-2.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">导入此网页到主页</TooltipContent>
        </Tooltip>

        {/* Delete */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">删除</TooltipContent>
          </Tooltip>
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

"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowUpFromLine,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import type { WebCard } from "@/lib/types";
import { openWebCollectUrl } from "@/lib/platform";
import { getSemanticSiteIcon, getSiteIconCandidates, shouldPersistSiteIcon } from "@/lib/site-icons";
import { useAppStore } from "@/lib/store";
import { EditActionDock, type EditAction } from "@/components/ui/edit-action-dock";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface WebCardItemProps {
  card: WebCard;
  categoryColor: string;
  editMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShip?: () => void;
  onCreateGroup?: () => void;
  dragListeners?: React.HTMLAttributes<HTMLElement> | null;
  onUpdateCard?: (card: WebCard) => void;
}

export function WebCardItem({
  card,
  categoryColor,
  editMode,
  onEdit,
  onDelete,
  onShip,
  onCreateGroup,
  dragListeners,
  onUpdateCard,
}: WebCardItemProps) {
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  const [editingField, setEditingField] = useState<"title" | "shortDesc" | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const linkOpenMode = useAppStore((s) => s.linkOpenMode);
  const isPinnedBookmark = useAppStore((s) => s.pinnedBookmarkItems.some((item) => item.cardId === card.id));
  const togglePinBookmark = useAppStore((s) => s.togglePinBookmark);

  const iconCandidates = React.useMemo(() => getSiteIconCandidates(card), [card]);
  const displayImageUrl = iconCandidates[imageCandidateIndex] || "";
  const semanticIcon = React.useMemo(() => getSemanticSiteIcon(card), [card]);
  const shouldUseSemanticIcon = Boolean(
    semanticIcon && (semanticIcon.prefer || !displayImageUrl),
  );
  const SemanticIcon = semanticIcon?.Icon;

  const handleClick = useCallback(() => {
    if (editMode) return;
    openWebCollectUrl(card.url, linkOpenMode);
  }, [editMode, card.url, linkOpenMode]);

  const displayAbbr = card.abbreviation || card.title?.slice(0, 2) || "?";

  // Start inline editing
  const startEdit = useCallback((field: "title" | "shortDesc", e: React.MouseEvent) => {
    if (!editMode || !onUpdateCard) return;
    e.stopPropagation();
    setEditingField(field);
    setEditValue(field === "title" ? card.title : (card.shortDesc || ""));
  }, [editMode, onUpdateCard, card.title, card.shortDesc]);

  // Save the edit
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

  // Cancel the edit
  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue("");
  }, []);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  useEffect(() => {
    setImageCandidateIndex(0);
  }, [card.id, card.imageUrl, card.url]);

  const handleImageError = useCallback(() => {
    setImageCandidateIndex((current) => current + 1);
  }, []);

  const handleImageLoad = useCallback(() => {
    if (!onUpdateCard || !shouldPersistSiteIcon(card.imageUrl, displayImageUrl)) return;
    onUpdateCard({ ...card, imageUrl: displayImageUrl, updatedAt: Date.now() });
  }, [card, displayImageUrl, onUpdateCard]);

  // Handle key events in the inline input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
    e.stopPropagation(); // Prevent dnd-kit from capturing
  }, [saveEdit, cancelEdit]);

  const hasHoverDetails = Boolean(card.title || card.shortDesc || card.fullDesc || card.note || card.url);
  const detailDescription = card.fullDesc || card.shortDesc;
  const shouldShowHoverDetails = !editMode && !editingField && hasHoverDetails;
  const { title: dragTitle, ...dragHandleProps } = dragListeners || {};

  const cardActions: EditAction[] = [
    { id: "edit", label: "编辑详情", icon: Pencil, onSelect: onEdit },
    ...(onCreateGroup ? [{ id: "create-group", label: "新建分组", icon: ArrowUpFromLine, onSelect: onCreateGroup }] : []),
    ...(onShip ? [{ id: "ship", label: "飞到其他编组", icon: Send, onSelect: onShip }] : []),
    { id: "delete", label: "删除网页", icon: Trash2, tone: "danger" as const, onSelect: onDelete },
  ];

  const cardContent = (
    <div
      className={`
        wc-site-tile group relative flex min-h-12 items-center gap-2.5 px-3 py-2
        transition-all
        w-[var(--wc-site-tile-width)] min-w-[var(--wc-site-tile-width)] max-w-[var(--wc-site-tile-width)] flex-none
        ${editMode ? "wc-site-tile-editing cursor-default select-text" : "cursor-pointer select-none hover:-translate-y-0.5"}
      `}
      style={{ borderLeftWidth: "3px", borderLeftColor: categoryColor }}
      onClick={handleClick}
    >
      {/* Drag handle - always visible for direct drag */}
      {dragListeners && (
        <span
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-500 transition-colors"
          {...dragHandleProps}
          title={typeof dragTitle === "string" ? dragTitle : "拖动排序"}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}

      {/* Icon / Abbreviation - small 6x6 */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/85 text-[10px] font-bold shadow-sm shadow-blue-100"
        style={shouldUseSemanticIcon && semanticIcon ? { background: semanticIcon.background, color: semanticIcon.color } : undefined}
      >
        {shouldUseSemanticIcon && SemanticIcon ? (
          <SemanticIcon className="h-[18px] w-[18px]" strokeWidth={2.3} />
        ) : displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={card.title}
            className="h-full w-full rounded-xl object-cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading="lazy"
          />
        ) : (
          <span className="text-slate-500">{displayAbbr}</span>
        )}
      </div>

      {/* Text content - two-line: name on line 1, shortDesc on line 2 */}
      <div className="min-w-0 flex-[1_1_0] overflow-hidden">
        {editingField === "title" ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full border-b border-blue-500 bg-transparent px-0 py-0 text-[12px] font-semibold leading-tight text-slate-900 outline-none"
          />
        ) : (
          <div
            className={`block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold leading-tight text-slate-900 ${editMode && onUpdateCard ? "cursor-text hover:bg-white/70 rounded px-0.5 -mx-0.5" : ""}`}
            onClick={editMode && onUpdateCard ? (e) => startEdit("title", e) : undefined}
            title={editMode && onUpdateCard ? "点击编辑名称" : undefined}
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
            className="w-full border-b border-blue-500 bg-transparent px-0 py-0 text-[11px] leading-tight text-slate-500 outline-none"
          />
        ) : (
          <div
            className={`block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-tight text-slate-500 ${editMode && onUpdateCard ? "cursor-text hover:bg-white/70 rounded px-0.5 -mx-0.5" : ""}`}
            onClick={editMode && onUpdateCard ? (e) => startEdit("shortDesc", e) : undefined}
            title={editMode && onUpdateCard ? "点击编辑简介" : (card.fullDesc || card.shortDesc || undefined)}
          >
            {card.shortDesc || (editMode && onUpdateCard ? <span className="italic text-slate-400">添加简介...</span> : null)}
          </div>
        )}
      </div>

      <EditActionDock
        actions={cardActions}
        align="card"
        trigger={
          <button
            type="button"
            className="wc-site-edit-trigger"
            onClick={(event) => event.stopPropagation()}
            title="网页更多操作"
            aria-label="网页更多操作"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        }
      />

      {/* External link icon on hover (non-edit mode) */}
      {!editMode && (
        <ExternalLink className="h-3 w-3 flex-shrink-0 text-slate-300/0 transition-colors group-hover:text-blue-400/80" />
      )}
      <button
        type="button"
        className={`wc-site-pin ${isPinnedBookmark ? "wc-site-pin-active" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          togglePinBookmark(card.id);
        }}
        title={isPinnedBookmark ? "取消固定到顶部收藏栏" : "固定到顶部收藏栏"}
      >
        <Star className={`h-3.5 w-3.5 ${isPinnedBookmark ? "fill-current" : ""}`} />
      </button>
    </div>
  );

  if (shouldShowHoverDetails) {
    return (
      <HoverCard openDelay={320} closeDelay={120}>
        <HoverCardTrigger asChild>
          {cardContent}
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          className="wc-card-hover-detail w-80 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_24px_60px_rgba(37,99,235,0.18)] backdrop-blur-xl"
          sideOffset={10}
        >
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="break-words text-sm font-semibold leading-snug text-slate-950">{card.title}</p>
              <p className="break-all text-[10px] leading-relaxed text-slate-400">{card.url}</p>
            </div>
            {card.shortDesc && (
              <p className="break-words text-xs leading-relaxed text-slate-600">{card.shortDesc}</p>
            )}
            {detailDescription && detailDescription !== card.shortDesc && (
              <p className="break-words text-xs leading-relaxed text-slate-500">{detailDescription}</p>
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

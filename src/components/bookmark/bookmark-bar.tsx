"use client";

import React, { useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil, Star } from "lucide-react";
import { getPinnedBookmarkLabel, resolvePinnedBookmarkCards } from "@/lib/pinned-bookmarks";
import { openWebCollectUrl } from "@/lib/platform";
import { getSemanticSiteIcon, getSiteIconCandidates, shouldPersistSiteIcon } from "@/lib/site-icons";
import { useAppStore } from "@/lib/store";
import type { PinnedBookmarkDisplayMode, PinnedBookmarkItem, WebCard } from "@/lib/types";

export function BookmarkBar() {
  const [editMode, setEditMode] = useState(false);
  const cards = useAppStore((state) => state.cards);
  const pinnedBookmarkItems = useAppStore((state) => state.pinnedBookmarkItems);
  const reorderPinnedBookmarks = useAppStore((state) => state.reorderPinnedBookmarks);
  const updatePinnedBookmark = useAppStore((state) => state.updatePinnedBookmark);
  const updateCard = useAppStore((state) => state.updateCard);
  const togglePinBookmark = useAppStore((state) => state.togglePinBookmark);
  const linkOpenMode = useAppStore((state) => state.linkOpenMode);

  const resolvedItems = useMemo(
    () => resolvePinnedBookmarkCards(pinnedBookmarkItems, cards),
    [cards, pinnedBookmarkItems]
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    if (!editMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = resolvedItems.map((entry) => entry.item.id);
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;

    const nextIds = [...ids];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);
    reorderPinnedBookmarks(nextIds);
  };

  return (
    <div className="wc-bookmark-shell">
      <div className="wc-shell px-5">
        <div className={`wc-bookmark-bar ${resolvedItems.length === 0 ? "wc-bookmark-bar-empty" : ""} ${editMode ? "wc-bookmark-bar-editing" : ""}`}>
          <button
            type="button"
            className={`wc-bookmark-edit-toggle ${editMode ? "wc-bookmark-edit-toggle-active" : ""}`}
            onClick={() => setEditMode((value) => !value)}
            aria-pressed={editMode}
            title={editMode ? "完成收藏栏编辑" : "编辑收藏栏"}
          >
            {editMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
          {resolvedItems.length === 0 ? (
            <div className="wc-bookmark-empty">
              <Star className="h-3.5 w-3.5" />
              <span>把常用网页点亮星标后，会固定在这里</span>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={resolvedItems.map((entry) => entry.item.id)} strategy={horizontalListSortingStrategy}>
                <div className="wc-bookmark-track">
                  {resolvedItems.map(({ item, card }) => (
                    <SortableBookmark
                      key={item.id}
                      item={item}
                      card={card}
                      editMode={editMode}
                      onOpen={() => openWebCollectUrl(card.url, linkOpenMode)}
                      onUpdate={updatePinnedBookmark}
                      onUpdateCard={updateCard}
                      onRemove={() => togglePinBookmark(card.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}

interface SortableBookmarkProps {
  item: PinnedBookmarkItem;
  card: WebCard;
  editMode: boolean;
  onOpen: () => void;
  onUpdate: (item: PinnedBookmarkItem) => void;
  onUpdateCard: (card: WebCard) => void;
  onRemove: () => void;
}

function SortableBookmark({ item, card, editMode, onOpen, onUpdate, onUpdateCard, onRemove }: SortableBookmarkProps) {
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editMode,
  });
  const label = getPinnedBookmarkLabel(item, card);
  const iconCandidates = useMemo(() => getSiteIconCandidates(card), [card]);
  const imageUrl = iconCandidates[imageCandidateIndex] || "";
  const semanticIcon = useMemo(() => getSemanticSiteIcon(card), [card]);
  const SemanticIcon = semanticIcon?.Icon;
  const shouldUseSemanticIcon = Boolean(semanticIcon && (semanticIcon.prefer || !imageUrl));
  const showIcon = item.displayMode === "icon" || item.displayMode === "both";
  const showLabel = item.displayMode === "label" || item.displayMode === "both";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const editBookmark = () => {
    const nextLabel = window.prompt("收藏栏短标签，留空则自动使用简称", item.customLabel || label);
    if (nextLabel === null) return;
    const modeInput = window.prompt("显示方式：icon / label / both", item.displayMode);
    if (modeInput === null) return;
    const displayMode: PinnedBookmarkDisplayMode =
      modeInput === "label" || modeInput === "both" || modeInput === "icon" ? modeInput : item.displayMode;
    onUpdate({ ...item, customLabel: nextLabel.trim() || undefined, displayMode });
  };

  const handleImageError = () => {
    setImageCandidateIndex((current) => current + 1);
  };

  const handleImageLoad = () => {
    if (shouldPersistSiteIcon(card.imageUrl, imageUrl)) {
      onUpdateCard({ ...card, imageUrl, updatedAt: Date.now() });
    }
  };

  React.useEffect(() => {
    setImageCandidateIndex(0);
  }, [card.id, card.imageUrl, card.url]);

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`wc-bookmark-item ${editMode ? "wc-bookmark-item-editing group/bookmark" : ""}`}
      onClick={onOpen}
      title={card.title}
    >
      {editMode && (
      <span
        className="wc-bookmark-drag"
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
        title="拖动排序"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      )}
      {showIcon && (
        <span
          className="wc-bookmark-icon"
          style={shouldUseSemanticIcon && semanticIcon ? { background: semanticIcon.background, color: semanticIcon.color } : undefined}
        >
          {shouldUseSemanticIcon && SemanticIcon ? (
            <SemanticIcon className="h-4 w-4" strokeWidth={2.35} />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full rounded-lg object-cover"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          ) : (
            <span>{label.slice(0, 2)}</span>
          )}
        </span>
      )}
      {showLabel && <span className="wc-bookmark-label">{label}</span>}
      {!showLabel && !showIcon && <span className="wc-bookmark-label">{label}</span>}
      {editMode && (
      <span className="wc-bookmark-actions">
        <span
          role="button"
          tabIndex={0}
          className="wc-bookmark-mini"
          onClick={(event) => {
            event.stopPropagation();
            editBookmark();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.stopPropagation();
              editBookmark();
            }
          }}
          title="编辑收藏显示"
        >
          <Pencil className="h-3 w-3" />
        </span>
        <span
          role="button"
          tabIndex={0}
          className="wc-bookmark-mini wc-bookmark-mini-danger"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.stopPropagation();
              onRemove();
            }
          }}
          title="取消固定"
        >
          <Star className="h-3 w-3 fill-current" />
        </span>
      </span>
      )}
    </button>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReadOnlySiteIcon } from "@/components/mindmap/read-only-site-icon";
import { getPinnedBookmarkLabel, resolvePinnedBookmarkCards } from "@/lib/pinned-bookmarks";
import { openWebCollectUrl } from "@/lib/platform";
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState(item.customLabel || "");
  const [draftMode, setDraftMode] = useState<PinnedBookmarkDisplayMode>(item.displayMode);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editMode,
  });
  const label = getPinnedBookmarkLabel(item, card);
  const showIcon = item.displayMode === "icon" || item.displayMode === "both";
  const showLabel = item.displayMode === "label" || item.displayMode === "both";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const commitBookmarkEdit = () => {
    onUpdate({ ...item, customLabel: draftLabel.trim() || undefined, displayMode: draftMode });
    setEditorOpen(false);
  };

  React.useEffect(() => {
    if (!editorOpen) return;
    setDraftLabel(item.customLabel || "");
    setDraftMode(item.displayMode);
  }, [editorOpen, item.customLabel, item.displayMode]);

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
        <ReadOnlySiteIcon
          card={card}
          className="wc-bookmark-icon relative"
          fallbackClassName="text-[10px] font-bold text-slate-500"
          onUpdateCard={onUpdateCard}
        />
      )}
      {showLabel && <span className="wc-bookmark-label">{label}</span>}
      {!showLabel && !showIcon && <span className="wc-bookmark-label">{label}</span>}
      {editMode && (
      <span className="wc-bookmark-actions">
        <Popover open={editorOpen} onOpenChange={setEditorOpen}>
          <PopoverTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              className="wc-bookmark-mini"
              onClick={(event) => {
                event.stopPropagation();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.stopPropagation();
                }
              }}
              title="编辑收藏显示"
            >
              <Pencil className="h-3 w-3" />
            </span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-64 space-y-3 rounded-2xl border-slate-200 bg-white/95 p-3 text-slate-900 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <label className="block space-y-1 text-xs font-bold text-slate-600">
              <span>短标签</span>
              <input
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitBookmarkEdit();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setEditorOpen(false);
                  }
                }}
                placeholder={label}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-300"
              />
            </label>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-600">显示方式</p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                {(["icon", "label", "both"] as PinnedBookmarkDisplayMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${draftMode === mode ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                    onClick={() => setDraftMode(mode)}
                  >
                    {mode === "icon" ? "图标" : mode === "label" ? "文字" : "全部"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100" onClick={() => setEditorOpen(false)}>
                取消
              </button>
              <button type="button" className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white" onClick={commitBookmarkEdit}>
                保存
              </button>
            </div>
          </PopoverContent>
        </Popover>
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

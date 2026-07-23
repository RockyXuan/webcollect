
"use client";

import React, { memo, useCallback, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownFromLine, Folder, GripVertical, Layers, Lock, MoreHorizontal, Pencil, PencilOff, Plus, Send, Settings2, Trash2, Unlock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EditActionDock, type EditAction } from "@/components/ui/edit-action-dock";
import { InlineEditableText } from "@/components/ui/inline-editable-text";
import { useAppStore } from "@/lib/store";
import { useAdaptiveLayoutMetrics } from "@/components/layout/adaptive-resolution-viewport";
import type { Category, CategoryLayoutPreference } from "@/lib/types";
import {
  catId,
  formatRem,
  getSmartParentWidthPercent,
  handleLockedLayoutPointerDown,
  inferLayoutColumns,
  notifyLockedLayoutHint,
} from "./layout-math";

// ============ Sortable Parent Category Block ============
export interface SortableCategoryBlockProps {
  category: Category;
  isParent?: boolean;
  editMode: boolean;
  isHovered?: boolean;
  isDraggingActive?: boolean;
  widthPercent?: number;
  layoutPreference?: CategoryLayoutPreference;
  contentWidthRem?: number;
  defaultWidthPercent: number;
  onEditCategory?: (category: Category) => void;
  onAddCard?: (categoryId?: string) => void;
  onAddGroup?: (parentId?: string) => void;
  onShipCategory?: (category: Category) => void;
  children: React.ReactNode;
}

export const SortableCategoryBlock = memo(function SortableCategoryBlock({
  category,
  isParent,
  editMode,
  isHovered,
  isDraggingActive,
  widthPercent: storedWidth,
  layoutPreference,
  contentWidthRem,
  defaultWidthPercent,
  onEditCategory,
  onAddCard,
  onAddGroup,
  onShipCategory,
  children,
}: SortableCategoryBlockProps) {
  const isLayoutLocked = layoutPreference?.locked === true;
  const { density } = useAdaptiveLayoutMetrics();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: catId(category.id), disabled: isLayoutLocked });

  const { setCategoryWidth, setCategoryLayoutLocked, demoteParentCategory, updateCategory, editMode: globalEditMode, toggleEditMode, softDeleteCategory } = useAppStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDemoteOpen, setConfirmDemoteOpen] = useState(false);

  const rawWidthPercent = localWidth ?? storedWidth ?? layoutPreference?.widthPercent ?? defaultWidthPercent;
  const widthPercent = getSmartParentWidthPercent(rawWidthPercent, defaultWidthPercent);
  const renderedWidth = formatRem(contentWidthRem ?? 30);

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? transition : `${transition}, min-height 0.3s ease-out`,
    opacity: isDragging ? 0.2 : 1,
    flex: `0 0 ${renderedWidth}`,
    width: renderedWidth,
    minWidth: formatRem(20 * density),
    maxWidth: renderedWidth,
    minHeight: isDraggingActive ? '60px' : undefined,
  };

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isLayoutLocked) {
        notifyLockedLayoutHint(e.clientX, e.clientY);
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = container.parentElement?.offsetWidth ?? 1;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newWidth = Math.max(180 * density, startWidth + dx);
        const logicalWidth = newWidth / density;
        const newPercent = Math.max(8, Math.min(100, (logicalWidth / parentWidth) * 100));
        setLocalWidth(newPercent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setLocalWidth((prev) => {
          if (prev !== null) setCategoryWidth(category.id, prev, inferLayoutColumns(prev, 1));
          return prev;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [category.id, density, isLayoutLocked, setCategoryWidth]
  );

  const handleToggleLayoutLock = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setCategoryLayoutLocked(category.id, !isLayoutLocked, widthPercent, inferLayoutColumns(widthPercent, 1));
    },
    [category.id, isLayoutLocked, setCategoryLayoutLocked, widthPercent]
  );

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const categoryActions: EditAction[] = [
    {
      id: "edit",
      label: "轻量编辑",
      icon: Pencil,
      onSelect: () => {
        if (!globalEditMode) toggleEditMode();
      },
    },
    {
      id: "advanced-settings",
      label: "高级设置",
      icon: Settings2,
      onSelect: () => {
        if (!globalEditMode) toggleEditMode();
        onEditCategory?.(category);
      },
    },
    ...(isParent ? [{ id: "add-group", label: "添加分组", icon: Layers, onSelect: () => onAddGroup?.(category.id) }] : []),
    { id: "add-card", label: "添加网页", icon: Plus, onSelect: () => onAddCard?.() },
    { id: "ship", label: "飞到其他分项", icon: Send, onSelect: () => onShipCategory?.(category) },
    { id: "delete", label: "删除分类", icon: Trash2, tone: "danger" as const, onSelect: () => setConfirmDeleteOpen(true) },
    ...(isParent ? [{ id: "demote", label: "降级为分组", icon: ArrowDownFromLine, tone: "danger" as const, onSelect: () => setConfirmDemoteOpen(true) }] : []),
  ];

  const handleDockTriggerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={setRef}
      style={style}
      data-wc-category-id={category.id}
      className={`
        wc-glass-card wc-category-panel relative overflow-visible
        ${isHovered ? "ring-2 ring-blue-400/35 shadow-[0_28px_70px_rgba(59,130,246,0.18)]" : ""}
        transition-all duration-300 ease-out
      `}
    >
      {/* Category header - buttons right next to title */}
      <div
        className="wc-category-header relative z-10 flex items-center gap-2 border-b border-white/60 px-5 py-4"
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
      >
        <span
          className={`transition-colors ${
            isLayoutLocked
              ? "cursor-not-allowed text-slate-300"
              : "cursor-grab active:cursor-grabbing text-slate-400/70 hover:text-blue-600"
          }`}
          {...(isLayoutLocked ? {} : attributes)}
          {...(isLayoutLocked ? {} : listeners)}
          onPointerDown={isLayoutLocked ? handleLockedLayoutPointerDown : undefined}
          title={isLayoutLocked ? "布局已固定，先点击右上角固定按钮解除固定" : "拖动排序"}
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <div
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-sm shadow-blue-300/40"
          style={{ backgroundColor: category.color }}
        />
        <Folder
          className="h-4 w-4 shrink-0 text-blue-500/70"
          aria-hidden="true"
        />
        <InlineEditableText
          value={category.name}
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-semibold text-slate-900 font-serif hover:text-blue-600 transition-colors"
          editMode={editMode}
          onSave={(newName) => updateCategory({ ...category, name: newName })}
        />
        <Button
          variant="ghost"
          size="sm"
          className={`wc-layout-lock-trigger h-7 w-7 shrink-0 rounded-full p-0 ${
            isLayoutLocked
              ? "wc-layout-lock-trigger-active text-blue-600"
              : "text-slate-400 hover:bg-white/80 hover:text-blue-600"
          }`}
          onClick={handleToggleLayoutLock}
          title={isLayoutLocked ? "解除固定布局" : "固定当前布局"}
          aria-label={isLayoutLocked ? "解除固定布局" : "固定当前布局"}
          aria-pressed={isLayoutLocked}
        >
          {isLayoutLocked ? <Lock className="h-4 w-4 stroke-[2.5]" /> : <Unlock className="h-4 w-4 stroke-[2.3]" />}
        </Button>
        {(isHeaderHovered || globalEditMode) && (
          <EditActionDock
            actions={categoryActions}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="wc-edit-dock-trigger h-7 w-7 rounded-full p-0 text-slate-500 hover:bg-white/80 hover:text-blue-600 animate-in fade-in duration-200"
                onClick={handleDockTriggerClick}
                title={globalEditMode ? "分类更多操作" : "进入编辑模式"}
                aria-label={globalEditMode ? "分类更多操作" : "进入编辑模式"}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            }
          />
        )}
        {/* Smooth drop hint */}
        {isHovered && isParent && (
          <span className="text-[10px] text-primary/70 font-medium animate-in fade-in duration-300">
            释放以降级到此分类
          </span>
        )}
        {isDraggingActive && isParent && !isHovered && (
          <span className="text-[10px] text-slate-400/60 transition-opacity duration-300">
            拖入分组到此分类
          </span>
        )}

        {globalEditMode && (
          <Button
            variant="ghost"
            size="sm"
            className="wc-edit-exit-chip h-8 gap-1 rounded-full px-3 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            onClick={(e) => { e.stopPropagation(); toggleEditMode(); }}
            title="退出编辑模式"
          >
            <PencilOff className="w-2.5 h-2.5" />
            退出编辑
          </Button>
        )}
      </div>

      {/* Category body */}
      <div className="wc-category-body relative z-10 p-4">{children}</div>

      {/* Resize handle - right edge, always available */}
      <div
        className={`absolute right-0 top-0 bottom-0 z-20 w-2 rounded-r-[28px] transition-colors ${
          isLayoutLocked
            ? "cursor-not-allowed hover:bg-amber-300/20"
            : "cursor-col-resize hover:bg-blue-400/20 active:bg-blue-500/25"
        }`}
        title={isLayoutLocked ? "布局已固定，先点击右上角固定按钮解除固定" : "拖动调整分类宽度"}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={handleResizeStart}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">确认删除「{category.name}」</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，此分类及其下属所有分组和网页将移入回收站。
              你可以随时从回收站恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { softDeleteCategory(category.id); setConfirmDeleteOpen(false); }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote confirmation dialog */}
      {isParent && (
        <AlertDialog open={confirmDemoteOpen} onOpenChange={setConfirmDemoteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif">确认降级「{category.name}」</AlertDialogTitle>
              <AlertDialogDescription>
                降级后，此分类将变为分组移入「未分类」区域，
                其下属的所有分组也会被拆散为独立分组。
                此操作不会删除任何网站数据。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { demoteParentCategory(category.id); setConfirmDemoteOpen(false); }}
              >
                确认降级
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
});

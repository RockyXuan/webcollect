
import type React from "react";
import { pointerWithin, rectIntersection, type CollisionDetection } from "@dnd-kit/core";
import type { CategoryLayoutPreference } from "@/lib/types";

// ============ Type-prefixed ID helpers ============
export const catId = (id: string) => `cat:${id}`;
export const cardId = (id: string) => `card:${id}`;
export const ungroupId = (id: string) => `ungrouped:${id}`;
export const subId = (id: string) => `sub:${id}`;
export const MAX_RENDERED_CARD_COLUMNS = 3;
export const SITE_TILE_WIDTH_REM = 14.75;
export const SITE_TILE_GAP_REM = 0.5;
export const GROUP_HORIZONTAL_PADDING_REM = 2;
export const GROUP_FLOW_GAP_REM = 0.75;
export const PARENT_HORIZONTAL_PADDING_REM = 3.5;
export const LOCKED_LAYOUT_HINT_EVENT = "webcollect:locked-layout-hint";
export const LOCKED_LAYOUT_HINT_TEXT = "布局已锁定，若需移动或调整，请先点击右上角解锁。";

export type LockedLayoutHint = {
  id: number;
  x: number;
  y: number;
};

// ============ Custom collision detection ============
export const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

// ============ Default width calculation ============
export function getDefaultWidthPercent(cardCount: number, groupCount: number): number {
  if (groupCount <= 1) {
    if (cardCount <= 2) return 30;
    if (cardCount <= 4) return 33;
    if (cardCount <= 12) return 40;
    return 52;
  }
  if (groupCount <= 2) {
    if (cardCount <= 4) return 33;
    if (cardCount <= 8) return 40;
    if (cardCount <= 16) return 48;
    return 60;
  }
  if (groupCount <= 3) {
    if (cardCount <= 12) return 56;
    if (cardCount <= 20) return 66;
    return 76;
  }
  if (cardCount <= 16) return 72;
  return 88;
}

export function getSmartParentWidthPercent(rawWidth: number, defaultWidth: number): number {
  const safeWidth = Number.isFinite(rawWidth) ? rawWidth : defaultWidth;
  return Math.max(30, Math.min(88, safeWidth));
}

export function notifyLockedLayoutHint(x: number, y: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOCKED_LAYOUT_HINT_EVENT, {
      detail: { x, y },
    }));
  }
}

export function handleLockedLayoutPointerDown(event: React.PointerEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
  notifyLockedLayoutHint(event.clientX, event.clientY);
}

export function formatRem(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}rem`;
}

export function getPracticalMaxColumns(cardCount: number): number {
  if (!Number.isFinite(cardCount)) return MAX_RENDERED_CARD_COLUMNS;
  if (cardCount <= 1) return 1;
  if (cardCount <= 4) return 2;
  return MAX_RENDERED_CARD_COLUMNS;
}

export function normalizeRenderedColumns(columns: number, cardCount = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(columns)) return 1;
  return Math.max(1, Math.min(getPracticalMaxColumns(cardCount), Math.round(columns)));
}

export function getChildBasisRemForColumns(columns: number): number {
  const safeColumns = normalizeRenderedColumns(columns);
  return safeColumns * SITE_TILE_WIDTH_REM
    + Math.max(0, safeColumns - 1) * SITE_TILE_GAP_REM
    + GROUP_HORIZONTAL_PADDING_REM;
}

export function getChildBasisForColumns(columns: number): string {
  const width = getChildBasisRemForColumns(columns);
  return formatRem(width);
}

export function getMaxChildWidth(cardCount: number): string {
  if (cardCount <= 4) return "77.75rem";
  if (cardCount <= 6) return "47.25rem";
  if (cardCount <= 10) return "62.5rem";
  return "77.75rem";
}

export function inferLayoutColumns(widthPercent: number | null, cardCount: number): number {
  const maxColumns = getPracticalMaxColumns(cardCount);
  if (widthPercent === null) return Math.min(maxColumns, cardCount <= 4 ? 2 : 3);
  if (widthPercent >= 64) return maxColumns;
  if (widthPercent >= 38) return Math.min(maxColumns, 2);
  return 1;
}

export function getStableLayoutColumns(
  layoutPreference: CategoryLayoutPreference | undefined,
  widthPercent: number | null,
  cardCount: number
): number {
  if (typeof layoutPreference?.columns === "number" && Number.isFinite(layoutPreference.columns)) {
    return normalizeRenderedColumns(layoutPreference.columns, cardCount);
  }
  return inferLayoutColumns(widthPercent ?? layoutPreference?.widthPercent ?? null, cardCount);
}

export function getCardGridStyle(columns: number): React.CSSProperties {
  return {
    "--wc-card-columns": String(normalizeRenderedColumns(columns)),
  } as React.CSSProperties;
}

export function getSmartChildStyle(
  widthPercent: number | null,
  cardCount: number,
  columns = inferLayoutColumns(widthPercent, cardCount)
): React.CSSProperties {
  const columnBasis = getChildBasisForColumns(columns);
  const maxWidth = getMaxChildWidth(cardCount);

  if (widthPercent !== null) {
    const contentMaxWidth = formatRem(Math.max(getChildBasisRemForColumns(columns), GROUP_HORIZONTAL_PADDING_REM + SITE_TILE_WIDTH_REM));
    return {
      flex: `0 0 ${contentMaxWidth}`,
      width: contentMaxWidth,
      minWidth: columnBasis,
      maxWidth: contentMaxWidth,
    };
  }

  return {
    flex: `0 0 ${columnBasis}`,
    width: columnBasis,
    minWidth: columnBasis,
    maxWidth,
  };
}

export function getParentLayoutRowWidthsRem(groupWidths: number[]): number[] {
  const widths = groupWidths.filter((width) => Number.isFinite(width) && width > 0);
  if (widths.length === 0) return [30 - PARENT_HORIZONTAL_PADDING_REM];
  if (widths.length <= 2) {
    return [
      widths.reduce((sum, width) => sum + width, 0)
        + Math.max(0, widths.length - 1) * GROUP_FLOW_GAP_REM,
    ];
  }

  const sorted = [...widths].sort((a, b) => a - b);
  const compactPairWidth = sorted[0] + sorted[1] + GROUP_FLOW_GAP_REM;
  const targetRowWidth = Math.max(sorted[sorted.length - 1], compactPairWidth);
  const rows: number[] = [];
  let currentRowWidth = 0;
  let currentRowCount = 0;

  for (const width of widths) {
    const nextRowWidth = currentRowCount === 0
      ? width
      : currentRowWidth + GROUP_FLOW_GAP_REM + width;

    if (currentRowCount > 0 && nextRowWidth > targetRowWidth + 0.01) {
      rows.push(currentRowWidth);
      currentRowWidth = width;
      currentRowCount = 1;
    } else {
      currentRowWidth = nextRowWidth;
      currentRowCount += 1;
    }
  }

  if (currentRowCount > 0) rows.push(currentRowWidth);
  return rows;
}

export function getParentContentWidthRem(groupWidths: number[]): number {
  const rowWidths = getParentLayoutRowWidthsRem(groupWidths);
  return Math.max(...rowWidths) + PARENT_HORIZONTAL_PADDING_REM;
}

import type { CategoryLayoutPreference, CategoryLayoutPreferences } from "./types";

export const SITE_TILE_WIDTH_REM = 14.75;
export const SITE_TILE_GAP_REM = 0.5;
export const GROUP_CARD_LIST_INLINE_PADDING_REM = 2;
export const DEFAULT_ROOT_FONT_SIZE_PX = 16;
export const MAX_GROUP_COLUMNS = 4;

export function getDefaultLayoutColumns(cardCount: number): number {
  if (cardCount <= 1) return 1;
  if (cardCount <= 4) return 2;
  if (cardCount <= 8) return 4;
  return 4;
}

export function clampLayoutColumns(columns: number | undefined, cardCount: number): number {
  const maxColumns = Math.max(1, Math.min(MAX_GROUP_COLUMNS, Math.max(1, cardCount)));
  if (!Number.isFinite(columns)) return getDefaultLayoutColumns(cardCount);
  return Math.max(1, Math.min(maxColumns, Math.round(columns || 1)));
}

export function getGroupWidthRemForColumns(columns: number): number {
  const safeColumns = Math.max(1, Math.min(MAX_GROUP_COLUMNS, Math.round(columns)));
  return GROUP_CARD_LIST_INLINE_PADDING_REM
    + safeColumns * SITE_TILE_WIDTH_REM
    + Math.max(0, safeColumns - 1) * SITE_TILE_GAP_REM;
}

export function calculateColumnsForWidth(
  widthPx: number,
  cardCount: number,
  rootFontSizePx = DEFAULT_ROOT_FONT_SIZE_PX
): number {
  const maxColumns = Math.max(1, Math.min(MAX_GROUP_COLUMNS, Math.max(1, cardCount)));
  for (let columns = maxColumns; columns >= 1; columns -= 1) {
    if (widthPx >= getGroupWidthRemForColumns(columns) * rootFontSizePx) {
      return columns;
    }
  }
  return 1;
}

export function sanitizeCategoryLayout(
  value: unknown,
  fallbackUpdatedAt = 0
): CategoryLayoutPreference | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const widthPercent = typeof raw.widthPercent === "number" && Number.isFinite(raw.widthPercent)
    ? Math.max(1, Math.min(100, raw.widthPercent))
    : undefined;
  const columns = typeof raw.columns === "number" && Number.isFinite(raw.columns)
    ? Math.max(1, Math.min(MAX_GROUP_COLUMNS, Math.round(raw.columns)))
    : undefined;
  const updatedAt = typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
    ? raw.updatedAt
    : fallbackUpdatedAt;

  if (widthPercent === undefined && columns === undefined) return null;
  return { widthPercent, columns, updatedAt };
}

export function sanitizeCategoryLayouts(value: unknown): CategoryLayoutPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: CategoryLayoutPreferences = {};
  for (const [categoryId, layout] of Object.entries(value as Record<string, unknown>)) {
    const normalized = sanitizeCategoryLayout(layout);
    if (normalized) result[categoryId] = normalized;
  }
  return result;
}

export function migrateWidthsToLayouts(
  widths: Record<string, number>,
  updatedAt = Date.now()
): CategoryLayoutPreferences {
  const result: CategoryLayoutPreferences = {};
  for (const [categoryId, widthPercent] of Object.entries(widths)) {
    if (typeof widthPercent === "number" && Number.isFinite(widthPercent)) {
      result[categoryId] = {
        widthPercent: Math.max(1, Math.min(100, widthPercent)),
        updatedAt,
      };
    }
  }
  return result;
}

export function mergeCategoryLayouts(
  localLayouts: CategoryLayoutPreferences,
  cloudLayouts: CategoryLayoutPreferences
): CategoryLayoutPreferences {
  const result: CategoryLayoutPreferences = {};
  const categoryIds = new Set([
    ...Object.keys(localLayouts),
    ...Object.keys(cloudLayouts),
  ]);

  for (const categoryId of categoryIds) {
    const local = localLayouts[categoryId];
    const cloud = cloudLayouts[categoryId];
    if (!local) {
      result[categoryId] = cloud;
    } else if (!cloud) {
      result[categoryId] = local;
    } else {
      result[categoryId] = cloud.updatedAt > local.updatedAt ? cloud : local;
    }
  }

  return result;
}

export function layoutsToWidths(layouts: CategoryLayoutPreferences): Record<string, number> {
  const widths: Record<string, number> = {};
  for (const [categoryId, layout] of Object.entries(layouts)) {
    if (typeof layout.widthPercent === "number" && Number.isFinite(layout.widthPercent)) {
      widths[categoryId] = layout.widthPercent;
    }
  }
  return widths;
}

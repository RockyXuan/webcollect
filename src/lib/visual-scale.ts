export const DEFAULT_VISUAL_SCALE = 100;
export const MIN_VISUAL_SCALE = 85;
export const MAX_VISUAL_SCALE = 125;
export const VISUAL_SCALE_RENDER_BASELINE = 0.9;
export const VISUAL_SCALE_BASELINE_MIGRATION_KEY = "visualScaleBaseline90Migrated";

export function clampVisualScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_VISUAL_SCALE;
  return Math.max(MIN_VISUAL_SCALE, Math.min(MAX_VISUAL_SCALE, scale));
}

export function shouldMigrateLegacyNinetyScale(scale: number, migrationDone: boolean): boolean {
  return !migrationDone && scale === 90;
}

export function getRenderedVisualScale(scale: number): number {
  return clampVisualScale(scale) * VISUAL_SCALE_RENDER_BASELINE;
}

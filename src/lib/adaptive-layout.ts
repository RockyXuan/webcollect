import {
  DEFAULT_VISUAL_SCALE,
  clampVisualScale,
} from "@/lib/visual-scale";

export type AdaptiveLayoutTier = "wide" | "compressed" | "reflow" | "compact";

export interface AdaptiveLayoutMetrics {
  availableWidth: number;
  effectiveWidth: number;
  density: number;
  textDensity: number;
  controlHeight: number;
  tier: AdaptiveLayoutTier;
}

export const ADAPTIVE_WIDE_MIN_WIDTH = 1880;
export const ADAPTIVE_SINGLE_ROW_MIN_WIDTH = 1600;
export const ADAPTIVE_COMPACT_MAX_WIDTH = 1180;
export const ADAPTIVE_MIN_DENSITY = 0.88;
export const ADAPTIVE_MIN_TEXT_DENSITY = 0.92;
export const ADAPTIVE_MIN_CONTROL_HEIGHT = 36;
export const ADAPTIVE_WIDE_CONTROL_HEIGHT = 38;

function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function normalizeAvailableWidth(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return ADAPTIVE_WIDE_MIN_WIDTH;
  return value;
}

/**
 * Calculates presentation-only responsive metrics from the space WebCollect
 * actually owns. The result is never persisted and never changes logical
 * collection layout preferences.
 */
export function getAdaptiveLayoutMetrics(
  availableWidth: number,
  visualScale = DEFAULT_VISUAL_SCALE
): AdaptiveLayoutMetrics {
  const safeAvailableWidth = normalizeAvailableWidth(availableWidth);
  const safeVisualScale = clampVisualScale(visualScale);
  const effectiveWidth = safeAvailableWidth * (DEFAULT_VISUAL_SCALE / safeVisualScale);

  if (safeAvailableWidth <= ADAPTIVE_COMPACT_MAX_WIDTH) {
    return {
      availableWidth: roundMetric(safeAvailableWidth),
      effectiveWidth: roundMetric(effectiveWidth),
      density: 1,
      textDensity: 1,
      controlHeight: ADAPTIVE_MIN_CONTROL_HEIGHT,
      tier: "compact",
    };
  }

  if (effectiveWidth < ADAPTIVE_SINGLE_ROW_MIN_WIDTH) {
    return {
      availableWidth: roundMetric(safeAvailableWidth),
      effectiveWidth: roundMetric(effectiveWidth),
      density: ADAPTIVE_MIN_DENSITY,
      textDensity: ADAPTIVE_MIN_TEXT_DENSITY,
      controlHeight: ADAPTIVE_MIN_CONTROL_HEIGHT,
      tier: "reflow",
    };
  }

  if (effectiveWidth < ADAPTIVE_WIDE_MIN_WIDTH) {
    const density = Math.max(
      ADAPTIVE_MIN_DENSITY,
      Math.min(1, effectiveWidth / ADAPTIVE_WIDE_MIN_WIDTH)
    );
    return {
      availableWidth: roundMetric(safeAvailableWidth),
      effectiveWidth: roundMetric(effectiveWidth),
      density: roundMetric(density),
      textDensity: roundMetric(Math.max(ADAPTIVE_MIN_TEXT_DENSITY, density)),
      controlHeight: Math.max(
        ADAPTIVE_MIN_CONTROL_HEIGHT,
        roundMetric(ADAPTIVE_WIDE_CONTROL_HEIGHT * density)
      ),
      tier: "compressed",
    };
  }

  return {
    availableWidth: roundMetric(safeAvailableWidth),
    effectiveWidth: roundMetric(effectiveWidth),
    density: 1,
    textDensity: 1,
    controlHeight: ADAPTIVE_WIDE_CONTROL_HEIGHT,
    tier: "wide",
  };
}

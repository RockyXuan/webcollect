import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_MIN_DENSITY,
  getAdaptiveLayoutMetrics,
} from "@/lib/adaptive-layout";

describe("getAdaptiveLayoutMetrics", () => {
  it.each([
    [1920, "wide", 1],
    [1880, "wide", 1],
    [1680, "compressed", 1680 / 1880],
    [1600, "compressed", ADAPTIVE_MIN_DENSITY],
    [1599, "reflow", ADAPTIVE_MIN_DENSITY],
    [1536, "reflow", ADAPTIVE_MIN_DENSITY],
    [1366, "reflow", ADAPTIVE_MIN_DENSITY],
    [1180, "compact", 1],
    [1024, "compact", 1],
    [390, "compact", 1],
  ] as const)("maps %ipx to %s", (width, tier, expectedDensity) => {
    const metrics = getAdaptiveLayoutMetrics(width);

    expect(metrics.tier).toBe(tier);
    expect(metrics.density).toBeCloseTo(expectedDensity, 3);
    expect(metrics.density).toBeGreaterThanOrEqual(ADAPTIVE_MIN_DENSITY);
    expect(metrics.density).toBeLessThanOrEqual(1);
    expect(metrics.textDensity).toBeGreaterThanOrEqual(0.92);
    expect(metrics.textDensity).toBeLessThanOrEqual(1);
    expect(metrics.controlHeight).toBeGreaterThanOrEqual(36);
    expect(metrics.controlHeight).toBeLessThanOrEqual(38);
  });

  it("accounts for the existing visual-scale preference without mutating it", () => {
    expect(getAdaptiveLayoutMetrics(1680, 85).tier).toBe("wide");
    expect(getAdaptiveLayoutMetrics(1680, 100).tier).toBe("compressed");
    expect(getAdaptiveLayoutMetrics(1920, 125).tier).toBe("reflow");
    expect(getAdaptiveLayoutMetrics(1024, 85).tier).toBe("compact");
  });

  it("uses a stable wide fallback for invalid widths", () => {
    expect(getAdaptiveLayoutMetrics(Number.NaN)).toEqual(
      getAdaptiveLayoutMetrics(1880)
    );
    expect(getAdaptiveLayoutMetrics(-100).tier).toBe("wide");
  });
});

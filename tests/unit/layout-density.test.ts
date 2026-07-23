import { describe, expect, it } from "vitest";
import {
  getChildBasisRemForColumns,
  getParentContentWidthRem,
  getSmartChildStyle,
} from "@/components/layout/sortable-grid/layout-math";

describe("classic layout density", () => {
  it("scales tile, padding, gap, and parent width together", () => {
    const density = 0.9;
    const wideChildren = [
      getChildBasisRemForColumns(2),
      getChildBasisRemForColumns(3),
    ];
    const compactChildren = [
      getChildBasisRemForColumns(2, density),
      getChildBasisRemForColumns(3, density),
    ];

    expect(compactChildren[0]).toBeCloseTo(wideChildren[0] * density, 8);
    expect(compactChildren[1]).toBeCloseTo(wideChildren[1] * density, 8);
    expect(getParentContentWidthRem(compactChildren, density)).toBeCloseTo(
      getParentContentWidthRem(wideChildren) * density,
      8
    );
  });

  it("does not alter the stored logical width or column choice", () => {
    const style = getSmartChildStyle(40, 8, 2, 0.88);

    expect(style.flex).toBe("0 0 28.16rem");
    expect(style.width).toBe("28.16rem");
    expect(style.minWidth).toBe("28.16rem");
  });

  it("sanitizes invalid density without mutating source widths", () => {
    const widths = [20, 30, 40];
    const before = [...widths];

    expect(getParentContentWidthRem(widths, Number.NaN)).toBe(
      getParentContentWidthRem(widths)
    );
    expect(widths).toEqual(before);
  });
});

import assert from "node:assert/strict";
import {
  getSmartChildStyle,
  getSmartParentWidthPercent,
} from "../src/components/layout/sortable-grid";

function numericPercent(styleValue: string): number {
  const match = styleValue.match(/calc\(([\d.]+)%/);
  assert.ok(match, `Expected calc(percent%) style, received ${styleValue}`);
  return Number(match[1]);
}

const parentDefaultWidth = getSmartParentWidthPercent(50, 50);
assert.equal(parentDefaultWidth, 50);

const stretchedParentWidth = getSmartParentWidthPercent(96, 50);
assert.equal(stretchedParentWidth, 96, "manual parent resize should allow near-full-row widths");

const compactFourCardStyle = getSmartChildStyle(null, 4);
assert.equal(compactFourCardStyle.width, "32rem");
assert.equal(compactFourCardStyle.maxWidth, "77.75rem");

const stretchedFourCardStyle = getSmartChildStyle(72, 4);
assert.equal(numericPercent(String(stretchedFourCardStyle.width)), 72);
assert.equal(stretchedFourCardStyle.maxWidth, "none");
assert.equal(stretchedFourCardStyle.minWidth, "47.25rem");

const fullFourCardStyle = getSmartChildStyle(100, 4);
assert.equal(numericPercent(String(fullFourCardStyle.width)), 100);

console.log("layout-sizing tests passed");

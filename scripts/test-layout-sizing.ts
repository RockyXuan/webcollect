import assert from "node:assert/strict";
import {
  getSmartChildStyle,
  getSmartParentWidthPercent,
} from "../src/components/layout/sortable-grid";

const parentDefaultWidth = getSmartParentWidthPercent(50, 50);
assert.equal(parentDefaultWidth, 50);

const stretchedParentWidth = getSmartParentWidthPercent(96, 50);
assert.equal(stretchedParentWidth, 88, "historical near-full-row parent widths should be capped to avoid large empty slabs");

const compactFourCardStyle = getSmartChildStyle(null, 4);
assert.equal(compactFourCardStyle.width, "32rem");
assert.equal(compactFourCardStyle.maxWidth, "77.75rem");

const stretchedFourCardStyle = getSmartChildStyle(72, 4);
assert.equal(String(stretchedFourCardStyle.width).includes("%"), false, "saved percent widths should not drive flex wrapping");
assert.equal(stretchedFourCardStyle.width, "47.25rem");
assert.equal(stretchedFourCardStyle.flex, "0 0 47.25rem");
assert.equal(stretchedFourCardStyle.maxWidth, "47.25rem", "saved percent widths should still be capped by content-fit width");
assert.equal(stretchedFourCardStyle.minWidth, "47.25rem");

const fullFourCardStyle = getSmartChildStyle(100, 4);
assert.equal(fullFourCardStyle.width, "62.5rem");
assert.equal(fullFourCardStyle.flex, "0 0 62.5rem");
assert.equal(fullFourCardStyle.maxWidth, "62.5rem", "full-width legacy group layouts should cap at a 4-column content-fit width");

console.log("layout-sizing tests passed");

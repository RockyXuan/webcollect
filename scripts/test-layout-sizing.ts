import assert from "node:assert/strict";
import {
  getParentContentWidthRem,
  getParentLayoutRowWidthsRem,
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
assert.equal(stretchedFourCardStyle.width, "32rem");
assert.equal(stretchedFourCardStyle.flex, "0 0 32rem");
assert.equal(stretchedFourCardStyle.maxWidth, "32rem", "saved percent widths should still be capped by content-fit width");
assert.equal(stretchedFourCardStyle.minWidth, "32rem");

const fullFourCardStyle = getSmartChildStyle(100, 4);
assert.equal(fullFourCardStyle.width, "32rem");
assert.equal(fullFourCardStyle.flex, "0 0 32rem");
assert.equal(fullFourCardStyle.maxWidth, "32rem", "full-width legacy group layouts should cap at a compact content-fit width");

const sixCardLegacyStyle = getSmartChildStyle(100, 6);
assert.equal(sixCardLegacyStyle.width, "47.25rem", "6-card groups should cap at 3 columns instead of leaving an empty fourth column");

const elevenCardLegacyStyle = getSmartChildStyle(100, 11);
assert.equal(elevenCardLegacyStyle.width, "47.25rem", "11-card groups should cap at 3 columns for compact download-like groups");

assert.deepEqual(
  getParentLayoutRowWidthsRem([47.25, 32, 32]),
  [47.25, 64.75],
  "wide first groups should stand alone, with smaller groups packed under them instead of stretching the parent"
);
assert.equal(
  getParentContentWidthRem([47.25, 32, 32]),
  68.25,
  "parent width should fit the widest real row plus padding, not a phantom wide row"
);
assert.equal(
  getParentContentWidthRem([47.25, 16.75]),
  68.25,
  "two real groups should stay on one compact row"
);

console.log("layout-sizing tests passed");

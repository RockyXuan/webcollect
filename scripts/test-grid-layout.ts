import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const files = [
  "src/components/layout/sortable-grid/index.tsx",
  "src/components/layout/sortable-grid/category-block.tsx",
  "src/components/layout/sortable-grid/sub-group-block.tsx",
  "src/components/layout/sortable-grid/ungrouped-block.tsx",
  "src/components/layout/sortable-grid/sortable-card.tsx",
  "src/components/layout/sortable-grid/layout-math.ts",
];

for (const file of files) {
  assert.equal(existsSync(file), true, `${file} should exist after sortable-grid split`);
}

assert.equal(existsSync("src/components/layout/sortable-grid.tsx"), false, "old monolithic sortable-grid.tsx should be replaced by a folder module");

const indexSource = readFileSync("src/components/layout/sortable-grid/index.tsx", "utf8");
const categorySource = readFileSync("src/components/layout/sortable-grid/category-block.tsx", "utf8");
const subGroupSource = readFileSync("src/components/layout/sortable-grid/sub-group-block.tsx", "utf8");
const ungroupedSource = readFileSync("src/components/layout/sortable-grid/ungrouped-block.tsx", "utf8");
const cardSource = readFileSync("src/components/layout/sortable-grid/sortable-card.tsx", "utf8");
const layoutMathSource = readFileSync("src/components/layout/sortable-grid/layout-math.ts", "utf8");

assert.ok(indexSource.includes("export function SortableGrid"), "index should keep the DnD shell and SortableGrid export");
assert.ok(indexSource.includes('from "./category-block"'), "index should import parent category block");
assert.ok(indexSource.includes('from "./sub-group-block"'), "index should import sub-group components");
assert.ok(indexSource.includes('from "./ungrouped-block"'), "index should import ungrouped block");
assert.equal(indexSource.includes("const SortableCategoryBlock ="), false, "index should not keep parent block implementation inline");
assert.equal(indexSource.includes("const SortableSubGroupBlock ="), false, "index should not keep sub-group block implementation inline");
assert.equal(indexSource.includes("const SortableUngroupedBlock ="), false, "index should not keep ungrouped block implementation inline");
assert.equal(indexSource.includes("const SortableCard ="), false, "index should not keep card implementation inline");

assert.ok(categorySource.includes("export const SortableCategoryBlock"), "category-block should export SortableCategoryBlock");
assert.ok(subGroupSource.includes("export function SortableSubGroupContainer"), "sub-group-block should export SortableSubGroupContainer");
assert.ok(subGroupSource.includes("export const SortableSubGroupBlock"), "sub-group-block should export SortableSubGroupBlock");
assert.ok(ungroupedSource.includes("export const SortableUngroupedBlock"), "ungrouped-block should export SortableUngroupedBlock");
assert.ok(cardSource.includes("export const SortableCard"), "sortable-card should export SortableCard");

for (const fnName of [
  "getSmartParentWidthPercent",
  "inferLayoutColumns",
  "getStableLayoutColumns",
  "getCardGridStyle",
  "getSmartChildStyle",
  "getParentLayoutRowWidthsRem",
  "getParentContentWidthRem",
]) {
  assert.ok(layoutMathSource.includes(`export function ${fnName}`), `${fnName} should live in layout-math.ts`);
}

console.log("grid layout split tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getCardGridStyle,
  getSmartChildStyle,
  getStableLayoutColumns,
  inferLayoutColumns,
} from "../src/components/layout/sortable-grid";
import { mergeCategoryLayouts } from "../src/lib/sync";

const defaultFourCardStyle = getSmartChildStyle(null, 4);
assert.equal(defaultFourCardStyle.width, "32rem", "4-card groups should default to a 2x2-friendly width");
assert.equal(defaultFourCardStyle.flex, "0 0 32rem", "default groups should not shrink across viewport scales");
assert.equal(inferLayoutColumns(null, 4), 2, "4-card default intent should be 2 columns");
assert.equal(inferLayoutColumns(28, 4), 1, "narrow resize should remember 1-column intent");
assert.equal(inferLayoutColumns(50, 4), 2, "medium resize should remember 2-column intent");
assert.equal(inferLayoutColumns(92, 4), 4, "wide resize should remember 4-column intent");
assert.equal(getStableLayoutColumns({ columns: 3, updatedAt: 100 }, 28, 11), 3, "saved columns should win over viewport/container width");
assert.equal(getStableLayoutColumns(undefined, null, 11), 3, "large groups should get a stable default column count");
assert.equal(getSmartChildStyle(null, 11, 3).width, "47.25rem", "3-column groups should use a 3-column basis");
assert.deepEqual(getCardGridStyle(3), { "--wc-card-columns": "3" }, "card grid style should expose fixed column count");

const globalCss = readFileSync("src/app/globals.css", "utf8");
assert.match(
  globalCss,
  /grid-template-columns:\s*repeat\(var\(--wc-card-columns,\s*1\),\s*var\(--wc-site-tile-width\)\)/,
  "normal card grids should use fixed saved columns"
);
assert.doesNotMatch(
  globalCss,
  /\.wc-group-card-list\s*\{[\s\S]*?auto-fill/,
  "normal card grids must not auto-fill by viewport width"
);

const merged = mergeCategoryLayouts(
  { chrome: { widthPercent: 46, columns: 2, locked: true, updatedAt: 200 }, zmt: { widthPercent: 96, columns: 4, updatedAt: 100 } },
  { chrome: { widthPercent: 24, columns: 1, locked: false, updatedAt: 100 }, work: { widthPercent: 50, columns: 2, locked: true, updatedAt: 300 } }
);

assert.deepEqual(merged.chrome, { widthPercent: 46, columns: 2, locked: true, updatedAt: 200 });
assert.deepEqual(merged.zmt, { widthPercent: 96, columns: 4, updatedAt: 100 });
assert.deepEqual(merged.work, { widthPercent: 50, columns: 2, locked: true, updatedAt: 300 });

console.log("layout preference tests passed");

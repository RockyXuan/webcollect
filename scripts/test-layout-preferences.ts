import assert from "node:assert/strict";
import { inferLayoutColumns, getSmartChildStyle } from "../src/components/layout/sortable-grid";
import { mergeCategoryLayouts } from "../src/lib/sync";

const defaultFourCardStyle = getSmartChildStyle(null, 4);
assert.equal(defaultFourCardStyle.width, "32rem", "4-card groups should default to a 2x2-friendly width");
assert.equal(inferLayoutColumns(null, 4), 2, "4-card default intent should be 2 columns");
assert.equal(inferLayoutColumns(28, 4), 1, "narrow resize should remember 1-column intent");
assert.equal(inferLayoutColumns(50, 4), 2, "medium resize should remember 2-column intent");
assert.equal(inferLayoutColumns(92, 4), 4, "wide resize should remember 4-column intent");

const merged = mergeCategoryLayouts(
  { chrome: { widthPercent: 46, columns: 2, locked: true, updatedAt: 200 }, zmt: { widthPercent: 96, columns: 4, updatedAt: 100 } },
  { chrome: { widthPercent: 24, columns: 1, locked: false, updatedAt: 100 }, work: { widthPercent: 50, columns: 2, locked: true, updatedAt: 300 } }
);

assert.deepEqual(merged.chrome, { widthPercent: 46, columns: 2, locked: true, updatedAt: 200 });
assert.deepEqual(merged.zmt, { widthPercent: 96, columns: 4, updatedAt: 100 });
assert.deepEqual(merged.work, { widthPercent: 50, columns: 2, locked: true, updatedAt: 300 });

console.log("layout preference tests passed");

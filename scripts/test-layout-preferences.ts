import assert from "node:assert/strict";
import {
  calculateColumnsForWidth,
  getDefaultLayoutColumns,
  mergeCategoryLayouts,
  migrateWidthsToLayouts,
} from "../src/lib/category-layouts";

const now = 1_700_000_000_000;

assert.equal(getDefaultLayoutColumns(0), 1);
assert.equal(getDefaultLayoutColumns(1), 1);
assert.equal(getDefaultLayoutColumns(4), 2, "four-card groups should default to a 2x2 layout");
assert.equal(getDefaultLayoutColumns(8), 4);

assert.equal(calculateColumnsForWidth(260, 4), 1);
assert.equal(calculateColumnsForWidth(540, 4), 2);
assert.equal(calculateColumnsForWidth(1020, 4), 4, "wide four-card groups should fit one row");

assert.deepEqual(migrateWidthsToLayouts({ chrome: 50 }, now), {
  chrome: { widthPercent: 50, updatedAt: now },
});

const merged = mergeCategoryLayouts(
  {
    chrome: { columns: 2, widthPercent: 50, updatedAt: 10 },
    ai: { columns: 3, widthPercent: 75, updatedAt: 30 },
  },
  {
    chrome: { columns: 4, widthPercent: 100, updatedAt: 20 },
    work: { columns: 1, widthPercent: 25, updatedAt: 25 },
  }
);
assert.deepEqual(merged, {
  chrome: { columns: 4, widthPercent: 100, updatedAt: 20 },
  ai: { columns: 3, widthPercent: 75, updatedAt: 30 },
  work: { columns: 1, widthPercent: 25, updatedAt: 25 },
});

assert.deepEqual(mergeCategoryLayouts({ chrome: { columns: 2, updatedAt: 10 } }, {}), {
  chrome: { columns: 2, updatedAt: 10 },
});

console.log("layout preference tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const storeSource = readFileSync("src/lib/store.ts", "utf8");
const sortableSource = [
  readFileSync("src/components/layout/sortable-grid/category-block.tsx", "utf8"),
  readFileSync("src/components/layout/sortable-grid/sub-group-block.tsx", "utf8"),
  readFileSync("src/components/layout/sortable-grid/ungrouped-block.tsx", "utf8"),
  readFileSync("src/components/layout/sortable-grid/sortable-card.tsx", "utf8"),
].join("\n");
const hotRecommendationSource = readFileSync("src/components/hot-recommendation.tsx", "utf8");

const forbiddenStorePatterns = [
  /set\(\{[^\n]*(await getCards|await getCategories)/,
  /set\(\{ cards: await/,
  /set\(\{ categories: await/,
  /set\(\{ cards: await getCards\(\), categories: await getCategories\(\) \}\)/,
];

for (const pattern of forbiddenStorePatterns) {
  assert.doesNotMatch(
    storeSource,
    pattern,
    "store mutations should set already-computed arrays instead of re-reading all IndexedDB rows"
  );
}

for (const componentName of [
  "SortableCategoryBlock",
  "SortableSubGroupBlock",
  "SortableUngroupedBlock",
  "SortableCard",
]) {
  assert.match(
    sortableSource,
    new RegExp(`const ${componentName} = memo\\(function ${componentName}`),
    `${componentName} should be wrapped in React.memo`
  );
}

assert.ok(
  hotRecommendationSource.includes("IntersectionObserver"),
  "hot recommendation safety checks should wait until the panel enters the viewport"
);
assert.ok(
  hotRecommendationSource.includes("discoverRef"),
  "hot recommendation should observe the recommendation panel root"
);
assert.doesNotMatch(
  hotRecommendationSource,
  /auto-check on first load/,
  "hot recommendation should not describe or implement eager first-load safety checks"
);

console.log("render performance guard tests passed");

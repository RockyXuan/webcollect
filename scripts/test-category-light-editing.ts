import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/layout/sortable-grid.tsx", "utf8");

const lightEditBlocks = source.match(/id: "edit",[\s\S]*?id: "advanced-settings"/g) ?? [];
assert.equal(lightEditBlocks.length, 3, "category and group menus should expose light edit before advanced settings");

for (const block of lightEditBlocks) {
  assert.ok(block.includes('label: "轻量编辑"'), "light edit action should be labeled clearly");
  assert.ok(!block.includes("onEditCategory?.(category);"), "light edit must not open the advanced category dialog");
}

const advancedSettingsMatches = source.match(/label: "高级设置"[\s\S]*?onEditCategory\?\.\(category\);/g) ?? [];
assert.equal(advancedSettingsMatches.length, 3, "advanced settings should be the only category menu action that opens the full dialog");

console.log("category light editing tests passed");

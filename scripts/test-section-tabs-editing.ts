import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const topNavSource = readFileSync("src/components/nav/top-nav.tsx", "utf8");
const storeSource = readFileSync("src/lib/store.ts", "utf8");
const webCss = readFileSync("src/app/globals.css", "utf8");

assert.ok(storeSource.includes("reorderSections"), "store should expose a section reorder action");
assert.ok(topNavSource.includes("DndContext"), "top section tabs should support drag sorting");
assert.ok(topNavSource.includes("InlineEditableText"), "top section names should edit inline");
assert.ok(topNavSource.includes("wc-section-edit-toggle"), "top section tabs should have a visible edit toggle");
assert.ok(topNavSource.includes("sectionDraftName"), "new sections should be created with an inline draft input");
assert.ok(!topNavSource.includes("window.prompt(\"新分项名称"), "adding a section must not use browser prompt");
assert.ok(!topNavSource.includes("window.prompt(\"重命名分项"), "renaming a section must not use browser prompt");
assert.ok(!topNavSource.includes("window.confirm(\n      `删除分项"), "section deletion must not use browser confirm");
assert.ok(webCss.includes(".wc-section-tab:not(.wc-section-tab-active):hover"), "inactive tab hover color should be explicit");
assert.ok(webCss.includes(".wc-section-drag-handle"), "section edit mode should show a drag handle");

console.log("section tabs editing tests passed");

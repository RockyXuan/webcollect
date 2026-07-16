import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDist = resolve(projectRoot, "extension/dist");
const mainScriptPath = resolve(extensionDist, "assets/main.js");
const mainStylesPath = resolve(extensionDist, "assets/main.css");
const newtabPath = resolve(extensionDist, "newtab.html");
const layoutAssetNames = [
  "layout-logic-right.svg",
  "layout-bilateral.svg",
  "layout-tree-down.svg",
  "layout-indent.svg",
];

for (const path of [mainScriptPath, mainStylesPath, newtabPath]) {
  assert.ok(existsSync(path), `${path} must exist after build:ext`);
}

const script = readFileSync(mainScriptPath, "utf8");
const styles = readFileSync(mainStylesPath, "utf8");
const newtab = readFileSync(newtabPath, "utf8");

assert.match(script, /mindmapViewState:/, "extension bundle must include the isolated mindmap view-state key");
assert.match(script, /wc-mindmap-stage/, "extension bundle must render the shared mindmap stage");
assert.match(styles, /\.wc-mindmap-stage/, "extension bundle must include shared mindmap styles");
assert.match(newtab, /assets\/main\.js/, "newtab must load the built application bundle");
assert.doesNotMatch(newtab, /<script[^>]+https?:\/\//, "newtab must not add external runtime scripts");

for (const assetName of layoutAssetNames) {
  const sourcePath = resolve(projectRoot, "public/mindmap", assetName);
  const builtPath = resolve(extensionDist, "mindmap", assetName);
  assert.ok(existsSync(sourcePath), `source layout asset is missing: ${assetName}`);
  assert.ok(existsSync(builtPath), `built layout asset is missing: ${assetName}`);
  assert.equal(
    readFileSync(builtPath, "utf8"),
    readFileSync(sourcePath, "utf8"),
    `built layout asset must exactly match source: ${assetName}`
  );
}

console.log("extension mindmap artifact test passed");

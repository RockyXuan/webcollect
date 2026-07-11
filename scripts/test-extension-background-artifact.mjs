import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backgroundPath = resolve(projectRoot, "extension/dist/background.js");

assert.ok(existsSync(backgroundPath), "extension/dist/background.js must exist after build:ext");

const source = readFileSync(backgroundPath, "utf8");
const sourceManifest = JSON.parse(readFileSync(resolve(projectRoot, "extension/manifest.json"), "utf8"));
const builtManifest = JSON.parse(readFileSync(resolve(projectRoot, "extension/dist/manifest.json"), "utf8"));
const importPattern = /(?:from\s+|import\s*)["'](\.{1,2}\/[^"']+)["']/g;
const missingImports = [];

for (const match of source.matchAll(importPattern)) {
  const resolvedImport = resolve(dirname(backgroundPath), match[1]);
  if (!existsSync(resolvedImport)) missingImports.push(match[1]);
}

assert.deepEqual(
  missingImports,
  [],
  `built service worker has unresolved relative imports: ${missingImports.join(", ")}`
);
assert.deepEqual(builtManifest, sourceManifest, "built manifest must exactly match the release source manifest");

console.log("extension background artifact test passed");

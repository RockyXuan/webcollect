import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backgroundPath = resolve(projectRoot, "extension/dist/background.js");

assert.ok(existsSync(backgroundPath), "extension/dist/background.js must exist after build:ext");

const source = readFileSync(backgroundPath, "utf8");
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

console.log("extension background artifact test passed");

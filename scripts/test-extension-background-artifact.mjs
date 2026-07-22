import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backgroundPath = resolve(projectRoot, "extension/dist/background.js");
const extensionDistPath = resolve(projectRoot, "extension/dist");

function listFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(path, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

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
assert.ok(sourceManifest.permissions.includes("favicon"), "extension must keep Chrome's private favicon renderer permission");
assert.ok(!sourceManifest.permissions.includes("tabGroups"), "saved tag packs must not request Chrome tabGroups permission");
assert.ok(!sourceManifest.permissions.includes("tabs"), "saved tag packs must keep the narrower existing tab access contract");

const searchableArtifactText = listFiles(extensionDistPath)
  .filter((path) => statSync(path).size <= 8_000_000)
  .flatMap((path) => {
    try {
      return [readFileSync(path, "utf8")];
    } catch {
      return [];
    }
  })
  .join("\n");

for (const forbiddenRuntimeMarker of [
  "api.openai.com",
  "text-embedding-3-small",
  "OPENAI_API_KEY",
  "bookmark-search",
]) {
  assert.ok(
    !searchableArtifactText.includes(forbiddenRuntimeMarker),
    `released extension must not contain dormant AI runtime marker: ${forbiddenRuntimeMarker}`,
  );
}

console.log("extension background artifact test passed");

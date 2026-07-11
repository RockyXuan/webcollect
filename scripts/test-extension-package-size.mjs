import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const MAX_EXTENSION_BYTES = 25 * 1024 * 1024;
const distDir = resolve("extension/dist");

function directoryBytes(path) {
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const child = resolve(path, entry.name);
    return total + (entry.isDirectory() ? directoryBytes(child) : statSync(child).size);
  }, 0);
}

const bytes = directoryBytes(distDir);
assert.ok(
  bytes <= MAX_EXTENSION_BYTES,
  `extension package is ${(bytes / 1024 / 1024).toFixed(1)} MiB; expected at most 25 MiB`
);

console.log(`extension package size passed: ${(bytes / 1024 / 1024).toFixed(1)} MiB`);

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const EXPECTED_VERSION = "1.0.3";
const EXPECTED_RELEASE_DATE = "2026-07-02";
const EXPECTED_RELEASE_DATE_DISPLAY = "2026年7月2日";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readPngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  assertPng(bytes, path);
  return readPngDimensions(bytes);
}

function assertPng(bytes: Buffer, label: string) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(bytes.subarray(0, 8).equals(pngSignature), true, `${label} should be a real PNG file`);
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } {
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function readIcoPngEntries(path: string): Array<{ width: number; height: number }> {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt16LE(0), 0, `${path} should be an ICO file`);
  assert.equal(bytes.readUInt16LE(2), 1, `${path} should be an icon resource`);
  const count = bytes.readUInt16LE(4);
  const entries: Array<{ width: number; height: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const size = bytes.readUInt32LE(entryOffset + 8);
    const imageOffset = bytes.readUInt32LE(entryOffset + 12);
    const imageBytes = bytes.subarray(imageOffset, imageOffset + size);
    assertPng(imageBytes, `${path} entry ${index}`);
    entries.push(readPngDimensions(imageBytes));
  }
  return entries;
}

const packageJson = readJson<{ version: string }>("package.json");
const manifest = readJson<{ version: string; icons: Record<string, string> }>("extension/manifest.json");

assert.equal(packageJson.version, EXPECTED_VERSION, "package version should track the current product version");
assert.equal(manifest.version, EXPECTED_VERSION, "Chrome extension manifest version should match the product version");

assert.deepEqual(
  manifest.icons,
  {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  "manifest should keep all Chrome icon entry points wired"
);

for (const [size, path] of Object.entries(manifest.icons)) {
  const expectedSize = Number(size);
  const iconPath = `extension/public/${path}`;
  const { width, height } = readPngSize(iconPath);
  assert.equal(width, expectedSize, `${iconPath} should be ${expectedSize}px wide`);
  assert.equal(height, expectedSize, `${iconPath} should be ${expectedSize}px tall`);
}

assert.deepEqual(
  readIcoPngEntries("src/app/favicon.ico"),
  [
    { width: 16, height: 16 },
    { width: 32, height: 32 },
    { width: 48, height: 48 },
    { width: 128, height: 128 },
  ],
  "web favicon should use chipmunk PNG entries at common browser sizes"
);

const versionModulePath = "src/lib/app-version.ts";
assert.equal(existsSync(versionModulePath), true, "app version module should exist");
const versionModule = readFileSync(versionModulePath, "utf8");
assert.ok(versionModule.includes(`APP_VERSION = "${EXPECTED_VERSION}"`), "app version module should expose the current version");
assert.ok(versionModule.includes(`APP_RELEASE_DATE = "${EXPECTED_RELEASE_DATE}"`), "app version module should expose the release date");
assert.ok(
  versionModule.includes(`APP_RELEASE_DATE_DISPLAY = "${EXPECTED_RELEASE_DATE_DISPLAY}"`),
  "app version module should expose a Chinese display date"
);

const userMenuSource = readFileSync("src/components/auth/user-menu.tsx", "utf8");
assert.ok(userMenuSource.includes("APP_VERSION"), "account menu should render the app version");
assert.ok(userMenuSource.includes("APP_RELEASE_DATE_DISPLAY"), "account menu should render the release date");

const topNavSource = readFileSync("src/components/nav/top-nav.tsx", "utf8");
assert.ok(
  topNavSource.includes("/assets/mascots/chipmunk-head.png"),
  "main WebCollect brand mark should use the chipmunk head asset"
);

console.log("extension branding tests passed");

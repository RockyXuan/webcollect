import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_FLOATING_CAPTURE_PREFS, normalizeFloatingCapturePrefs } from "../src/lib/floating-capture";

const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as {
  content_scripts?: Array<{ matches?: string[]; js?: string[] }>;
  web_accessible_resources?: Array<{ resources?: string[] }>;
};
const contentScript = readFileSync("extension/src/content/floating-capture.ts", "utf8");
const backgroundScript = readFileSync("extension/background.js", "utf8");
const builtContentScriptPath = "extension/dist/assets/floating-capture.js";

assert.ok(
  manifest.content_scripts?.some((entry) => entry.js?.includes("assets/floating-capture.js")),
  "manifest should inject the floating capture content script"
);
assert.ok(
  manifest.content_scripts?.some((entry) => entry.matches?.includes("https://*/*") && entry.matches?.includes("http://*/*")),
  "floating capture should run on normal http/https pages"
);
assert.ok(
  manifest.web_accessible_resources?.some((entry) => entry.resources?.includes("assets/mascots/*.png")),
  "mascot images should be web-accessible to the content script"
);

for (const asset of [
  "extension/src/assets/mascots/chipmunk-head.png",
  "extension/src/assets/mascots/otter-head.png",
  "extension/src/assets/mascots/wc-3d.png",
  "extension/src/assets/mascots/plus-3d.png",
]) {
  assert.equal(existsSync(asset), true, `${asset} should exist`);
}

assert.match(
  contentScript,
  /__WEBCOLLECT_FLOATING_CAPTURE_HEALTH__/,
  "content script should expose a health marker for browser verification"
);
assert.match(
  contentScript,
  /sanitizeFloatingCapturePrefs/,
  "content script should sanitize old or malformed floating capture prefs"
);
assert.match(
  backgroundScript,
  /normalizeCapturePrefs/,
  "background worker should normalize floating capture prefs before returning them"
);

if (existsSync(builtContentScriptPath)) {
  const builtContentScript = readFileSync(builtContentScriptPath, "utf8").slice(0, 500);
  assert.doesNotMatch(
    builtContentScript,
    /^\s*import\b|^\s*import\{/,
    "built floating capture content script must be a classic script without ESM imports"
  );
}

const recovered = normalizeFloatingCapturePrefs({
  ...DEFAULT_FLOATING_CAPTURE_PREFS,
  enabled: false,
  buttonEnabled: false,
});
assert.equal(recovered.enabled, true, "legacy hidden global prefs should recover to visible defaults");
assert.equal(recovered.buttonEnabled, true, "legacy hidden button prefs should recover to visible defaults");
assert.equal(typeof recovered.recoveredAt, "number", "legacy recovery should be recorded");

const explicitHidden = normalizeFloatingCapturePrefs({
  ...DEFAULT_FLOATING_CAPTURE_PREFS,
  enabled: false,
  hiddenByUserAt: 123,
});
assert.equal(explicitHidden.enabled, false, "explicit current hidden prefs should remain respected");

const expiredPause = normalizeFloatingCapturePrefs({
  ...DEFAULT_FLOATING_CAPTURE_PREFS,
  pauseUntil: Date.now() - 1000,
});
assert.equal(expiredPause.pauseUntil, null, "expired pause should not keep the floating capture hidden");

console.log("floating capture health tests passed");

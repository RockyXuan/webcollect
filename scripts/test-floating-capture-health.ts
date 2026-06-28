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
  contentScript,
  /PANEL_POSITION_STORAGE_KEY/,
  "floating capture panel should persist draggable panel position"
);
assert.match(
  contentScript,
  /panelHead\.addEventListener\("pointerdown"/,
  "floating capture panel header should be draggable"
);
assert.match(
  contentScript,
  /window\.addEventListener\("pointerup",\s*finishPanelDrag,\s*true\)/,
  "floating capture panel drag should recover when pointerup happens outside the panel header"
);
assert.match(
  contentScript,
  /applyPanelPosition\(\);\s*savePanelPosition\(\);/,
  "floating capture panel should persist position during drag, not only on a perfect pointerup"
);
assert.match(
  contentScript,
  /position:\s*sticky;[\s\S]*?bottom:\s*-16px;[\s\S]*?wc-actions/,
  "floating capture actions should stay visible when the panel body scrolls"
);
assert.match(
  contentScript,
  /data-action="save">保存<\/button>\s*<button class="wc-secondary" type="button" data-action="close">取消<\/button>/,
  "floating capture actions should put save on the left and cancel on the right"
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
assert.equal(recovered.sizeScale, 0.67, "floating capture should default to the smaller two-thirds size");

const hugeScale = normalizeFloatingCapturePrefs({
  ...DEFAULT_FLOATING_CAPTURE_PREFS,
  sizeScale: 5,
});
assert.equal(hugeScale.sizeScale, 1.15, "floating capture size should clamp large custom values");

const tinyScale = normalizeFloatingCapturePrefs({
  ...DEFAULT_FLOATING_CAPTURE_PREFS,
  sizeScale: 0.2,
});
assert.equal(tinyScale.sizeScale, 0.55, "floating capture size should clamp tiny custom values");

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

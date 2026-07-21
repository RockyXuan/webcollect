import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const authStoreSource = readFileSync("src/lib/auth-store.ts", "utf8");
const driveAuthSource = readFileSync("src/lib/google-drive-auth.ts", "utf8");
const EXPECTED_EXTENSION_ID = "immpcmhmabobllnopedaoflcjneigbko";
const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

function extensionIdFromManifestKey(key) {
  const publicKey = Buffer.from(key, "base64");
  const hash = createHash("sha256").update(publicKey).digest().subarray(0, 16);
  return [...hash]
    .map((byte) => String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 15)))
    .join("");
}

assert.ok(Array.isArray(manifest.permissions) && manifest.permissions.includes("identity"), "manifest must keep identity permission");
assert.equal(typeof manifest.key, "string", "manifest must include stable extension key");
assert.equal(extensionIdFromManifestKey(manifest.key), EXPECTED_EXTENSION_ID, "manifest key must resolve to allowlisted extension ID");
assert.equal(typeof manifest.oauth2?.client_id, "string", "manifest must include the Google OAuth client id");
assert.match(
  manifest.oauth2.client_id,
  /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/,
  "manifest OAuth client id must be a real Google client id",
);
assert.deepEqual(manifest.oauth2.scopes, [DRIVE_APPDATA_SCOPE], "manifest must request only drive.appdata");
assert.equal(manifest.oauth2.client_secret, undefined, "manifest must never contain a Google client secret");
assert.equal(
  packageJson.dependencies?.["@supabase/supabase-js"],
  undefined,
  "formal V1.4 production dependencies must not include the retired Supabase runtime",
);
assert.ok(driveAuthSource.includes("chrome.identity.getAuthToken"), "Drive login must use chrome.identity.getAuthToken");
assert.ok(driveAuthSource.includes("chrome.identity.removeCachedAuthToken"), "expired Drive tokens must be invalidated");
assert.ok(driveAuthSource.includes(DRIVE_APPDATA_SCOPE), "Drive auth must request the app-data-only scope");
assert.equal(driveAuthSource.includes("launchWebAuthFlow"), false, "Drive auth must not use a custom web auth flow");
assert.equal(authStoreSource.includes("supabase"), false, "normal V1.4 auth state must not import or call Supabase");
console.log("auth contract checks passed");

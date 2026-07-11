import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const authStoreSource = readFileSync("src/lib/auth-store.ts", "utf8");
const callbackSource = readFileSync("src/app/auth/callback/route.ts", "utf8");
const EXPECTED_EXTENSION_ID = "immpcmhmabobllnopedaoflcjneigbko";

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
assert.ok(authStoreSource.includes('chrome.identity.getRedirectURL("auth")'), "extension login must derive redirect URL from installed extension");
assert.ok(authStoreSource.includes("launchWebAuthFlow"), "extension login must use launchWebAuthFlow");
assert.ok(authStoreSource.includes("skipBrowserRedirect: true"), "extension login must request Supabase OAuth URL");
assert.ok(authStoreSource.includes("exchangeCodeForSession(code)"), "extension login must exchange returned code");
assert.ok(authStoreSource.includes("client.auth.getUser()"), "startup must validate the user with Supabase");
assert.equal(authStoreSource.includes("if (cached)"), false, "cached display identity must not establish login state");
assert.ok(authStoreSource.includes('client.auth.signOut({ scope: "local" })'), "web and extension logout must revoke the current remote session");
assert.ok(authStoreSource.includes("clearBrowserSupabaseSessionCache()"), "logout must clear the Supabase local token cache");
assert.ok(callbackSource.includes('target.searchParams.set("code", code)'), "web callback must forward code to browser client");
assert.equal(callbackSource.includes("exchangeCodeForSession"), false, "web callback must not exchange code server-side");
assert.ok(callbackSource.includes("safeNext"), "web callback must sanitize next path");
console.log("auth contract checks passed");

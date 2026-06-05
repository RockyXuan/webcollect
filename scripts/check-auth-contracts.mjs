import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const authStoreSource = readFileSync("src/lib/auth-store.ts", "utf8");
const callbackSource = readFileSync("src/app/auth/callback/route.ts", "utf8");
const userMenuSource = readFileSync("src/components/auth/user-menu.tsx", "utf8");
const EXPECTED_EXTENSION_ID = "immpcmhmabobllnopedaoflcjneigbko";
const EXPECTED_EXTENSION_REDIRECT = `https://${EXPECTED_EXTENSION_ID}.chromiumapp.org/auth`;

function extensionIdFromManifestKey(key) {
  const publicKey = Buffer.from(key, "base64");
  const hash = createHash("sha256").update(publicKey).digest().subarray(0, 16);
  return [...hash]
    .map((byte) => String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 15)))
    .join("");
}

assert.ok(
  Array.isArray(manifest.permissions) && manifest.permissions.includes("identity"),
  "Chrome extension manifest must keep the identity permission for Google login."
);

assert.equal(
  typeof manifest.key,
  "string",
  "Chrome extension manifest must include a public key so unpacked Release installs keep a stable extension ID."
);

assert.equal(
  extensionIdFromManifestKey(manifest.key),
  EXPECTED_EXTENSION_ID,
  `Chrome extension manifest key must resolve to the OAuth allowlisted extension ID ${EXPECTED_EXTENSION_ID}.`
);

assert.ok(
  authStoreSource.includes(EXPECTED_EXTENSION_REDIRECT) || authStoreSource.includes('chrome.identity.getRedirectURL("auth")'),
  `Extension login must use the stable Chrome redirect URL ${EXPECTED_EXTENSION_REDIRECT}.`
);

assert.ok(
  authStoreSource.includes('chrome.identity.getRedirectURL("auth")'),
  "Extension login must derive its redirect URL from the currently installed extension ID."
);

assert.ok(
  authStoreSource.includes("launchWebAuthFlow"),
  "Extension login must use chrome.identity.launchWebAuthFlow."
);

assert.ok(
  authStoreSource.includes("skipBrowserRedirect: true"),
  "Extension login must request a Supabase OAuth URL instead of navigating the extension page."
);

assert.ok(
  authStoreSource.includes("exchangeCodeForSession(code)"),
  "Extension login must exchange the returned code for a Supabase session."
);

assert.ok(
  authStoreSource.includes('redirectTo: typeof window !== "undefined" ? window.location.origin : ""'),
  "Web login must keep the existing origin redirect so it does not require a new Supabase allowlist URL."
);

assert.ok(
  callbackSource.includes('target.searchParams.set("code", code)'),
  "The web auth callback must forward the OAuth code to the browser client."
);

assert.equal(
  callbackSource.includes("exchangeCodeForSession"),
  false,
  "The web auth callback route must not exchange the code server-side without browser session cookies."
);

assert.ok(
  callbackSource.includes("safeNext"),
  "The web auth callback must sanitize the next redirect path."
);

assert.ok(
  userMenuSource.includes("getExtensionAuthDiagnostics"),
  "The extension login panel must keep OAuth diagnostics visible for future failures."
);

console.log("auth contract checks passed");

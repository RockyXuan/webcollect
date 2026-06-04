import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const authStoreSource = readFileSync("src/lib/auth-store.ts", "utf8");
const callbackSource = readFileSync("src/app/auth/callback/route.ts", "utf8");
const userMenuSource = readFileSync("src/components/auth/user-menu.tsx", "utf8");

assert.ok(
  Array.isArray(manifest.permissions) && manifest.permissions.includes("identity"),
  "Chrome extension manifest must keep the identity permission for Google login."
);

assert.equal(
  Object.prototype.hasOwnProperty.call(manifest, "key"),
  false,
  "Chrome extension manifest must not add a hard-coded key without a verified OAuth redirect migration."
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function assertLocalLoadBeforeAuth(path: string): void {
  const source = readFileSync(path, "utf8");
  const localLoadIndex = source.indexOf("await loadData();");
  const authInitIndex = source.indexOf("useAuthStore.getState().initialize()");
  assert.ok(localLoadIndex >= 0, `${path} should await local loadData`);
  assert.ok(authInitIndex >= 0, `${path} should start auth initialization`);
  assert.ok(
    localLoadIndex < authInitIndex,
    `${path} should render local IndexedDB data before starting auth/cloud sync`
  );
}

assertLocalLoadBeforeAuth("src/app/page.tsx");
assertLocalLoadBeforeAuth("extension/src/newtab-app.tsx");

const authStore = readFileSync("src/lib/auth-store.ts", "utf8");
const initializeStart = authStore.indexOf("initialize: async () => {");
const loginStart = authStore.indexOf("loginWithGoogle: async () => {");
assert.ok(initializeStart >= 0 && loginStart > initializeStart, "auth-store should contain initialize before login");
const initializeBody = authStore.slice(initializeStart, loginStart);
assert.equal(
  initializeBody.includes("await triggerSync(cached.id);"),
  false,
  "cached extension sessions should not block startup on cloud sync"
);
assert.equal(
  initializeBody.includes("await triggerSync(user.id);"),
  false,
  "web sessions should not block startup on cloud sync"
);
assert.equal(
  authStore.includes("loadData({ showLoading: false })"),
  true,
  "background cloud refresh should not return the wall to the loading screen"
);

console.log("local-first startup tests passed");

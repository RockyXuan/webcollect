import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authStore = readFileSync("src/lib/auth-store.ts", "utf8");
const topNav = readFileSync("src/components/nav/top-nav.tsx", "utf8");
const appStore = readFileSync("src/lib/store.ts", "utf8");
const userMenu = readFileSync("src/components/auth/user-menu.tsx", "utf8");

const manualSyncStart = authStore.indexOf("manualSync: async");
const setSyncModeStart = authStore.indexOf("  setSyncMode:", manualSyncStart + 1);
assert.ok(manualSyncStart >= 0 && setSyncModeStart > manualSyncStart, "auth store should expose manualSync before setSyncMode");
const manualSyncBody = authStore.slice(manualSyncStart, setSyncModeStart);

assert.ok(
  manualSyncBody.includes("await syncData(user.id)"),
  "manual sync should run the full bidirectional cloud sync so other-device changes are pulled"
);
assert.equal(
  manualSyncBody.includes("localUpdatedAt <= localSyncedAt"),
  false,
  "manual sync must not skip cloud pull just because local data has no pending edits"
);
assert.ok(
  manualSyncBody.includes("loadData({ showLoading: false, preserveOnCollapse: true })"),
  "manual sync should refresh the visible store through the collapse-protected path"
);

const refreshStart = topNav.indexOf("const handleRefreshLocalView = async () => {");
const saveStart = topNav.indexOf("const handleSaveCurrentSnapshot");
assert.ok(refreshStart >= 0 && saveStart > refreshStart, "TopNav should contain the refresh handler before save handler");
const refreshBody = topNav.slice(refreshStart, saveStart);

assert.ok(
  refreshBody.includes("manualSync({ reloadView: false, throwOnError: true })"),
  "header refresh should pull cloud data when logged in instead of only re-reading IndexedDB"
);
assert.ok(
  refreshBody.includes("loadData({ showLoading: false, preserveOnCollapse: true })"),
  "header refresh should use the collapse-protected local reload"
);
assert.ok(
  topNav.includes('title={isLoggedIn ? "从云端同步并刷新视图" : "刷新本地视图"}'),
  "refresh button title should describe the cloud-aware behavior when logged in"
);

assert.ok(
  appStore.includes("preserveOnCollapse"),
  "app store loadData should support preserving the current UI when a refresh result collapses"
);
assert.ok(
  appStore.includes("looksLikeRefreshCollapse"),
  "app store should detect suspicious refresh collapse before committing the new visible state"
);
assert.ok(
  appStore.includes("publishCaptureDestinationsSoon"),
  "app store refresh should republish floating capture destinations after data changes"
);
assert.equal(
  userMenu.includes("onClick={manualSync}"),
  false,
  "sync buttons should call manualSync explicitly so React click events are not mistaken for options"
);

console.log("sync refresh behavior tests passed");

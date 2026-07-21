import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideStartupSyncAction } from "../src/lib/auth-store";
import { CURRENT_SYNC_METADATA_VERSION } from "../src/lib/db";

const baseTime = 1_777_200_000_000;

assert.equal(
  decideStartupSyncAction(baseTime, baseTime, baseTime + 100, baseTime + 100),
  "none",
  "this device should not sync again after it already saw its own cloud marker"
);
assert.equal(
  decideStartupSyncAction(baseTime, baseTime, baseTime + 100, baseTime + 100, 0),
  "sync",
  "an upgraded profile without revision metadata must hydrate cloud revisions"
);
assert.equal(
  decideStartupSyncAction(baseTime, baseTime, baseTime + 200, baseTime + 100),
  "sync",
  "a cloud marker newer than the last seen marker means another device changed data"
);
assert.equal(
  decideStartupSyncAction(baseTime + 300, baseTime, baseTime + 100, baseTime + 100),
  "push",
  "local edits newer than the synced marker should push when cloud has no unseen marker"
);
assert.ok(CURRENT_SYNC_METADATA_VERSION > 0);

const authSource = readFileSync("src/lib/auth-store.ts", "utf8");
const initializeStart = authSource.indexOf("initialize: async () => {");
const loginStart = authSource.indexOf("loginWithGoogle: async () => {");
const initializeBody = authSource.slice(initializeStart, loginStart);

assert.ok(initializeBody.includes("googleDriveSyncProvider.getIdentity()"));
assert.ok(initializeBody.includes("scheduleStartupSync()"));
assert.equal(authSource.includes("requiresMigration"), false, "formal V1.4 must not keep a temporary migration gate");
assert.equal(initializeBody.includes("await triggerSync"), false, "startup must not block first paint on Drive sync");
assert.ok(authSource.includes("googleDriveSyncProvider.sync()"));
assert.ok(authSource.includes("requestIdleCallback"), "Drive startup sync should be scheduled after first paint");
assert.equal(authSource.includes("supabase-browser"), false, "normal auth runtime must not import Supabase");
assert.equal(authSource.includes("syncData("), false, "normal auth runtime must not call the retired Supabase sync path");

console.log("startup light sync tests passed");

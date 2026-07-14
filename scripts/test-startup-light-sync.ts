import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import localforage from "localforage";
import type { SupabaseClient } from "@supabase/supabase-js";

type WorkspaceVersionRow = {
  user_id: string;
  version: number;
};

const userId = "user-startup-light-sync";
const baseTime = 1_777_200_000_000;
const memoryStore = new Map<string, unknown>();

Object.assign(localforage, {
  async getItem<T>(key: string): Promise<T | null> {
    return (memoryStore.has(key) ? memoryStore.get(key) : null) as T | null;
  },
  async setItem<T>(key: string, value: T): Promise<T> {
    memoryStore.set(key, value);
    return value;
  },
  async removeItem(key: string): Promise<void> {
    memoryStore.delete(key);
  },
  async clear(): Promise<void> {
    memoryStore.clear();
  },
});

class FakeWorkspaceVersionQuery {
  private filters: Array<{ column: keyof WorkspaceVersionRow; value: unknown }> = [];
  private limitCount: number | null = null;

  constructor(private readonly db: FakeSupabaseClient) {}

  select(): this {
    return this;
  }

  eq(column: keyof WorkspaceVersionRow, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  then<TResult1 = { data: WorkspaceVersionRow[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: WorkspaceVersionRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: WorkspaceVersionRow[]; error: null }> {
    this.db.selectRequests += 1;
    let rows = this.db.workspaceVersions.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value)
    );
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return {
      data: rows.map((row) => ({ ...row })),
      error: null,
    };
  }
}

class FakeSupabaseClient {
  workspaceVersions: WorkspaceVersionRow[] = [];
  selectRequests = 0;

  from(table: string): FakeWorkspaceVersionQuery {
    assert.equal(table, "workspace_versions", "startup freshness check should only read workspace_versions");
    return new FakeWorkspaceVersionQuery(this);
  }

  requestCount(): number {
    return this.selectRequests;
  }
}

async function main(): Promise<void> {
  const supabase = await import("../src/lib/supabase-browser");
  const auth = await import("../src/lib/auth-store");
  const db = await import("../src/lib/db");

  assert.equal(
    auth.decideStartupSyncAction(baseTime, baseTime, baseTime + 100, baseTime + 100),
    "none",
    "this device should not sync again after it already saw its own pushed cloud marker"
  );
  assert.equal(
    auth.decideStartupSyncAction(baseTime, baseTime, baseTime + 100, baseTime + 100, 0),
    "sync",
    "an upgraded profile without revision metadata must hydrate cloud revisions before lightweight startup can skip"
  );
  assert.equal(
    auth.decideStartupSyncAction(baseTime, baseTime, baseTime + 200, baseTime + 100),
    "sync",
    "a cloud marker newer than the last seen marker means another device pushed data"
  );
  assert.equal(
    auth.decideStartupSyncAction(baseTime + 300, baseTime, baseTime + 100, baseTime + 100),
    "push",
    "local edits newer than the synced marker should push when cloud has no unseen marker"
  );

  const fake = new FakeSupabaseClient();
  fake.workspaceVersions.push({
    user_id: userId,
    version: 7,
  });
  supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
  memoryStore.clear();
  await db.saveSyncMetadataVersion(db.CURRENT_SYNC_METADATA_VERSION, "different-user");
  assert.equal(
    await db.getSyncMetadataVersion(userId),
    0,
    "sync revision metadata from another account must not skip this account's first full sync"
  );
  await db.saveSyncMetadataVersion(db.CURRENT_SYNC_METADATA_VERSION, userId);
  await localforage.setItem("localSnapshotUpdatedAt", baseTime);
  await localforage.setItem("localSnapshotSyncedAt", baseTime);
  await localforage.setItem("lastSeenCloudSnapshotUpdatedAt", baseTime);
  await localforage.setItem("lastSeenCloudWorkspaceVersion", 7);

  auth.useAuthStore.setState({
    user: {
      id: userId,
      email: "startup-light-sync@example.com",
      displayName: "Startup Sync",
      avatarUrl: "",
    },
    isLoggedIn: true,
    syncMode: "auto",
    syncStatus: "idle",
    localSavedAt: null,
    lastSyncAt: null,
    error: null,
  });

  await auth.triggerSync(userId);

  assert.equal(fake.requestCount(), 1, "equal startup freshness should use only one cloud request");
  assert.equal(auth.useAuthStore.getState().syncStatus, "success");
  assert.ok(auth.useAuthStore.getState().lastSyncAt, "equal startup freshness should still mark sync success");

  const authSource = readFileSync("src/lib/auth-store.ts", "utf8");
  const initializeStart = authSource.indexOf("initialize: async () => {");
  const loginStart = authSource.indexOf("loginWithGoogle: async () => {");
  const initializeBody = authSource.slice(initializeStart, loginStart);
  assert.equal(
    initializeBody.includes("scheduleStartupSync(cached.id)"),
    false,
    "an unverified cached display identity must not trigger startup sync"
  );
  assert.ok(
    initializeBody.includes("scheduleStartupSync(user.id, syncMetadataVersion < CURRENT_SYNC_METADATA_VERSION)"),
    "startup sync should run immediately for profiles that still need revision metadata hydration"
  );
  assert.equal(initializeBody.includes("void triggerSync(cached.id)"), false);
  assert.equal(initializeBody.includes("void triggerSync(user.id)"), false);
  assert.ok(authSource.includes("requestIdleCallback"), "startup sync should be scheduled after first paint when supported");

  supabase.__resetBrowserSupabaseForTest();
  console.log("startup light sync tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

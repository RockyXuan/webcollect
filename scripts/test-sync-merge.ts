import assert from "node:assert/strict";
import localforage from "localforage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, WebCard } from "../src/lib/types";
import { compareSyncVersions } from "../src/lib/sync-revisions";

type Row = Record<string, unknown>;
type TableName = "categories" | "cards" | "user_preferences" | "workspace_tombstones";

const userId = "user-sync-test";
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
  createInstance() {
    return localforage;
  },
});

class FakeSupabaseQuery {
  private action: "select" | "update" | "delete" = "select";
  private filters: Array<{ kind: "eq" | "in"; column: string; value: unknown }> = [];
  private limitCount: number | null = null;
  private updateValue: Row = {};

  constructor(private readonly db: FakeSupabaseClient, private readonly table: TableName) {}

  select(): this {
    this.action = "select";
    return this;
  }

  update(value: Row): this {
    this.action = "update";
    this.updateValue = value;
    return this;
  }

  delete(): this {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]): this {
    this.filters.push({ kind: "in", column, value });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  async upsert(value: Row | Row[], options?: { onConflict?: string }): Promise<{ data: Row[]; error: null }> {
    const count = Array.isArray(value) ? value.length : 1;
    this.db.operations.upsert += count;
    this.db.operations.upsertRequests += 1;
    this.db.operations.upsertByTable[this.table] += count;
    const data = this.db.upsert(this.table, value, options?.onConflict);
    await this.db.onUpsert?.(this.table, value);
    return { data, error: null };
  }

  insert(value: Row | Row[]): Promise<{ data: Row[]; error: null }> {
    this.db.operations.insert += Array.isArray(value) ? value.length : 1;
    return Promise.resolve({ data: this.db.insert(this.table, value), error: null });
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: Row[]; error: null }> {
    if (this.action === "update") {
      this.db.operations.update += 1;
      return { data: this.db.update(this.table, this.filters, this.updateValue), error: null };
    }
    if (this.action === "delete") {
      this.db.operations.delete += 1;
      return { data: this.db.delete(this.table, this.filters), error: null };
    }
    this.db.operations.select += 1;
    await this.db.onSelect?.(this.table);
    const data = this.db.select(this.table, this.filters, this.limitCount);
    return { data, error: null };
  }
}

class FakeSupabaseClient {
  onSelect?: (table: TableName) => void | Promise<void>;
  onUpsert?: (table: TableName, value: Row | Row[]) => void | Promise<void>;

  readonly tables: Record<TableName, Row[]> = {
    categories: [],
    cards: [],
    user_preferences: [],
    workspace_tombstones: [],
  };

  readonly operations = {
    select: 0,
    upsert: 0,
    upsertRequests: 0,
    upsertByTable: {
      categories: 0,
      cards: 0,
      user_preferences: 0,
      workspace_tombstones: 0,
    } as Record<TableName, number>,
    insert: 0,
    update: 0,
    delete: 0,
  };

  from(table: TableName): FakeSupabaseQuery {
    return new FakeSupabaseQuery(this, table);
  }

  requestCount(): number {
    return this.operations.select
      + this.operations.upsertRequests
      + this.operations.insert
      + this.operations.update
      + this.operations.delete;
  }

  select(table: TableName, filters: FakeSupabaseQuery["filters"], limitCount: number | null): Row[] {
    let rows = this.tables[table].filter((row) => matches(row, filters));
    if (limitCount !== null) rows = rows.slice(0, limitCount);
    return rows.map(cloneRow);
  }

  upsert(table: TableName, value: Row | Row[], onConflict = "id"): Row[] {
    const rows = Array.isArray(value) ? value : [value];
    const conflicts = onConflict.split(",").map((item) => item.trim()).filter(Boolean);
    const written: Row[] = [];
    for (const row of rows) {
      const normalized = this.withTimestamps(table, row);
      const existingIndex = this.tables[table].findIndex((existing) =>
        conflicts.every((key) => existing[key] === normalized[key])
      );
      if (existingIndex >= 0) {
        this.tables[table][existingIndex] = {
          ...this.tables[table][existingIndex],
          ...normalized,
          created_at: this.tables[table][existingIndex].created_at || normalized.created_at,
        };
        written.push(cloneRow(this.tables[table][existingIndex]));
      } else {
        this.tables[table].push(normalized);
        written.push(cloneRow(normalized));
      }
    }
    return written;
  }

  insert(table: TableName, value: Row | Row[]): Row[] {
    const rows = Array.isArray(value) ? value : [value];
    const written = rows.map((row) => this.withTimestamps(table, row));
    this.tables[table].push(...written);
    return written.map(cloneRow);
  }

  update(table: TableName, filters: FakeSupabaseQuery["filters"], value: Row): Row[] {
    const written: Row[] = [];
    this.tables[table] = this.tables[table].map((row) => {
      if (!matches(row, filters)) return row;
      const next = this.withTimestamps(table, { ...row, ...value });
      written.push(cloneRow(next));
      return next;
    });
    return written;
  }

  delete(table: TableName, filters: FakeSupabaseQuery["filters"]): Row[] {
    const deleted = this.tables[table].filter((row) => matches(row, filters));
    this.tables[table] = this.tables[table].filter((row) => !matches(row, filters));
    return deleted.map(cloneRow);
  }

  private withTimestamps(table: TableName, row: Row): Row {
    const nowIso = new Date(Date.now()).toISOString();
    const id = typeof row.id === "string" ? row.id : `${table}-${this.tables[table].length + 1}`;
    if (table === "user_preferences" || table === "workspace_tombstones") {
      return {
        id,
        updated_at: nowIso,
        ...row,
      };
    }
    return {
      created_at: nowIso,
      updated_at: nowIso,
      ...row,
      id,
    };
  }
}

function matches(row: Row, filters: FakeSupabaseQuery["filters"]): boolean {
  return filters.every((filter) => {
    if (filter.kind === "eq") return row[filter.column] === filter.value;
    return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
  });
}

function cloneRow(row: Row): Row {
  return JSON.parse(JSON.stringify(row)) as Row;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function captureLocalStore(): Map<string, unknown> {
  return new Map([...memoryStore.entries()].map(([key, value]) => [key, cloneValue(value)]));
}

function restoreLocalStore(snapshot: Map<string, unknown>): void {
  memoryStore.clear();
  for (const [key, value] of snapshot.entries()) {
    memoryStore.set(key, cloneValue(value));
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function category(input: Partial<Category> = {}): Category {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "收集箱",
    icon: "inbox",
    color: "#888888",
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
    isParent: true,
    sectionId: "section-default",
    ...input,
  };
}

function card(input: Partial<WebCard> = {}): WebCard {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    url: "https://example.com",
    title: "Example",
    shortDesc: "Local example",
    fullDesc: "Local example full description",
    note: "",
    abbreviation: "EX",
    imageUrl: "",
    categoryId: "11111111-1111-4111-8111-111111111111",
    order: 0,
    createdAt: baseTime,
    updatedAt: baseTime,
    ...input,
  };
}

function cloudCategory(input: Category): Row {
  return {
    id: input.id,
    user_id: userId,
    name: input.name,
    icon: input.icon,
    color: input.color,
    parent_id: input.parentId || null,
    is_parent: input.isParent ?? null,
    order: input.order,
    created_at: new Date(input.createdAt || baseTime).toISOString(),
    updated_at: new Date(input.updatedAt || input.createdAt || baseTime).toISOString(),
  };
}

function cloudCard(input: WebCard): Row {
  return {
    id: input.id,
    user_id: userId,
    category_id: input.categoryId,
    url: input.url,
    title: input.title,
    short_desc: input.shortDesc,
    full_desc: input.fullDesc,
    note: input.note,
    abbreviation: input.abbreviation,
    image_url: input.imageUrl,
    order: input.order,
    created_at: new Date(input.createdAt).toISOString(),
    updated_at: new Date(input.updatedAt).toISOString(),
  };
}

async function importSyncModules() {
  const supabase = await import("../src/lib/supabase-browser");
  const sync = await import("../src/lib/sync");
  const db = await import("../src/lib/db");
  const wallpaper = await import("../src/lib/wallpaper-db");
  const wallpaperSources = await import("../src/lib/wallpaper-sources");
  return { supabase, sync, db, wallpaper, wallpaperSources };
}

async function resetLocal(db: Awaited<ReturnType<typeof importSyncModules>>["db"]): Promise<void> {
  memoryStore.clear();
  await db.saveSections([
    {
      id: "section-default",
      name: "主页",
      order: 0,
      createdAt: baseTime,
      updatedAt: baseTime,
    },
  ]);
  await db.saveActiveSectionId("section-default");
}

async function main(): Promise<void> {
  const { supabase, sync, db, wallpaper, wallpaperSources } = await importSyncModules();

  {
    const fake = new FakeSupabaseClient();
    const parentCategory = category();
    const childCategory = category({
      id: "33333333-3333-4333-8333-333333333333",
      name: "默认收集箱",
      parentId: parentCategory.id,
      isParent: false,
      order: 0,
    });
    const childCard = card({ categoryId: childCategory.id });
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.saveCategories([parentCategory, childCategory]);
    await db.saveCards([childCard]);

    await sync.syncData(userId);

    assert.equal(fake.tables.categories.length, 2, "local parent and child categories should be pushed to cloud");
    assert.equal(fake.tables.cards.length, 1, "local card should be pushed to cloud");
    assert.equal(fake.tables.cards[0]?.title, "Example");
    assert.ok(fake.requestCount() <= 8, `syncData should stay within the Step 1.3 request budget, got ${fake.requestCount()}`);
  }

  {
    const fake = new FakeSupabaseClient();
    const cloudInbox = category();
    const otherSectionInbox = category({
      id: "33333333-3333-4333-8333-333333333333",
      sectionId: "section-ai",
    });
    const cloudExistingCard = card();
    const bootstrapInbox = category({
      id: "cat-inbox",
      createdAt: baseTime + 50_000,
      updatedAt: baseTime + 50_000,
      syncRevision: undefined,
      syncDeviceId: undefined,
    });
    const preLoginCapture = card({
      id: "card-before-login",
      categoryId: bootstrapInbox.id,
      url: "https://before-login.example.com",
      title: "Captured before login",
      createdAt: baseTime + 60_000,
      updatedAt: baseTime + 60_000,
      syncRevision: undefined,
      syncDeviceId: undefined,
    });
    fake.tables.categories.push(cloudCategory(cloudInbox));
    fake.tables.categories.push(cloudCategory(otherSectionInbox));
    fake.tables.cards.push(cloudCard(cloudExistingCard));
    fake.tables.user_preferences.push({
      id: "pref-category-sections",
      user_id: userId,
      key: "categorySectionIds",
      value: {
        [cloudInbox.id]: "section-default",
        [otherSectionInbox.id]: "section-ai",
      },
      created_at: new Date(baseTime).toISOString(),
      updated_at: new Date(baseTime).toISOString(),
    });
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.addCategory(bootstrapInbox);
    await db.addCard(preLoginCapture);

    await sync.syncData(userId);

    assert.equal(
      fake.tables.categories.length,
      2,
      "a fresh profile must reuse the matching cloud inbox without merging or duplicating another section's inbox"
    );
    assert.equal(fake.tables.cards.length, 2, "a card captured before login must still be uploaded");
    assert.equal(
      fake.tables.cards.find((row) => row.title === preLoginCapture.title)?.category_id,
      cloudInbox.id,
      "the pre-login card should be remapped to the existing cloud inbox"
    );
    assert.deepEqual(
      (await db.getCategories()).map((item) => item.id).sort(),
      [cloudInbox.id, otherSectionInbox.id].sort(),
      "the new profile should converge on the matching inbox while preserving the other section"
    );
  }

  {
    const fake = new FakeSupabaseClient();
    const staleEmptyInbox = category({
      id: "44444444-4444-4444-8444-444444444444",
      createdAt: baseTime + 10_000,
      updatedAt: baseTime + 10_000,
    });
    const populatedInbox = category();
    const cloudExistingCard = card({ categoryId: populatedInbox.id });
    const bootstrapInbox = category({
      id: "cat-inbox",
      createdAt: baseTime + 50_000,
      updatedAt: baseTime + 50_000,
      syncRevision: undefined,
      syncDeviceId: undefined,
    });
    const preLoginCapture = card({
      id: "card-before-login-with-duplicate",
      categoryId: bootstrapInbox.id,
      url: "https://before-login-with-duplicate.example.com",
      title: "Captured before login with duplicate inbox",
      createdAt: baseTime + 60_000,
      updatedAt: baseTime + 60_000,
      syncRevision: undefined,
      syncDeviceId: undefined,
    });
    // Put the empty duplicate first to prove reconciliation is not row-order dependent.
    fake.tables.categories.push(cloudCategory(staleEmptyInbox));
    fake.tables.categories.push(cloudCategory(populatedInbox));
    fake.tables.cards.push(cloudCard(cloudExistingCard));
    fake.tables.user_preferences.push({
      id: "pref-category-sections-with-duplicate",
      user_id: userId,
      key: "categorySectionIds",
      value: {
        [staleEmptyInbox.id]: "section-default",
        [populatedInbox.id]: "section-default",
      },
      created_at: new Date(baseTime).toISOString(),
      updated_at: new Date(baseTime).toISOString(),
    });
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.addCategory(bootstrapInbox);
    await db.addCard(preLoginCapture);

    await sync.syncData(userId);

    assert.equal(
      fake.tables.categories.length,
      2,
      "a fresh profile must not upload a third inbox when the cloud already contains an empty duplicate"
    );
    assert.equal(
      fake.tables.cards.find((row) => row.title === preLoginCapture.title)?.category_id,
      populatedInbox.id,
      "bootstrap captures must use the populated canonical inbox instead of a row-order-dependent empty duplicate"
    );
    assert.deepEqual(
      (await db.getCategories()).map((item) => item.id).sort(),
      [populatedInbox.id, staleEmptyInbox.id].sort(),
      "reconciliation must preserve both cloud rows while preventing another duplicate"
    );
  }

  {
    const fake = new FakeSupabaseClient();
    const cloudInbox = category();
    const staleEmptyInbox = category({
      id: "55555555-5555-4555-8555-555555555555",
      createdAt: baseTime + 10_000,
      updatedAt: baseTime + 10_000,
    });
    const cloudExistingCard = card();
    const bootstrapInbox = category({
      id: "cat-inbox",
      createdAt: baseTime + 70_000,
      updatedAt: baseTime + 70_000,
      syncRevision: undefined,
      syncDeviceId: undefined,
    });
    const preLoginCapture = card({
      id: "card-before-push",
      categoryId: bootstrapInbox.id,
      url: "https://before-push.example.com",
      title: "Captured before fallback push",
      createdAt: baseTime + 80_000,
      updatedAt: baseTime + 80_000,
      syncRevision: undefined,
      syncDeviceId: undefined,
    });
    fake.tables.categories.push(cloudCategory(staleEmptyInbox));
    fake.tables.categories.push(cloudCategory(cloudInbox));
    fake.tables.cards.push(cloudCard(cloudExistingCard));
    fake.tables.user_preferences.push({
      id: "pref-category-sections-push",
      user_id: userId,
      key: "categorySectionIds",
      value: {
        [staleEmptyInbox.id]: "section-default",
        [cloudInbox.id]: "section-default",
      },
      created_at: new Date(baseTime).toISOString(),
      updated_at: new Date(baseTime).toISOString(),
    });
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.addCategory(bootstrapInbox);
    await db.addCard(preLoginCapture);

    await sync.pushLocalSnapshotToCloud(userId);

    assert.equal(fake.tables.categories.length, 2, "fallback snapshot push must reuse the populated cloud inbox without another duplicate");
    assert.equal(fake.tables.cards.length, 2, "fallback snapshot push must preserve the pre-login card");
    assert.equal(
      fake.tables.cards.find((row) => row.title === preLoginCapture.title)?.category_id,
      cloudInbox.id,
      "fallback snapshot push should remap the pre-login card to the cloud inbox"
    );
    assert.deepEqual(
      (await db.getCategories()).map((item) => item.id),
      [cloudInbox.id],
      "fallback snapshot push should keep only the populated canonical inbox in the fresh local profile"
    );
    assert.deepEqual(
      fake.tables.user_preferences.find((row) => row.key === "categorySectionIds")?.value,
      { [cloudInbox.id]: "section-default" },
      "fallback snapshot push should converge the fresh profile section mapping on the populated inbox"
    );
  }

  {
    const fake = new FakeSupabaseClient();
    const existingCategory = category();
    const existingCard = card();
    fake.tables.categories.push(cloudCategory(existingCategory));
    fake.tables.cards.push(cloudCard(existingCard));
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([existingCategory]);
      await db.saveCards([existingCard]);
    });
    await db.clearSyncDirtySets();

    await sync.syncData(userId);

    const rowUpserts = fake.operations.upsertByTable.categories + fake.operations.upsertByTable.cards;
    assert.equal(rowUpserts, 0, "clean local rows that match cloud should not be upserted");
  }

  {
    const fake = new FakeSupabaseClient();
    const remoteCategory = category({ name: "云端分类", updatedAt: baseTime + 1_000 });
    const remoteCard = card({ title: "Cloud Example", shortDesc: "Cloud wins by existing only remotely", updatedAt: baseTime + 1_000 });
    fake.tables.categories.push(cloudCategory(remoteCategory));
    fake.tables.cards.push(cloudCard(remoteCard));
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.saveCategories([]);
    await db.saveCards([]);

    await sync.syncData(userId);

    assert.equal((await db.getCategories())[0]?.name, "云端分类", "cloud-only category should be pulled locally");
    assert.equal((await db.getCards())[0]?.title, "Cloud Example", "cloud-only card should be pulled locally");
  }

  {
    const fake = new FakeSupabaseClient();
    const sharedCategory = category();
    const sharedCard = card({ title: "Delete and restore" });
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(sharedCard));
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);

    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([sharedCategory]);
      await db.saveCards([sharedCard]);
    });
    await db.clearSyncDirtySets();
    const staleDeviceStore = captureLocalStore();

    await db.deleteCard(sharedCard.id);
    await sync.syncData(userId);
    assert.equal(fake.tables.cards.length, 0, "a synced tombstone should remove the active cloud card");
    assert.equal(fake.tables.workspace_tombstones.length, 1, "card deletion should be persisted before removing cloud content");

    restoreLocalStore(staleDeviceStore);
    await sync.syncData(userId);
    assert.equal((await db.getCards()).length, 0, "a stale device must not resurrect a cloud-tombstoned card");

    await db.addCard(sharedCard);
    const restoredRevision = (await db.getCards())[0]?.syncRevision || 0;
    const tombstoneRevision = Number(fake.tables.workspace_tombstones[0]?.sync_revision || 0);
    assert.ok(
      restoredRevision > tombstoneRevision,
      `restore should create a revision newer than the tombstone (restore=${restoredRevision}, tombstone=${tombstoneRevision})`
    );
    await sync.syncData(userId);
    assert.equal(fake.tables.cards.length, 1, "a deliberate newer restore should recreate the cloud card");
  }

  {
    const fake = new FakeSupabaseClient();
    const legacyCategory = category({ id: "cat-local-before-first-sync" });
    const legacyCard = card({
      id: "card-local-before-first-sync",
      categoryId: legacyCategory.id,
      title: "Deleted before first sync",
    });
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.addCategory(legacyCategory);
    await db.addCard(legacyCard);
    await db.deleteCard(legacyCard.id);

    await sync.syncData(userId);

    assert.equal(
      fake.tables.workspace_tombstones[0]?.entity_id,
      legacyCard.id,
      "a pre-sync deletion must preserve its legacy string entity ID in the cloud tombstone"
    );
  }

  {
    const fake = new FakeSupabaseClient();
    const hiddenSite = {
      siteId: "site-a",
      siteUrl: "https://example.com",
      hiddenAt: baseTime,
      duration: "permanent" as const,
    };
    const recycleItem = {
      id: "recycle-a",
      type: "card" as const,
      name: "Old item",
      deletedAt: baseTime,
      categories: [],
      cards: [],
    };
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);

    await db.savePinnedCategoryIds(["category-a"]);
    await db.saveHiddenSites([hiddenSite]);
    await db.saveRecycleBin([recycleItem]);
    const staleDeviceStore = captureLocalStore();

    await db.savePinnedCategoryIds([]);
    await db.saveHiddenSites([]);
    await db.clearRecycleBin();
    await sync.syncData(userId);

    for (const key of ["pinnedCategoryIds", "hiddenSites", "recycleBin"]) {
      const row = fake.tables.user_preferences.find((preference) => preference.key === key);
      assert.deepEqual(row?.value, [], `${key} should push an explicit empty value to cloud`);
      assert.ok(Number(row?.sync_revision || 0) > 0, `${key} should carry a Lamport revision`);
    }

    restoreLocalStore(staleDeviceStore);
    await sync.syncData(userId);

    assert.deepEqual(await db.getPinnedCategoryIds(), [], "a stale device must not restore an old pin");
    assert.deepEqual(await db.getHiddenSites(), [], "a stale device must not restore an old hidden site");
    assert.deepEqual(await db.getRecycleBin(), [], "a stale device must not restore a cleared recycle bin");
  }

  {
    const fake = new FakeSupabaseClient();
    const olderLocalCard = card({ title: "Older Local", updatedAt: baseTime + 1_000 });
    const newerCloudCard = card({ title: "Newer Cloud", updatedAt: baseTime + 2_000 });
    const sharedCategory = category({ updatedAt: baseTime + 1_000 });
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(newerCloudCard));
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([sharedCategory]);
      await db.saveCards([olderLocalCard]);
    });

    await sync.syncData(userId);

    assert.equal((await db.getCards())[0]?.title, "Newer Cloud", "newer cloud timestamp should win conflicts");
  }

  {
    const fake = new FakeSupabaseClient();
    const newerLocalCard = card({ title: "Newer Local", updatedAt: baseTime + 3_000 });
    const olderCloudCard = card({ title: "Older Cloud", updatedAt: baseTime + 2_000 });
    const sharedCategory = category({ updatedAt: baseTime + 2_000 });
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(olderCloudCard));
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.saveCategories([sharedCategory]);
    await db.saveCards([newerLocalCard]);

    await sync.syncData(userId);

    assert.equal(fake.tables.cards[0]?.title, "Newer Local", "newer local timestamp should be pushed to cloud");
    assert.equal((await db.getCards())[0]?.title, "Newer Local", "newer local timestamp should remain local");
  }

  {
    const fake = new FakeSupabaseClient();
    const sharedCategory = category();
    const originalCard = card({ title: "Original", updatedAt: baseTime });
    const duringSyncCard = card({ title: "Changed During Sync", updatedAt: baseTime + 7_000 });
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(originalCard));
    let injected = false;
    fake.onUpsert = async (table) => {
      if (table !== "user_preferences" || injected) return;
      injected = true;
      await db.saveCards([duringSyncCard]);
    };
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([sharedCategory]);
      await db.saveCards([originalCard]);
    });
    await db.clearSyncDirtySets();

    await sync.syncData(userId);

    assert.equal(injected, true, "test should inject a local edit during sync");
    assert.equal((await db.getCards())[0]?.title, "Changed During Sync");
    assert.ok(
      (await db.getLocalSnapshotUpdatedAt()) > (await db.getLocalSnapshotSyncedAt()),
      "local edits during sync should remain newer than the synced marker"
    );
  }

  {
    const fake = new FakeSupabaseClient();
    const sharedCategory = category();
    const sharedCard = card();
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(sharedCard));
    fake.onSelect = async (table) => {
      if (table === "categories") await delay(5);
    };
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([sharedCategory]);
      await db.saveCards([sharedCard]);
    });
    await db.clearSyncDirtySets();

    await Promise.all([
      sync.syncData(userId),
      sync.syncData(userId),
    ]);

    assert.equal(
      fake.operations.select,
      4,
      "concurrent top-level syncData calls should share one in-flight run across all four sync tables"
    );
  }

  {
    const fake = new FakeSupabaseClient();
    const sharedCategory = category();
    const sharedCard = card({ title: "Original", updatedAt: baseTime });
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(sharedCard));
    fake.tables.user_preferences.push({
      id: "pref-future-snapshot",
      user_id: userId,
      key: "localSnapshotUpdatedAt",
      value: 9_999_999_999_999,
      updated_at: new Date(baseTime).toISOString(),
    });
    let injectedWrites = 0;
    fake.onSelect = async (table) => {
      if (table !== "cards" || injectedWrites >= 3) return;
      injectedWrites += 1;
      await delay(2);
      await db.saveCards([
        card({ title: `Concurrent Local ${injectedWrites}`, updatedAt: baseTime + injectedWrites * 1_000 }),
      ]);
    };
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([sharedCategory]);
      await db.saveCards([sharedCard]);
    });
    await db.clearSyncDirtySets();

    await sync.syncData(userId);

    assert.equal(injectedWrites, 3, "test should keep writing through the max allowed recursion depth");
    assert.ok(
      fake.operations.select <= 4 * 3,
      `recursive sync/push should stop after depth 2 across four sync tables, got ${fake.operations.select} selects`
    );
  }

  {
    const fake = new FakeSupabaseClient();
    const sharedCategory = category();
    const originalCard = card({ title: "Original", updatedAt: baseTime });
    const editedAt = baseTime + 1_000;
    const editedCard = card({ title: "Device A Edit", updatedAt: editedAt });
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(originalCard));
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);

    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([sharedCategory]);
      await db.saveCards([originalCard]);
    });
    await db.clearSyncDirtySets();
    const deviceBStore = captureLocalStore();

    await resetLocal(db);
    await db.withoutLocalChangeEvents(async () => {
      await db.saveCategories([sharedCategory]);
      await db.saveCards([originalCard]);
    });
    await db.clearSyncDirtySets();
    await db.saveCards([editedCard]);
    const deviceAStore = captureLocalStore();

    restoreLocalStore(deviceBStore);
    await sync.syncData(userId);
    assert.equal(fake.tables.cards[0]?.title, "Original", "clean device B sync should not refresh cloud card content");

    restoreLocalStore(deviceAStore);
    await sync.syncData(userId);

    assert.equal((await db.getCards())[0]?.title, "Device A Edit", "device A edit should not be rolled back after device B sync");
    assert.equal(fake.tables.cards[0]?.title, "Device A Edit", "device A edit should be pushed to cloud");
    assert.equal(fake.tables.cards[0]?.updated_at, new Date(editedAt).toISOString(), "cloud row should preserve client edit timestamp");
  }

  {
    const fake = new FakeSupabaseClient();
    const sharedCategory = category({ name: "Dual device inbox" });
    const sharedCard = card({ title: "Initial shared card" });
    const hiddenSite = {
      siteId: "dual-device-hidden",
      siteUrl: "https://hidden.example.com",
      hiddenAt: baseTime,
      duration: "permanent" as const,
    };
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);

    await resetLocal(db);
    await db.addCategory(sharedCategory);
    await db.addCard(sharedCard);
    await db.savePinnedCategoryIds([sharedCategory.id]);
    await db.saveHiddenSites([hiddenSite]);
    await wallpaper.saveWallpaperPrefs({
      ...wallpaperSources.DEFAULT_WALLPAPER_PREFS,
      defaultMode: "collection",
    });
    await sync.syncData(userId);
    const deviceABaseline = captureLocalStore();
    const deviceAId = String(memoryStore.get("syncDeviceId") || "");

    memoryStore.clear();
    await resetLocal(db);
    await sync.syncData(userId);
    const deviceBId = String(memoryStore.get("syncDeviceId") || "");
    assert.ok(deviceAId && deviceBId && deviceAId !== deviceBId, "isolated profiles should use different stable device IDs");
    assert.equal((await db.getCategories()).some((item) => item.id === sharedCategory.id), true, "a new device should pull the shared category");
    assert.equal((await db.getCards())[0]?.title, "Initial shared card", "a new device should pull the shared card");
    assert.deepEqual(await db.getPinnedCategoryIds(), [sharedCategory.id], "a new device should pull pinned categories");
    assert.deepEqual(await db.getHiddenSites(), [hiddenSite], "a new device should pull hidden sites");
    assert.equal((await wallpaper.getWallpaperPrefs()).defaultMode, "collection", "a new device should pull the wallpaper mode switch");
    const deviceBBaseline = captureLocalStore();

    restoreLocalStore(deviceABaseline);
    const deviceACard = (await db.getCards())[0];
    await db.updateCard({ ...deviceACard, title: "Device A offline edit", updatedAt: baseTime + 10_000 });
    const deviceAEditedCard = (await db.getCards())[0];
    const deviceAOffline = captureLocalStore();

    restoreLocalStore(deviceBBaseline);
    const deviceBCard = (await db.getCards())[0];
    await db.updateCard({ ...deviceBCard, title: "Device B offline edit", updatedAt: baseTime + 20_000 });
    await db.savePinnedCategoryIds([]);
    await db.saveHiddenSites([]);
    await wallpaper.saveWallpaperPrefs({
      ...(await wallpaper.getWallpaperPrefs()),
      defaultMode: "wallpaper",
    });
    const deviceBEditedCard = (await db.getCards())[0];
    const deviceBOffline = captureLocalStore();

    const expectedWinner = compareSyncVersions(deviceAEditedCard, deviceBEditedCard) >= 0
      ? deviceAEditedCard
      : deviceBEditedCard;

    restoreLocalStore(deviceAOffline);
    await sync.syncData(userId);
    const deviceAAfterFirstSync = captureLocalStore();

    restoreLocalStore(deviceBOffline);
    await sync.syncData(userId);
    assert.equal((await db.getCards())[0]?.title, expectedWinner.title, "the second online device should resolve the offline conflict deterministically");
    assert.deepEqual(await db.getPinnedCategoryIds(), [], "an explicit unpin should reach the cloud");
    assert.deepEqual(await db.getHiddenSites(), [], "an explicit unhide should reach the cloud");
    assert.equal((await wallpaper.getWallpaperPrefs()).defaultMode, "wallpaper", "the wallpaper switch should reach the cloud");
    const deviceBAfterSync = captureLocalStore();

    restoreLocalStore(deviceAAfterFirstSync);
    await sync.syncData(userId);
    assert.equal((await db.getCards())[0]?.title, expectedWinner.title, "device A should converge after the other device resolves the conflict");
    assert.deepEqual(await db.getPinnedCategoryIds(), [], "device A should receive the explicit unpin");
    assert.deepEqual(await db.getHiddenSites(), [], "device A should receive the explicit unhide");
    assert.equal((await wallpaper.getWallpaperPrefs()).defaultMode, "wallpaper", "device A should receive the wallpaper switch");

    restoreLocalStore(deviceBAfterSync);
    assert.equal((await db.getCards())[0]?.title, expectedWinner.title, "both isolated profiles should finish with the same card");
    assert.equal(fake.tables.cards[0]?.title, expectedWinner.title, "cloud state should match both isolated profiles");
  }

  supabase.__resetBrowserSupabaseForTest();
  console.log("sync merge tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

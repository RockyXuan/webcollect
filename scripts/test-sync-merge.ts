import assert from "node:assert/strict";
import localforage from "localforage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, WebCard } from "../src/lib/types";

type Row = Record<string, unknown>;
type TableName = "categories" | "cards" | "user_preferences";

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
    const data = this.db.select(this.table, this.filters, this.limitCount);
    return { data, error: null };
  }
}

class FakeSupabaseClient {
  onUpsert?: (table: TableName, value: Row | Row[]) => void | Promise<void>;

  readonly tables: Record<TableName, Row[]> = {
    categories: [],
    cards: [],
    user_preferences: [],
  };

  readonly operations = {
    select: 0,
    upsert: 0,
    upsertRequests: 0,
    upsertByTable: {
      categories: 0,
      cards: 0,
      user_preferences: 0,
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
    if (table === "user_preferences") {
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
  return { supabase, sync, db };
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
  const { supabase, sync, db } = await importSyncModules();

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
    const olderLocalCard = card({ title: "Older Local", updatedAt: baseTime + 1_000 });
    const newerCloudCard = card({ title: "Newer Cloud", updatedAt: baseTime + 2_000 });
    const sharedCategory = category({ updatedAt: baseTime + 1_000 });
    fake.tables.categories.push(cloudCategory(sharedCategory));
    fake.tables.cards.push(cloudCard(newerCloudCard));
    supabase.__setBrowserSupabaseClientForTest(fake as unknown as SupabaseClient);
    await resetLocal(db);
    await db.saveCategories([sharedCategory]);
    await db.saveCards([olderLocalCard]);

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

  supabase.__resetBrowserSupabaseForTest();
  console.log("sync merge tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

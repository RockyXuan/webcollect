import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("revisioned sync SQL migration", () => {
  const sql = readFileSync("migrations/2026-07-10-sync-revisions.sql", "utf8");
  const bootstrapSql = readFileSync("src/storage/database/supabase-init.sql", "utf8");

  it("is additive and contains no user-data deletion statement", () => {
    expect(sql).toMatch(/add column if not exists sync_revision/i);
    expect(sql).toMatch(/create table if not exists public\.workspace_tombstones/i);
    expect(sql).toMatch(/create table if not exists public\.workspace_versions/i);
    expect(sql).not.toMatch(/\b(delete\s+from|truncate\s+table|drop\s+table)\b/i);
  });

  it("protects new tables with RLS and bumps the lightweight workspace version", () => {
    expect(sql).toMatch(/workspace_tombstones enable row level security/i);
    expect(sql).toMatch(/workspace_versions enable row level security/i);
    expect(sql).toMatch(/create or replace function public\.bump_workspace_version/i);
    expect(sql).toMatch(/after insert or update or delete on public\.cards/i);
    expect(sql).toMatch(/after insert or update or delete on public\.user_preferences/i);
  });

  it("accepts legacy entity IDs and exposes only the required authenticated Data API operations", () => {
    for (const source of [sql, bootstrapSql]) {
      expect(source).toMatch(/entity_id\s+text\s+not null/i);
      expect(source).not.toMatch(/entity_id\s+uuid\s+not null/i);
      expect(source).toMatch(/grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+public\.workspace_tombstones\s+to\s+authenticated/i);
      expect(source).toMatch(/grant\s+select\s+on\s+public\.workspace_versions\s+to\s+authenticated/i);
      expect(source).toMatch(/workspace_tombstones_owner_all[\s\S]*for all\s+to authenticated[\s\S]*auth\.uid\(\)/i);
      expect(source).toMatch(/workspace_versions_owner_select[\s\S]*for select\s+to authenticated[\s\S]*auth\.uid\(\)/i);
    }
  });

  it("replaces legacy WebCollect policies with initplan-safe authenticated ownership checks", () => {
    for (const policy of [
      "users_select_own",
      "users_insert_own",
      "users_update_own",
      "users_delete_own",
      "categories_owner_all",
      "cards_owner_all",
      "user_preferences_owner_all",
      "workspace_snapshots_owner_all",
    ]) {
      expect(sql).toMatch(new RegExp(`${policy}[\\s\\S]*?to authenticated[\\s\\S]*?\\(select auth\\.uid\\(\\)\\)`, "i"));
    }
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("revisioned sync SQL migration", () => {
  const sql = readFileSync("migrations/2026-07-10-sync-revisions.sql", "utf8");

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
});

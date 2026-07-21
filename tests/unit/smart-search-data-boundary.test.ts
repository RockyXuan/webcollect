import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

const migrationSql = readRepositoryFile(
  "supabase/migrations/20260718035443_bookmark_search_embeddings.sql",
);
const dualSourceMigrationSql = readRepositoryFile(
  "supabase/migrations/20260718035513_bookmark_search_dual_sources.sql",
);
const bootstrapSql = readRepositoryFile("src/storage/database/supabase-init.sql");
const drizzleSchemaSource = readRepositoryFile("src/storage/database/shared/schema.ts");
const bootstrapMarker = "-- V1.3.0 derived smart-search index.";
const bootstrapSmartSearchSql = bootstrapSql.slice(bootstrapSql.indexOf(bootstrapMarker));

const knowledgeIndexSource = readRepositoryFile("src/lib/knowledge-index.ts");
const knowledgeBuilderSource = readRepositoryFile("src/lib/knowledge-builder.ts");
const derivedCacheSources = `${knowledgeIndexSource}\n${knowledgeBuilderSource}`;
const knowledgeFetchRouteSource = readRepositoryFile("src/app/api/knowledge/fetch/route.ts");
const localKnowledgeHookSource = readRepositoryFile("src/hooks/use-local-knowledge-build.ts");
const localSearchHookSource = readRepositoryFile("src/hooks/use-local-workspace-search.ts");
const topNavSource = readRepositoryFile("src/components/nav/top-nav.tsx");
const extensionBackgroundSource = readRepositoryFile("extension/background.js");

const edgeFunctionSources = [
  "supabase/functions/bookmark-search/index.ts",
  "supabase/functions/bookmark-search/openai.ts",
  "supabase/functions/bookmark-search/validation.ts",
].map(readRepositoryFile).join("\n");

const businessTables = [
  "cards",
  "categories",
  "user_preferences",
  "workspace_snapshots",
  "workspace_tombstones",
  "workspace_versions",
];
const businessTableAlternation = businessTables.join("|");

function expectAdditiveSmartSearchSql(sql: string): void {
  expect(sql).toMatch(/create extension if not exists vector with schema extensions/i);
  expect(sql).toMatch(/create table if not exists public\.bookmark_search_embeddings/i);
  expect(sql).toMatch(/embedding\s+extensions\.vector\(1536\)\s+not null/i);
  expect(sql).toMatch(/primary key\s*\(user_id,\s*card_id(?:,\s*document_source)?\)/i);
  expect(sql).toMatch(/model\s+text\s+not null\s+check\s*\(model\s*=\s*'text-embedding-3-small'\)/i);

  expect(sql).toMatch(/alter table public\.bookmark_search_embeddings enable row level security/i);
  expect(sql).toMatch(/using\s*\(\(select auth\.uid\(\)\)\s*=\s*user_id\)/i);
  expect(sql).toMatch(/with check\s*\([\s\S]*?auth\.uid\(\)[\s\S]*?from public\.cards[\s\S]*?public\.cards\.id\s*=\s*public\.bookmark_search_embeddings\.card_id[\s\S]*?public\.cards\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  expect(sql).toMatch(/security invoker[\s\S]*?indexed\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  expect(sql).toMatch(/revoke all on(?: table)? public\.bookmark_search_embeddings[\s\S]*?from(?: public,)? anon/i);

  expect(sql).not.toMatch(new RegExp(
    `\\b(?:insert\\s+into|update|delete\\s+from|truncate\\s+table)\\s+public\\.(?:${businessTableAlternation})\\b`,
    "i",
  ));
  expect(sql).not.toMatch(new RegExp(
    `\\b(?:alter|drop)\\s+table(?:\\s+if\\s+exists)?\\s+public\\.(?:${businessTableAlternation})\\b`,
    "i",
  ));
  expect(sql).not.toMatch(/\bcreate\s+(?:or\s+replace\s+)?trigger\b/i);
}

describe("V1.3 smart-search SQL data boundary", () => {
  it("keeps the generated TypeScript schema aware of the derived vector table", () => {
    expect(drizzleSchemaSource).toMatch(/bookmarkSearchEmbeddings\s*=\s*pgTable\("bookmark_search_embeddings"/);
    expect(drizzleSchemaSource).toMatch(/embedding:\s*vector\(\{\s*dimensions:\s*1536\s*\}\)/);
    expect(drizzleSchemaSource).toMatch(/documentSource:\s*text\("document_source"\)\.default\('saved-fields'\)\.notNull\(\)/);
    expect(drizzleSchemaSource).toMatch(/primaryKey\(\{\s*columns:\s*\[table\.userId,\s*table\.cardId,\s*table\.documentSource\]/);
    expect(drizzleSchemaSource).toMatch(/index\("bookmark_search_embeddings_card_id_idx"\)\.on\(table\.cardId\)/);
  });

  it("migrates the derived table to independent public and saved-field vectors", () => {
    expect(dualSourceMigrationSql).toMatch(/add column if not exists document_source text/i);
    expect(dualSourceMigrationSql).toMatch(/check \(document_source in \('public-html', 'saved-fields'\)\)[\s\S]*?not valid/i);
    expect(dualSourceMigrationSql).toMatch(/validate constraint bookmark_search_embeddings_document_source_check/i);
    expect(dualSourceMigrationSql).toMatch(/primary key \(user_id, card_id, document_source\)/i);
    expect(dualSourceMigrationSql).toMatch(/bookmark_search_embeddings_card_id_idx[\s\S]*?\(card_id\)/i);
    expect(dualSourceMigrationSql).toMatch(/enable row level security/i);
    expect(dualSourceMigrationSql).toMatch(/revoke all on table public\.bookmark_search_embeddings[\s\S]*?from public, anon, authenticated/i);
    expect(dualSourceMigrationSql).toMatch(/grant select, insert, update, delete on table public\.bookmark_search_embeddings[\s\S]*?to authenticated/i);
    expect(dualSourceMigrationSql).toMatch(/select distinct on \(candidates\.card_id\)[\s\S]*?candidates\.similarity desc[\s\S]*?when 'saved-fields' then 0/i);
    expect(dualSourceMigrationSql).toMatch(/notify pgrst, 'reload schema'/i);
    expect(dualSourceMigrationSql).not.toMatch(new RegExp(
      `\\b(?:insert\\s+into|update|delete\\s+from|truncate\\s+table)\\s+public\\.(?:${businessTableAlternation})\\b`,
      "i",
    ));
  });

  it("keeps the migration additive and owner-scoped", () => {
    expectAdditiveSmartSearchSql(migrationSql);
    expect(migrationSql).toMatch(/create table if not exists private\.bookmark_search_rate_limits/i);
    expect(migrationSql).toMatch(/create table if not exists private\.bookmark_search_daily_usage/i);
    expect(migrationSql).toMatch(/security definer[\s\S]*?requesting_user uuid := \(select auth\.uid\(\)\)/i);
    expect(migrationSql).toMatch(/create or replace function public\.consume_bookmark_search_quota\s*\(\s*requested_action text,\s*requested_units integer\s*\)/i);
    expect(migrationSql).toMatch(/request_limit := case requested_action when 'search' then 30 else 60 end/i);
    expect(migrationSql).toMatch(/daily_unit_limit := case requested_action when 'search' then 100000 else 3000000 end/i);
    expect(migrationSql).toMatch(/pg_advisory_xact_lock[\s\S]*?current_request_count \+ 1 > request_limit[\s\S]*?current_daily_units \+ requested_units::bigint > daily_unit_limit[\s\S]*?return false/i);
    expect(migrationSql).not.toContain("workspace_versions");
  });

  it("keeps the bootstrap smart-search block aligned with the migration contract", () => {
    expect(bootstrapSmartSearchSql.startsWith(bootstrapMarker)).toBe(true);
    expectAdditiveSmartSearchSql(bootstrapSmartSearchSql);
    for (const contractName of [
      "bookmark_search_embeddings_select_own",
      "bookmark_search_embeddings_insert_own_card",
      "bookmark_search_embeddings_update_own_card",
      "bookmark_search_embeddings_delete_own",
      "match_bookmark_search_embeddings",
      "bookmark_search_daily_usage",
      "consume_bookmark_search_quota",
    ]) {
      expect(bootstrapSmartSearchSql).toContain(contractName);
      expect(migrationSql).toContain(contractName);
    }

    expect(bootstrapSmartSearchSql).toMatch(/document_source text not null default 'saved-fields'/i);
    expect(bootstrapSmartSearchSql).toMatch(/primary key \(user_id, card_id, document_source\)/i);
    expect(bootstrapSmartSearchSql).toMatch(/bookmark_search_embeddings_card_id_idx[\s\S]*?\(card_id\)/i);
    expect(bootstrapSmartSearchSql).toMatch(/select distinct on \(candidates\.card_id\)/i);
    expect(bootstrapSmartSearchSql).toMatch(/when 'saved-fields' then 0/i);
    expect(dualSourceMigrationSql).toContain("bookmark_search_embeddings_document_source_check");
  });

  it("stores no webpage text or query text in the embedding table", () => {
    const tableStart = migrationSql.indexOf("create table if not exists public.bookmark_search_embeddings");
    const tableEnd = migrationSql.indexOf("\n);", tableStart);
    const tableDefinition = migrationSql.slice(tableStart, tableEnd);

    expect(tableStart).toBeGreaterThanOrEqual(0);
    expect(tableEnd).toBeGreaterThan(tableStart);
    expect(tableDefinition).toMatch(/content_hash\s+text\s+not null/i);
    expect(tableDefinition).not.toMatch(/\b(?:document_text|raw_html|page_html|query_text|source_text|full_text|content_text)\b/i);
  });
});

describe("V1.3 derived-cache isolation", () => {
  it("uses its own localforage namespace and never clears storage", () => {
    expect(knowledgeIndexSource).toMatch(/name:\s*"WebCollectSearch"/);
    expect(knowledgeIndexSource).toMatch(/storeName:\s*"knowledge_index"/);
    expect(derivedCacheSources).not.toMatch(/name:\s*["']WebCollect["']/);
    expect(derivedCacheSources).not.toMatch(/storeName:\s*["']webcollect_data["']/);
    expect(derivedCacheSources).not.toMatch(/chrome\.storage/i);
    expect(derivedCacheSources).not.toMatch(/\.clear\s*\(/);
  });

  it("does not import or call business mutation, sync, snapshot, or dirty-set paths", () => {
    expect(derivedCacheSources).not.toMatch(/from\s+["']\.\/(?:db|store|sync|snapshot)["']/);
    expect(derivedCacheSources).not.toMatch(/\b(?:addCard|updateCard|softDeleteCard|restoreCard|permanentlyDelete|markCardDirty|markCategoryDirty|createSnapshot|pushToCloud)\s*\(/);
    expect(derivedCacheSources).not.toMatch(/\b(?:dirtyCardIds|dirtyCategoryIds|workspaceSnapshots|chromeStorage)\b/);
  });

  it("keeps Web public-page parsing disabled until a Web Google OAuth client exists", () => {
    expect(knowledgeFetchRouteSource).toMatch(/web-google-drive-auth-unavailable/);
    expect(knowledgeFetchRouteSource).toMatch(/status:\s*503/);
    expect(knowledgeFetchRouteSource).not.toMatch(/fetchRemoteText|supabase|cookie|credentials/i);
  });

  it("keeps the released search path local and leaves the semantic client dormant", () => {
    expect(topNavSource).toMatch(/useLocalKnowledgeBuild/);
    expect(topNavSource).toMatch(/useLocalWorkspaceSearch/);
    expect(topNavSource).not.toMatch(/useHybridWorkspaceSearch|useKnowledgeBuild/);
    expect(`${localKnowledgeHookSource}\n${localSearchHookSource}`).not.toMatch(
      /semanticSearchKnowledge|indexKnowledge|removeKnowledgeEmbedding|bookmark-search|OPENAI_API_KEY/i,
    );
    expect(localKnowledgeHookSource).not.toMatch(/chrome\.storage|clear\s*\(|removeKnowledgeCacheEntry/);
    expect(localKnowledgeHookSource).not.toMatch(
      /\b(?:addCard|updateCard|softDeleteCard|restoreCard|markCardDirty|markCategoryDirty|createSnapshot|pushToCloud)\s*\(/,
    );
  });

  it("uses the extension worker for public HTML without adding permissions or cookies", () => {
    expect(extensionBackgroundSource).toMatch(/message\.type === 'FETCH_KNOWLEDGE'/);
    expect(extensionBackgroundSource).toMatch(/extractKnowledgeText\(html, \{ maxChars: 6000 \}\)/);
    expect(extensionBackgroundSource).toMatch(/timeoutMs:\s*8000/);
    expect(extensionBackgroundSource).toMatch(/maxBytes:\s*1500000/);
    expect(extensionBackgroundSource).not.toMatch(/credentials:\s*['"]include['"]/);
  });
});

describe("V1.3 bookmark-search Edge Function secret and logging boundary", () => {
  it("uses a user JWT and environment-only OpenAI credential without a service role", () => {
    expect(edgeFunctionSources).toMatch(/client\.auth\.getUser\(token\)/);
    expect(edgeFunctionSources).toMatch(/Deno\.env\.get\("OPENAI_API_KEY"\)/);
    expect(edgeFunctionSources).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i);
    expect(edgeFunctionSources).not.toMatch(/\bsk-[A-Za-z0-9_-]{16,}\b/);
    expect(edgeFunctionSources).not.toMatch(/OPENAI_API_KEY\s*[:=]\s*["'][^"']+["']/);
  });

  it("does not log query text, document text, credentials, or request bodies", () => {
    expect(edgeFunctionSources).not.toMatch(/console\.(?:log|info|debug|warn|error)\s*\(/);
    expect(edgeFunctionSources).not.toMatch(/\b(?:logger|logQuery|auditLog|requestLog)\b/i);
  });

  it("only reads the cards table for ownership and writes only the derived index", () => {
    expect(edgeFunctionSources).toMatch(/\.from\("cards"\)\s*\.select\("id"\)/);
    expect(edgeFunctionSources).not.toMatch(/\.from\("cards"\)[\s\S]{0,160}?\.(?:insert|update|upsert|delete)\s*\(/);
    expect(edgeFunctionSources).toMatch(/\.from\("bookmark_search_embeddings"\)[\s\S]{0,200}?\.upsert\(/);
  });

  it("charges Unicode character units and refreshes stale model versions", () => {
    expect(edgeFunctionSources).toMatch(/quotaUnitsForRequest\(body\)/);
    expect(edgeFunctionSources).toMatch(/requested_units:\s*requestedUnits/);
    expect(edgeFunctionSources).toMatch(/\.select\(\s*"card_id,document_source,content_hash,model,index_version,indexed_at"\s*,?\s*\)/);
    expect(edgeFunctionSources).toMatch(/onConflict:\s*"user_id,card_id,document_source"/);
    expect(edgeFunctionSources).toMatch(/needsEmbeddingRefresh\(/);
    expect(edgeFunctionSources).toMatch(/select\("card_id,document_source,content_hash,indexed_at"\)/);
    expect(edgeFunctionSources).toMatch(/contentHash:\s*item\.contentHash/);
  });

  it("bounds the raw JSON body before parsing and maps malformed JSON to a stable code", () => {
    expect(edgeFunctionSources).toMatch(/MAX_REQUEST_BODY_BYTES\s*=\s*1_048_576/);
    expect(edgeFunctionSources).toMatch(/assertBookmarkSearchContentLength\(request\)/);
    expect(edgeFunctionSources).toMatch(/byteLength\s*>\s*MAX_REQUEST_BODY_BYTES/);
    expect(edgeFunctionSources).toMatch(/RequestValidationError\("invalid-json"\)/);
    expect(edgeFunctionSources).not.toMatch(/await request\.json\(\)/);
  });
});

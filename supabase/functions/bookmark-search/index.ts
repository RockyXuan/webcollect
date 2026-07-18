import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createOpenAiEmbeddings, EmbeddingProviderError } from "./openai.ts";
import {
  assertBookmarkSearchContentLength,
  type BookmarkSearchRequest,
  EMBEDDING_INDEX_VERSION,
  EMBEDDING_MODEL,
  type IndexRequestItem,
  needsEmbeddingRefresh,
  parseBookmarkSearchRequest,
  quotaUnitsForRequest,
  readBookmarkSearchJson,
  RequestValidationError,
} from "./validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store" },
  });
}

function publishableKey(): string {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
    ) as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? "";
  } catch {
    return "";
  }
}

function bearerToken(request: Request): string {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim() ?? "";
}

function embeddingKey(cardId: string, source: string): string {
  return `${cardId}:${source}`;
}

async function consumeQuota(
  client: SupabaseClient,
  action: BookmarkSearchRequest["action"],
  requestedUnits: number,
): Promise<boolean> {
  const { data, error } = await client.rpc("consume_bookmark_search_quota", {
    requested_action: action,
    requested_units: requestedUnits,
  });
  if (error) throw new Error("quota-unavailable");
  return data === true;
}

async function indexDocuments(
  client: SupabaseClient,
  userId: string,
  items: IndexRequestItem[],
  apiKey: string,
): Promise<Response> {
  const cardIds = [...new Set(items.map((item) => item.cardId))];
  const { data: ownedCards, error: ownershipError } = await client.from("cards")
    .select("id").in("id", cardIds);
  if (ownershipError) {
    return json({ error: "card-ownership-check-failed" }, 503);
  }
  const ownedIds = new Set((ownedCards ?? []).map((card) => String(card.id)));
  if (cardIds.some((cardId) => !ownedIds.has(cardId))) {
    return json({ error: "card-not-owned" }, 403);
  }

  const { data: existing, error: existingError } = await client
    .from("bookmark_search_embeddings")
    .select(
      "card_id,document_source,content_hash,model,index_version,indexed_at",
    )
    .in("card_id", cardIds);
  if (existingError) return json({ error: "index-read-failed" }, 503);
  const existingById = new Map(
    (existing ?? []).map((row) => [
      embeddingKey(String(row.card_id), String(row.document_source)),
      row,
    ]),
  );
  const changed = items.filter((item) =>
    needsEmbeddingRefresh(
      existingById.get(embeddingKey(item.cardId, item.source)),
      item,
    )
  );

  if (changed.length > 0) {
    const embeddings = await createOpenAiEmbeddings(
      changed.map((item) => item.text),
      apiKey,
    );
    const indexedAt = new Date().toISOString();
    const rows = changed.map((item, index) => ({
      user_id: userId,
      card_id: item.cardId,
      document_source: item.source,
      content_hash: item.contentHash,
      model: EMBEDDING_MODEL,
      embedding: embeddings[index],
      indexed_at: indexedAt,
      index_version: EMBEDDING_INDEX_VERSION,
    }));
    const { error: upsertError } = await client
      .from("bookmark_search_embeddings")
      .upsert(rows, { onConflict: "user_id,card_id,document_source" });
    if (upsertError) return json({ error: "index-write-failed" }, 503);
  }

  const { data: indexedRows, error: indexedError } = await client
    .from("bookmark_search_embeddings")
    .select("card_id,document_source,content_hash,indexed_at")
    .in("card_id", cardIds);
  if (indexedError) return json({ error: "index-read-failed" }, 503);
  const indexedByKey = new Map(
    (indexedRows ?? []).map((row) => [
      embeddingKey(String(row.card_id), String(row.document_source)),
      row,
    ]),
  );
  const indexed = items.map((item) => {
    const row = indexedByKey.get(embeddingKey(item.cardId, item.source));
    if (
      !row || String(row.content_hash) !== item.contentHash ||
      !Number.isFinite(new Date(String(row.indexed_at)).getTime())
    ) {
      return null;
    }
    return {
      cardId: item.cardId,
      contentHash: item.contentHash,
      source: item.source,
      indexedAt: new Date(String(row.indexed_at)).getTime(),
    };
  });
  if (indexed.some((item) => item === null)) {
    return json({ error: "index-receipt-mismatch" }, 503);
  }
  return json({
    indexed,
  });
}

async function semanticSearch(
  client: SupabaseClient,
  query: string,
  limit: number,
  apiKey: string,
): Promise<Response> {
  const [embedding] = await createOpenAiEmbeddings([query], apiKey);
  const { data, error } = await client.rpc("match_bookmark_search_embeddings", {
    query_embedding: embedding,
    match_threshold: 0.35,
    match_count: limit,
  });
  if (error) return json({ error: "semantic-search-failed" }, 503);
  return json({
    results: (data ?? []).map((row: Record<string, unknown>) => ({
      cardId: String(row.card_id ?? ""),
      contentHash: String(row.content_hash ?? ""),
      similarity: Number(row.similarity ?? 0),
    })),
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method-not-allowed" }, 405);
  }

  try {
    assertBookmarkSearchContentLength(request);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return json(
        { error: error.code },
        error.code === "request-too-large" ? 413 : 400,
      );
    }
    return json({ error: "invalid-request" }, 400);
  }

  const token = bearerToken(request);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = publishableKey();
  if (!token || !supabaseUrl || !anonKey) {
    return json({ error: "authentication-required" }, 401);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user?.id) {
    return json({ error: "authentication-required" }, 401);
  }

  try {
    const body = parseBookmarkSearchRequest(
      await readBookmarkSearchJson(request),
    );
    if (
      !(await consumeQuota(client, body.action, quotaUnitsForRequest(body)))
    ) {
      return json({ error: "rate-limited" }, 429);
    }
    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    return body.action === "index"
      ? await indexDocuments(client, authData.user.id, body.items, apiKey)
      : await semanticSearch(client, body.query, body.limit, apiKey);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return json(
        { error: error.code },
        error.code === "request-too-large" ? 413 : 400,
      );
    }
    if (error instanceof EmbeddingProviderError) {
      const status = error.code === "embedding-rate-limited"
        ? 429
        : error.code === "embedding-timeout"
        ? 504
        : error.code === "embedding-not-configured"
        ? 503
        : 502;
      return json({ error: error.code }, status);
    }
    return json({ error: "bookmark-search-failed" }, 500);
  }
});

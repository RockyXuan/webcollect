import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetKnowledgeClientDependenciesForTest,
  __setKnowledgeClientDependenciesForTest,
  fetchPublicKnowledge,
  indexKnowledge,
  KnowledgeClientError,
  type KnowledgeClientErrorCode,
  removeKnowledgeEmbedding,
  semanticSearchKnowledge,
} from "@/lib/knowledge-client";

const TOKEN = "session-token-for-test";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

interface FakeClientOptions {
  session?: string | null;
  sessionError?: boolean;
  invokeData?: unknown;
  invokeError?: unknown;
  invokeResponse?: Response;
  deleteError?: unknown;
}

function createFakeClient(options: FakeClientOptions = {}) {
  const invoke = vi.fn(async () => ({
    data: options.invokeData ?? null,
    error: options.invokeError ?? null,
    response: options.invokeResponse,
  }));
  const deletion = Object.assign(
    Promise.resolve({ error: options.deleteError ?? null }),
    {
      abortSignal: vi.fn(() => Promise.resolve({ error: options.deleteError ?? null })),
    },
  );
  const eq = vi.fn(() => deletion);
  const deleteRows = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: deleteRows }));
  const getSession = vi.fn(async () => ({
    data: {
      session: options.session === null
        ? null
        : { access_token: options.session ?? TOKEN },
    },
    error: options.sessionError ? { message: "session failed" } : null,
  }));
  const client = {
    auth: { getSession },
    functions: { invoke },
    from,
  } as unknown as SupabaseClient;
  return { client, invoke, from, deleteRows, eq, deletion, getSession };
}

function installClient(client: SupabaseClient, overrides: {
  configured?: boolean;
  fetch?: typeof globalThis.fetch;
  isExtension?: boolean;
} = {}) {
  const initSupabase = vi.fn(async () => overrides.configured ?? true);
  const getSupabaseClient = vi.fn(() => client);
  const fetchMock = overrides.fetch ?? vi.fn();
  __setKnowledgeClientDependenciesForTest({
    initSupabase,
    getSupabaseClient,
    fetch: fetchMock,
    isExtension: () => overrides.isExtension ?? false,
  });
  return { initSupabase, getSupabaseClient, fetchMock };
}

async function expectCode(promise: Promise<unknown>, code: KnowledgeClientErrorCode) {
  await expect(promise).rejects.toMatchObject({
    name: "KnowledgeClientError",
    code,
    message: code,
  } satisfies Partial<KnowledgeClientError>);
}

describe("knowledge client", () => {
  beforeEach(() => {
    __resetKnowledgeClientDependenciesForTest();
  });

  afterEach(() => {
    __resetKnowledgeClientDependenciesForTest();
    vi.restoreAllMocks();
  });

  it("uses the current session token and filters semantic results to live local cards", async () => {
    const controller = new AbortController();
    const fake = createFakeClient({
      invokeData: {
        results: [
          { cardId: "live-card", contentHash: HASH_A, similarity: 0.91 },
          { cardId: "stale-card", contentHash: HASH_B, similarity: 0.88 },
          { cardId: "live-card", contentHash: HASH_A, similarity: 0.7 },
        ],
      },
    });
    const deps = installClient(fake.client);

    await expect(semanticSearchKnowledge("  AI 写代码  ", {
      limit: 5,
      signal: controller.signal,
      allowedCardIds: new Set(["live-card"]),
    })).resolves.toEqual([
      { cardId: "live-card", contentHash: HASH_A, similarity: 0.91 },
    ]);

    expect(deps.initSupabase).toHaveBeenCalledTimes(1);
    expect(fake.getSession).toHaveBeenCalledTimes(1);
    expect(fake.invoke).toHaveBeenCalledWith("bookmark-search", {
      body: { action: "search", query: "AI 写代码", limit: 5 },
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: controller.signal,
    });
  });

  it("fails closed when there is no signed-in session", async () => {
    const fake = createFakeClient({ session: null });
    installClient(fake.client);

    await expectCode(semanticSearchKnowledge("github"), "authentication-required");
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("normalizes function failures without exposing provider details", async () => {
    const fake = createFakeClient({
      invokeError: new Error("secret upstream detail"),
      invokeResponse: Response.json({ error: "embedding-rate-limited" }, { status: 429 }),
    });
    installClient(fake.client);

    await expectCode(semanticSearchKnowledge("github"), "rate-limited");
  });

  it("rejects malformed semantic response rows", async () => {
    const fake = createFakeClient({
      invokeData: { results: [{ cardId: "card-a", contentHash: "bad", similarity: 2 }] },
    });
    installClient(fake.client);

    await expectCode(semanticSearchKnowledge("github"), "invalid-response");
  });

  it("normalizes index input and ignores result IDs outside the requested batch", async () => {
    const fake = createFakeClient({
      invokeData: {
        indexed: [
          { cardId: "card-a", indexedAt: 1_700_000_000_000 },
          { cardId: "unrequested", indexedAt: 1_700_000_000_001 },
        ],
      },
    });
    installClient(fake.client);

    await expect(indexKnowledge([
      { cardId: " card-a ", contentHash: HASH_A.toUpperCase(), text: "  document text  " },
    ])).resolves.toEqual([{ cardId: "card-a", indexedAt: 1_700_000_000_000 }]);
    expect(fake.invoke).toHaveBeenCalledWith("bookmark-search", expect.objectContaining({
      body: {
        action: "index",
        items: [{ cardId: "card-a", contentHash: HASH_A, text: "document text" }],
      },
      headers: { Authorization: `Bearer ${TOKEN}` },
    }));
  });

  it("deletes only the requested embedding row through the RLS client", async () => {
    const fake = createFakeClient();
    installClient(fake.client);
    const controller = new AbortController();

    await removeKnowledgeEmbedding(" card-a ", { signal: controller.signal });

    expect(fake.from).toHaveBeenCalledWith("bookmark_search_embeddings");
    expect(fake.deleteRows).toHaveBeenCalledTimes(1);
    expect(fake.eq).toHaveBeenCalledWith("card_id", "card-a");
    expect(fake.deletion.abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it("blocks public-page extraction inside the extension before auth or network access", async () => {
    const fake = createFakeClient();
    const deps = installClient(fake.client, { isExtension: true });

    await expectCode(fetchPublicKnowledge("https://example.com"), "extension-public-fetch-disabled");
    expect(deps.initSupabase).not.toHaveBeenCalled();
    expect(deps.fetchMock).not.toHaveBeenCalled();
  });

  it("fetches public knowledge on Web with bearer auth and validates the result", async () => {
    const fake = createFakeClient();
    const fetchMock = vi.fn(async () => Response.json({
      resolvedUrl: "https://example.com/final",
      text: "Public article text",
      truncated: false,
      segmentCount: 1,
    }));
    installClient(fake.client, { fetch: fetchMock });
    const controller = new AbortController();

    await expect(fetchPublicKnowledge("https://example.com", { signal: controller.signal })).resolves.toEqual({
      resolvedUrl: "https://example.com/final",
      text: "Public article text",
      truncated: false,
      segmentCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/knowledge/fetch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com/" }),
      cache: "no-store",
      signal: controller.signal,
    });
  });

  it("returns stable abort and configuration errors", async () => {
    const fake = createFakeClient();
    installClient(fake.client, { configured: false });
    await expectCode(semanticSearchKnowledge("github"), "not-configured");

    const controller = new AbortController();
    controller.abort();
    await expectCode(semanticSearchKnowledge("github", { signal: controller.signal }), "aborted");
  });
});

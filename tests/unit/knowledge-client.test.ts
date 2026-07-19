import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetKnowledgeClientDependenciesForTest,
  __setKnowledgeClientDependenciesForTest,
  fetchPublicKnowledge,
  indexKnowledge,
  KnowledgeClientError,
  type KnowledgeClientErrorCode,
  listKnowledgeEmbeddingStates,
  removeKnowledgeEmbedding,
  semanticSearchKnowledge,
} from "@/lib/knowledge-client";

const TOKEN = "session-token-for-test";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

interface FakeClientOptions {
  session?: string | null;
  sessionUserId?: string | null;
  sessionError?: boolean;
  invokeData?: unknown;
  invokeError?: unknown;
  invokeResponse?: Response;
  deleteError?: unknown;
  embeddingRows?: unknown[];
  selectError?: unknown;
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
      eq: vi.fn(),
    },
  );
  const eq = deletion.eq.mockImplementation(() => deletion);
  const deleteRows = vi.fn(() => ({ eq }));
  const selection = Object.assign(
    Promise.resolve({
      data: options.embeddingRows ?? [],
      error: options.selectError ?? null,
    }),
    {
      abortSignal: vi.fn(() => selection),
      in: vi.fn(() => selection),
    },
  );
  const select = vi.fn(() => selection);
  const from = vi.fn(() => ({ delete: deleteRows, select }));
  const getSession = vi.fn(async () => ({
    data: {
      session: options.session === null
        ? null
        : {
            access_token: options.session ?? TOKEN,
            user: options.sessionUserId === null
              ? undefined
              : { id: options.sessionUserId ?? "user-a" },
          },
    },
    error: options.sessionError ? { message: "session failed" } : null,
  }));
  const client = {
    auth: { getSession },
    functions: { invoke },
    from,
  } as unknown as SupabaseClient;
  return {
    client,
    invoke,
    from,
    deleteRows,
    eq,
    deletion,
    select,
    selection,
    getSession,
  };
}

function installClient(client: SupabaseClient, overrides: {
  configured?: boolean;
  fetch?: typeof globalThis.fetch;
  isExtension?: boolean;
  sendExtensionMessage?: (message: unknown) => Promise<unknown>;
} = {}) {
  const initSupabase = vi.fn(async () => overrides.configured ?? true);
  const getSupabaseClient = vi.fn(() => client);
  const fetchMock = overrides.fetch ?? vi.fn();
  const sendExtensionMessage = vi.fn(overrides.sendExtensionMessage ?? (async () => null));
  __setKnowledgeClientDependenciesForTest({
    initSupabase,
    getSupabaseClient,
    fetch: fetchMock,
    isExtension: () => overrides.isExtension ?? false,
    sendExtensionMessage,
  });
  return { initSupabase, getSupabaseClient, fetchMock, sendExtensionMessage };
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

  it("fails closed before cloud I/O when the session user changed", async () => {
    const fake = createFakeClient({ sessionUserId: "user-b" });
    const deps = installClient(fake.client);

    await expectCode(semanticSearchKnowledge("github", {
      expectedUserId: "user-a",
    }), "authentication-required");

    expect(deps.initSupabase).toHaveBeenCalledTimes(1);
    expect(fake.invoke).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
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
          { cardId: "card-a", contentHash: HASH_A, indexedAt: 1_700_000_000_000, source: "public-html" },
          { cardId: "unrequested", contentHash: HASH_B, indexedAt: 1_700_000_000_001, source: "saved-fields" },
        ],
      },
    });
    installClient(fake.client);

    await expect(indexKnowledge([
      {
        cardId: " card-a ",
        contentHash: HASH_A.toUpperCase(),
        text: "  document text  ",
        source: "public-html",
      },
    ])).resolves.toEqual([{
      cardId: "card-a",
      contentHash: HASH_A,
      indexedAt: 1_700_000_000_000,
      source: "public-html",
    }]);
    expect(fake.invoke).toHaveBeenCalledWith("bookmark-search", expect.objectContaining({
      body: {
        action: "index",
        items: [{
          cardId: "card-a",
          contentHash: HASH_A,
          text: "document text",
          source: "public-html",
        }],
      },
      headers: { Authorization: `Bearer ${TOKEN}` },
    }));
  });

  it("allows independent public and saved-field vectors for the same card", async () => {
    const fake = createFakeClient({
      invokeData: {
        indexed: [
          { cardId: "card-a", contentHash: HASH_A, indexedAt: 1_700_000_000_010, source: "saved-fields" },
          { cardId: "card-a", contentHash: HASH_B, indexedAt: 1_700_000_000_011, source: "public-html" },
        ],
      },
    });
    installClient(fake.client);

    await expect(indexKnowledge([
      { cardId: "card-a", contentHash: HASH_A, text: "saved text", source: "saved-fields" },
      { cardId: "card-a", contentHash: HASH_B, text: "public text", source: "public-html" },
    ])).resolves.toEqual([
      { cardId: "card-a", contentHash: HASH_A, indexedAt: 1_700_000_000_010, source: "saved-fields" },
      { cardId: "card-a", contentHash: HASH_B, indexedAt: 1_700_000_000_011, source: "public-html" },
    ]);

    expect(fake.invoke).toHaveBeenCalledWith("bookmark-search", expect.objectContaining({
      body: {
        action: "index",
        items: [
          { cardId: "card-a", contentHash: HASH_A, text: "saved text", source: "saved-fields" },
          { cardId: "card-a", contentHash: HASH_B, text: "public text", source: "public-html" },
        ],
      },
    }));
  });

  it("rejects an index receipt whose content hash does not match the request", async () => {
    const fake = createFakeClient({
      invokeData: {
        indexed: [{
          cardId: "card-a",
          contentHash: HASH_B,
          indexedAt: 1_700_000_000_020,
          source: "saved-fields",
        }],
      },
    });
    installClient(fake.client);

    await expectCode(indexKnowledge([{
      cardId: "card-a",
      contentHash: HASH_A,
      text: "saved text",
      source: "saved-fields",
    }]), "invalid-response");
  });

  it("rejects an unknown document source before auth or indexing", async () => {
    const fake = createFakeClient();
    const deps = installClient(fake.client);

    await expectCode(indexKnowledge([{
      cardId: "card-a",
      contentHash: HASH_A,
      text: "document",
      source: "browser-cache" as "saved-fields",
    }]), "invalid-request");

    expect(deps.initSupabase).not.toHaveBeenCalled();
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("deletes every source for the requested card through the RLS client", async () => {
    const fake = createFakeClient();
    installClient(fake.client);
    const controller = new AbortController();

    await removeKnowledgeEmbedding(" card-a ", { signal: controller.signal });

    expect(fake.from).toHaveBeenCalledWith("bookmark_search_embeddings");
    expect(fake.deleteRows).toHaveBeenCalledTimes(1);
    expect(fake.eq).toHaveBeenCalledWith("card_id", "card-a");
    expect(fake.eq).toHaveBeenCalledTimes(1);
    expect(fake.deletion.abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it("can delete exactly one source without affecting the other source", async () => {
    const fake = createFakeClient();
    installClient(fake.client);

    await removeKnowledgeEmbedding("card-a", {
      expectedUserId: "user-a",
      source: "public-html",
    });

    expect(fake.eq).toHaveBeenNthCalledWith(1, "card_id", "card-a");
    expect(fake.eq).toHaveBeenNthCalledWith(2, "document_source", "public-html");
  });

  it("lists only validated embedding state in batches of at most 100", async () => {
    const fake = createFakeClient({
      embeddingRows: [{
        card_id: "card-a",
        document_source: "saved-fields",
        content_hash: HASH_A,
      }],
    });
    installClient(fake.client);

    await expect(listKnowledgeEmbeddingStates(["card-a"], {
      expectedUserId: "user-a",
    })).resolves.toEqual([{
      cardId: "card-a",
      source: "saved-fields",
      contentHash: HASH_A,
    }]);
    expect(fake.select).toHaveBeenCalledWith("card_id,document_source,content_hash");
    expect(fake.selection.in).toHaveBeenCalledWith("card_id", ["card-a"]);

    const empty = createFakeClient();
    installClient(empty.client);
    await listKnowledgeEmbeddingStates(
      Array.from({ length: 201 }, (_, index) => `card-${index}`),
    );
    expect(empty.selection.in).toHaveBeenCalledTimes(3);
    expect(empty.selection.in).toHaveBeenNthCalledWith(
      1,
      "card_id",
      Array.from({ length: 100 }, (_, index) => `card-${index}`),
    );
    expect(empty.selection.in).toHaveBeenNthCalledWith(
      2,
      "card_id",
      Array.from({ length: 100 }, (_, index) => `card-${index + 100}`),
    );
    expect(empty.selection.in).toHaveBeenNthCalledWith(3, "card_id", ["card-200"]);
  });

  it("rejects an empty card id before auth or deletion", async () => {
    const fake = createFakeClient();
    const deps = installClient(fake.client);

    await expectCode(removeKnowledgeEmbedding("   "), "invalid-request");

    expect(deps.initSupabase).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("fetches public-page text through the extension worker without Supabase auth", async () => {
    const fake = createFakeClient();
    const deps = installClient(fake.client, {
      isExtension: true,
      sendExtensionMessage: async () => ({
        success: true,
        data: {
          resolvedUrl: "https://example.com/final",
          text: "Public article text",
          truncated: false,
          segmentCount: 1,
        },
      }),
    });

    await expect(fetchPublicKnowledge("https://example.com")).resolves.toEqual({
      resolvedUrl: "https://example.com/final",
      text: "Public article text",
      truncated: false,
      segmentCount: 1,
    });
    expect(deps.initSupabase).not.toHaveBeenCalled();
    expect(deps.fetchMock).not.toHaveBeenCalled();
    expect(deps.sendExtensionMessage).toHaveBeenCalledWith({
      type: "FETCH_KNOWLEDGE",
      url: "https://example.com/",
    });
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

import {
  EMBEDDING_INDEX_VERSION,
  EMBEDDING_MODEL,
  MAX_REQUEST_BODY_BYTES,
  needsEmbeddingRefresh,
  parseBookmarkSearchRequest,
  quotaUnitsForRequest,
  readBookmarkSearchJson,
  RequestValidationError,
} from "./validation.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message = "values are not equal",
): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(
      `${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`,
    );
  }
}

function assertValidationError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    assert(
      error instanceof RequestValidationError,
      `expected RequestValidationError, got ${String(error)}`,
    );
    assertEquals(error.code, code);
    return;
  }
  throw new Error(`expected RequestValidationError(${code})`);
}

async function assertAsyncValidationError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(
      error instanceof RequestValidationError,
      `expected RequestValidationError, got ${String(error)}`,
    );
    assertEquals(error.code, code);
    return;
  }
  throw new Error(`expected RequestValidationError(${code})`);
}

const CARD_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONTENT_HASH = "a".repeat(64);
const PUBLIC_SOURCE = "public-html" as const;
const SAVED_SOURCE = "saved-fields" as const;

Deno.test("readBookmarkSearchJson accepts JSON within the byte limit", async () => {
  const value = await readBookmarkSearchJson(
    new Request("https://edge.test", {
      method: "POST",
      body: JSON.stringify({ action: "search", query: "github" }),
    }),
  );
  assertEquals(value, { action: "search", query: "github" });
});

Deno.test("readBookmarkSearchJson returns stable invalid-json for malformed JSON", async () => {
  await assertAsyncValidationError(
    () =>
      readBookmarkSearchJson(
        new Request("https://edge.test", {
          method: "POST",
          body: "{malformed",
        }),
      ),
    "invalid-json",
  );
});

Deno.test("readBookmarkSearchJson rejects declared and actual bodies above one MiB", async () => {
  await assertAsyncValidationError(
    () =>
      readBookmarkSearchJson(
        new Request("https://edge.test", {
          method: "POST",
          headers: { "content-length": String(MAX_REQUEST_BODY_BYTES + 1) },
          body: "{}",
        }),
      ),
    "request-too-large",
  );
  await assertAsyncValidationError(
    () =>
      readBookmarkSearchJson(
        new Request("https://edge.test", {
          method: "POST",
          body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
        }),
      ),
    "request-too-large",
  );
});

Deno.test("parseBookmarkSearchRequest trims a search query and normalizes its limit", () => {
  assertEquals(
    parseBookmarkSearchRequest({
      action: "search",
      query: "  思维导图  ",
      limit: 3.8,
    }),
    {
      action: "search",
      query: "思维导图",
      limit: 3,
    },
  );
  assertEquals(
    parseBookmarkSearchRequest({ action: "search", query: "github", limit: 0 }),
    {
      action: "search",
      query: "github",
      limit: 1,
    },
  );
  assertEquals(
    parseBookmarkSearchRequest({
      action: "search",
      query: "github",
      limit: 999,
    }),
    {
      action: "search",
      query: "github",
      limit: 20,
    },
  );
  assertEquals(
    parseBookmarkSearchRequest({
      action: "search",
      query: "github",
      limit: "not-a-number",
    }),
    {
      action: "search",
      query: "github",
      limit: 20,
    },
  );
});

Deno.test("parseBookmarkSearchRequest rejects malformed search requests", () => {
  for (const value of [null, undefined, false, "search"]) {
    assertValidationError(
      () => parseBookmarkSearchRequest(value),
      "invalid-request",
    );
  }
  assertValidationError(() => parseBookmarkSearchRequest([]), "invalid-action");
  assertValidationError(
    () => parseBookmarkSearchRequest({ action: "other" }),
    "invalid-action",
  );
  assertValidationError(
    () => parseBookmarkSearchRequest({ action: "search", query: " " }),
    "invalid-query",
  );
  assertValidationError(
    () => parseBookmarkSearchRequest({ action: "search", query: "a" }),
    "invalid-query",
  );
  assertValidationError(
    () =>
      parseBookmarkSearchRequest({ action: "search", query: "x".repeat(201) }),
    "invalid-query",
  );
});

Deno.test("parseBookmarkSearchRequest accepts and trims a valid index batch without mutating it", () => {
  const input = {
    action: "index",
    items: [{
      cardId: CARD_ID,
      contentHash: CONTENT_HASH,
      text: "  public page text  ",
      source: PUBLIC_SOURCE,
    }],
  } as const;
  const snapshot = structuredClone(input);

  assertEquals(parseBookmarkSearchRequest(input), {
    action: "index",
    items: [{
      cardId: CARD_ID,
      contentHash: CONTENT_HASH,
      text: "public page text",
      source: PUBLIC_SOURCE,
    }],
  });
  assertEquals(input, snapshot, "parser must not mutate the caller's request");
});

Deno.test("parseBookmarkSearchRequest enforces index batch and identifier boundaries", () => {
  assertValidationError(
    () => parseBookmarkSearchRequest({ action: "index", items: [] }),
    "invalid-index-batch",
  );
  assertValidationError(
    () =>
      parseBookmarkSearchRequest({
        action: "index",
        items: Array.from({ length: 33 }, (_, index) => ({
          cardId: `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`,
          contentHash: CONTENT_HASH,
          text: "text",
          source: SAVED_SOURCE,
        })),
      }),
    "invalid-index-batch",
  );
  assertValidationError(
    () => parseBookmarkSearchRequest({ action: "index", items: [null] }),
    "invalid-index-item",
  );
  assertValidationError(
    () =>
      parseBookmarkSearchRequest({
        action: "index",
        items: [{
          cardId: "not-a-uuid",
          contentHash: CONTENT_HASH,
          text: "text",
          source: SAVED_SOURCE,
        }],
      }),
    "invalid-card-id",
  );
  assertValidationError(
    () =>
      parseBookmarkSearchRequest({
        action: "index",
        items: [
          {
            cardId: CARD_ID,
            contentHash: CONTENT_HASH,
            text: "first",
            source: SAVED_SOURCE,
          },
          {
            cardId: CARD_ID,
            contentHash: CONTENT_HASH,
            text: "duplicate",
            source: SAVED_SOURCE,
          },
        ],
      }),
    "duplicate-index-item",
  );
  assertValidationError(
    () =>
      parseBookmarkSearchRequest({
        action: "index",
        items: [{
          cardId: CARD_ID,
          contentHash: "A".repeat(64),
          text: "text",
          source: SAVED_SOURCE,
        }],
      }),
    "invalid-content-hash",
  );
  assertValidationError(
    () =>
      parseBookmarkSearchRequest({
        action: "index",
        items: [{
          cardId: CARD_ID,
          contentHash: CONTENT_HASH,
          text: "text",
          source: "browser-cache",
        }],
      }),
    "invalid-document-source",
  );

  const dualSource = parseBookmarkSearchRequest({
    action: "index",
    items: [
      {
        cardId: CARD_ID,
        contentHash: CONTENT_HASH,
        text: "saved",
        source: SAVED_SOURCE,
      },
      {
        cardId: CARD_ID,
        contentHash: "b".repeat(64),
        text: "public",
        source: PUBLIC_SOURCE,
      },
    ],
  });
  assert(dualSource.action === "index");
  assertEquals(dualSource.items.length, 2);
});

Deno.test("parseBookmarkSearchRequest measures the 6000 character document limit by Unicode code point", () => {
  const accepted = "页".repeat(5_999) + "😀";
  const rejected = accepted + "页";

  const parsed = parseBookmarkSearchRequest({
    action: "index",
    items: [{
      cardId: CARD_ID,
      contentHash: CONTENT_HASH,
      text: accepted,
      source: SAVED_SOURCE,
    }],
  });
  assert(parsed.action === "index");
  assertEquals(Array.from(parsed.items[0].text).length, 6_000);

  assertValidationError(
    () =>
      parseBookmarkSearchRequest({
        action: "index",
        items: [{
          cardId: CARD_ID,
          contentHash: CONTENT_HASH,
          text: rejected,
          source: SAVED_SOURCE,
        }],
      }),
    "invalid-document-text",
  );
  assertValidationError(
    () =>
      parseBookmarkSearchRequest({
        action: "index",
        items: [{
          cardId: CARD_ID,
          contentHash: CONTENT_HASH,
          text: "   ",
          source: SAVED_SOURCE,
        }],
      }),
    "invalid-document-text",
  );
});

Deno.test("quotaUnitsForRequest counts Unicode code points for search and index documents", () => {
  const search = parseBookmarkSearchRequest({
    action: "search",
    query: "图😀谱",
    limit: 5,
  });
  const index = parseBookmarkSearchRequest({
    action: "index",
    items: [
      {
        cardId: CARD_ID,
        contentHash: CONTENT_HASH,
        text: "一😀",
        source: SAVED_SOURCE,
      },
      {
        cardId: "123e4567-e89b-42d3-a456-426614174001",
        contentHash: "b".repeat(64),
        text: "abc",
        source: PUBLIC_SOURCE,
      },
    ],
  });

  assertEquals(quotaUnitsForRequest(search), 3);
  assertEquals(quotaUnitsForRequest(index), 5);
});

Deno.test("needsEmbeddingRefresh includes source, model, and index version in its cache contract", () => {
  const item = {
    cardId: CARD_ID,
    contentHash: CONTENT_HASH,
    text: "document",
    source: SAVED_SOURCE,
  };
  assertEquals(needsEmbeddingRefresh(undefined, item), true);
  assertEquals(
    needsEmbeddingRefresh({
      content_hash: CONTENT_HASH,
      document_source: SAVED_SOURCE,
      model: EMBEDDING_MODEL,
      index_version: EMBEDDING_INDEX_VERSION,
    }, item),
    false,
  );
  assertEquals(
    needsEmbeddingRefresh({
      content_hash: CONTENT_HASH,
      document_source: SAVED_SOURCE,
      model: "previous-model",
      index_version: EMBEDDING_INDEX_VERSION,
    }, item),
    true,
  );
  assertEquals(
    needsEmbeddingRefresh({
      content_hash: CONTENT_HASH,
      document_source: SAVED_SOURCE,
      model: EMBEDDING_MODEL,
      index_version: EMBEDDING_INDEX_VERSION + 1,
    }, item),
    true,
  );
  assertEquals(
    needsEmbeddingRefresh({
      content_hash: CONTENT_HASH,
      document_source: PUBLIC_SOURCE,
      model: EMBEDDING_MODEL,
      index_version: EMBEDDING_INDEX_VERSION,
    }, item),
    true,
  );
});

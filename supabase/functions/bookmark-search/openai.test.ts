import { createOpenAiEmbeddings, EmbeddingProviderError } from "./openai.ts";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./validation.ts";

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

async function assertProviderError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(
      error instanceof EmbeddingProviderError,
      `expected EmbeddingProviderError, got ${String(error)}`,
    );
    assertEquals(error.code, code);
    return;
  }
  throw new Error(`expected EmbeddingProviderError(${code})`);
}

function vector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

Deno.test("createOpenAiEmbeddings sends the fixed model contract and restores provider index order", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return Promise.resolve(jsonResponse({
      data: [
        { index: 1, embedding: vector(2) },
        { index: 0, embedding: vector(1) },
      ],
    }));
  };

  const result = await createOpenAiEmbeddings(
    ["first", "second"],
    "test-secret",
    fetchMock,
  );

  assertEquals(capturedUrl, "https://api.openai.com/v1/embeddings");
  assertEquals(capturedInit?.method, "POST");
  const headers = new Headers(capturedInit?.headers);
  assertEquals(headers.get("authorization"), "Bearer test-secret");
  assertEquals(headers.get("content-type"), "application/json");
  assert(
    capturedInit?.signal instanceof AbortSignal,
    "request must include a timeout signal",
  );
  assertEquals(JSON.parse(String(capturedInit?.body)), {
    model: EMBEDDING_MODEL,
    input: ["first", "second"],
    encoding_format: "float",
  });
  assertEquals(result.length, 2);
  assertEquals(result[0][0], 1);
  assertEquals(result[1][0], 2);
  assertEquals(result[0].length, EMBEDDING_DIMENSIONS);
});

Deno.test("createOpenAiEmbeddings rejects a missing API key without making a request", async () => {
  let calls = 0;
  const fetchMock: typeof fetch = () => {
    calls += 1;
    return Promise.resolve(jsonResponse({ data: [] }));
  };

  await assertProviderError(
    () => createOpenAiEmbeddings(["query"], "", fetchMock),
    "embedding-not-configured",
  );
  assertEquals(calls, 0);
});

Deno.test("createOpenAiEmbeddings maps HTTP provider failures to stable error codes", async () => {
  await assertProviderError(
    () =>
      createOpenAiEmbeddings(
        ["query"],
        "key",
        () => Promise.resolve(jsonResponse({}, 429)),
      ),
    "embedding-rate-limited",
  );
  await assertProviderError(
    () =>
      createOpenAiEmbeddings(
        ["query"],
        "key",
        () => Promise.resolve(jsonResponse({}, 500)),
      ),
    "embedding-provider-failed",
  );
});

Deno.test("createOpenAiEmbeddings rejects missing, extra, or malformed vectors", async () => {
  const invalidPayloads: unknown[] = [
    {},
    { data: [] },
    {
      data: [{ index: 0, embedding: vector(1) }, {
        index: 1,
        embedding: vector(2),
      }],
    },
    { data: [{ index: 0, embedding: vector(1).slice(1) }] },
    { data: [{ index: 0, embedding: [...vector(1).slice(0, -1), "1"] }] },
    {
      data: [{ index: 0, embedding: [...vector(1).slice(0, -1), Number.NaN] }],
    },
    {
      data: [{
        index: 0,
        embedding: [...vector(1).slice(0, -1), Number.POSITIVE_INFINITY],
      }],
    },
  ];

  for (const payload of invalidPayloads) {
    await assertProviderError(
      () =>
        createOpenAiEmbeddings(
          ["query"],
          "key",
          () => Promise.resolve(jsonResponse(payload)),
        ),
      "embedding-invalid-response",
    );
  }
});

Deno.test("createOpenAiEmbeddings requires a unique complete provider index set", async () => {
  const invalidPayloads: unknown[] = [
    {
      data: [
        { embedding: vector(1) },
        { index: 1, embedding: vector(2) },
      ],
    },
    {
      data: [
        { index: 0, embedding: vector(1) },
        { index: 0, embedding: vector(2) },
      ],
    },
    {
      data: [
        { index: 0, embedding: vector(1) },
        { index: 2, embedding: vector(2) },
      ],
    },
    {
      data: [
        { index: 0, embedding: vector(1) },
        { index: 1.5, embedding: vector(2) },
      ],
    },
  ];

  for (const payload of invalidPayloads) {
    await assertProviderError(
      () =>
        createOpenAiEmbeddings(
          ["first", "second"],
          "key",
          () => Promise.resolve(jsonResponse(payload)),
        ),
      "embedding-invalid-response",
    );
  }
});

Deno.test("createOpenAiEmbeddings maps invalid JSON to a stable response error", async () => {
  const fetchMock: typeof fetch = () =>
    Promise.resolve(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

  await assertProviderError(
    () => createOpenAiEmbeddings(["query"], "key", fetchMock),
    "embedding-invalid-response",
  );
});

Deno.test("createOpenAiEmbeddings maps a fetch timeout without leaking the API key", async () => {
  const timeout = new DOMException("The operation timed out", "TimeoutError");
  const fetchMock: typeof fetch = (_url, init) => {
    assert(init?.signal instanceof AbortSignal, "timeout signal is required");
    return Promise.reject(timeout);
  };

  await assertProviderError(
    () => createOpenAiEmbeddings(["query"], "sensitive-test-key", fetchMock),
    "embedding-timeout",
  );
});

Deno.test("createOpenAiEmbeddings maps AbortError and network failures separately", async () => {
  await assertProviderError(
    () =>
      createOpenAiEmbeddings(
        ["query"],
        "key",
        () => Promise.reject(new DOMException("aborted", "AbortError")),
      ),
    "embedding-timeout",
  );
  await assertProviderError(
    () =>
      createOpenAiEmbeddings(
        ["query"],
        "key",
        () => Promise.reject(new TypeError("connection failed")),
      ),
    "embedding-provider-unavailable",
  );
});

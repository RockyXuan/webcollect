import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./validation.ts";

export class EmbeddingProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "EmbeddingProviderError";
  }
}

interface OpenAiEmbeddingPayload {
  data?: Array<{ index?: number; embedding?: unknown }>;
}

export async function createOpenAiEmbeddings(
  inputs: string[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number[][]> {
  if (!apiKey) throw new EmbeddingProviderError("embedding-not-configured");
  let response: Response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: inputs,
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new EmbeddingProviderError("embedding-timeout");
    }
    throw new EmbeddingProviderError("embedding-provider-unavailable");
  }

  if (response.status === 429) {
    throw new EmbeddingProviderError("embedding-rate-limited");
  }
  if (!response.ok) {
    throw new EmbeddingProviderError("embedding-provider-failed");
  }
  let payload: OpenAiEmbeddingPayload;
  try {
    payload = await response.json() as OpenAiEmbeddingPayload;
  } catch {
    throw new EmbeddingProviderError("embedding-invalid-response");
  }
  if (!Array.isArray(payload.data) || payload.data.length !== inputs.length) {
    throw new EmbeddingProviderError("embedding-invalid-response");
  }

  const embeddingsByIndex = new Map<number, number[]>();
  for (const item of payload.data) {
    const index = item.index;
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= inputs.length ||
      embeddingsByIndex.has(index) ||
      !Array.isArray(item.embedding) ||
      item.embedding.length !== EMBEDDING_DIMENSIONS ||
      item.embedding.some((value) =>
        typeof value !== "number" || !Number.isFinite(value)
      )
    ) {
      throw new EmbeddingProviderError("embedding-invalid-response");
    }
    embeddingsByIndex.set(index, item.embedding as number[]);
  }

  return Array.from({ length: inputs.length }, (_, index) => {
    const embedding = embeddingsByIndex.get(index);
    if (!embedding) {
      throw new EmbeddingProviderError("embedding-invalid-response");
    }
    return embedding;
  });
}

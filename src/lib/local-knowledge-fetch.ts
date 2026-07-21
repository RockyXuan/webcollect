import { isChromeExtension } from "@/lib/platform";

const MAX_DOCUMENT_CHARACTERS = 6_000;

export interface PublicKnowledgeResult {
  resolvedUrl: string;
  text: string;
  truncated: boolean;
  segmentCount: number;
}

export interface PublicKnowledgeRequestOptions {
  signal?: AbortSignal;
  expectedUserId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateResult(data: unknown): PublicKnowledgeResult {
  if (!isRecord(data)) throw new Error("public-knowledge-invalid-response");
  const resolvedUrl = typeof data.resolvedUrl === "string" ? data.resolvedUrl : "";
  const text = typeof data.text === "string" ? data.text : "";
  const truncated = data.truncated;
  const segmentCount = data.segmentCount;
  let protocol = "";
  try {
    protocol = new URL(resolvedUrl).protocol;
  } catch {
    throw new Error("public-knowledge-invalid-response");
  }
  if (
    (protocol !== "http:" && protocol !== "https:")
    || Array.from(text).length > MAX_DOCUMENT_CHARACTERS
    || typeof truncated !== "boolean"
    || typeof segmentCount !== "number"
    || !Number.isInteger(segmentCount)
    || segmentCount < 0
  ) {
    throw new Error("public-knowledge-invalid-response");
  }
  return { resolvedUrl, text, truncated, segmentCount };
}

export async function fetchPublicKnowledge(
  value: string,
  options: PublicKnowledgeRequestOptions = {},
): Promise<PublicKnowledgeResult> {
  let url: string;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("public-knowledge-invalid-url");
    }
    url = parsed.toString();
  } catch {
    throw new Error("public-knowledge-invalid-url");
  }
  if (!isChromeExtension()) {
    throw new Error("public-knowledge-web-oauth-unavailable");
  }
  if (options.signal?.aborted) throw new DOMException("aborted", "AbortError");
  const response = await chrome.runtime.sendMessage({ type: "FETCH_KNOWLEDGE", url });
  if (options.signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (!isRecord(response) || response.success !== true) {
    throw new Error("public-knowledge-fetch-failed");
  }
  return validateResult(response.data);
}

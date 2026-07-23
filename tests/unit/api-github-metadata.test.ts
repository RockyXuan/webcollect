import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchRemoteTextMock } = vi.hoisted(() => ({
  fetchRemoteTextMock: vi.fn(),
}));

vi.mock("@/lib/safe-remote-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safe-remote-fetch")>();
  return {
    ...actual,
    fetchRemoteText: fetchRemoteTextMock,
  };
});

import { POST as fetchMeta } from "@/app/api/fetch-meta/route";

function metadataRequest(url: string): Request {
  return new Request("http://localhost/api/fetch-meta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

describe("GitHub metadata API fallback", () => {
  beforeEach(() => {
    fetchRemoteTextMock.mockReset();
  });

  it("still returns a repository title and README summary when the GitHub HTML request times out", async () => {
    fetchRemoteTextMock
      .mockRejectedValueOnce(new Error("aborted"))
      .mockResolvedValueOnce({
        response: new Response("", { status: 200, headers: { "content-type": "text/plain" } }),
        text: "# codex-slides\n\nThe open-source AI slide studio that turns a prompt into an editable presentation.",
        url: "https://raw.githubusercontent.com/nexu-io/codex-slides/HEAD/README.md",
      });

    const response = await fetchMeta(metadataRequest("https://github.com/nexu-io/codex-slides"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      title: "codex-slides",
      description: "The open-source AI slide studio that turns a prompt into an editable presentation.",
      descriptionSource: "github-readme",
    });
  });

  it("falls back to page metadata when README candidates fail", async () => {
    fetchRemoteTextMock
      .mockResolvedValueOnce({
        response: new Response("", { status: 200, headers: { "content-type": "text/html" } }),
        text: "<title>Long GitHub title</title><meta name=\"description\" content=\"Project About description\">",
        url: "https://github.com/nexu-io/codex-slides",
      })
      .mockRejectedValue(new Error("README unavailable"));

    const response = await fetchMeta(metadataRequest("https://github.com/nexu-io/codex-slides"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      title: "codex-slides",
      description: "Project About description",
      descriptionSource: "page",
    });
  });
});

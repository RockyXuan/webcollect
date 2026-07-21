import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/knowledge/fetch/route";

describe("knowledge fetch route", () => {
  it("keeps Web public-page fetching unavailable until Web OAuth exists", async () => {
    const response = await POST(new Request("http://localhost/api/knowledge/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "web-google-drive-auth-unavailable" });
  });
});

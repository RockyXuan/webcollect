import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/knowledge/fetch/route";

describe("knowledge fetch route", () => {
  it("rejects unauthenticated requests before any remote page fetch", async () => {
    const response = await POST(new Request("http://localhost/api/knowledge/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authentication-required" });
  });
});

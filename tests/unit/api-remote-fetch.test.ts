import { describe, expect, it, vi } from "vitest";
import { POST as fetchMeta } from "@/app/api/fetch-meta/route";
import { POST as checkSafety } from "@/app/api/check-safety/route";

describe("remote fetch API boundaries", () => {
  it("blocks private metadata targets before issuing a network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await fetchMeta(new Request("http://localhost/api/fetch-meta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data" }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/私网|链路本地|保留地址/),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("marks private targets as danger in the basic check", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await checkSafety(new Request("http://localhost/api/check-safety", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls: ["http://127.0.0.1/admin"] }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      results: Array<{ status: string; details: string[] }>;
    };
    expect(payload.results[0].status).toBe("danger");
    expect(payload.results[0].details.join(" ")).toMatch(/私网|链路本地|保留地址/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

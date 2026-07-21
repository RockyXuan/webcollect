import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/supabase-config/route";

describe("retired Supabase runtime endpoint", () => {
  it("returns a permanent retirement response without exposing any project configuration", async () => {
    const response = await GET();
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(410);
    expect(payload).toEqual({ error: "supabase-runtime-retired" });
    expect(JSON.stringify(payload)).not.toMatch(/anonKey|https:\/\//);
  });
});

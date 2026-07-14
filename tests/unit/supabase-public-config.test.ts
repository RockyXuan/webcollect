import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/supabase-config/route";

const originalUrl = process.env.COZE_SUPABASE_URL;
const originalAnonKey = process.env.COZE_SUPABASE_ANON_KEY;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.COZE_SUPABASE_URL;
  else process.env.COZE_SUPABASE_URL = originalUrl;

  if (originalAnonKey === undefined) delete process.env.COZE_SUPABASE_ANON_KEY;
  else process.env.COZE_SUPABASE_ANON_KEY = originalAnonKey;
});

describe("public Supabase configuration", () => {
  it("keeps Google login available in a local WebCollect checkout without private env files", async () => {
    delete process.env.COZE_SUPABASE_URL;
    delete process.env.COZE_SUPABASE_ANON_KEY;

    const response = await GET();
    const payload = await response.json() as { url?: string; anonKey?: string };

    expect(response.status).toBe(200);
    expect(payload.url).toBe("https://qxlkigwadvgkoeqdojxx.supabase.co");
    expect(payload.anonKey).toMatch(/^eyJ/);
  });

  it("only exposes the RLS-protected anon role for the WebCollect project", async () => {
    delete process.env.COZE_SUPABASE_URL;
    delete process.env.COZE_SUPABASE_ANON_KEY;

    const response = await GET();
    const payload = await response.json() as { anonKey: string };
    const jwtPayload = JSON.parse(
      Buffer.from(payload.anonKey.split(".")[1], "base64url").toString("utf8")
    ) as { role?: string; ref?: string };

    expect(jwtPayload).toMatchObject({
      role: "anon",
      ref: "qxlkigwadvgkoeqdojxx",
    });
  });

  it("prefers an explicit deployment configuration", async () => {
    process.env.COZE_SUPABASE_URL = "https://configured.supabase.co";
    process.env.COZE_SUPABASE_ANON_KEY = "configured-anon-key";

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://configured.supabase.co",
      anonKey: "configured-anon-key",
    });
  });
});

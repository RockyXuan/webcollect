import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  pnpm?: { overrides?: Record<string, string> };
};

describe("production dependency surface", () => {
  it("does not ship unused high-risk dependency trees", () => {
    for (const dependency of [
      "@aws-sdk/client-s3",
      "@aws-sdk/lib-storage",
      "coze-coding-dev-sdk",
      "recharts",
      "drizzle-kit",
      "drizzle-orm",
      "drizzle-zod",
      "pg",
    ]) {
      expect(packageJson.dependencies).not.toHaveProperty(dependency);
    }
  });

  it("keeps schema tooling development-only and pins the patched HTTP client", () => {
    expect(packageJson.devDependencies).toHaveProperty("drizzle-orm");
    expect(packageJson.pnpm?.overrides?.["@babel/core"]).toBe("7.29.6");
    expect(packageJson.pnpm?.overrides?.postcss).toBe("8.5.10");
    expect(packageJson.pnpm?.overrides?.undici).toBe("7.28.0");
  });

  it("does not wrap Supabase fetches with the removed reporting SDK", () => {
    const source = readFileSync("src/storage/database/supabase-client.ts", "utf8");
    expect(source).not.toContain("coze-coding-dev-sdk");
    expect(source).not.toContain("createWrappedFetch");
    expect(source).not.toContain("getReportBuffer");
  });

  it("reads Supabase configuration without spawning legacy Coze helpers", () => {
    for (const file of [
      "src/app/api/supabase-config/route.ts",
      "src/storage/database/supabase-client.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("child_process");
      expect(source).not.toContain("execSync");
      expect(source).not.toContain("coze_workload_identity");
      expect(source).not.toContain("python3");
    }
  });

  it("never falls back to a service-role key for ordinary app clients", () => {
    const source = readFileSync("src/storage/database/supabase-client.ts", "utf8");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("getSupabaseServiceRoleKey");
  });
});

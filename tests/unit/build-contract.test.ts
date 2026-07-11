import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("production build contract", () => {
  it("uses the Next compiler instead of a global Babel development plugin", () => {
    expect(existsSync(".babelrc")).toBe(false);
    expect(read("src/app/layout.tsx")).not.toContain("react-dev-inspector");
  });

  it("does not install dependencies during a build", () => {
    expect(read("scripts/build.sh")).not.toMatch(/pnpm\s+install/);
  });

  it("uses the pinned Corepack package manager in shell entry points", () => {
    expect(read("scripts/build.sh")).toContain("corepack pnpm@9.0.0 exec next build");
    expect(read("scripts/dev.sh")).toContain("corepack pnpm@9.0.0 exec tsx watch");
  });

  it("enforces pnpm without invoking npx during installation", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.preinstall).toBe("node ./scripts/enforce-pnpm.mjs");
  });
});

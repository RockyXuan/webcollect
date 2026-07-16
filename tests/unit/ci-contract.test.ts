import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("continuous integration contract", () => {
  it("runs every release-grade command on main and pull requests", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain("run: pnpm audit:prod");
    expect(workflow).toContain("run: pnpm test:legacy");
    expect(workflow).toContain("run: pnpm build\n");
    expect(workflow).toContain("run: pnpm build:ext");
    expect(workflow).toContain("run: pnpm test:extension-artifact");
    expect(workflow).toContain("run: pnpm test:extension-size");
    expect(workflow).toContain("run: pnpm test:e2e");

    const releaseWorkflow = readFileSync(
      ".github/workflows/webcollect-release.yml",
      "utf8"
    );
    expect(releaseWorkflow).toContain("run: pnpm audit:prod");
  });
});

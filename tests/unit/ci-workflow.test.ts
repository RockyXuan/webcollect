import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("continuous integration workflow", () => {
  it("uses the supported bulk-advisory client without skipping the verification suite", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const auditJob = workflow.indexOf("audit-production:");
    const verifyJob = workflow.indexOf("verify:");

    expect(auditJob).toBeGreaterThan(-1);
    expect(verifyJob).toBeGreaterThan(auditJob);
    expect(workflow).toContain('node-version: "24"');
    expect(workflow).toContain("npx --yes pnpm@11.13.0 audit --prod --audit-level=high");
    expect(workflow.slice(auditJob, verifyJob)).not.toContain("pnpm/action-setup");
    expect(workflow.slice(verifyJob)).not.toContain("pnpm audit");
  });
});

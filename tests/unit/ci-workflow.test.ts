import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("continuous integration workflow", () => {
  it("uses the supported bulk-advisory client without skipping the verification suite", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const auditJob = workflow.indexOf("audit-production:");
    const verifyJob = workflow.indexOf("verify:");

    expect(auditJob).toBeGreaterThan(-1);
    expect(verifyJob).toBeGreaterThan(auditJob);
    expect(workflow).toContain('node-version: "20"');
    expect(workflow.slice(auditJob, verifyJob)).toContain("pnpm/action-setup");
    expect(workflow.slice(auditJob, verifyJob)).toContain("pnpm install --frozen-lockfile");
    expect(workflow.slice(auditJob, verifyJob)).toContain("pnpm audit:prod");
    expect(workflow).not.toContain("pnpm_config_pm_on_fail");
    expect(workflow).not.toContain("npx --yes pnpm@11.13.0 audit");
    expect(workflow.slice(verifyJob)).not.toContain("pnpm audit:prod");
  });
});

import { describe, expect, it } from "vitest";

import {
  collectPackageVersions,
  summarizeAdvisories,
} from "../../scripts/audit-production.mjs";

describe("production dependency audit", () => {
  it("collects and deduplicates exact versions from the production dependency tree", () => {
    const inventory = collectPackageVersions([
      {
        dependencies: {
          alpha: {
            version: "1.0.0",
            dependencies: {
              shared: { version: "2.0.0" },
            },
          },
          beta: {
            version: "3.0.0",
            optionalDependencies: {
              shared: { version: "2.1.0" },
              local: { version: "link:../local" },
            },
          },
        },
      },
    ]);

    expect(inventory).toEqual({
      alpha: ["1.0.0"],
      beta: ["3.0.0"],
      shared: ["2.0.0", "2.1.0"],
    });
  });

  it("fails the high threshold only for high and critical advisories", () => {
    const summary = summarizeAdvisories({
      alpha: [
        { id: 1, severity: "moderate", title: "Moderate issue" },
        { id: 2, severity: "high", title: "High issue" },
      ],
      beta: [{ id: 3, severity: "critical", title: "Critical issue" }],
    });

    expect(summary.counts).toMatchObject({ moderate: 1, high: 1, critical: 1 });
    expect(summary.blocking.map((advisory) => advisory.id)).toEqual([2, 3]);
  });

  it("rejects malformed API payloads instead of silently passing", () => {
    expect(() => summarizeAdvisories({ alpha: { severity: "high" } })).toThrow(
      "invalid advisories"
    );
  });
});

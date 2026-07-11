import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePorcelainPaths, validateReleaseState } from "../../scripts/release-preflight.mjs";

const validState = {
  branch: "main",
  dirtyPaths: [],
  head: "abc123",
  remoteMain: "abc123",
  packageVersion: "1.1.0",
  manifestVersion: "1.1.0",
  appVersion: "1.1.0",
  releaseDate: "2026-07-12",
  tag: "webcollect-2026-07-12-v1.1.0",
  staticArtifactExists: false,
  builtManifestVersion: "1.1.0",
  existingTagCommit: "",
};

describe("extension release preflight", () => {
  it("preserves leading dots in porcelain paths", () => {
    expect(parsePorcelainPaths(" M .github/workflows/release.yml\n?? new-file.ts\n")).toEqual([
      ".github/workflows/release.yml",
      "new-file.ts",
    ]);
  });

  it("accepts one clean, pushed, version-aligned main commit", () => {
    expect(validateReleaseState(validState)).toEqual([]);
  });

  it.each([
    ["feature branch", { branch: "fix/sync-architecture" }, "main branch"],
    ["dirty worktree", { dirtyPaths: ["src/lib/store.ts"] }, "worktree"],
    ["unpushed commit", { remoteMain: "older" }, "origin/main"],
    ["manifest mismatch", { manifestVersion: "1.0.3" }, "versions"],
    ["wrong tag", { tag: "webcollect-2026-07-12-deadbee" }, "release tag"],
    ["reused tag", { existingTagCommit: "another" }, "another commit"],
    ["stale static artifact", { staticArtifactExists: true }, "public/extension-dist"],
    ["stale built artifact", { builtManifestVersion: "1.0.3" }, "built extension"],
  ])("rejects %s", (_label, override, expectedMessage) => {
    const errors = validateReleaseState({ ...validState, ...override });
    expect(errors.join("\n")).toContain(expectedMessage);
  });

  it("keeps the release shell guarded before and after building", () => {
    const script = readFileSync("scripts/release-extension.sh", "utf8");
    const firstPreflight = script.indexOf('release-preflight.mjs" "${TAG}"');
    const build = script.indexOf("build:ext");
    const builtPreflight = script.indexOf('release-preflight.mjs" "${TAG}" --built');
    expect(firstPreflight).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(firstPreflight);
    expect(builtPreflight).toBeGreaterThan(build);
    expect(script).toContain("fetch origin main --tags");
    expect(script).toContain("test:extension-artifact");
  });
});

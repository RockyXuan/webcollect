import { describe, expect, it } from "vitest";

import {
  buildGitHubReadmeCandidateUrls,
  extractGitHubReadmeSummary,
  githubRepositoryTitleFromUrl,
  parseGitHubRepositoryUrl,
} from "../../shared/github-repository.js";

describe("GitHub repository metadata", () => {
  it("identifies repository roots and subpages without confusing profile or product routes", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/nexu-io/codex-slides")).toMatchObject({
      owner: "nexu-io",
      repository: "codex-slides",
    });
    expect(githubRepositoryTitleFromUrl("https://github.com/nexu-io/codex-slides/tree/main/docs")).toBe("codex-slides");
    expect(githubRepositoryTitleFromUrl("https://github.com/nexu-io/codex-slides.git")).toBe("codex-slides");
    expect(parseGitHubRepositoryUrl("https://github.com/nexu-io")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://github.com/settings/profile")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://github.com/topics/ai")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://gitlab.com/nexu-io/codex-slides")).toBeNull();
  });

  it("builds bounded raw README candidates against the repository default branch", () => {
    const candidates = buildGitHubReadmeCandidateUrls("https://github.com/nexu-io/codex-slides/issues/1");
    expect(candidates).toHaveLength(5);
    expect(candidates[0]).toBe("https://raw.githubusercontent.com/nexu-io/codex-slides/HEAD/README.md");
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it("extracts the first project paragraph while ignoring badges, headings, lists, and code", () => {
    const summary = extractGitHubReadmeSummary(`
# Codex Slides

[![Build](https://img.shields.io/build.svg)](https://example.com)
![Preview](./preview.png)

Open-source AI slide studio for creating image-native presentations, reviewing every slide on a visual canvas, and exporting the finished deck.

## Install

\`\`\`bash
pnpm install
\`\`\`
`);

    expect(summary).toBe(
      "Open-source AI slide studio for creating image-native presentations, reviewing every slide on a visual canvas, and exporting the finished deck."
    );
  });

  it("supports RST-style headings and cleans inline Markdown links", () => {
    const summary = extractGitHubReadmeSummary(`
Codex Slides
============

.. image:: https://example.com/badge.svg

[Codex Slides](https://example.com) turns repository content into editable presentations and keeps the complete workflow in the browser.
`);

    expect(summary).toBe(
      "Codex Slides turns repository content into editable presentations and keeps the complete workflow in the browser."
    );
  });

  it("returns an empty result when a README contains only navigation and commands", () => {
    expect(extractGitHubReadmeSummary(`
# Project

- [Install](#install)
- [Usage](#usage)

\`\`\`sh
npm install
\`\`\`
`)).toBe("");
  });
});

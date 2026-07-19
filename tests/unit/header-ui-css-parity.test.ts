import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webCss = readFileSync("src/app/globals.css", "utf8");
const extensionCss = readFileSync("extension/src/extension.css", "utf8");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedRule(css: string, selector: string): string {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]+)\\}`));
  expect(match, `missing CSS rule: ${selector}`).not.toBeNull();
  return (match?.[1] || "").replace(/\s+/g, " ").trim();
}

describe("header UI CSS parity", () => {
  it.each([
    ".wc-sync-status-badge",
    ".wc-sync-status-badge:hover",
    ".wc-sync-status-badge:disabled",
    ".wc-sync-status-icon.is-success",
    ".wc-sync-status-icon.is-syncing",
    ".wc-sync-status-icon.is-error",
    ".wc-sync-status-line",
    ".wc-header-tool,\n.wc-header-primary",
    ".wc-header-tool",
    ".wc-header-tool:hover",
    ".wc-header-save",
    ".wc-header-tool-quiet",
    ".wc-wallpaper-quick-control",
    ".wc-login-button",
    ".wc-login-button:hover",
    ".wc-account-button",
    ".wc-account-button:hover",
    ".wc-round-tool",
    ".wc-round-tool:hover",
    ".wc-resolution-canvas .wc-header-tool,\n.wc-resolution-canvas .wc-header-primary",
  ])("keeps %s identical in Web and extension styles", (selector) => {
    expect(normalizedRule(extensionCss, selector)).toBe(normalizedRule(webCss, selector));
  });

  it("keeps shared search and view-mode styles in both builds", () => {
    for (const source of [webCss, extensionCss]) {
      expect(source).toMatch(/@import ['"][^'"]*mindmap\.css['"]/);
      expect(source).toMatch(/@import ['"][^'"]*search\.css['"]/);
    }
  });
});

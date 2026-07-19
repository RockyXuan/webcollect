import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SyncStatusBadge } from "@/components/auth/user-menu";
import { useAuthStore } from "@/lib/auth-store";

describe("SyncStatusBadge", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState(useAuthStore.getInitialState(), true);
  });

  it.each([
    ["success", "is-success"],
    ["syncing", "is-syncing"],
    ["error", "is-error"],
  ] as const)("keeps %s color on the icon instead of the badge surface", (syncStatus, toneClass) => {
    useAuthStore.setState({
      isLoggedIn: true,
      syncStatus,
      localSavedAt: null,
      lastSyncAt: Date.now(),
      error: syncStatus === "error" ? "同步失败" : null,
    });

    const { container } = render(<SyncStatusBadge />);
    const badge = screen.getByRole("button");
    expect(badge).toHaveClass("wc-sync-status-badge", toneClass);
    expect(badge.className).not.toMatch(/border-(emerald|blue|rose)|bg-(emerald|blue|rose)|text-(emerald|blue|rose)/);
    expect(container.querySelector(`.wc-sync-status-icon.${toneClass}`)).not.toBeNull();
    expect(container.querySelector(".wc-sync-status-line")?.className).toBe("wc-sync-status-line");
  });
});

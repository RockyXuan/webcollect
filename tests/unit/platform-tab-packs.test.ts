import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("tab-pack batch opening", () => {
  it("opens web URLs without an opener and focuses only the first tab when requested", async () => {
    const opened = Array.from({ length: 3 }, () => ({ opener: window, focus: vi.fn() }));
    const open = vi.spyOn(window, "open")
      .mockReturnValueOnce(opened[0] as unknown as Window)
      .mockReturnValueOnce(opened[1] as unknown as Window)
      .mockReturnValueOnce(null);
    const { openTabPackUrls } = await import("@/lib/platform");

    const result = await openTabPackUrls([
      "https://example.com/one",
      "https://example.com/two",
      "https://example.com/blocked",
    ], "first-active");

    expect(result).toEqual({ requested: 3, opened: 2, blocked: 1 });
    expect(open).toHaveBeenCalledTimes(3);
    expect(opened[0].opener).toBeNull();
    expect(opened[1].opener).toBeNull();
    expect(opened[0].focus).toHaveBeenCalledOnce();
    expect(opened[1].focus).not.toHaveBeenCalled();
  });

  it("creates extension tabs in the background and activates the first only after creation", async () => {
    const create = vi.fn((options: { url: string; active: boolean }, callback: (tab: { id: number }) => void) => {
      callback({ id: create.mock.calls.length });
    });
    const update = vi.fn((_tabId: number, _options: { active: boolean }, callback: () => void) => callback());
    vi.stubGlobal("chrome", {
      runtime: { id: "stable-extension-id", lastError: undefined },
      tabs: { create, update },
    });
    const { openTabPackUrls } = await import("@/lib/platform");

    const result = await openTabPackUrls([
      "https://example.com/one",
      "https://example.com/two",
    ], "first-active");

    expect(result).toEqual({ requested: 2, opened: 2, blocked: 0 });
    expect(create.mock.calls.map(([options]) => options)).toEqual([
      { url: "https://example.com/one", active: false },
      { url: "https://example.com/two", active: false },
    ]);
    expect(update).toHaveBeenCalledWith(1, { active: true }, expect.any(Function));
  });
});

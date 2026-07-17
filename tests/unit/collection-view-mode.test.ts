import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLLECTION_VIEW_MODE_KEY,
  readCollectionViewMode,
  writeCollectionViewMode,
} from "@/lib/collection-view-mode";

describe("collection view mode preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to classic and round-trips both legal values", () => {
    expect(readCollectionViewMode()).toBe("classic");
    writeCollectionViewMode("mindmap");
    expect(readCollectionViewMode()).toBe("mindmap");
    writeCollectionViewMode("classic");
    expect(readCollectionViewMode()).toBe("classic");
  });

  it("falls back without deleting a malformed legacy value", () => {
    window.localStorage.setItem(COLLECTION_VIEW_MODE_KEY, "retired-mode");
    expect(readCollectionViewMode()).toBe("classic");
    expect(window.localStorage.getItem(COLLECTION_VIEW_MODE_KEY)).toBe("retired-mode");
  });

  it("keeps the app usable when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new DOMException("blocked");
    });
    expect(readCollectionViewMode()).toBe("classic");

    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("blocked");
    });
    expect(() => writeCollectionViewMode("mindmap")).not.toThrow();
  });
});

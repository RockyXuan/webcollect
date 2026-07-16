import { beforeEach, describe, expect, it } from "vitest";
import localforage from "localforage";
import {
  loadMindmapViewState,
  mindmapViewStateKey,
  normalizeMindmapViewState,
  saveMindmapViewState,
} from "@/lib/mindmap-view-state";

const db = localforage.createInstance({ name: "WebCollect", storeName: "webcollect_data" });

describe("mindmap view state", () => {
  beforeEach(async () => {
    await db.removeItem(mindmapViewStateKey("unit-section"));
  });

  it("normalizes corrupt camera and stale node ids in memory", () => {
    const normalized = normalizeMindmapViewState({
      layout: "unknown",
      collapsed: ["cat:valid", "cat:stale", 42],
      offsets: {
        "logic-right": {
          "cat:valid": { dx: 12, dy: -8 },
          "cat:stale": { dx: 7, dy: 9 },
          broken: { dx: Number.NaN, dy: 2 },
        },
      },
      camera: { x: Number.NaN, y: 40, k: 99 },
    }, new Set(["cat:valid"]));

    expect(normalized.layout).toBe("logic-right");
    expect(normalized.collapsed).toEqual(["cat:valid"]);
    expect(normalized.offsets["logic-right"]).toEqual({ "cat:valid": { dx: 12, dy: -8 } });
    expect(normalized.camera).toEqual({ x: 0, y: 40, k: 2 });
  });

  it("writes only its section key and restores the safe state", async () => {
    const originalCards = await db.getItem("cards");
    const originalDirtySets = await db.getItem("syncDirtySets");
    try {
      await db.setItem("cards", [{ id: "protected-card" }]);
      await db.setItem("syncDirtySets", { cards: ["protected-card"], categories: [] });
      await saveMindmapViewState("unit-section", {
        layout: "bilateral",
        collapsed: ["cat:one"],
        offsets: {
          "logic-right": {},
          bilateral: { "cat:one": { dx: 20, dy: 10 } },
          "tree-down": {},
          indent: {},
        },
        camera: { x: 300, y: 200, k: 1.25 },
        updatedAt: 123,
      });

      expect(await loadMindmapViewState("unit-section", new Set(["cat:one"]))).toEqual({
        exists: true,
        state: {
          layout: "bilateral",
          collapsed: ["cat:one"],
          offsets: {
            "logic-right": {},
            bilateral: { "cat:one": { dx: 20, dy: 10 } },
            "tree-down": {},
            indent: {},
          },
          camera: { x: 300, y: 200, k: 1.25 },
          updatedAt: 123,
        },
      });
      expect(await db.getItem("cards")).toEqual([{ id: "protected-card" }]);
      expect(await db.getItem("syncDirtySets")).toEqual({ cards: ["protected-card"], categories: [] });
    } finally {
      if (originalCards === null) await db.removeItem("cards");
      else await db.setItem("cards", originalCards);
      if (originalDirtySets === null) await db.removeItem("syncDirtySets");
      else await db.setItem("syncDirtySets", originalDirtySets);
    }
  });
});

import { describe, expect, it } from "vitest";
import { indexMindmapNodes } from "@/components/mindmap/tree-index";
import type { MindmapNode } from "@/components/mindmap/types";

function largeTree(cardCount: number): MindmapNode {
  return {
    id: "sec:section-default",
    type: "section",
    refId: "section-default",
    label: "主页",
    children: [{
      id: "cat:large",
      type: "category",
      refId: "large",
      label: "大树",
      children: [{
        id: "grp:large",
        type: "group",
        refId: "large",
        label: "网页",
        children: Array.from({ length: cardCount }, (_, index) => ({
          id: `card:${index}`,
          type: "card" as const,
          refId: String(index),
          label: `Card ${index}`,
          children: [],
        })),
      }],
    }],
  };
}

describe("mindmap node index", () => {
  it("computes parent links and every descendant count in one traversal", () => {
    const index = indexMindmapNodes(largeTree(330));
    expect(Object.keys(index.nodes)).toHaveLength(333);
    expect(index.parentIds["card:329"]).toBe("grp:large");
    expect(index.descendantCounts["sec:section-default"]).toBe(332);
    expect(index.descendantCounts["cat:large"]).toBe(331);
    expect(index.descendantCounts["grp:large"]).toBe(330);
    expect(index.descendantCounts["card:329"]).toBe(0);
  });
});

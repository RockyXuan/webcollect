import { describe, expect, it } from "vitest";
import type { Category, CollectionSection, WebCard } from "@/lib/types";
import {
  buildMindmapTree,
  fitCamera,
  layoutBilateral,
  layoutIndent,
  layoutLogicRight,
  layoutTreeDown,
} from "@/components/mindmap/layout-engine";

const sections: CollectionSection[] = [
  { id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 },
  { id: "section-work", name: "工作", order: 1, createdAt: 2, updatedAt: 2 },
];

const categories: Category[] = [
  { id: "cat-b", name: "第二分类", icon: "star", color: "#8b5cf6", order: 2, createdAt: 2, sectionId: "section-default", isParent: true },
  { id: "cat-a", name: "第一分类", icon: "star", color: "#10b981", order: 1, createdAt: 1, sectionId: "section-default", isParent: true },
  { id: "group-a", name: "分组", icon: "star", color: "#10b981", order: 0, createdAt: 3, sectionId: "section-default", parentId: "cat-a" },
  { id: "cat-empty", name: "空分类", icon: "star", color: "#f97316", order: 3, createdAt: 4, sectionId: "section-default" },
  { id: "cat-orphan", name: "孤立分类", icon: "star", color: "#64748b", order: 4, createdAt: 5, sectionId: "section-default", parentId: "missing" },
  { id: "cat-work", name: "其他分项", icon: "star", color: "#ef4444", order: 0, createdAt: 6, sectionId: "section-work" },
];

const card = (id: string, categoryId: string, order: number): WebCard => ({
  id,
  categoryId,
  order,
  createdAt: order + 10,
  updatedAt: order + 10,
  url: `https://${id}.example.com`,
  title: id,
  shortDesc: `${id} description`,
  fullDesc: "",
  note: "",
  abbreviation: id.slice(0, 1).toUpperCase(),
  imageUrl: "",
});

const cards = [
  card("card-group-2", "group-a", 2),
  card("card-group-1", "group-a", 1),
  card("card-direct", "cat-a", 0),
  card("card-independent", "cat-b", 0),
  card("card-orphan", "missing-category", 0),
  card("card-other-section", "cat-work", 0),
];

function rectanglesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe("mindmap tree builder", () => {
  it("sorts hierarchy, keeps empty and malformed data, and excludes other sections", () => {
    const tree = buildMindmapTree(sections, categories, cards, "section-default");

    expect(tree.id).toBe("sec:section-default");
    expect(tree.children.map((node) => node.id)).toEqual([
      "cat:cat-a",
      "cat:cat-b",
      "cat:cat-empty",
      "cat:cat-orphan",
      "card:card-orphan",
    ]);
    expect(tree.children[0].children.map((node) => node.id)).toEqual(["grp:group-a", "card:card-direct"]);
    expect(tree.children[0].children[0].children.map((node) => node.id)).toEqual([
      "card:card-group-1",
      "card:card-group-2",
    ]);
    expect(tree.children[2].children).toEqual([]);
    expect(JSON.stringify(tree)).not.toContain("card-other-section");
  });

  it("does not mutate source collections", () => {
    const before = JSON.stringify({ sections, categories, cards });
    buildMindmapTree(sections, categories, cards, "section-default");
    expect(JSON.stringify({ sections, categories, cards })).toBe(before);
  });
});

describe("mindmap layout engine", () => {
  const tree = buildMindmapTree(sections, categories, cards, "section-default");
  const layouts = [layoutLogicRight, layoutBilateral, layoutTreeDown, layoutIndent];

  it.each(layouts)("produces finite, non-overlapping positions", (layout) => {
    const result = layout(tree);
    const positions = Object.values(result.positions);
    for (const position of positions) {
      expect(Object.values(position).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
    }
    for (let index = 0; index < positions.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < positions.length; otherIndex += 1) {
        expect(rectanglesOverlap(positions[index], positions[otherIndex])).toBe(false);
      }
    }
    expect(result.edges).toHaveLength(positions.length - 1);
    expect(result.edges.every((edge) => edge.path.includes("NaN") === false)).toBe(true);
  });

  it("removes collapsed descendants from positions and edges", () => {
    const result = layoutLogicRight(tree, new Set(["cat:cat-a"]));
    expect(result.positions["cat:cat-a"]).toBeDefined();
    expect(result.positions["grp:group-a"]).toBeUndefined();
    expect(result.positions["card:card-direct"]).toBeUndefined();
    expect(result.edges.some((edge) => edge.parentId === "cat:cat-a")).toBe(false);
  });

  it("stacks cards vertically in the tree-down group spine", () => {
    const result = layoutTreeDown(tree);
    const first = result.positions["card:card-group-1"];
    const second = result.positions["card:card-group-2"];
    expect(first.x).toBe(second.x);
    expect(second.y).toBeGreaterThan(first.y + first.height);
  });

  it("fits bounds inside the rail-aware 60px viewport margin and clamps zoom", () => {
    const bounds = { minX: -100, minY: 20, maxX: 900, maxY: 620 };
    const viewport = { width: 1920, height: 1080 };
    const camera = fitCamera(bounds, viewport);
    const left = bounds.minX * camera.k + camera.x;
    const right = bounds.maxX * camera.k + camera.x;
    const top = bounds.minY * camera.k + camera.y;
    const bottom = bounds.maxY * camera.k + camera.y;
    expect(camera.k).toBeGreaterThanOrEqual(0.25);
    expect(camera.k).toBeLessThanOrEqual(1.1);
    expect(left).toBeGreaterThanOrEqual(180);
    expect(right).toBeLessThanOrEqual(viewport.width - 60);
    expect(top).toBeGreaterThanOrEqual(60);
    expect(bottom).toBeLessThanOrEqual(viewport.height - 60);
    expect(fitCamera({ minX: 0, minY: 0, maxX: 100000, maxY: 100000 }, viewport).k).toBe(0.25);
    expect(fitCamera({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, viewport).k).toBe(1.1);
  });
});

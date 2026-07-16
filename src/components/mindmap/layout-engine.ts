import type { Category, CollectionSection, WebCard } from "@/lib/types";
import type {
  MindmapBounds,
  MindmapCamera,
  MindmapEdge,
  MindmapLayoutId,
  MindmapLayoutResult,
  MindmapNode,
  MindmapNodePosition,
  MindmapNodeType,
} from "./types";

const DEFAULT_SECTION_ID = "section-default";
const FALLBACK_COLOR = "#4f46e5";

export const MINDMAP_NODE_DIMENSIONS = {
  section: { height: 56, minWidth: 150 },
  category: { height: 46, minWidth: 130 },
  group: { height: 40, minWidth: 110 },
  card: { height: 44, width: 208 },
} as const;

const GAP_Y: Partial<Record<MindmapNodeType, number>> = {
  section: 40,
  category: 26,
  group: 12,
};
const GAP_X: Partial<Record<MindmapNodeType, number>> = {
  section: 96,
  category: 72,
  group: 56,
};
const DOWN_GAP_Y: Partial<Record<MindmapNodeType, number>> = {
  section: 92,
  category: 76,
  group: 64,
};
const DOWN_GAP_X = 20;
const INDENT = { amount: 44, gap: 12 } as const;

function stableEntitySort<T extends { id: string; order: number; createdAt: number }>(a: T, b: T): number {
  return a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

function sectionIdOf(category: Category): string {
  return category.sectionId || DEFAULT_SECTION_ID;
}

function cardNode(card: WebCard, color?: string): MindmapNode {
  return {
    id: `card:${card.id}`,
    type: "card",
    refId: card.id,
    label: card.title,
    color,
    url: card.url,
    shortDesc: card.shortDesc,
    imageUrl: card.imageUrl,
    abbreviation: card.abbreviation,
    children: [],
  };
}

/**
 * Derives the active collection section as a mindmap without mutating or mirroring
 * business data. Broken references are kept visible under the nearest safe root.
 */
export function buildMindmapTree(
  sections: readonly CollectionSection[],
  categories: readonly Category[],
  cards: readonly WebCard[],
  activeSectionId: string,
): MindmapNode {
  const section = sections.find((candidate) => candidate.id === activeSectionId)
    || sections.find((candidate) => candidate.id === DEFAULT_SECTION_ID)
    || sections[0];
  const resolvedSectionId = section?.id || activeSectionId || DEFAULT_SECTION_ID;
  const root: MindmapNode = {
    id: `sec:${resolvedSectionId}`,
    type: "section",
    refId: resolvedSectionId,
    label: section?.name || "主页",
    children: [],
  };

  const allCategoryIds = new Set(categories.map((category) => category.id));
  const sectionCategories = categories
    .filter((category) => sectionIdOf(category) === resolvedSectionId)
    .slice()
    .sort(stableEntitySort);
  const sectionCategoryIds = new Set(sectionCategories.map((category) => category.id));
  const cardsByCategory = new Map<string, WebCard[]>();
  const orphanCards: WebCard[] = [];

  for (const card of cards) {
    if (!allCategoryIds.has(card.categoryId)) {
      if (resolvedSectionId === DEFAULT_SECTION_ID) orphanCards.push(card);
      continue;
    }
    if (!sectionCategoryIds.has(card.categoryId)) continue;
    const bucket = cardsByCategory.get(card.categoryId) || [];
    bucket.push(card);
    cardsByCategory.set(card.categoryId, bucket);
  }
  for (const bucket of cardsByCategory.values()) bucket.sort(stableEntitySort);
  orphanCards.sort(stableEntitySort);

  const childrenByParent = new Map<string, Category[]>();
  const topLevel: Category[] = [];
  for (const category of sectionCategories) {
    if (!category.parentId || !sectionCategoryIds.has(category.parentId) || category.parentId === category.id) {
      topLevel.push(category);
      continue;
    }
    const bucket = childrenByParent.get(category.parentId) || [];
    bucket.push(category);
    childrenByParent.set(category.parentId, bucket);
  }
  for (const bucket of childrenByParent.values()) bucket.sort(stableEntitySort);

  const visited = new Set<string>();
  const makeCategoryNode = (category: Category, type: "category" | "group", lineage: Set<string>): MindmapNode => {
    visited.add(category.id);
    const nextLineage = new Set(lineage).add(category.id);
    const childCategories = (childrenByParent.get(category.id) || []).filter((child) => !nextLineage.has(child.id));
    const directCards = (cardsByCategory.get(category.id) || []).map((card) => cardNode(card, category.color));
    return {
      id: `${type === "category" ? "cat" : "grp"}:${category.id}`,
      type,
      refId: category.id,
      label: category.name,
      color: category.color,
      children: [
        ...childCategories.map((child) => makeCategoryNode(child, "group", nextLineage)),
        ...directCards,
      ],
    };
  };

  root.children = topLevel.map((category) => makeCategoryNode(category, "category", new Set()));

  // Cycles or malformed parent chains have no natural root. Preserve them as
  // independent categories instead of dropping user content.
  for (const category of sectionCategories) {
    if (!visited.has(category.id)) root.children.push(makeCategoryNode(category, "category", new Set()));
  }
  root.children.push(...orphanCards.map((card) => cardNode(card)));
  return root;
}

export function nodeWidth(node: MindmapNode): number {
  if (node.type === "card") return MINDMAP_NODE_DIMENSIONS.card.width;
  const base = node.type === "section" ? 66 : node.type === "category" ? 52 : 42;
  const per = node.type === "section" ? 17.5 : node.type === "category" ? 15 : 13.5;
  const visualLength = [...node.label].reduce(
    (sum, character) => sum + (character.charCodeAt(0) > 255 ? 1.8 : 1),
    0,
  );
  return Math.max(MINDMAP_NODE_DIMENSIONS[node.type].minWidth, Math.round(base + visualLength * per));
}

export function nodeHeight(node: MindmapNode): number {
  return MINDMAP_NODE_DIMENSIONS[node.type].height;
}

function visibleChildren(node: MindmapNode, collapsed: ReadonlySet<string>): readonly MindmapNode[] {
  return collapsed.has(node.id) ? [] : node.children;
}

function createPosition(node: MindmapNode, x: number, y: number): MindmapNodePosition {
  return { id: node.id, x, y, width: nodeWidth(node), height: nodeHeight(node) };
}

function subtreeHeight(node: MindmapNode, collapsed: ReadonlySet<string>): number {
  const children = visibleChildren(node, collapsed);
  if (!children.length) return nodeHeight(node);
  const gap = GAP_Y[node.type] ?? 12;
  const sum = children.reduce((total, child) => total + subtreeHeight(child, collapsed), 0)
    + gap * (children.length - 1);
  return Math.max(nodeHeight(node), sum);
}

function placeSide(
  node: MindmapNode,
  x: number,
  y: number,
  direction: 1 | -1,
  collapsed: ReadonlySet<string>,
  positions: Record<string, MindmapNodePosition>,
): void {
  const height = subtreeHeight(node, collapsed);
  const nodeX = direction === 1 ? x : x - nodeWidth(node);
  const nodeY = y + (height - nodeHeight(node)) / 2;
  positions[node.id] = createPosition(node, nodeX, nodeY);
  const children = visibleChildren(node, collapsed);
  if (!children.length) return;
  const gap = GAP_Y[node.type] ?? 12;
  let childY = y;
  const childX = direction === 1
    ? nodeX + nodeWidth(node) + (GAP_X[node.type] ?? 56)
    : nodeX - (GAP_X[node.type] ?? 56);
  for (const child of children) {
    placeSide(child, childX, childY, direction, collapsed, positions);
    childY += subtreeHeight(child, collapsed) + gap;
  }
}

function subtreeWidth(node: MindmapNode, collapsed: ReadonlySet<string>): number {
  const children = visibleChildren(node, collapsed);
  if (!children.length) return nodeWidth(node);
  if (node.type === "group") {
    return Math.max(nodeWidth(node), MINDMAP_NODE_DIMENSIONS.card.width + 28);
  }
  const sum = children.reduce((total, child) => total + subtreeWidth(child, collapsed), 0)
    + DOWN_GAP_X * (children.length - 1);
  return Math.max(nodeWidth(node), sum);
}

function placeDown(
  node: MindmapNode,
  x: number,
  y: number,
  collapsed: ReadonlySet<string>,
  positions: Record<string, MindmapNodePosition>,
): void {
  const width = subtreeWidth(node, collapsed);
  positions[node.id] = createPosition(node, x + (width - nodeWidth(node)) / 2, y);
  const children = visibleChildren(node, collapsed);
  if (!children.length) return;
  if (node.type === "group" && children.every((child) => child.type === "card")) {
    let childY = y + nodeHeight(node) + 30;
    for (const child of children) {
      positions[child.id] = createPosition(
        child,
        x + (width - MINDMAP_NODE_DIMENSIONS.card.width) / 2 + 12,
        childY,
      );
      childY += nodeHeight(child) + 10;
    }
    return;
  }
  let childX = x;
  for (const child of children) {
    placeDown(
      child,
      childX,
      y + nodeHeight(node) + (DOWN_GAP_Y[node.type] ?? 64),
      collapsed,
      positions,
    );
    childX += subtreeWidth(child, collapsed) + DOWN_GAP_X;
  }
}

function subtreeIndentHeight(node: MindmapNode, collapsed: ReadonlySet<string>): number {
  return nodeHeight(node) + visibleChildren(node, collapsed).reduce(
    (total, child) => total + subtreeIndentHeight(child, collapsed) + INDENT.gap,
    0,
  );
}

function placeIndent(
  node: MindmapNode,
  x: number,
  y: number,
  collapsed: ReadonlySet<string>,
  positions: Record<string, MindmapNodePosition>,
): void {
  positions[node.id] = createPosition(node, x, y);
  let childY = y + nodeHeight(node) + INDENT.gap;
  for (const child of visibleChildren(node, collapsed)) {
    placeIndent(child, x + INDENT.amount, childY, collapsed, positions);
    childY += subtreeIndentHeight(child, collapsed) + INDENT.gap;
  }
}

function layoutPositions(
  root: MindmapNode,
  layout: MindmapLayoutId,
  collapsed: ReadonlySet<string>,
): Record<string, MindmapNodePosition> {
  const positions: Record<string, MindmapNodePosition> = {};
  if (layout === "logic-right") placeSide(root, 0, 0, 1, collapsed, positions);
  else if (layout === "tree-down") placeDown(root, 0, 0, collapsed, positions);
  else if (layout === "indent") placeIndent(root, 0, 0, collapsed, positions);
  else {
    const children = visibleChildren(root, collapsed);
    const right = children.filter((_, index) => index % 2 === 0);
    const left = children.filter((_, index) => index % 2 === 1);
    const gap = GAP_Y.section ?? 40;
    const rightHeight = right.reduce((total, child) => total + subtreeHeight(child, collapsed), 0)
      + gap * Math.max(0, right.length - 1);
    const leftHeight = left.reduce((total, child) => total + subtreeHeight(child, collapsed), 0)
      + gap * Math.max(0, left.length - 1);
    const totalHeight = Math.max(rightHeight, leftHeight, nodeHeight(root));
    const rootX = -nodeWidth(root) / 2;
    positions[root.id] = createPosition(root, rootX, (totalHeight - nodeHeight(root)) / 2);
    let childY = (totalHeight - rightHeight) / 2;
    for (const child of right) {
      placeSide(child, rootX + nodeWidth(root) + (GAP_X.section ?? 96), childY, 1, collapsed, positions);
      childY += subtreeHeight(child, collapsed) + gap;
    }
    childY = (totalHeight - leftHeight) / 2;
    for (const child of left) {
      placeSide(child, rootX - (GAP_X.section ?? 96), childY, -1, collapsed, positions);
      childY += subtreeHeight(child, collapsed) + gap;
    }
  }
  return positions;
}

function categoryColor(node: MindmapNode, ancestors: readonly MindmapNode[]): string {
  if (node.type === "category") return node.color || FALLBACK_COLOR;
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (ancestor.type === "category") return ancestor.color || FALLBACK_COLOR;
  }
  return FALLBACK_COLOR;
}

export function edgePath(
  parent: MindmapNodePosition,
  child: MindmapNodePosition,
  layout: MindmapLayoutId,
  childType: MindmapNodeType,
): string {
  if (layout === "tree-down") {
    if (childType === "card") {
      const groupX = parent.x + parent.width / 2;
      const groupY = parent.y + parent.height;
      const spineX = child.x - 12;
      const childY = child.y + child.height / 2;
      return `M ${groupX} ${groupY} C ${groupX} ${groupY + 12}, ${spineX} ${groupY + 10}, ${spineX} ${groupY + 24} L ${spineX} ${childY - 8} Q ${spineX} ${childY}, ${spineX + 8} ${childY} L ${child.x} ${childY}`;
    }
    const x1 = parent.x + parent.width / 2;
    const y1 = parent.y + parent.height;
    const x2 = child.x + child.width / 2;
    const y2 = child.y;
    const middle = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`;
  }
  if (layout === "indent") {
    const x1 = parent.x + 16;
    const y1 = parent.y + parent.height;
    const x2 = child.x;
    const y2 = child.y + child.height / 2;
    return `M ${x1} ${y1} L ${x1} ${y2 - 8} Q ${x1} ${y2}, ${x1 + 8} ${y2} L ${x2} ${y2}`;
  }
  const childOnLeft = child.x + child.width / 2 < parent.x + parent.width / 2;
  const x1 = childOnLeft ? parent.x : parent.x + parent.width;
  const y1 = parent.y + parent.height / 2;
  const x2 = childOnLeft ? child.x + child.width : child.x;
  const y2 = child.y + child.height / 2;
  const deltaX = Math.max(28, Math.abs(x2 - x1) * 0.5) * (childOnLeft ? -1 : 1);
  return `M ${x1} ${y1} C ${x1 + deltaX} ${y1}, ${x2 - deltaX} ${y2}, ${x2} ${y2}`;
}

function boundsOf(positions: Record<string, MindmapNodePosition>): MindmapBounds {
  const nodes = Object.values(positions);
  if (!nodes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return nodes.reduce<MindmapBounds>((bounds, node) => ({
    minX: Math.min(bounds.minX, node.x),
    minY: Math.min(bounds.minY, node.y),
    maxX: Math.max(bounds.maxX, node.x + node.width),
    maxY: Math.max(bounds.maxY, node.y + node.height),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

export function layoutMindmap(
  root: MindmapNode,
  layout: MindmapLayoutId,
  collapsed: ReadonlySet<string> = new Set(),
  offsets: Readonly<Record<string, { dx: number; dy: number }>> = {},
): MindmapLayoutResult {
  const positions = layoutPositions(root, layout, collapsed);
  const applyOffsets = (
    node: MindmapNode,
    inherited: { dx: number; dy: number },
  ): void => {
    const own = offsets[node.id] || { dx: 0, dy: 0 };
    const cumulative = { dx: inherited.dx + own.dx, dy: inherited.dy + own.dy };
    const position = positions[node.id];
    if (position) {
      position.x += cumulative.dx;
      position.y += cumulative.dy;
    }
    if (!collapsed.has(node.id)) {
      node.children.forEach((child) => applyOffsets(child, cumulative));
    }
  };
  applyOffsets(root, { dx: 0, dy: 0 });
  const edges: MindmapEdge[] = [];
  const walk = (node: MindmapNode, ancestors: readonly MindmapNode[]): void => {
    const parentPosition = positions[node.id];
    if (!parentPosition) return;
    for (const child of visibleChildren(node, collapsed)) {
      const childPosition = positions[child.id];
      if (!childPosition) continue;
      edges.push({
        id: `${node.id}->${child.id}`,
        parentId: node.id,
        childId: child.id,
        path: edgePath(parentPosition, childPosition, layout, child.type),
        color: categoryColor(child, [...ancestors, node]),
        width: child.type === "category" ? 2.4 : child.type === "group" ? 2 : 1.6,
        opacity: child.type === "card" ? 0.4 : 0.55,
      });
      walk(child, [...ancestors, node]);
    }
  };
  walk(root, []);
  return {
    positions,
    edges,
    bounds: boundsOf(positions),
    visibleNodeIds: Object.keys(positions),
  };
}

export function layoutLogicRight(root: MindmapNode, collapsed?: ReadonlySet<string>): MindmapLayoutResult {
  return layoutMindmap(root, "logic-right", collapsed);
}

export function layoutBilateral(root: MindmapNode, collapsed?: ReadonlySet<string>): MindmapLayoutResult {
  return layoutMindmap(root, "bilateral", collapsed);
}

export function layoutTreeDown(root: MindmapNode, collapsed?: ReadonlySet<string>): MindmapLayoutResult {
  return layoutMindmap(root, "tree-down", collapsed);
}

export function layoutIndent(root: MindmapNode, collapsed?: ReadonlySet<string>): MindmapLayoutResult {
  return layoutMindmap(root, "indent", collapsed);
}

export function fitCamera(
  bounds: MindmapBounds,
  viewport: { width: number; height: number },
  options: { railWidth?: number; padding?: number; minScale?: number; maxScale?: number } = {},
): MindmapCamera {
  const railWidth = options.railWidth ?? 120;
  const padding = options.padding ?? 60;
  const minScale = options.minScale ?? 0.25;
  const maxScale = options.maxScale ?? 1.1;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, viewport.width - railWidth - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const rawScale = Math.min(maxScale, availableWidth / width, availableHeight / height);
  const k = Math.min(2, Math.max(minScale, rawScale));
  return {
    k,
    x: railWidth + padding + (availableWidth - width * k) / 2 - bounds.minX * k,
    y: padding + (availableHeight - height * k) / 2 - bounds.minY * k,
  };
}

import type { MindmapNode } from "./types";

export interface MindmapNodeIndex {
  nodes: Record<string, MindmapNode>;
  parentIds: Record<string, string | undefined>;
  descendantCounts: Record<string, number>;
}

export function indexMindmapNodes(root: MindmapNode): MindmapNodeIndex {
  const nodes: Record<string, MindmapNode> = {};
  const parentIds: Record<string, string | undefined> = {};
  const descendantCounts: Record<string, number> = {};

  const walk = (node: MindmapNode, parentId?: string): number => {
    nodes[node.id] = node;
    parentIds[node.id] = parentId;
    let descendants = 0;
    for (const child of node.children) {
      descendants += 1 + walk(child, node.id);
    }
    descendantCounts[node.id] = descendants;
    return descendants;
  };

  walk(root);
  return { nodes, parentIds, descendantCounts };
}

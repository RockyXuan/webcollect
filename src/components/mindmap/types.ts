export type CollectionViewMode = "classic" | "mindmap";

export type MindmapLayoutId = "logic-right" | "bilateral" | "tree-down" | "indent";

export type MindmapNodeType = "section" | "category" | "group" | "card";

export interface MindmapNode {
  id: string;
  type: MindmapNodeType;
  refId: string;
  label: string;
  color?: string;
  url?: string;
  shortDesc?: string;
  imageUrl?: string;
  abbreviation?: string;
  children: MindmapNode[];
}

export interface MindmapPoint {
  x: number;
  y: number;
}

export interface MindmapCamera extends MindmapPoint {
  k: number;
}

export interface MindmapNodePosition extends MindmapPoint {
  id: string;
  width: number;
  height: number;
}

export interface MindmapEdge {
  id: string;
  parentId: string;
  childId: string;
  path: string;
  color: string;
  width: number;
  opacity: number;
}

export interface MindmapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MindmapLayoutResult {
  positions: Record<string, MindmapNodePosition>;
  edges: MindmapEdge[];
  bounds: MindmapBounds;
  visibleNodeIds: string[];
}

export interface MindmapViewState {
  layout: MindmapLayoutId;
  collapsed: string[];
  offsets: Record<MindmapLayoutId, Record<string, { dx: number; dy: number }>>;
  camera: MindmapCamera;
  updatedAt: number;
}

export const DEFAULT_MINDMAP_VIEW_STATE: MindmapViewState = {
  layout: "logic-right",
  collapsed: [],
  offsets: {
    "logic-right": {},
    bilateral: {},
    "tree-down": {},
    indent: {},
  },
  camera: { x: 0, y: 0, k: 1 },
  updatedAt: 0,
};

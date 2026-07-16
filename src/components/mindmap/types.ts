export type CollectionViewMode = "classic" | "mindmap";

export type MindmapLayoutId = "logic-right" | "bilateral" | "tree-down" | "indent";

export interface MindmapPoint {
  x: number;
  y: number;
}

export interface MindmapCamera extends MindmapPoint {
  k: number;
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

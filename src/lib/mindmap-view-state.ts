import localforage from "localforage";
import {
  DEFAULT_MINDMAP_VIEW_STATE,
  type MindmapCamera,
  type MindmapLayoutId,
  type MindmapViewState,
} from "@/components/mindmap/types";
import { withStorageLock } from "./storage-lock";

const mindmapViewDb = localforage.createInstance({
  name: "WebCollect",
  storeName: "webcollect_data",
});

const LAYOUTS: MindmapLayoutId[] = ["logic-right", "bilateral", "tree-down", "indent"];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const MINDMAP_VIEW_STATE_PREFIX = "mindmapViewState:";

export interface MindmapViewStateRecord {
  sectionId: string;
  state: MindmapViewState;
}

export function mindmapViewStateKey(sectionId: string): string {
  return `${MINDMAP_VIEW_STATE_PREFIX}${sectionId}`;
}

export function clearMindmapLayoutOffsets(
  offsets: MindmapViewState["offsets"],
  layout: MindmapLayoutId,
): MindmapViewState["offsets"] {
  return {
    ...offsets,
    [layout]: {},
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCamera(value: unknown): MindmapCamera {
  const raw = value && typeof value === "object" ? value as Partial<MindmapCamera> : {};
  return {
    x: finiteNumber(raw.x, DEFAULT_MINDMAP_VIEW_STATE.camera.x),
    y: finiteNumber(raw.y, DEFAULT_MINDMAP_VIEW_STATE.camera.y),
    k: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finiteNumber(raw.k, DEFAULT_MINDMAP_VIEW_STATE.camera.k))),
  };
}

function normalizeOffsets(
  value: unknown,
  validNodeIds?: ReadonlySet<string>,
): MindmapViewState["offsets"] {
  const rawLayouts = value && typeof value === "object"
    ? value as Partial<Record<MindmapLayoutId, unknown>>
    : {};
  return Object.fromEntries(LAYOUTS.map((layout) => {
    const raw = rawLayouts[layout];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [layout, {}];
    const entries = Object.entries(raw as Record<string, unknown>).flatMap(([nodeId, offset]) => {
      if (validNodeIds && !validNodeIds.has(nodeId)) return [];
      if (!offset || typeof offset !== "object" || Array.isArray(offset)) return [];
      const candidate = offset as { dx?: unknown; dy?: unknown };
      const dx = finiteNumber(candidate.dx, Number.NaN);
      const dy = finiteNumber(candidate.dy, Number.NaN);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return [];
      return [[nodeId, { dx, dy }] as const];
    });
    return [layout, Object.fromEntries(entries)];
  })) as MindmapViewState["offsets"];
}

export function normalizeMindmapViewState(
  value: unknown,
  validNodeIds?: ReadonlySet<string>,
): MindmapViewState {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<MindmapViewState>
    : {};
  const layout = LAYOUTS.includes(raw.layout as MindmapLayoutId)
    ? raw.layout as MindmapLayoutId
    : DEFAULT_MINDMAP_VIEW_STATE.layout;
  const collapsed = Array.isArray(raw.collapsed)
    ? [...new Set(raw.collapsed.filter((nodeId): nodeId is string =>
      typeof nodeId === "string" && (!validNodeIds || validNodeIds.has(nodeId))))]
    : [];
  return {
    layout,
    collapsed,
    offsets: normalizeOffsets(raw.offsets, validNodeIds),
    camera: normalizeCamera(raw.camera),
    updatedAt: Math.max(0, finiteNumber(raw.updatedAt, 0)),
  };
}

export async function loadMindmapViewState(
  sectionId: string,
  validNodeIds?: ReadonlySet<string>,
): Promise<{ exists: boolean; state: MindmapViewState }> {
  const raw = await mindmapViewDb.getItem<unknown>(mindmapViewStateKey(sectionId));
  return { exists: raw !== null, state: normalizeMindmapViewState(raw, validNodeIds) };
}

export async function saveMindmapViewState(sectionId: string, state: MindmapViewState): Promise<void> {
  const key = mindmapViewStateKey(sectionId);
  const safeState = normalizeMindmapViewState(state);
  await withStorageLock(key, () => mindmapViewDb.setItem(key, safeState).then(() => undefined));
}

export async function listMindmapViewStates(): Promise<MindmapViewStateRecord[]> {
  const records: MindmapViewStateRecord[] = [];
  await mindmapViewDb.iterate<unknown, void>((value, key) => {
    if (!key.startsWith(MINDMAP_VIEW_STATE_PREFIX)) return;
    const sectionId = key.slice(MINDMAP_VIEW_STATE_PREFIX.length);
    if (!sectionId) return;
    records.push({ sectionId, state: normalizeMindmapViewState(value) });
  });
  return records.sort((left, right) => left.sectionId.localeCompare(right.sectionId));
}

export async function restoreMindmapViewStates(records: MindmapViewStateRecord[]): Promise<void> {
  for (const record of records) {
    if (!record || typeof record.sectionId !== "string" || !record.sectionId) continue;
    await saveMindmapViewState(record.sectionId, record.state);
  }
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { RotateCcw } from "lucide-react";
import {
  clearMindmapLayoutOffsets,
  loadMindmapViewState,
  saveMindmapViewState,
} from "@/lib/mindmap-view-state";
import { openWebCollectUrl } from "@/lib/platform";
import { useAppStore } from "@/lib/store";
import { buildMindmapTree, fitCamera, layoutMindmap } from "./layout-engine";
import { MindmapNode } from "./mindmap-node";
import { NodeHoverPreview, type MindmapPreviewTarget } from "./node-hover-preview";
import { indexMindmapNodes } from "./tree-index";
import type {
  MindmapCamera,
  MindmapLayoutId,
  MindmapNode as MindmapNodeModel,
  MindmapViewState,
} from "./types";

const LAYOUTS: Array<{ id: MindmapLayoutId; label: string; asset: string }> = [
  { id: "logic-right", label: "右侧逻辑图（默认）", asset: "/mindmap/layout-logic-right.svg" },
  { id: "bilateral", label: "双侧脑图", asset: "/mindmap/layout-bilateral.svg" },
  { id: "tree-down", label: "下行组织图", asset: "/mindmap/layout-tree-down.svg" },
  { id: "indent", label: "缩进树", asset: "/mindmap/layout-indent.svg" },
];

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 1.15;
const VIRTUALIZE_NODE_THRESHOLD = 300;
const VIRTUALIZE_OVERSCAN = 240;
const FOCUS_VIEW_MARGIN = 96;

export interface MindmapSearchTarget {
  sectionId: string;
  categoryId: string;
  requestId: number;
}

interface MindmapViewProps {
  searchTarget?: MindmapSearchTarget | null;
  onAddCategory: (trigger?: HTMLButtonElement) => void;
  onAddGroup: (parentId?: string, trigger?: HTMLButtonElement) => void;
  onAddCard: (categoryId?: string, trigger?: HTMLButtonElement) => void;
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

const EMPTY_OFFSETS = (): MindmapViewState["offsets"] => ({
  "logic-right": {},
  bilateral: {},
  "tree-down": {},
  indent: {},
});

function nodeDepth(nodeId: string, parentIds: Record<string, string | undefined>): number {
  let depth = 1;
  let currentId = parentIds[nodeId];
  while (currentId) {
    depth += 1;
    currentId = parentIds[currentId];
  }
  return depth;
}

export function MindmapView({ searchTarget = null, onAddCategory, onAddGroup, onAddCard }: MindmapViewProps) {
  const sections = useAppStore((state) => state.sections);
  const categories = useAppStore((state) => state.categories);
  const cards = useAppStore((state) => state.cards);
  const activeSectionId = useAppStore((state) => state.activeSectionId);
  const pinnedBookmarkItems = useAppStore((state) => state.pinnedBookmarkItems);
  const linkOpenMode = useAppStore((state) => state.linkOpenMode);
  const togglePinBookmark = useAppStore((state) => state.togglePinBookmark);
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; camera: MindmapCamera } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    nodeId: string;
    startX: number;
    startY: number;
    base: { dx: number; dy: number };
    moved: boolean;
    latest: { dx: number; dy: number };
  } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const previewShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrationRequestRef = useRef(0);
  const lastSearchRequestRef = useRef(0);
  const lastAutoFitKeyRef = useRef("");
  const skipNextAutoFitRef = useRef(false);
  const activeStateSectionRef = useRef(activeSectionId);
  const dirtyRef = useRef(false);
  const knownNodeIdsBySectionRef = useRef(new Map<string, Set<string>>());
  const enteringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressActivationRef = useRef<{ nodeId: string; until: number } | null>(null);
  const [layout, setLayout] = useState<MindmapLayoutId>("logic-right");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [offsets, setOffsets] = useState(EMPTY_OFFSETS);
  const [dragDelta, setDragDelta] = useState<{ nodeId: string; dx: number; dy: number } | null>(null);
  const [camera, setCamera] = useState<MindmapCamera>({ x: 0, y: 0, k: 1 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<MindmapPreviewTarget | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dirtyRevision, setDirtyRevision] = useState(0);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [enteringNodeIds, setEnteringNodeIds] = useState<Set<string>>(() => new Set());

  const tree = useMemo(
    () => buildMindmapTree(sections, categories, cards, activeSectionId),
    [sections, categories, cards, activeSectionId],
  );
  const {
    nodes: nodeById,
    parentIds,
    descendantCounts,
  } = useMemo(() => indexMindmapNodes(tree), [tree]);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const pinnedSet = useMemo(
    () => new Set(pinnedBookmarkItems.map((item) => item.cardId)),
    [pinnedBookmarkItems],
  );

  useEffect(() => {
    if (!previewTarget) return;
    const pinned = pinnedSet.has(previewTarget.card.id);
    if (previewTarget.pinned !== pinned) {
      setPreviewTarget((current) => current ? { ...current, pinned } : current);
    }
  }, [pinnedSet, previewTarget]);

  useEffect(() => {
    if (!hydrated) return;
    const nextNodeIds = new Set(Object.keys(nodeById));
    const previousNodeIds = knownNodeIdsBySectionRef.current.get(activeSectionId);
    knownNodeIdsBySectionRef.current.set(activeSectionId, nextNodeIds);
    if (!previousNodeIds) {
      setEnteringNodeIds(new Set());
      return;
    }
    const addedNodeIds = new Set([...nextNodeIds].filter((nodeId) => !previousNodeIds.has(nodeId)));
    if (addedNodeIds.size === 0) return;
    setEnteringNodeIds(addedNodeIds);
    if (enteringTimerRef.current) clearTimeout(enteringTimerRef.current);
    enteringTimerRef.current = setTimeout(() => setEnteringNodeIds(new Set()), 440);
  }, [activeSectionId, hydrated, nodeById]);
  const renderedOffsets = useMemo(() => {
    if (!dragDelta) return offsets[layout];
    const base = offsets[layout][dragDelta.nodeId] || { dx: 0, dy: 0 };
    return {
      ...offsets[layout],
      [dragDelta.nodeId]: { dx: base.dx + dragDelta.dx, dy: base.dy + dragDelta.dy },
    };
  }, [dragDelta, layout, offsets]);
  const layoutResult = useMemo(
    () => layoutMindmap(tree, layout, collapsed, renderedOffsets),
    [tree, layout, collapsed, renderedOffsets],
  );
  const canResetCurrentLayout = Object.keys(offsets[layout]).length > 0;
  const renderedNodeIds = useMemo(() => {
    const visibleNodeIds = layoutResult.visibleNodeIds;
    if (visibleNodeIds.length <= VIRTUALIZE_NODE_THRESHOLD || !viewport.width || !viewport.height) {
      return visibleNodeIds;
    }
    const minX = (0 - camera.x) / camera.k - VIRTUALIZE_OVERSCAN;
    const minY = (0 - camera.y) / camera.k - VIRTUALIZE_OVERSCAN;
    const maxX = (viewport.width - camera.x) / camera.k + VIRTUALIZE_OVERSCAN;
    const maxY = (viewport.height - camera.y) / camera.k + VIRTUALIZE_OVERSCAN;
    const previewNodeId = previewTarget ? `card:${previewTarget.card.id}` : null;
    const keepNodeIds = new Set([
      tree.id,
      focusedNodeId,
      dragDelta?.nodeId,
      previewNodeId,
    ].filter((nodeId): nodeId is string => Boolean(nodeId)));

    return visibleNodeIds.filter((nodeId) => {
      if (keepNodeIds.has(nodeId)) return true;
      const position = layoutResult.positions[nodeId];
      if (!position) return false;
      return position.x + position.width >= minX
        && position.x <= maxX
        && position.y + position.height >= minY
        && position.y <= maxY;
    });
  }, [camera.k, camera.x, camera.y, dragDelta?.nodeId, focusedNodeId, layoutResult.positions, layoutResult.visibleNodeIds, previewTarget, tree.id, viewport.height, viewport.width]);
  const renderedNodeIdSet = useMemo(() => new Set(renderedNodeIds), [renderedNodeIds]);
  const visibleNodeIdSet = useMemo(() => new Set(layoutResult.visibleNodeIds), [layoutResult.visibleNodeIds]);
  const renderedEdges = useMemo(() => {
    if (layoutResult.visibleNodeIds.length <= VIRTUALIZE_NODE_THRESHOLD) return layoutResult.edges;
    return layoutResult.edges.filter((edge) => renderedNodeIdSet.has(edge.parentId) && renderedNodeIdSet.has(edge.childId));
  }, [layoutResult.edges, layoutResult.visibleNodeIds.length, renderedNodeIdSet]);
  const treeSignature = useMemo(() => Object.keys(nodeById).sort().join("|"), [nodeById]);
  const collapsedSignature = useMemo(() => [...collapsed].sort().join("|"), [collapsed]);
  const autoFitKey = `${activeSectionId}|${layout}|${treeSignature}|${collapsedSignature}|${viewport.width}x${viewport.height}`;
  const viewStateRef = useRef<MindmapViewState>({
    layout,
    collapsed: [],
    offsets,
    camera,
    updatedAt: 0,
  });

  viewStateRef.current = {
    layout,
    collapsed: [...collapsed],
    offsets,
    camera,
    updatedAt: Date.now(),
  };

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirtyRevision((value) => value + 1);
  }, []);

  const persistSectionState = useCallback((sectionId: string, state: MindmapViewState) => {
    void saveMindmapViewState(sectionId, state).catch((error) => {
      console.error("[WebCollect] Mindmap view state save failed", error);
    });
  }, []);

  const fit = useCallback((persist = true) => {
    if (!viewport.width || !viewport.height) return;
    setCamera(fitCamera(layoutResult.bounds, viewport));
    if (persist) markDirty();
  }, [layoutResult.bounds, markDirty, viewport]);

  const focusNodeElement = useCallback((nodeId: string) => {
    requestAnimationFrame(() => {
      const nodeElement = [...(stageRef.current?.querySelectorAll<HTMLElement>("[data-mindmap-node]") || [])]
        .find((element) => element.dataset.mindmapNode === nodeId);
      nodeElement?.focus({ preventScroll: true });
    });
  }, []);

  const ensureNodeInViewport = useCallback((nodeId: string, persist = true) => {
    const position = layoutResult.positions[nodeId];
    if (!position || !viewport.width || !viewport.height) return;
    setCamera((current) => {
      let nextX = current.x;
      let nextY = current.y;
      const left = position.x * current.k + current.x;
      const top = position.y * current.k + current.y;
      const right = (position.x + position.width) * current.k + current.x;
      const bottom = (position.y + position.height) * current.k + current.y;
      const safeLeft = FOCUS_VIEW_MARGIN;
      const safeTop = FOCUS_VIEW_MARGIN;
      const safeRight = viewport.width - FOCUS_VIEW_MARGIN;
      const safeBottom = viewport.height - FOCUS_VIEW_MARGIN;

      if (left < safeLeft) nextX += safeLeft - left;
      else if (right > safeRight) nextX -= right - safeRight;
      if (top < safeTop) nextY += safeTop - top;
      else if (bottom > safeBottom) nextY -= bottom - safeBottom;

      if (nextX === current.x && nextY === current.y) return current;
      if (persist) markDirty();
      return { ...current, x: nextX, y: nextY };
    });
  }, [layoutResult.positions, markDirty, viewport.height, viewport.width]);

  const focusMindmapNode = useCallback((nodeId: string, moveDomFocus = true) => {
    if (!nodeById[nodeId]) return;
    setFocusedNodeId(nodeId);
    ensureNodeInViewport(nodeId);
    if (moveDomFocus) focusNodeElement(nodeId);
  }, [ensureNodeInViewport, focusNodeElement, nodeById]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateViewport = () => {
      // Layout dimensions must not inherit the temporary scale used by the
      // 180ms classic↔mindmap transition.
      setViewport({ width: stage.clientWidth, height: stage.clientHeight });
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!focusedNodeId || !nodeById[focusedNodeId]) {
      setFocusedNodeId(tree.id);
    }
  }, [focusedNodeId, hydrated, nodeById, tree.id]);

  useEffect(() => {
    const previousSectionId = activeStateSectionRef.current;
    if (previousSectionId !== activeSectionId && dirtyRef.current) {
      persistSectionState(previousSectionId, viewStateRef.current);
    }
    activeStateSectionRef.current = activeSectionId;
    dirtyRef.current = false;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    const requestId = ++hydrationRequestRef.current;
    setHydrated(false);
    setHighlightedNodeId(null);
    const validNodeIds = new Set(Object.keys(nodeById));
    void loadMindmapViewState(activeSectionId, validNodeIds).then(({ exists, state }) => {
      if (hydrationRequestRef.current !== requestId || activeStateSectionRef.current !== activeSectionId) return;
      setLayout(state.layout);
      setCollapsed(new Set(state.collapsed));
      setOffsets(state.offsets);
      setCamera(state.camera);
      skipNextAutoFitRef.current = exists;
      lastAutoFitKeyRef.current = "";
      setHydrated(true);
    }).catch((error) => {
      if (hydrationRequestRef.current !== requestId) return;
      console.error("[WebCollect] Mindmap view state load failed", error);
      setLayout("logic-right");
      setCollapsed(new Set());
      setOffsets(EMPTY_OFFSETS());
      setCamera({ x: 0, y: 0, k: 1 });
      skipNextAutoFitRef.current = false;
      setHydrated(true);
    });
    // Rehydrate only when the active section changes. Live collection edits rebuild the tree in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, persistSectionState]);

  useEffect(() => {
    if (!hydrated || !dirtyRef.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    const sectionId = activeSectionId;
    const state = viewStateRef.current;
    persistTimerRef.current = setTimeout(() => {
      persistSectionState(sectionId, state);
      if (activeStateSectionRef.current === sectionId) dirtyRef.current = false;
    }, 120);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [activeSectionId, dirtyRevision, hydrated, persistSectionState]);

  useLayoutEffect(() => {
    if (!hydrated || !viewport.width || !viewport.height) return;
    if (lastAutoFitKeyRef.current === autoFitKey) return;
    lastAutoFitKeyRef.current = autoFitKey;
    if (skipNextAutoFitRef.current) {
      skipNextAutoFitRef.current = false;
      return;
    }
    fit(false);
    markDirty();
  }, [autoFitKey, fit, hydrated, markDirty, viewport.height, viewport.width]);

  const clearPreviewTimers = useCallback(() => {
    if (previewShowTimerRef.current) clearTimeout(previewShowTimerRef.current);
    if (previewHideTimerRef.current) clearTimeout(previewHideTimerRef.current);
    if (previewUnmountTimerRef.current) clearTimeout(previewUnmountTimerRef.current);
    previewShowTimerRef.current = null;
    previewHideTimerRef.current = null;
    previewUnmountTimerRef.current = null;
  }, []);

  const hidePreview = useCallback((immediate = true) => {
    clearPreviewTimers();
    setPreviewVisible(false);
    if (immediate) setPreviewTarget(null);
    else previewUnmountTimerRef.current = setTimeout(() => setPreviewTarget(null), 180);
  }, [clearPreviewTimers]);

  const zoomAt = useCallback((nextZoom: number, anchorX: number, anchorY: number, persist = true) => {
    hidePreview();
    setCamera((current) => {
      const k = clampZoom(nextZoom);
      const worldX = (anchorX - current.x) / current.k;
      const worldY = (anchorY - current.y) / current.k;
      return { x: anchorX - worldX * k, y: anchorY - worldY * k, k };
    });
    if (persist) markDirty();
  }, [hidePreview, markDirty]);

  const zoomFromCenter = useCallback((factor: number) => {
    zoomAt(camera.k * factor, viewport.width / 2, viewport.height / 2);
  }, [camera.k, viewport, zoomAt]);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(camera.k * factor, event.clientX - rect.left, event.clientY - rect.top, false);
    if (wheelPersistTimerRef.current) clearTimeout(wheelPersistTimerRef.current);
    wheelPersistTimerRef.current = setTimeout(markDirty, 180);
  }, [camera.k, markDirty, zoomAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-mindmap-node]")) return;
    hidePreview();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera };
    setIsPanning(true);
  }, [camera, hidePreview]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setCamera({
      ...pan.camera,
      x: pan.camera.x + event.clientX - pan.x,
      y: pan.camera.y + event.clientY - pan.y,
    });
  }, []);

  const endPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    markDirty();
  }, [markDirty]);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    hidePreview();
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    markDirty();
  }, [hidePreview, markDirty]);

  const handleResetLayout = useCallback(() => {
    if (!canResetCurrentLayout) return;
    hidePreview();
    const resetOffsets = clearMindmapLayoutOffsets(offsets, layout);
    const automaticLayout = layoutMindmap(tree, layout, collapsed, {});
    setOffsets(resetOffsets);
    setDragDelta(null);
    if (viewport.width && viewport.height) {
      setCamera(fitCamera(automaticLayout.bounds, viewport));
    }
    markDirty();
  }, [canResetCurrentLayout, collapsed, hidePreview, layout, markDirty, offsets, tree, viewport]);

  const handleNodePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    hidePreview();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      base: offsets[layout][nodeId] || { dx: 0, dy: 0 },
      moved: false,
      latest: { dx: 0, dy: 0 },
    };
  }, [hidePreview, layout, offsets]);

  const handleNodePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.nodeId !== nodeId) return;
    const screenDx = event.clientX - drag.startX;
    const screenDy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(screenDx, screenDy) <= 3) return;
    drag.moved = true;
    drag.latest = { dx: screenDx / camera.k, dy: screenDy / camera.k };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const current = dragRef.current;
      if (current?.moved) setDragDelta({ nodeId: current.nodeId, ...current.latest });
    });
  }, [camera.k]);

  const finishNodeDrag = useCallback((event: React.PointerEvent<HTMLDivElement>, nodeId: string, commit: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.nodeId !== nodeId) return;
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    if (commit && drag.moved) {
      const finalDelta = drag.latest;
      setOffsets((current) => ({
        ...current,
        [layout]: {
          ...current[layout],
          [nodeId]: { dx: drag.base.dx + finalDelta.dx, dy: drag.base.dy + finalDelta.dy },
        },
      }));
      suppressActivationRef.current = { nodeId, until: performance.now() + 280 };
      markDirty();
    }
    dragRef.current = null;
    setDragDelta(null);
  }, [layout, markDirty]);

  const handleNodeAdd = useCallback((node: MindmapNodeModel, trigger: HTMLButtonElement) => {
    hidePreview();
    if (node.type === "section") onAddCategory(trigger);
    else if (node.type === "category") onAddGroup(node.refId, trigger);
    else if (node.type === "group") onAddCard(node.refId, trigger);
  }, [hidePreview, onAddCard, onAddCategory, onAddGroup]);

  const handleNodeActivate = useCallback((node: MindmapNodeModel) => {
    if (node.type !== "card") return;
    const suppressed = suppressActivationRef.current;
    if (suppressed?.nodeId === node.id && performance.now() < suppressed.until) return;
    const card = cardsById.get(node.refId);
    if (!card) return;
    hidePreview();
    openWebCollectUrl(card.url, linkOpenMode);
  }, [cardsById, hidePreview, linkOpenMode]);

  const handleFocusNode = useCallback((nodeId: string) => {
    if (!nodeById[nodeId]) return;
    setFocusedNodeId(nodeId);
    ensureNodeInViewport(nodeId, false);
  }, [ensureNodeInViewport, nodeById]);

  const handleNodeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>, node: MindmapNodeModel) => {
    if (event.defaultPrevented) return;
    const focusTarget = (nodeId: string | undefined): void => {
      if (!nodeId) return;
      event.preventDefault();
      focusMindmapNode(nodeId);
    };

    if (event.key === "Enter") {
      event.preventDefault();
      handleNodeActivate(node);
      return;
    }

    if (event.key === " ") {
      if (descendantCounts[node.id] > 0) {
        event.preventDefault();
        handleToggleCollapse(node.id);
        focusMindmapNode(node.id);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      focusTarget(parentIds[node.id]);
      return;
    }

    if (event.key === "ArrowRight") {
      const firstChild = node.children[0];
      if (!firstChild) return;
      if (collapsed.has(node.id)) {
        event.preventDefault();
        handleToggleCollapse(node.id);
        requestAnimationFrame(() => focusMindmapNode(firstChild.id));
        return;
      }
      focusTarget(firstChild.id);
      return;
    }

    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const parentId = parentIds[node.id];
    const siblings = parentId
      ? (nodeById[parentId]?.children || []).filter((child) => visibleNodeIdSet.has(child.id))
      : [tree].filter((child) => visibleNodeIdSet.has(child.id));
    const index = siblings.findIndex((sibling) => sibling.id === node.id);
    if (index === -1) return;
    const nextIndex = event.key === "ArrowUp"
      ? Math.max(0, index - 1)
      : Math.min(siblings.length - 1, index + 1);
    focusTarget(siblings[nextIndex]?.id);
  }, [collapsed, descendantCounts, focusMindmapNode, handleNodeActivate, handleToggleCollapse, nodeById, parentIds, tree, visibleNodeIdSet]);

  const handlePreviewOpen = useCallback((card: (typeof cards)[number]) => {
    hidePreview();
    openWebCollectUrl(card.url, linkOpenMode);
  }, [hidePreview, linkOpenMode]);

  const handlePreviewTogglePin = useCallback((cardId: string) => {
    togglePinBookmark(cardId);
  }, [togglePinBookmark]);

  const handleCardPointerEnter = useCallback((element: HTMLDivElement, node: MindmapNodeModel, card: (typeof cards)[number]) => {
    clearPreviewTimers();
    previewShowTimerRef.current = setTimeout(() => {
      const path: string[] = [];
      let currentId = parentIds[node.id];
      while (currentId) {
        const current = nodeById[currentId];
        if (current) path.unshift(current.label);
        currentId = parentIds[currentId];
      }
      setPreviewTarget({ card, path, anchor: element.getBoundingClientRect(), pinned: pinnedSet.has(card.id) });
      requestAnimationFrame(() => setPreviewVisible(true));
    }, 380);
  }, [clearPreviewTimers, nodeById, parentIds, pinnedSet]);

  const schedulePreviewHide = useCallback(() => {
    if (previewShowTimerRef.current) clearTimeout(previewShowTimerRef.current);
    if (previewHideTimerRef.current) clearTimeout(previewHideTimerRef.current);
    previewHideTimerRef.current = setTimeout(() => hidePreview(false), 200);
  }, [hidePreview]);

  const keepPreviewOpen = useCallback(() => {
    if (previewHideTimerRef.current) clearTimeout(previewHideTimerRef.current);
  }, []);

  useEffect(() => {
    if (!hydrated || !searchTarget || searchTarget.sectionId !== activeSectionId) return;
    if (lastSearchRequestRef.current === searchTarget.requestId) return;
    const targetNode = Object.values(nodeById).find((node) =>
      (node.type === "category" || node.type === "group") && node.refId === searchTarget.categoryId);
    if (!targetNode || !viewport.width || !viewport.height) return;
    lastSearchRequestRef.current = searchTarget.requestId;
    const nextCollapsed = new Set(collapsed);
    let ancestorId = parentIds[targetNode.id];
    while (ancestorId) {
      nextCollapsed.delete(ancestorId);
      ancestorId = parentIds[ancestorId];
    }
    setCollapsed(nextCollapsed);
    const focusedLayout = layoutMindmap(tree, layout, nextCollapsed, offsets[layout]);
    const position = focusedLayout.positions[targetNode.id];
    if (!position) return;
    lastAutoFitKeyRef.current = autoFitKey;
    setCamera((current) => ({
      x: viewport.width / 2 - (position.x + position.width / 2) * current.k,
      y: viewport.height / 2 - (position.y + position.height / 2) * current.k,
      k: current.k,
    }));
    setHighlightedNodeId(targetNode.id);
    setFocusedNodeId(targetNode.id);
    focusNodeElement(targetNode.id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (enteringTimerRef.current) clearTimeout(enteringTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedNodeId(null), 1600);
    markDirty();
  }, [activeSectionId, autoFitKey, collapsed, focusNodeElement, hydrated, layout, markDirty, nodeById, offsets, parentIds, searchTarget, tree, viewport.height, viewport.width]);

  useEffect(() => () => {
    panRef.current = null;
    dragRef.current = null;
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    if (wheelPersistTimerRef.current) clearTimeout(wheelPersistTimerRef.current);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    clearPreviewTimers();
    if (dirtyRef.current) persistSectionState(activeStateSectionRef.current, viewStateRef.current);
  }, [clearPreviewTimers, persistSectionState]);

  return (
    <section
      ref={stageRef}
      className="wc-mindmap-stage"
      aria-label="导图模式"
      data-testid="mindmap-stage"
      data-mindmap-layout={layout}
      data-mindmap-hydrated={hydrated ? "true" : "false"}
      data-mindmap-total-nodes={layoutResult.visibleNodeIds.length}
      data-mindmap-rendered-nodes={renderedNodeIds.length}
    >
      <div
        ref={canvasRef}
        className={`wc-mindmap-canvas${isPanning ? " is-panning" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onLostPointerCapture={endPan}
      >
        <div
          className="wc-mindmap-world"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})` }}
        >
          <svg className="wc-mindmap-edges" width="1" height="1" aria-hidden="true">
            {renderedEdges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                stroke={edge.color}
                strokeWidth={edge.width}
                strokeOpacity={edge.opacity}
              />
            ))}
          </svg>
          <div className="wc-mindmap-nodes" role="tree" aria-label="导图节点">
            {renderedNodeIds.map((nodeId) => {
              const node = nodeById[nodeId];
              if (!node) return null;
              return (
                <MindmapNode
                  key={node.id}
                  node={node}
                  position={layoutResult.positions[node.id]}
                  card={node.type === "card" ? cardsById.get(node.refId) : undefined}
                  pinned={node.type === "card" && pinnedSet.has(node.refId)}
                  collapsed={collapsed.has(node.id)}
                  descendantCount={descendantCounts[node.id] || 0}
                  chipSide={layout === "tree-down" ? "down" : layoutResult.sideByNodeId[node.id] || "right"}
                  dragging={dragDelta?.nodeId === node.id}
                  highlighted={highlightedNodeId === node.id}
                  focused={focusedNodeId === node.id}
                  entering={enteringNodeIds.has(node.id)}
                  tabIndex={focusedNodeId === node.id ? 0 : -1}
                  ariaLevel={nodeDepth(node.id, parentIds)}
                  addLabel={node.type === "section" ? "新建分类" : node.type === "category" ? `在“${node.label}”中新建分组` : node.type === "group" ? `在“${node.label}”中添加网站` : undefined}
                  onToggleCollapse={handleToggleCollapse}
                  onAdd={handleNodeAdd}
                  onActivate={handleNodeActivate}
                  onFocusNode={handleFocusNode}
                  onNodeKeyDown={handleNodeKeyDown}
                  onNodePointerDown={handleNodePointerDown}
                  onNodePointerMove={handleNodePointerMove}
                  onNodePointerUp={(event, id) => finishNodeDrag(event, id, true)}
                  onNodePointerCancel={(event, id) => finishNodeDrag(event, id, false)}
                  onNodeLostPointerCapture={(event, id) => finishNodeDrag(event, id, false)}
                  onCardPointerEnter={handleCardPointerEnter}
                  onCardPointerLeave={schedulePreviewHide}
                />
              );
            })}
          </div>
        </div>
      </div>

      {tree.children.length === 0 && (
        <div className="wc-mindmap-empty" role="status">
          <span className="wc-mindmap-empty-kicker">导图为空</span>
          <h2>这个分项还没有分类或网页</h2>
          <p>先新建分类，或切回经典模式添加网页；数据会继续走现有保存和同步流程。</p>
          <button
            type="button"
            className="wc-mindmap-empty-action"
            onClick={(event) => onAddCategory(event.currentTarget)}
          >
            新建分类
          </button>
        </div>
      )}

      <div className="wc-mindmap-layout-rail" aria-label="布局">
        <div className="wc-mindmap-rail-label">布局</div>
        {LAYOUTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="wc-mindmap-layout-button"
            aria-label={item.label}
            aria-pressed={layout === item.id}
            onClick={() => {
              if (layout === item.id) return;
              setLayout(item.id);
              skipNextAutoFitRef.current = false;
              markDirty();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.asset} alt="" aria-hidden="true" />
            <span className="wc-mindmap-layout-tip">{item.label}</span>
          </button>
        ))}
        <div className="wc-mindmap-rail-separator" aria-hidden="true" />
        <button
          type="button"
          className="wc-mindmap-reset-button"
          aria-label="重置当前布局的手动摆放"
          title="重置布局"
          disabled={!canResetCurrentLayout}
          onClick={handleResetLayout}
        >
          <RotateCcw aria-hidden="true" />
        </button>
      </div>

      <div className="wc-mindmap-legend" aria-hidden="true">
        <span className="wc-mindmap-legend-item"><i className="is-section" />分项</span>
        <span className="wc-mindmap-legend-separator">›</span>
        <span className="wc-mindmap-legend-item"><i className="is-category" />分类</span>
        <span className="wc-mindmap-legend-separator">›</span>
        <span className="wc-mindmap-legend-item"><i className="is-group" />分组</span>
        <span className="wc-mindmap-legend-separator">›</span>
        <span className="wc-mindmap-legend-item"><i className="is-card" />网页</span>
        <span className="wc-mindmap-legend-separator">·</span>
        <span>拖动区块自由摆放，从属关系与连线始终保留</span>
      </div>

      <div className="wc-mindmap-zoom-cluster" aria-label="缩放">
        <button type="button" className="wc-mindmap-zoom-button" aria-label="缩小" onClick={() => zoomFromCenter(1 / ZOOM_STEP)}>−</button>
        <div className="wc-mindmap-zoom-percent" data-testid="mindmap-zoom-percent">{Math.round(camera.k * 100)}%</div>
        <button type="button" className="wc-mindmap-zoom-button" aria-label="放大" onClick={() => zoomFromCenter(ZOOM_STEP)}>＋</button>
        <button type="button" className="wc-mindmap-zoom-button wc-mindmap-zoom-fit" onClick={() => fit(true)}>适应画布</button>
      </div>
      <NodeHoverPreview
        target={previewTarget}
        visible={previewVisible}
        onPointerEnter={keepPreviewOpen}
        onPointerLeave={schedulePreviewHide}
        onOpen={handlePreviewOpen}
        onTogglePin={handlePreviewTogglePin}
      />
    </section>
  );
}

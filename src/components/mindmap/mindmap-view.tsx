"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { buildMindmapTree, fitCamera, layoutMindmap } from "./layout-engine";
import { MindmapNode } from "./mindmap-node";
import type { MindmapCamera, MindmapLayoutId, MindmapNode as MindmapNodeModel } from "./types";

const LAYOUTS: Array<{ id: MindmapLayoutId; label: string; asset: string }> = [
  { id: "logic-right", label: "右侧逻辑图（默认）", asset: "/mindmap/layout-logic-right.svg" },
  { id: "bilateral", label: "双侧脑图", asset: "/mindmap/layout-bilateral.svg" },
  { id: "tree-down", label: "下行组织图", asset: "/mindmap/layout-tree-down.svg" },
  { id: "indent", label: "缩进树", asset: "/mindmap/layout-indent.svg" },
];

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 1.15;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function indexNodes(root: MindmapNodeModel): Record<string, MindmapNodeModel> {
  const nodes: Record<string, MindmapNodeModel> = {};
  const walk = (node: MindmapNodeModel): void => {
    nodes[node.id] = node;
    node.children.forEach(walk);
  };
  walk(root);
  return nodes;
}

export function MindmapView() {
  const sections = useAppStore((state) => state.sections);
  const categories = useAppStore((state) => state.categories);
  const cards = useAppStore((state) => state.cards);
  const activeSectionId = useAppStore((state) => state.activeSectionId);
  const pinnedBookmarkItems = useAppStore((state) => state.pinnedBookmarkItems);
  const stageRef = useRef<HTMLElement>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; camera: MindmapCamera } | null>(null);
  const [layout, setLayout] = useState<MindmapLayoutId>("logic-right");
  const [camera, setCamera] = useState<MindmapCamera>({ x: 0, y: 0, k: 1 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const tree = useMemo(
    () => buildMindmapTree(sections, categories, cards, activeSectionId),
    [sections, categories, cards, activeSectionId],
  );
  const nodeById = useMemo(() => indexNodes(tree), [tree]);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const pinnedSet = useMemo(
    () => new Set(pinnedBookmarkItems.map((item) => item.cardId)),
    [pinnedBookmarkItems],
  );
  const layoutResult = useMemo(() => layoutMindmap(tree, layout), [tree, layout]);

  const fit = useCallback(() => {
    if (!viewport.width || !viewport.height) return;
    setCamera(fitCamera(layoutResult.bounds, viewport));
  }, [layoutResult.bounds, viewport]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateViewport = () => {
      const rect = stage.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  const zoomAt = useCallback((nextZoom: number, anchorX: number, anchorY: number) => {
    setCamera((current) => {
      const k = clampZoom(nextZoom);
      const worldX = (anchorX - current.x) / current.k;
      const worldY = (anchorY - current.y) / current.k;
      return { x: anchorX - worldX * k, y: anchorY - worldY * k, k };
    });
  }, []);

  const zoomFromCenter = useCallback((factor: number) => {
    zoomAt(camera.k * factor, viewport.width / 2, viewport.height / 2);
  }, [camera.k, viewport, zoomAt]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(camera.k * factor, event.clientX - rect.left, event.clientY - rect.top);
  }, [camera.k, zoomAt]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-mindmap-node]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera };
    setIsPanning(true);
  }, [camera]);

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
  }, []);

  useEffect(() => () => {
    panRef.current = null;
  }, []);

  return (
    <section
      ref={stageRef}
      className="wc-mindmap-stage"
      aria-label="导图模式"
      data-testid="mindmap-stage"
      data-mindmap-layout={layout}
    >
      <div
        className={`wc-mindmap-canvas${isPanning ? " is-panning" : ""}`}
        onWheel={handleWheel}
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
            {layoutResult.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                stroke={edge.color}
                strokeWidth={edge.width}
                strokeOpacity={edge.opacity}
              />
            ))}
          </svg>
          <div className="wc-mindmap-nodes">
            {layoutResult.visibleNodeIds.map((nodeId) => {
              const node = nodeById[nodeId];
              if (!node) return null;
              return (
                <MindmapNode
                  key={node.id}
                  node={node}
                  position={layoutResult.positions[node.id]}
                  card={node.type === "card" ? cardsById.get(node.refId) : undefined}
                  pinned={node.type === "card" && pinnedSet.has(node.refId)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="wc-mindmap-layout-rail" aria-label="布局">
        <div className="wc-mindmap-rail-label">布局</div>
        {LAYOUTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="wc-mindmap-layout-button"
            aria-label={item.label}
            aria-pressed={layout === item.id}
            onClick={() => setLayout(item.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.asset} alt="" aria-hidden="true" />
            <span className="wc-mindmap-layout-tip">{item.label}</span>
          </button>
        ))}
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
        <button type="button" className="wc-mindmap-zoom-button wc-mindmap-zoom-fit" onClick={fit}>适应画布</button>
      </div>
    </section>
  );
}

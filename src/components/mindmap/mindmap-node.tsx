"use client";

import { memo, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WebCard } from "@/lib/types";
import { getSemanticSiteIcon, getSiteIconCandidates } from "@/lib/site-icons";
import type { MindmapNode as MindmapNodeModel, MindmapNodePosition } from "./types";

interface MindmapNodeProps {
  node: MindmapNodeModel;
  position: MindmapNodePosition;
  card?: WebCard;
  pinned?: boolean;
}

function ReadOnlyCardIcon({ card }: { card: WebCard }) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = useMemo(() => getSiteIconCandidates(card), [card]);
  const semantic = useMemo(() => getSemanticSiteIcon(card), [card]);
  const candidate = candidates[candidateIndex] || "";
  const useSemantic = Boolean(semantic && (semantic.prefer || !candidate));
  const SemanticIcon = semantic?.Icon;

  if (useSemantic && SemanticIcon) {
    return (
      <span
        className="wc-mindmap-favicon wc-mindmap-semantic-icon"
        style={{ background: semantic?.background, color: semantic?.color }}
        aria-hidden="true"
      >
        <SemanticIcon />
      </span>
    );
  }

  if (candidate) {
    return (
      <span className="wc-mindmap-favicon" aria-hidden="true">
        {/* The read-only map advances through the existing favicon candidates but never persists them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate}
          alt=""
          onError={() => setCandidateIndex((index) => index + 1)}
        />
      </span>
    );
  }

  return (
    <span className="wc-mindmap-favicon wc-mindmap-fallback-icon" aria-hidden="true">
      {card.abbreviation || card.title.slice(0, 1) || "?"}
    </span>
  );
}

function MindmapNodeComponent({ node, position, card, pinned = false }: MindmapNodeProps) {
  const style = {
    left: position.x,
    top: position.y,
    width: position.width,
    height: position.height,
    "--mindmap-node-color": node.color || "#4f46e5",
  } as CSSProperties;

  return (
    <div
      className={`wc-mindmap-node wc-mindmap-node-${node.type}`}
      style={style}
      data-mindmap-node={node.id}
      data-node-type={node.type}
      aria-label={`${node.type === "section" ? "分项" : node.type === "category" ? "分类" : node.type === "group" ? "分组" : "网页"}：${node.label}`}
    >
      {node.type === "section" && <span className="wc-mindmap-root-icon" aria-hidden="true">🐿️</span>}
      {node.type === "category" && <span className="wc-mindmap-category-dot" aria-hidden="true" />}
      {node.type === "group" && <span className="wc-mindmap-group-bar" aria-hidden="true" />}
      {node.type === "card" && card && <ReadOnlyCardIcon card={card} />}
      <span className="wc-mindmap-node-label">{node.label}</span>
      {node.type === "card" && (
        <span className={`wc-mindmap-star${pinned ? " is-pinned" : ""}`} aria-hidden="true">★</span>
      )}
    </div>
  );
}

export const MindmapNode = memo(MindmapNodeComponent);

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WebCard } from "@/lib/types";
import { getSemanticSiteIcon, getSiteIconCandidates } from "@/lib/site-icons";

export interface MindmapPreviewTarget {
  card: WebCard;
  path: string[];
  anchor: DOMRect;
  pinned: boolean;
}

interface NodeHoverPreviewProps {
  target: MindmapPreviewTarget | null;
  visible: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

function PreviewIcon({ card }: { card: WebCard }) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = getSiteIconCandidates(card);
  const semantic = getSemanticSiteIcon(card);
  const candidate = candidates[candidateIndex] || "";
  const SemanticIcon = semantic?.Icon;

  if (semantic && SemanticIcon && (semantic.prefer || !candidate)) {
    return (
      <span className="wc-mindmap-preview-favicon wc-mindmap-semantic-icon" style={{ background: semantic.background, color: semantic.color }} aria-hidden="true">
        <SemanticIcon />
      </span>
    );
  }
  if (candidate) {
    return (
      <span className="wc-mindmap-preview-favicon" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={candidate} alt="" onError={() => setCandidateIndex((index) => index + 1)} />
      </span>
    );
  }
  return <span className="wc-mindmap-preview-favicon is-fallback" aria-hidden="true">{card.abbreviation || card.title.slice(0, 1) || "?"}</span>;
}

export function NodeHoverPreview({ target, visible, onPointerEnter, onPointerLeave }: NodeHoverPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!target || !preview) return;
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;
    let left = target.anchor.right + 14;
    let top = target.anchor.top - 8;
    if (left + width + 8 > window.innerWidth) left = target.anchor.left - width - 14;
    if (top + height + 8 > window.innerHeight) top = window.innerHeight - height - 8;
    setPosition({
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      top: Math.max(8, top),
    });
  }, [target]);

  if (!target || typeof document === "undefined") return null;
  const description = target.card.shortDesc || target.card.fullDesc || "暂无简介 — 悬停网页节点即可查看详细介绍。";

  return createPortal(
    <div
      ref={previewRef}
      className={`wc-mindmap-preview${visible ? " is-visible" : ""}`}
      role="tooltip"
      data-testid="mindmap-hover-preview"
      style={position}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="wc-mindmap-preview-head">
        <PreviewIcon card={target.card} />
        <div className="wc-mindmap-preview-heading">
          <div className="wc-mindmap-preview-title">{target.card.title}</div>
          <div className="wc-mindmap-preview-url">{target.card.url}</div>
        </div>
      </div>
      <p className="wc-mindmap-preview-description">{description}</p>
      <div className="wc-mindmap-preview-path">位置：<b>{target.path.join(" › ")}</b></div>
      <div className="wc-mindmap-preview-actions" aria-hidden="true">
        <span className="wc-mindmap-preview-button is-primary">打开网页</span>
        <span className="wc-mindmap-preview-button is-ghost">{target.pinned ? "★ 已在收藏栏" : "☆ 收藏栏"}</span>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WebCard } from "@/lib/types";
import { ReadOnlySiteIcon } from "./read-only-site-icon";

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
  onOpen: (card: WebCard) => void;
  onTogglePin: (cardId: string) => void;
}

export function NodeHoverPreview({
  target,
  visible,
  onPointerEnter,
  onPointerLeave,
  onOpen,
  onTogglePin,
}: NodeHoverPreviewProps) {
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
      role="dialog"
      aria-label={`${target.card.title} 网页预览`}
      data-testid="mindmap-hover-preview"
      style={position}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="wc-mindmap-preview-head">
        <ReadOnlySiteIcon
          card={target.card}
          className="wc-mindmap-preview-favicon"
          fallbackClassName="is-fallback"
        />
        <div className="wc-mindmap-preview-heading">
          <div className="wc-mindmap-preview-title">{target.card.title}</div>
          <div className="wc-mindmap-preview-url">{target.card.url}</div>
        </div>
      </div>
      <p className="wc-mindmap-preview-description">{description}</p>
      <div className="wc-mindmap-preview-path">位置：<b>{target.path.join(" › ")}</b></div>
      <div className="wc-mindmap-preview-actions">
        <button
          type="button"
          className="wc-mindmap-preview-button is-primary"
          onClick={() => onOpen(target.card)}
        >
          打开网页
        </button>
        <button
          type="button"
          className="wc-mindmap-preview-button is-ghost"
          aria-pressed={target.pinned}
          onClick={() => onTogglePin(target.card.id)}
        >
          {target.pinned ? "★ 已在收藏栏" : "☆ 收藏栏"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WebCard } from "@/lib/types";
import { getSemanticSiteIcon, getSiteIconCandidates } from "@/lib/site-icons";

interface ReadOnlySiteIconProps {
  card: WebCard;
  className: string;
  fallbackClassName?: string;
  fallbackStyle?: CSSProperties;
}

export function ReadOnlySiteIcon({
  card,
  className,
  fallbackClassName = "",
  fallbackStyle,
}: ReadOnlySiteIconProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const candidates = useMemo(() => getSiteIconCandidates(card), [card]);
  const candidatesKey = candidates.join("\u0000");
  const semantic = useMemo(() => getSemanticSiteIcon(card), [card]);
  const candidate = candidates[candidateIndex] || "";
  const useSemantic = Boolean(semantic && (semantic.prefer || !candidate));
  const SemanticIcon = semantic?.Icon;
  const fallback = card.abbreviation || card.title.slice(0, 1) || "?";

  useEffect(() => {
    setCandidateIndex(0);
    setLoaded(false);
  }, [card.id, candidatesKey]);

  return (
    <span
      className={`${className} wc-mindmap-layered-icon ${fallbackClassName}`.trim()}
      style={fallbackStyle}
      aria-hidden="true"
    >
      <span className="wc-mindmap-icon-fallback-text">{fallback}</span>
      {useSemantic && SemanticIcon ? (
        <span
          className="wc-mindmap-icon-overlay wc-mindmap-semantic-icon is-loaded"
          style={{ background: semantic?.background, color: semantic?.color }}
        >
          <SemanticIcon />
        </span>
      ) : candidate ? (
        // The read-only map advances through existing favicon candidates and
        // never persists browsing results back to collection data.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={`wc-mindmap-icon-overlay${loaded ? " is-loaded" : ""}`}
          src={candidate}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setCandidateIndex((index) => index + 1);
          }}
        />
      ) : null}
    </span>
  );
}

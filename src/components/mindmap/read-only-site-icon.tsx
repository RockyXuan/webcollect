"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WebCard } from "@/lib/types";
import { cacheLoadedSiteIcon, getCachedSiteIcon } from "@/lib/site-icon-cache";
import {
  getSemanticSiteIcon,
  getSiteIconCandidates,
  isGenericFaviconProvider,
  shouldPersistSiteIcon,
} from "@/lib/site-icons";

interface ReadOnlySiteIconProps {
  card: WebCard;
  className: string;
  fallbackClassName?: string;
  fallbackStyle?: CSSProperties;
  onUpdateCard?: (card: WebCard) => void;
}

export function ReadOnlySiteIcon({
  card,
  className,
  fallbackClassName = "",
  fallbackStyle,
  onUpdateCard,
}: ReadOnlySiteIconProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [cachedIcon, setCachedIcon] = useState("");
  const candidates = useMemo(() => {
    const base = getSiteIconCandidates(card);
    const specificStored = card.imageUrl && !isGenericFaviconProvider(card.imageUrl) ? card.imageUrl : "";
    return [...new Set([specificStored, cachedIcon, ...base].filter(Boolean))];
  }, [cachedIcon, card]);
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

  useEffect(() => {
    let active = true;
    setCachedIcon("");
    void getCachedSiteIcon(card.url).then((value) => {
      if (active) setCachedIcon(value);
    });
    return () => {
      active = false;
    };
  }, [card.url]);

  const handleLoaded = () => {
    setLoaded(true);
    if (candidate !== card.imageUrl && !isGenericFaviconProvider(candidate)) {
      void cacheLoadedSiteIcon(card.url, candidate);
    }
    if (onUpdateCard && shouldPersistSiteIcon(card.imageUrl, candidate)) {
      onUpdateCard({ ...card, imageUrl: candidate, updatedAt: Date.now() });
    }
  };

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
          loading="lazy"
          onLoad={handleLoaded}
          onError={() => {
            setLoaded(false);
            setCandidateIndex((index) => index + 1);
          }}
        />
      ) : null}
    </span>
  );
}

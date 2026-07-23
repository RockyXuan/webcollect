"use client";

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  getAdaptiveLayoutMetrics,
  type AdaptiveLayoutMetrics,
} from "@/lib/adaptive-layout";
import { useAppStore } from "@/lib/store";

const FALLBACK_METRICS = getAdaptiveLayoutMetrics(1880);
const AdaptiveLayoutContext = createContext<AdaptiveLayoutMetrics>(FALLBACK_METRICS);

function metricsEqual(left: AdaptiveLayoutMetrics, right: AdaptiveLayoutMetrics): boolean {
  return left.availableWidth === right.availableWidth
    && left.effectiveWidth === right.effectiveWidth
    && left.density === right.density
    && left.textDensity === right.textDensity
    && left.controlHeight === right.controlHeight
    && left.tier === right.tier;
}

export function useAdaptiveLayoutMetrics(): AdaptiveLayoutMetrics {
  return useContext(AdaptiveLayoutContext);
}

interface AdaptiveResolutionViewportProps {
  children: ReactNode;
  mindmap?: boolean;
  className?: string;
}

export function AdaptiveResolutionViewport({
  children,
  mindmap = false,
  className = "",
}: AdaptiveResolutionViewportProps) {
  const visualScale = useAppStore((state) => state.visualScale);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [metrics, setMetrics] = useState(FALLBACK_METRICS);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const update = (availableWidth: number) => {
      const next = getAdaptiveLayoutMetrics(availableWidth, visualScale);
      setMetrics((current) => (metricsEqual(current, next) ? current : next));
    };
    const scheduleUpdate = (availableWidth: number) => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        update(availableWidth);
      });
    };

    update(viewport.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      scheduleUpdate(entry.contentRect.width);
    });
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [visualScale]);

  const style = useMemo(() => ({
    "--wc-adaptive-density": String(metrics.density),
    "--wc-adaptive-text-density": String(metrics.textDensity),
    "--wc-adaptive-control-height": `${metrics.controlHeight}px`,
    "--wc-site-tile-width": `${14.75 * metrics.density}rem`,
    "--wc-site-tile-edit-width": `${14.75 * metrics.density}rem`,
  }) as CSSProperties, [metrics]);

  const combinedClassName = [
    "wc-resolution-viewport",
    mindmap ? "wc-resolution-viewport-mindmap" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <AdaptiveLayoutContext.Provider value={metrics}>
      <div
        ref={viewportRef}
        className={combinedClassName}
        data-wc-layout-tier={metrics.tier}
        data-wc-layout-density={metrics.density}
        data-wc-available-width={Math.round(metrics.availableWidth)}
        style={style}
      >
        {children}
      </div>
    </AdaptiveLayoutContext.Provider>
  );
}

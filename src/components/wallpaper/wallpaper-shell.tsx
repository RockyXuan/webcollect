"use client";

import { RefreshCw, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import { getWallpaperQuote } from "@/lib/wallpaper-quotes";
import { getRotationMs, selectCurrentWallpaper, useWallpaperStore } from "@/lib/wallpaper-store";
import { WALLPAPER_BACKGROUND_CHECK_MS } from "@/lib/wallpaper-sources";
import type { WallpaperMode, WallpaperPrefs } from "@/lib/wallpaper-types";
import { WallpaperSettingsDialog } from "./wallpaper-settings-dialog";

const LONG_PRESS_MS = 700;
const IDLE_HINT_MS = 2000;
const FLING_WINDOW_MS = 650;
const FLING_DISTANCE_PX = 420;
const WHEEL_WALLPAPER_DELTA = 70;
const WHEEL_WALLPAPER_COOLDOWN_MS = 720;
const WIKIMEDIA_PREVIEW_WIDTH = 1600;

interface WallpaperShellProps {
  mode: WallpaperMode;
  children?: ReactNode;
  onEnterCollection: () => void;
}

type MouseSample = {
  x: number;
  at: number;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    [
      "button",
      "a",
      "input",
      "textarea",
      "select",
      "[role='dialog']",
      "[data-radix-popper-content-wrapper]",
      "[data-wallpaper-control]",
      ".wc-app-header",
      ".wc-bookmark-bar",
      ".wc-card",
      ".wc-category-block",
      ".wc-group-block",
      ".wc-hot-card",
    ].join(",")
  ));
}

function countDirectionChanges(samples: MouseSample[]): number {
  let changes = 0;
  let lastDirection = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index].x - samples[index - 1].x;
    const direction = Math.abs(delta) < 12 ? 0 : Math.sign(delta);
    if (direction !== 0 && lastDirection !== 0 && direction !== lastDirection) {
      changes += 1;
    }
    if (direction !== 0) lastDirection = direction;
  }
  return changes;
}

function getFastPreviewUrl(imageUrl: string, fallbackUrl: string): string {
  try {
    const url = new URL(fallbackUrl || imageUrl);
    if (
      url.hostname === "upload.wikimedia.org"
      && url.pathname.includes("/wikipedia/commons/")
      && !url.pathname.includes("/thumb/")
    ) {
      const segments = url.pathname.split("/");
      const fileName = segments[segments.length - 1];
      if (!fileName) return fallbackUrl || imageUrl;
      const prefix = segments.slice(0, 3).join("/");
      const rest = segments.slice(3).join("/");
      url.pathname = `${prefix}/thumb/${rest}/${WIKIMEDIA_PREVIEW_WIDTH}px-${fileName}`;
      return url.toString();
    }
  } catch {
    return fallbackUrl || imageUrl;
  }
  return fallbackUrl || imageUrl;
}

export function WallpaperShell({
  mode,
  children,
  onEnterCollection,
}: WallpaperShellProps) {
  const wallpaper = useWallpaperStore(selectCurrentWallpaper);
  const prefs = useWallpaperStore((state) => state.prefs);
  const initialize = useWallpaperStore((state) => state.initialize);
  const nextWallpaper = useWallpaperStore((state) => state.nextWallpaper);
  const updatePrefs = useWallpaperStore((state) => state.updatePrefs);
  const refreshOnlineWallpapers = useWallpaperStore((state) => state.refreshOnlineWallpapers);
  const isRefreshing = useWallpaperStore((state) => state.isRefreshing);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const idleHintTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartedAtRef = useRef(0);
  const mouseSamplesRef = useRef<MouseSample[]>([]);
  const lastFlingAtRef = useRef(0);
  const wheelDeltaRef = useRef(0);
  const lastWheelSwitchAtRef = useRef(0);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (mode !== "wallpaper") return;

    const refreshIfOnline = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void refreshOnlineWallpapers({ selectFresh: true });
    };

    refreshIfOnline();
    const interval = window.setInterval(refreshIfOnline, WALLPAPER_BACKGROUND_CHECK_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshIfOnline();
    };

    window.addEventListener("focus", refreshIfOnline);
    window.addEventListener("online", refreshIfOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfOnline);
      window.removeEventListener("online", refreshIfOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mode, refreshOnlineWallpapers]);

  useEffect(() => {
    if (mode !== "wallpaper" || prefs.paused) return;
    const intervalMs = getRotationMs(prefs.rotationInterval);
    if (!intervalMs) return;
    const interval = window.setInterval(() => {
      void nextWallpaper();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [mode, nextWallpaper, prefs.paused, prefs.rotationInterval]);

  useEffect(() => {
    if (mode !== "wallpaper") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Space" || event.key === "Enter") {
        event.preventDefault();
        onEnterCollection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, onEnterCollection]);

  const previewUrl = useMemo(
    () => getFastPreviewUrl(wallpaper.imageUrl, wallpaper.thumbnailUrl),
    [wallpaper.imageUrl, wallpaper.thumbnailUrl]
  );

  const previewStyle = useMemo(() => ({
    backgroundImage: `url("${previewUrl}")`,
  }), [previewUrl]);

  const imageStyle = useMemo(() => ({
    backgroundImage: `url("${wallpaper.imageUrl}")`,
  }), [wallpaper.imageUrl]);

  const quote = useMemo(() => getWallpaperQuote(wallpaper.quoteId), [wallpaper.quoteId]);
  const attribution = useMemo(() => (
    wallpaper.attribution
    || `${wallpaper.author} · ${wallpaper.sourceCollection} · ${wallpaper.license}`
  ), [wallpaper.attribution, wallpaper.author, wallpaper.license, wallpaper.sourceCollection]);

  useEffect(() => {
    let active = true;
    setFullImageLoaded(false);
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      if (active) setFullImageLoaded(true);
    };
    image.onerror = () => {
      if (active) setFullImageLoaded(false);
    };
    image.src = wallpaper.imageUrl;
    if (image.complete && image.naturalWidth > 0) {
      setFullImageLoaded(true);
    }
    return () => {
      active = false;
    };
  }, [wallpaper.imageUrl]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearIdleHint = useCallback(() => {
    if (idleHintTimerRef.current !== null) {
      window.clearTimeout(idleHintTimerRef.current);
      idleHintTimerRef.current = null;
    }
  }, []);

  const scheduleIdleHint = useCallback(() => {
    clearIdleHint();
    setHintVisible(false);
    if (!prefs.showZoomHints) return;
    idleHintTimerRef.current = window.setTimeout(() => {
      setHintVisible(true);
    }, IDLE_HINT_MS);
  }, [clearIdleHint, prefs.showZoomHints]);

  useEffect(() => {
    if (mode !== "wallpaper") {
      clearIdleHint();
      setHintVisible(false);
      return clearIdleHint;
    }
    scheduleIdleHint();
    return clearIdleHint;
  }, [clearIdleHint, mode, scheduleIdleHint, wallpaper.id]);

  const startLongPress = useCallback((event: PointerEvent<HTMLDivElement>, action: () => void) => {
    if (isInteractiveTarget(event.target)) return;
    clearLongPress();
    longPressTriggeredRef.current = false;
    pointerStartedAtRef.current = performance.now();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      action();
    }, LONG_PRESS_MS);
  }, [clearLongPress]);

  const handleWallpaperPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    if (isInteractiveTarget(event.target) || longPressTriggeredRef.current) return;
    if (performance.now() - pointerStartedAtRef.current < LONG_PRESS_MS) {
      onEnterCollection();
    }
  }, [clearLongPress, onEnterCollection]);

  const handleWallpaperMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    scheduleIdleHint();
    if (event.buttons !== 0 || isInteractiveTarget(event.target)) return;
    const now = performance.now();
    const samples = [...mouseSamplesRef.current, { x: event.clientX, at: now }]
      .filter((sample) => now - sample.at <= FLING_WINDOW_MS)
      .slice(-12);
    mouseSamplesRef.current = samples;

    if (now - lastFlingAtRef.current < 1400 || samples.length < 5) return;
    const xs = samples.map((sample) => sample.x);
    const span = Math.max(...xs) - Math.min(...xs);
    if (span >= FLING_DISTANCE_PX && countDirectionChanges(samples) >= 1) {
      lastFlingAtRef.current = now;
      mouseSamplesRef.current = [];
      onEnterCollection();
    }
  }, [onEnterCollection, scheduleIdleHint]);

  const handleWallpaperWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) return;
    scheduleIdleHint();

    const now = performance.now();
    if (now - lastWheelSwitchAtRef.current < WHEEL_WALLPAPER_COOLDOWN_MS) return;

    wheelDeltaRef.current += event.deltaY;
    if (Math.abs(wheelDeltaRef.current) < WHEEL_WALLPAPER_DELTA) return;

    wheelDeltaRef.current = 0;
    lastWheelSwitchAtRef.current = now;
    void nextWallpaper();
  }, [nextWallpaper, scheduleIdleHint]);

  const handlePrefsUpdate = useCallback((updates: Partial<WallpaperPrefs>) => {
    void updatePrefs(updates);
  }, [updatePrefs]);

  const handleDismissHint = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setHintVisible(false);
    handlePrefsUpdate({ showZoomHints: false });
  }, [handlePrefsUpdate]);

  const handleManualRefresh = useCallback(() => {
    void refreshOnlineWallpapers({ force: true, selectFresh: true });
  }, [refreshOnlineWallpapers]);

  const hintText = "滚轮换壁纸，长按或左右滑动进入网页墙";

  if (mode === "wallpaper") {
    return (
      <div
        className="wc-wallpaper-stage"
        tabIndex={0}
        onMouseMove={handleWallpaperMouseMove}
        onWheel={handleWallpaperWheel}
        onPointerDown={(event) => startLongPress(event, onEnterCollection)}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerUp={handleWallpaperPointerUp}
      >
        <div className="wc-wallpaper-preview" style={previewStyle} aria-hidden="true" />
        <div
          className={`wc-wallpaper-image ${fullImageLoaded ? "wc-wallpaper-image-loaded" : ""}`}
          style={imageStyle}
          aria-hidden="true"
        />
        <div className="wc-wallpaper-vignette" aria-hidden="true" />

        <figure className="wc-zoom-quote" aria-label="Zoom 模式短句">
          <blockquote>{quote.zh}</blockquote>
          <p>{quote.en}</p>
          <figcaption>{quote.source}</figcaption>
          <cite>{attribution}</cite>
        </figure>

        <div className="wc-wallpaper-controls" data-wallpaper-control>
          <button
            type="button"
            className="wc-wallpaper-control inline-flex items-center justify-center"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="立即更新壁纸"
            title="立即更新壁纸"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            className="wc-wallpaper-control inline-flex items-center justify-center"
            onClick={() => setSettingsOpen(true)}
            aria-label="壁纸设置"
            title="壁纸设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <WallpaperSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          prefs={prefs}
          isRefreshing={isRefreshing}
          onUpdatePrefs={handlePrefsUpdate}
          onRefresh={handleManualRefresh}
        />

        {prefs.showZoomHints ? (
          <div
            className={`wc-zoom-idle-hint ${hintVisible ? "wc-zoom-idle-hint-visible" : ""}`}
            data-wallpaper-control
          >
            <span>{hintText}</span>
            <button type="button" onClick={handleDismissHint}>不再提示</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="wc-wallpaper-collection-shell">
      {children}
    </div>
  );
}

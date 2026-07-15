"use client";

import { RefreshCw, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type WheelEvent } from "react";
import { getWallpaperQuote, isSyntheticWallpaperQuote, selectWallpaperQuote } from "@/lib/wallpaper-quotes";
import { getRotationMs, selectCurrentWallpaper, useWallpaperStore } from "@/lib/wallpaper-store";
import { getDisplayUrl, WALLPAPER_BACKGROUND_CHECK_MS } from "@/lib/wallpaper-sources";
import type { WallpaperMode, WallpaperPrefs } from "@/lib/wallpaper-types";
import { WallpaperSettingsDialog } from "./wallpaper-settings-dialog";

const IDLE_HINT_MS = 2000;
const WHEEL_WALLPAPER_DELTA = 70;
const WHEEL_WALLPAPER_COOLDOWN_MS = 720;
type WallpaperImageLoadStage = "display" | "original" | "failed";

interface WallpaperShellProps {
  mode: WallpaperMode;
  children?: ReactNode;
  onEnterCollection: () => void;
}

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

export function WallpaperShell({
  mode,
  children,
  onEnterCollection,
}: WallpaperShellProps) {
  const wallpaper = useWallpaperStore(selectCurrentWallpaper);
  const prefs = useWallpaperStore((state) => state.prefs);
  const wallpapers = useWallpaperStore((state) => state.wallpapers);
  const initialize = useWallpaperStore((state) => state.initialize);
  const nextWallpaper = useWallpaperStore((state) => state.nextWallpaper);
  const updatePrefs = useWallpaperStore((state) => state.updatePrefs);
  const refreshOnlineWallpapers = useWallpaperStore((state) => state.refreshOnlineWallpapers);
  const isRefreshing = useWallpaperStore((state) => state.isRefreshing);
  const isReady = useWallpaperStore((state) => state.isReady);
  const wallpaperError = useWallpaperStore((state) => state.error);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [imageLoadStage, setImageLoadStage] = useState<WallpaperImageLoadStage>("display");
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const idleHintTimerRef = useRef<number | null>(null);
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

  const displayUrl = useMemo(() => getDisplayUrl(wallpaper), [wallpaper]);
  const previewUrl = wallpaper.thumbnailUrl || displayUrl;
  const activeImageUrl = imageLoadStage === "original" ? wallpaper.imageUrl : displayUrl;

  const previewStyle = useMemo(() => ({
    backgroundImage: `url("${previewUrl}")`,
  }), [previewUrl]);

  const imageStyle = useMemo(() => ({
    backgroundImage: `url("${activeImageUrl}")`,
  }), [activeImageUrl]);

  const quote = useMemo(() => {
    const cachedQuote = getWallpaperQuote(prefs.currentQuoteId || wallpaper.quoteId);
    if ((prefs.themeMode === "cinema" || prefs.themeMode === "tv") || !isSyntheticWallpaperQuote(cachedQuote)) {
      return cachedQuote;
    }
    return selectWallpaperQuote({
      wallpaper,
      themeMode: prefs.themeMode,
      recentQuoteIds: prefs.recentQuoteIds,
    }).quote;
  }, [prefs.currentQuoteId, prefs.recentQuoteIds, prefs.themeMode, wallpaper]);
  const attribution = useMemo(() => (
    wallpaper.attribution
    || `${wallpaper.author} · ${wallpaper.sourceCollection} · ${wallpaper.license}`
  ), [wallpaper.attribution, wallpaper.author, wallpaper.license, wallpaper.sourceCollection]);
  const wallpaperSourceLabel = wallpaper.source === "fallback" || wallpaper.imageUrl.startsWith("/assets/wallpapers/")
    ? "本地"
    : "远程";

  useEffect(() => {
    let active = true;
    setFullImageLoaded(false);
    setImageLoadStage("display");
    setImageLoadError(null);

    if (mode !== "wallpaper") return;

    const loadImage = (url: string, stage: WallpaperImageLoadStage) => {
      const image = new window.Image();
      image.decoding = "async";
      image.onload = () => {
        if (!active) return;
        setImageLoadStage(stage);
        setFullImageLoaded(true);
        setImageLoadError(null);
      };
      image.onerror = () => {
        if (!active) return;
        if (stage === "display" && wallpaper.imageUrl && wallpaper.imageUrl !== url) {
          setImageLoadStage("original");
          loadImage(wallpaper.imageUrl, "original");
          return;
        }
        setImageLoadStage("failed");
        setFullImageLoaded(false);
        setImageLoadError("远程壁纸高清图加载失败，已保留预览图。");
      };
      image.src = url;
      if (image.complete && image.naturalWidth > 0) {
        setImageLoadStage(stage);
        setFullImageLoaded(true);
        setImageLoadError(null);
      }
    };

    loadImage(displayUrl, "display");
    return () => {
      active = false;
    };
  }, [displayUrl, mode, wallpaper.imageUrl]);

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

  const handleWallpaperClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    scheduleIdleHint();
    if (isInteractiveTarget(event.target)) return;
    onEnterCollection();
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

  const hintText = "滚轮换壁纸，点击空白处或按 Enter 进入网页墙";

  if (mode === "wallpaper") {
    return (
      <div
        className="wc-wallpaper-stage"
        tabIndex={0}
        aria-busy={!isReady}
        data-wallpaper-ready={isReady ? "true" : "false"}
        onClick={handleWallpaperClick}
        onWheel={handleWallpaperWheel}
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
          <span className="wc-wallpaper-source-badge">{wallpaperSourceLabel}</span>
        </figure>

        <div className="wc-wallpaper-controls" data-wallpaper-control>
          <button
            type="button"
            className="wc-wallpaper-control inline-flex items-center justify-center"
            onClick={handleManualRefresh}
            aria-busy={isRefreshing}
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
          wallpapers={wallpapers}
          isRefreshing={isRefreshing}
          error={imageLoadError || wallpaperError}
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

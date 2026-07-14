"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { useWallpaperStore } from "@/lib/wallpaper-store";

interface WallpaperQuickControlProps {
  onShowWallpaper: () => void;
}

export function WallpaperQuickControl({ onShowWallpaper }: WallpaperQuickControlProps) {
  const wallpaperStartupEnabled = useWallpaperStore((state) => state.prefs.defaultMode === "wallpaper");
  const updatePrefs = useWallpaperStore((state) => state.updatePrefs);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStartupToggle = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await updatePrefs({
        defaultMode: wallpaperStartupEnabled ? "collection" : "wallpaper",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleTitle = wallpaperStartupEnabled
    ? "启动壁纸模式已开启；点击后，下次新标签页直接进入主页"
    : "启动壁纸模式已关闭；点击后，下次新标签页先显示壁纸";

  return (
    <div
      className="wc-wallpaper-quick-control"
      data-enabled={wallpaperStartupEnabled ? "true" : "false"}
      aria-label="壁纸快捷设置"
    >
      <button
        type="button"
        className="wc-wallpaper-quick-open"
        onClick={onShowWallpaper}
        title="进入壁纸模式"
      >
        <ImageIcon className="h-4 w-4" aria-hidden="true" />
        <span className="wc-wallpaper-quick-title">壁纸</span>
      </button>
      <button
        type="button"
        role="switch"
        aria-label="启动壁纸模式"
        aria-checked={wallpaperStartupEnabled}
        className="wc-wallpaper-quick-toggle"
        onClick={() => void handleStartupToggle()}
        disabled={isUpdating}
        title={toggleTitle}
      >
        <span className="wc-wallpaper-quick-state" aria-hidden="true">
          {wallpaperStartupEnabled ? "开" : "关"}
        </span>
        <span className="wc-wallpaper-quick-track" aria-hidden="true">
          <span className="wc-wallpaper-quick-thumb" />
        </span>
      </button>
    </div>
  );
}

"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  WallpaperCategory,
  WallpaperPrefs,
  WallpaperRotationInterval,
  WallpaperThemeMode,
} from "@/lib/wallpaper-types";

const CATEGORY_OPTIONS: Array<{ id: WallpaperCategory; label: string }> = [
  { id: "landscape", label: "风景" },
  { id: "aerial", label: "航拍" },
  { id: "landmark", label: "名胜" },
  { id: "space", label: "宇宙" },
  { id: "animals", label: "动物" },
  { id: "ocean", label: "海洋" },
  { id: "weather", label: "天气" },
];

const ROTATION_OPTIONS: Array<{ id: WallpaperRotationInterval; label: string }> = [
  { id: "off", label: "关闭轮播" },
  { id: "5m", label: "每 5 分钟" },
  { id: "15m", label: "每 15 分钟" },
  { id: "1h", label: "每 1 小时" },
  { id: "open", label: "每次打开换一张" },
];

const THEME_OPTIONS: Array<{ id: WallpaperThemeMode; label: string }> = [
  { id: "auto", label: "Auto Mix" },
  { id: "nature", label: "Nature" },
  { id: "cinema", label: "Cinema" },
  { id: "art", label: "Art" },
  { id: "space", label: "Space" },
];

interface WallpaperSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: WallpaperPrefs;
  isRefreshing: boolean;
  onUpdatePrefs: (prefs: Partial<WallpaperPrefs>) => void;
  onRefresh: () => void;
}

export function WallpaperSettingsDialog({
  open,
  onOpenChange,
  prefs,
  isRefreshing,
  onUpdatePrefs,
  onRefresh,
}: WallpaperSettingsDialogProps) {
  const toggleCategory = (category: WallpaperCategory) => {
    const enabled = prefs.enabledCategories.includes(category);
    if (enabled && prefs.enabledCategories.length === 1) return;
    onUpdatePrefs({
      enabledCategories: enabled
        ? prefs.enabledCategories.filter((item) => item !== category)
        : [...prefs.enabledCategories, category],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-serif">壁纸设置</DialogTitle>
          <DialogDescription>
            选择壁纸分类、轮播节奏和默认打开方式。壁纸数据与收藏数据分开保存。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-2">
            <p className="text-sm font-bold text-slate-800">壁纸模式</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {THEME_OPTIONS.map((option) => {
                const active = prefs.themeMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`wc-wallpaper-setting-chip ${active ? "wc-wallpaper-setting-chip-active" : ""}`}
                    onClick={() => onUpdatePrefs({ themeMode: option.id })}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-bold text-slate-800">壁纸分类</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((option) => {
                const active = prefs.enabledCategories.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`wc-wallpaper-setting-chip ${active ? "wc-wallpaper-setting-chip-active" : ""}`}
                    onClick={() => toggleCategory(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-bold text-slate-800">
              <span>轮播间隔</span>
              <select
                className="wc-wallpaper-select"
                value={prefs.rotationInterval}
                onChange={(event) => onUpdatePrefs({ rotationInterval: event.target.value as WallpaperRotationInterval })}
              >
                {ROTATION_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-800">
              <span>默认打开</span>
              <select
                className="wc-wallpaper-select"
                value={prefs.defaultMode}
                onChange={(event) => onUpdatePrefs({ defaultMode: event.target.value === "collection" ? "collection" : "wallpaper" })}
              >
                <option value="wallpaper">先看壁纸</option>
                <option value="collection">直接进收藏墙</option>
              </select>
            </label>
          </section>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>联网时每天自动更新壁纸列表</span>
            <input
              type="checkbox"
              checked={prefs.autoUpdate}
              onChange={(event) => onUpdatePrefs({ autoUpdate: event.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            立即更新
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

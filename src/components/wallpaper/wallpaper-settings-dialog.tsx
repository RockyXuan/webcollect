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
  WallpaperItem,
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
  { id: "tv", label: "TV" },
  { id: "pets", label: "Pets" },
  { id: "art", label: "Art" },
  { id: "space", label: "Space" },
];

interface WallpaperSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: WallpaperPrefs;
  wallpapers: WallpaperItem[];
  isRefreshing: boolean;
  error: string | null;
  onUpdatePrefs: (prefs: Partial<WallpaperPrefs>) => void;
  onRefresh: () => void;
}

function isLocalWallpaper(item: WallpaperItem): boolean {
  return item.source === "fallback" || item.imageUrl.startsWith("/assets/wallpapers/");
}

function formatRefreshTime(timestamp: number): string {
  if (!timestamp) return "还没有刷新记录";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function WallpaperSettingsDialog({
  open,
  onOpenChange,
  prefs,
  wallpapers,
  isRefreshing,
  error,
  onUpdatePrefs,
  onRefresh,
}: WallpaperSettingsDialogProps) {
  const localCount = wallpapers.filter(isLocalWallpaper).length;
  const remoteCount = Math.max(0, wallpapers.length - localCount);

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="px-6 pt-6 pr-12 pb-4">
          <DialogTitle className="font-serif">壁纸设置</DialogTitle>
          <DialogDescription>
            选择壁纸分类、轮播节奏和默认打开方式。壁纸数据与收藏数据分开保存。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-2">
          <section className="space-y-2">
            <p className="text-sm font-bold text-slate-800">壁纸主题</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

          <label className="wc-wallpaper-mode-toggle">
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-slate-800">启动壁纸模式</span>
              <span className="block text-xs font-semibold text-slate-500">
                关闭后，下次打开新页面会直接进入主页。
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.defaultMode === "wallpaper"}
              onChange={(event) => onUpdatePrefs({ defaultMode: event.target.checked ? "wallpaper" : "collection" })}
              className="wc-wallpaper-mode-switch"
            />
          </label>

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

          <section className="grid gap-3">
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

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-500">上次远程刷新</span>
              <span className="font-bold text-slate-800">{formatRefreshTime(prefs.lastRemoteRefreshAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-500">图库数量</span>
              <span className="font-bold text-slate-800">远程图 {remoteCount} · 本地图 {localCount}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500">最近一次刷新错误</span>
              <span className={`max-w-[16rem] text-right font-bold ${error ? "text-rose-600" : "text-emerald-700"}`}>
                {error || "无"}
              </span>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-200 bg-background px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onRefresh}
            aria-busy={isRefreshing}
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

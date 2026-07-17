"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, History, Loader2, LogOut, RefreshCw, Settings, Trash2, Type, User, Wrench } from "lucide-react";
import { APP_RELEASE_DATE_DISPLAY, APP_VERSION } from "@/lib/app-version";
import { useAuthStore } from "@/lib/auth-store";
import type { LinkOpenMode } from "@/lib/types";
import { LocalSnapshotDialog } from "@/components/dialogs/local-snapshot-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { restoreStructureFromBestLocalSnapshot, saveVersionAndClearLocalData } from "@/lib/local-snapshots";
import { isChromeExtension } from "@/lib/platform";
import { DEFAULT_EXTENSION_CONFIG, EXTENSION_STORAGE_KEYS, setSupabaseConfig } from "@/lib/supabase-browser";
import { useAppStore } from "@/lib/store";
import { pushLocalSnapshotToCloud } from "@/lib/sync";
import {
  DEFAULT_FLOATING_CAPTURE_PREFS,
  getFloatingCapturePrefs,
  saveFloatingCapturePrefs,
  type FloatingCapturePrefs,
} from "@/lib/floating-capture";

function formatSyncTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function SyncStatusBadge() {
  const { isLoggedIn, syncStatus, localSavedAt, lastSyncAt, error, manualSync } = useAuthStore();
  if (!isLoggedIn) return null;

  const cloudText = syncStatus === "syncing"
    ? "\u4e91\u7aef\u540c\u6b65\u4e2d"
    : syncStatus === "queued"
      ? "\u4e91\u7aef\u5f85\u540c\u6b65"
      : syncStatus === "success"
        ? lastSyncAt ? `\u4e91\u7aef\u5df2\u540c\u6b65 ${formatSyncTime(lastSyncAt)}` : "\u4e91\u7aef\u5df2\u540c\u6b65"
        : syncStatus === "error"
          ? "\u4e91\u7aef\u540c\u6b65\u5931\u8d25"
          : "\u4e91\u7aef\u7b49\u5f85\u540c\u6b65";
  const localText = localSavedAt
    ? `\u672c\u5730\u5df2\u4fdd\u5b58 ${formatSyncTime(localSavedAt)}`
    : "\u672c\u5730\u5df2\u5c31\u7eea";
  const showLocalText = localSavedAt !== null;
  const Icon = syncStatus === "syncing"
    ? Loader2
    : syncStatus === "success"
      ? Check
      : syncStatus === "error"
        ? AlertCircle
        : RefreshCw;
  const tone = syncStatus === "error"
    ? "border-rose-200 bg-rose-50/90 text-rose-600"
    : syncStatus === "syncing" || syncStatus === "queued"
      ? "border-blue-200 bg-blue-50/90 text-blue-600"
      : "border-emerald-200 bg-white/80 text-slate-600";

  return (
    <button
      type="button"
      disabled={syncStatus === "syncing"}
      onClick={() => void manualSync()}
      className={`wc-sync-status-badge hidden rounded-2xl border px-3 text-xs shadow-sm shadow-blue-100/50 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-80 lg:flex ${tone}`}
      title={
        syncStatus === "error" && error
          ? `${error}\n\u70b9\u51fb\u91cd\u8bd5\u4e91\u7aef\u540c\u6b65`
          : `${showLocalText ? `${localText} / ` : ""}${cloudText}\n\u70b9\u51fb\u7acb\u5373\u4e91\u7aef\u540c\u6b65`
      }
    >
      {showLocalText && (
        <span className="wc-sync-status-line text-[11px] leading-none text-emerald-600">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate">{localText}</span>
        </span>
      )}
      <span className="wc-sync-status-line">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
        <span className="truncate">{cloudText}</span>
      </span>
    </button>
  );
}
export function UserMenu() {
  const {
    user,
    isLoggedIn,
    isLoading,
    syncStatus,
    syncMode,
    lastSyncAt,
    error,
    loginWithGoogle,
    logout,
    manualSync,
    setSyncMode,
    clearError,
  } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [configSaved, setConfigSaved] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [repairingLayout, setRepairingLayout] = useState(false);
  const [repairMessage, setRepairMessage] = useState("");
  const [clearingData, setClearingData] = useState(false);
  const [clearMessage, setClearMessage] = useState("");
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [allLinksDialogOpen, setAllLinksDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [capturePrefs, setCapturePrefs] = useState<FloatingCapturePrefs | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visualScale = useAppStore((s) => s.visualScale);
  const setVisualScale = useAppStore((s) => s.setVisualScale);
  const linkOpenMode = useAppStore((s) => s.linkOpenMode);
  const setLinkOpenMode = useAppStore((s) => s.setLinkOpenMode);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfigOpen(false);
      }
    }
    if (menuOpen || configOpen || error) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen, configOpen, error]);

  useEffect(() => {
    if (!isChromeExtension() || !chrome.storage?.local) return;
    chrome.storage.local.get(
      [EXTENSION_STORAGE_KEYS.url, EXTENSION_STORAGE_KEYS.anonKey],
      (result) => {
        const storedUrl = String(result[EXTENSION_STORAGE_KEYS.url] || "");
        const storedAnonKey = String(result[EXTENSION_STORAGE_KEYS.anonKey] || "");
        const shouldUseDefault =
          !storedUrl
          || !storedAnonKey
          || (storedUrl === DEFAULT_EXTENSION_CONFIG.url && storedAnonKey !== DEFAULT_EXTENSION_CONFIG.anonKey);
        const config = shouldUseDefault
          ? DEFAULT_EXTENSION_CONFIG
          : { url: storedUrl, anonKey: storedAnonKey };

        setSupabaseUrl(config.url);
        setSupabaseAnonKey(config.anonKey);

        if (shouldUseDefault) {
          chrome.storage.local.set({
            [EXTENSION_STORAGE_KEYS.url]: config.url,
            [EXTENSION_STORAGE_KEYS.anonKey]: config.anonKey,
          });
        }
      }
    );
  }, []);

  useEffect(() => {
    if (!isChromeExtension()) return;
    void getFloatingCapturePrefs().then(setCapturePrefs);
  }, []);

  const saveExtensionConfig = async () => {
    if (!isChromeExtension() || !chrome.storage?.local) return;
    const config = {
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
    };
    await chrome.storage.local.set({
      [EXTENSION_STORAGE_KEYS.url]: config.url,
      [EXTENSION_STORAGE_KEYS.anonKey]: config.anonKey,
    });
    if (config.url && config.anonKey) {
      setSupabaseConfig(config);
    }
    clearError();
    setConfigSaved(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="wc-user-menu relative flex items-center gap-1.5" ref={menuRef}>
        <button
          onClick={loginWithGoogle}
          className="wc-login-button"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google 登录
        </button>
        {isChromeExtension() && (
          <button
            type="button"
            onClick={() => {
              setConfigOpen((open) => !open);
              setConfigSaved(false);
            }}
            className="wc-round-tool"
            title="登录配置"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
        {(error || configOpen) && (
          <div className="wc-config-popover absolute right-0 top-full z-50 mt-3 w-96 max-w-[calc(100vw-24px)] p-4">
            {error && (
              <div className="wc-inline-message-danger flex gap-2 p-3 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="max-h-24 overflow-y-auto break-words">{error}</span>
              </div>
            )}
            {isChromeExtension() && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">扩展登录配置</p>
                <input
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="wc-input h-9 w-full rounded-2xl px-3 text-xs text-slate-900 outline-none"
                />
                <input
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="Supabase anon public key"
                  className="wc-input h-9 w-full rounded-2xl px-3 text-xs text-slate-900 outline-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] leading-relaxed text-slate-500">
                    {configSaved ? "已保存，刷新页面后再登录。" : "在 Supabase Project Settings > API 中查看。"}
                  </span>
                  <button
                    type="button"
                    onClick={saveExtensionConfig}
                    className="wc-action-primary h-8 rounded-xl px-3 text-xs"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const syncLabel: Record<string, string> = {
    idle: "\u7b49\u5f85\u540c\u6b65",
    queued: "\u4e91\u7aef\u5f85\u540c\u6b65",
    syncing: "\u540c\u6b65\u4e2d...",
    success: "\u5df2\u540c\u6b65",
    error: "\u540c\u6b65\u5931\u8d25",
  };

  const SyncIcon = syncStatus === "syncing"
    ? Loader2
    : syncStatus === "success"
    ? Check
    : syncStatus === "error"
    ? AlertCircle
    : RefreshCw;

  const saveVersionAndClearData = async () => {
    setClearingData(true);
    setClearMessage("");
    try {
      const snapshot = await saveVersionAndClearLocalData();
      await useAppStore.getState().loadData();

      if (user?.id) {
        useAuthStore.setState({ syncStatus: "syncing", error: null });
        try {
          await pushLocalSnapshotToCloud(user.id, { allowDestructiveClear: true });
          await useAppStore.getState().loadData();
          useAuthStore.setState({ syncStatus: "success", lastSyncAt: Date.now(), error: null });
          setClearMessage(`\u5df2\u4fdd\u5b58\u7248\u672c\u5e76\u6e05\u7a7a\uff0c\u672c\u5730\u548c\u4e91\u7aef\u5df2\u540c\u6b65\u3002\u7248\u672c\u65f6\u95f4\uff1a${formatSyncTime(snapshot.createdAt)}`);
        } catch (cloudError) {
          await useAppStore.getState().loadData();
          const message = cloudError instanceof Error ? cloudError.message : "\u4e91\u7aef\u540c\u6b65\u5931\u8d25";
          useAuthStore.setState({ syncStatus: "error", error: message });
          setClearMessage("\u5df2\u4fdd\u5b58\u7248\u672c\u5e76\u6e05\u7a7a\u672c\u5730\uff0c\u4f46\u4e91\u7aef\u6e05\u7a7a\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u624b\u52a8\u540c\u6b65\u3002");
        }
      } else {
        setClearMessage(`\u5df2\u4fdd\u5b58\u7248\u672c\u5e76\u6e05\u7a7a\u672c\u5730\u6570\u636e\u3002\u7248\u672c\u65f6\u95f4\uff1a${formatSyncTime(snapshot.createdAt)}`);
      }
    } catch (err) {
      setClearMessage(err instanceof Error ? err.message : "\u4fdd\u5b58\u7248\u672c\u6216\u6e05\u7a7a\u5931\u8d25");
    } finally {
      setClearingData(false);
    }
  };

  const updateCapturePrefs = async (patch: Partial<FloatingCapturePrefs>) => {
    const next = {
      ...(capturePrefs || DEFAULT_FLOATING_CAPTURE_PREFS),
      ...patch,
    };
    setCapturePrefs(next);
    await saveFloatingCapturePrefs(next);
  };

  const resetCapturePrefs = async () => {
    const next = {
      ...DEFAULT_FLOATING_CAPTURE_PREFS,
      mascot: "chipmunk" as const,
      recoveredAt: Date.now(),
    };
    setCapturePrefs(next);
    await saveFloatingCapturePrefs(next);
  };

  const toggleAllLinksHover = async () => {
    if (!capturePrefs) return;
    await updateCapturePrefs({
      hoverEnabled: true,
      allLinksHoverEnabled: !capturePrefs.allLinksHoverEnabled,
    });
  };

  const restoreStructureOnly = async () => {
    setRepairingLayout(true);
    setRepairMessage("");
    try {
      const result = await restoreStructureFromBestLocalSnapshot();
      await useAppStore.getState().loadData();
      setRepairMessage(
        `\u5df2\u4ece ${formatSyncTime(result.snapshotCreatedAt)} \u7684\u5feb\u7167\u4fee\u590d\u7ed3\u6784\uff1a${result.categoriesTouched} \u4e2a\u5206\u7c7b\u5173\u7cfb\uff0c${result.cardsMoved} \u4e2a\u7f51\u9875\u4f4d\u7f6e\uff0c\u5df2\u4fdd\u7559 ${result.newCardsKept} \u4e2a\u73b0\u6709\u7f51\u9875\u3002\u786e\u8ba4\u9875\u9762\u6b63\u786e\u540e\u518d\u624b\u52a8\u4e91\u540c\u6b65\u3002`
      );
    } catch (err) {
      setRepairMessage(err instanceof Error ? err.message : "\u4fee\u590d\u7ed3\u6784\u5931\u8d25");
    } finally {
      setRepairingLayout(false);
    }
  };

  const captureSizeScale = capturePrefs?.sizeScale ?? DEFAULT_FLOATING_CAPTURE_PREFS.sizeScale;
  const captureSizePercent = Math.round(captureSizeScale * 100);

  return (
    <div className="wc-user-menu relative" ref={menuRef}>
      <LocalSnapshotDialog open={snapshotOpen} onOpenChange={setSnapshotOpen} />
      <AlertDialog open={allLinksDialogOpen} onOpenChange={setAllLinksDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>开启所有链接提示？</AlertDialogTitle>
            <AlertDialogDescription>
              开启后，页面上几乎所有链接悬停都会出现 WC 提示，可能比较打扰。建议只在临时整理链接时开启。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void toggleAllLinksHover(); }}>
              开启
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>修复结构并保留网页？</AlertDialogTitle>
            <AlertDialogDescription>
              将先保存当前状态，然后从本地历史中选择结构最完整的一版，只恢复分项、分类、分组关系，保留所有现有网页。
              如果当前页面已经正确，请不要执行这个操作，直接手动云同步即可。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void restoreStructureOnly(); }}>
              继续修复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={clearDataDialogOpen} onOpenChange={(open) => {
        setClearDataDialogOpen(open);
        if (!open) setClearConfirmText("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存版本并清空数据？</AlertDialogTitle>
            <AlertDialogDescription>
              这个操作会先把当前完整数据保存到“版本回档”，然后清空主页、分项、分类、分组、网页、回收站和仓库。
              如果已登录，这次清空也会同步到云端，防止旧云端数据被拉回。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              最后确认：请输入“清空”
            </label>
            <input
              value={clearConfirmText}
              onChange={(event) => setClearConfirmText(event.target.value)}
              className="wc-input h-10 w-full rounded-2xl px-3 text-sm text-slate-900 outline-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearConfirmText !== "清空"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-45"
              onClick={() => { void saveVersionAndClearData(); }}
            >
              保存版本并清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="打开账户设置"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wc-primary-gradient)] p-1 text-white shadow-[0_14px_32px_rgba(37,99,235,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(79,70,229,0.36)]"
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName || user.email}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white/80"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <User className="h-4 w-4 text-white" />
          </div>
        )}
      </button>

      {menuOpen && (
        <div
          className="wc-drawer-backdrop fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => {
            setMenuOpen(false);
            setConfigOpen(false);
          }}
        />
      )}

      {menuOpen && (
        <div className="wc-settings-panel fixed right-6 top-5 z-50 max-h-[calc(100vh-2.5rem)] overflow-y-auto p-4">
          <div className="wc-settings-hero mb-4 flex items-center gap-4 p-4">
            <div className="wc-settings-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold">
              {(user?.displayName || user?.email || "X").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-950">
                {user?.displayName || "User"}
              </p>
              <p className="truncate text-sm text-slate-500">{user?.email}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                {APP_RELEASE_DATE_DISPLAY} · V{APP_VERSION}
              </p>
            </div>
          </div>

          <div className="wc-settings-card mb-3 flex items-center gap-3 px-4 py-3 text-sm text-slate-600">
            <SyncIcon className={`h-3.5 w-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
            <span>{syncLabel[syncStatus]}</span>
            {lastSyncAt && syncStatus !== "syncing" && (
              <span className="ml-auto text-xs">
                {formatSyncTime(lastSyncAt)}
              </span>
            )}
          </div>

          <div className="wc-settings-card mb-3 space-y-3 p-3">
            <div className="wc-settings-label px-1">同步</div>
            <button
              type="button"
              disabled={syncStatus === "syncing"}
              onClick={() => void manualSync()}
              className="wc-panel-action"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
              {"手动同步当前页面"}
            </button>
            <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
              <span>{"同步模式"}</span>
              <div className="wc-segmented">
                <button
                  type="button"
                  onClick={() => setSyncMode("manual")}
                  data-active={syncMode === "manual"}
                >
                  {"手动"}
                </button>
                <button
                  type="button"
                  onClick={() => setSyncMode("auto")}
                  data-active={syncMode === "auto"}
                >
                  {"自动"}
                </button>
              </div>
            </div>
          </div>

          <div className="wc-settings-card mb-3 space-y-4 p-3">
            <div className="wc-settings-label px-1">显示</div>
            <div className="space-y-2 px-1 text-xs text-slate-500">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5" />
                  {"页面大小"}
                </span>
                <span className="text-[11px] tabular-nums text-slate-500">{visualScale}%</span>
              </div>
              <input
                type="range"
                min={85}
                max={125}
                step={5}
                value={visualScale}
                onChange={(e) => setVisualScale(Number(e.target.value))}
                className="wc-range w-full"
                title={"页面大小"}
              />
            </div>

            <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
              <span>{"网页打开方式"}</span>
              <select
                value={linkOpenMode}
                onChange={(e) => setLinkOpenMode(e.target.value as LinkOpenMode)}
                className="wc-select h-8 max-w-[150px] px-2 text-xs outline-none"
                title={"网页打开方式"}
              >
                <option value="new-background-tab">{"留在 WebCollect"}</option>
                <option value="new-active-tab">{"切到新标签"}</option>
                <option value="current-tab">{"当前页打开"}</option>
              </select>
            </div>
          </div>

          {isChromeExtension() && capturePrefs && (
            <div className="wc-settings-card mb-3 space-y-3 p-3 text-xs text-slate-500">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  {"浮窗组件"}
                </span>
                <button
                  type="button"
                  onClick={() => updateCapturePrefs({ enabled: !capturePrefs.enabled })}
                  className="wc-pill-toggle"
                  data-active={capturePrefs.enabled}
                >
                  {capturePrefs.enabled ? "已开启" : "已关闭"}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500/90">
                浮窗组件会在网页右侧提供 WC 快捷收集，也可以在显性的链接地址上停留后弹出 WC 小按钮。
              </p>
              <div className="space-y-1.5">
                <div className="px-1 text-[11px] font-semibold text-slate-500">浮窗形象</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateCapturePrefs({ mascot: "chipmunk" })}
                    className="wc-mascot-choice"
                    data-active={capturePrefs.mascot !== "otter"}
                    aria-label="花栗鼠浮窗形象"
                    title="花栗鼠浮窗形象"
                  >
                    <span
                      className="wc-mascot-choice-art"
                      style={{ backgroundImage: "url('/assets/mascots/chipmunk-pill.png')" }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCapturePrefs({ mascot: "otter" })}
                    className="wc-mascot-choice"
                    data-active={capturePrefs.mascot === "otter"}
                    aria-label="水獭浮窗形象"
                    title="水獭浮窗形象"
                  >
                    <span
                      className="wc-mascot-choice-art"
                      style={{ backgroundImage: "url('/assets/mascots/otter-pill.png')" }}
                    />
                  </button>
                </div>
              </div>
              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
                  <span>{"浮窗大小"}</span>
                  <span className="tabular-nums">{captureSizePercent}%</span>
                </div>
                <input
                  type="range"
                  min={55}
                  max={115}
                  step={5}
                  value={captureSizePercent}
                  onChange={(e) => updateCapturePrefs({ sizeScale: Number(e.target.value) / 100 })}
                  className="wc-range w-full"
                  title="浮窗大小"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateCapturePrefs({ sizeScale: 0.67 })}
                    className="wc-pill-toggle text-center"
                    data-active={Math.abs(captureSizeScale - 0.67) < 0.01}
                  >
                    {"小"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCapturePrefs({ sizeScale: 0.82 })}
                    className="wc-pill-toggle text-center"
                    data-active={Math.abs(captureSizeScale - 0.82) < 0.01}
                  >
                    {"中"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCapturePrefs({ sizeScale: 1 })}
                    className="wc-pill-toggle text-center"
                    data-active={Math.abs(captureSizeScale - 1) < 0.01}
                  >
                    {"原始"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateCapturePrefs({ hoverEnabled: !capturePrefs.hoverEnabled })}
                  className="wc-pill-toggle"
                  data-active={capturePrefs.hoverEnabled}
                >
                  {`${capturePrefs.hoverEnabled ? "✓ " : ""}显性链接提示`}
                </button>
                <button
                  type="button"
                  onClick={() => updateCapturePrefs({ contextMenuEnabled: !capturePrefs.contextMenuEnabled })}
                  className="wc-pill-toggle"
                  data-active={capturePrefs.contextMenuEnabled}
                >
                  {`${capturePrefs.contextMenuEnabled ? "✓ " : ""}右键菜单`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (capturePrefs.allLinksHoverEnabled) {
                      void toggleAllLinksHover();
                    } else {
                      setAllLinksDialogOpen(true);
                    }
                  }}
                  className="wc-pill-toggle col-span-2"
                  data-active={capturePrefs.allLinksHoverEnabled}
                  title="开启后，页面上几乎所有链接都会出现 WC 提示，可能比较打扰。"
                >
                  {`${capturePrefs.allLinksHoverEnabled ? "✓ " : ""}所有链接提示（谨慎开启）`}
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => updateCapturePrefs({ pauseUntil: Date.now() + 60 * 60 * 1000 })}
                  className="wc-pill-toggle flex-1 text-center"
                >
                  {"暂停 1 小时"}
                </button>
                <button
                  type="button"
                  onClick={() => updateCapturePrefs({ pauseUntil: null })}
                  className="wc-pill-toggle flex-1 text-center"
                >
                  {"恢复显示"}
                </button>
              </div>
              <button
                type="button"
                onClick={resetCapturePrefs}
                className="wc-pill-toggle w-full"
                title="重置浮窗本机设置，恢复右侧小松鼠快捷收集"
              >
                {"恢复小松鼠浮窗"}
              </button>
              {capturePrefs.disabledHosts.length > 0 && (
                <button
                  type="button"
                  onClick={() => updateCapturePrefs({ disabledHosts: [] })}
                  className="wc-pill-toggle w-full"
                  title={"\u6e05\u9664\u6240\u6709\u201c\u6c38\u4e45\u4e0d\u663e\u793a\u201d\u7684\u7f51\u7ad9\u8bb0\u5f55"}
                >
                  {"恢复永久不显示的网站"}
                  <span className="ml-1 text-slate-400">
                    ({capturePrefs.disabledHosts.length})
                  </span>
                </button>
              )}
              <p className="text-[11px] leading-relaxed text-slate-500/90">
                {"本机设置，首版不参与云同步。“永久不显示”可在这里统一恢复。"}
              </p>
            </div>
          )}

          <div className="wc-settings-card space-y-1 p-3">
            <div className="wc-settings-label px-1">版本与维护</div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSnapshotOpen(true);
              }}
              className="wc-panel-action"
            >
              <History className="h-3.5 w-3.5" />
              {"版本回档"}
            </button>

            <button
              type="button"
              disabled={repairingLayout}
              onClick={() => setRestoreDialogOpen(true)}
              className="wc-panel-action"
            >
              {repairingLayout ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
              {"修复结构（保留网页）"}
            </button>

            <button
              type="button"
              disabled={clearingData || syncStatus === "syncing"}
              onClick={() => {
                setClearConfirmText("");
                setClearDataDialogOpen(true);
              }}
              className="wc-panel-action wc-panel-action-danger"
            >
              {clearingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {"保存版本并清空数据"}
            </button>
          </div>

          {repairMessage && (
            <div className="wc-inline-message mt-3 p-3 text-[11px] leading-relaxed">
              {repairMessage}
            </div>
          )}

          {clearMessage && (
            <div className="wc-inline-message mt-3 p-3 text-[11px] leading-relaxed">
              {clearMessage}
            </div>
          )}

          {syncStatus === "error" && error && (
            <div className="wc-inline-message-danger mt-3 max-h-32 overflow-y-auto break-words p-3 text-[11px] leading-relaxed">
              {error}
            </div>
          )}

          <button
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
            className="wc-panel-action mt-3 justify-center"
          >
            <LogOut className="h-3.5 w-3.5" />
            {"退出登录"}
          </button>
        </div>
      )}
    </div>
  );
}

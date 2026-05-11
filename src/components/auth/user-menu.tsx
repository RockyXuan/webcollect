"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, History, Loader2, LogOut, RefreshCw, Settings, Trash2, Type, User, Wrench } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import type { LinkOpenMode } from "@/lib/types";
import { LocalSnapshotDialog } from "@/components/dialogs/local-snapshot-dialog";
import { saveVersionAndClearLocalData } from "@/lib/local-snapshots";
import { isChromeExtension } from "@/lib/platform";
import { DEFAULT_EXTENSION_CONFIG, EXTENSION_STORAGE_KEYS, setSupabaseConfig } from "@/lib/supabase-browser";
import { repairLayoutFromHomelyImport } from "@/lib/recover-layout";
import { useAppStore } from "@/lib/store";
import { pushLocalSnapshotToCloud } from "@/lib/sync";

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
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : syncStatus === "syncing" || syncStatus === "queued"
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-border bg-card text-muted-foreground";

  return (
    <button
      type="button"
      disabled={syncStatus === "syncing"}
      onClick={manualSync}
      className={`hidden lg:flex h-7 max-w-[260px] items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-80 ${tone}`}
      title={
        syncStatus === "error" && error
          ? `${error}\n\u70b9\u51fb\u91cd\u8bd5\u4e91\u7aef\u540c\u6b65`
          : `${showLocalText ? `${localText} / ` : ""}${cloudText}\n\u70b9\u51fb\u7acb\u5373\u4e91\u7aef\u540c\u6b65`
      }
    >
      {showLocalText && (
        <>
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="shrink-0">{localText}</span>
          <span className="text-muted-foreground/40">/</span>
        </>
      )}
      <Icon className={`h-3.5 w-3.5 shrink-0 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
      <span className="truncate">{cloudText}</span>
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="relative flex items-center gap-1.5" ref={menuRef}>
        <button
          onClick={loginWithGoogle}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors"
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
          Login
        </button>
        {isChromeExtension() && (
          <button
            type="button"
            onClick={() => {
              setConfigOpen((open) => !open);
              setConfigSaved(false);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Login settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
        {(error || configOpen) && (
          <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border border-border bg-card shadow-lg z-50 p-3 space-y-3">
            {error && (
              <div className="flex gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="max-h-24 overflow-y-auto break-words">{error}</span>
              </div>
            )}
            {isChromeExtension() && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Extension Supabase config</p>
                <input
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground"
                />
                <input
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="Supabase anon public key"
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {configSaved ? "Saved. Reload this page, then login." : "Find it in Supabase Project Settings > API."}
                  </span>
                  <button
                    type="button"
                    onClick={saveExtensionConfig}
                    className="px-2.5 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Save
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
    const firstOk = window.confirm(
      "\u8fd9\u4e2a\u64cd\u4f5c\u4f1a\u5148\u628a\u5f53\u524d\u5b8c\u6574\u6570\u636e\u4fdd\u5b58\u5230\u201c\u7248\u672c\u56de\u6863\u201d\uff0c\u7136\u540e\u6e05\u7a7a\u4e3b\u9875\u3001\u5206\u9879\u3001\u5206\u7c7b\u3001\u5206\u7ec4\u3001\u7f51\u9875\u3001\u56de\u6536\u7ad9\u548c\u4ed3\u5e93\u3002\u7ee7\u7eed\u5417\uff1f"
    );
    if (!firstOk) return;

    const secondOk = window.confirm(
      "\u518d\u6b21\u786e\u8ba4\uff1a\u6e05\u7a7a\u540e\u9875\u9762\u53ea\u4fdd\u7559\u4e00\u4e2a\u7a7a\u7684\u6536\u96c6\u7bb1\u3002\u5982\u679c\u5df2\u767b\u5f55\uff0c\u8fd9\u6b21\u6e05\u7a7a\u4e5f\u4f1a\u540c\u6b65\u5230\u4e91\u7aef\uff0c\u9632\u6b62\u65e7\u4e91\u7aef\u6570\u636e\u53c8\u88ab\u62c9\u56de\u6765\u3002\u786e\u5b9a\u7ee7\u7eed\uff1f"
    );
    if (!secondOk) return;

    const typed = window.prompt("\u6700\u540e\u786e\u8ba4\uff1a\u8bf7\u8f93\u5165\u201c\u6e05\u7a7a\u201d\u4e24\u4e2a\u5b57\u3002");
    if (typed !== "\u6e05\u7a7a") return;

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

  const repairImportedLayout = async () => {
    const ok = window.confirm(
      "\u5c06\u5148\u4fdd\u5b58\u672c\u5730\u5feb\u7167\uff0c\u7136\u540e\u6309\u5bfc\u5165\u7ed3\u6784\u4fee\u590d\u88ab\u6253\u6563\u7684\u5206\u7ec4\u5173\u7cfb\u3002\u8fd9\u4e0d\u4f1a\u5220\u9664\u4f60\u7684\u7f51\u9875\u3002\u7ee7\u7eed\u5417\uff1f"
    );
    if (!ok) return;
    setRepairingLayout(true);
    setRepairMessage("");
    try {
      const result = await repairLayoutFromHomelyImport();
      await useAppStore.getState().loadData();
      setRepairMessage(
        `\u5df2\u4fee\u590d ${result.categoriesTouched} \u4e2a\u5206\u7c7b\u5173\u7cfb\uff0c\u79fb\u52a8 ${result.cardsMoved} \u4e2a\u7f51\u9875`
      );
    } catch (err) {
      setRepairMessage(err instanceof Error ? err.message : "\u4fee\u590d\u5931\u8d25");
    } finally {
      setRepairingLayout(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <LocalSnapshotDialog open={snapshotOpen} onOpenChange={setSnapshotOpen} />
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-primary/30 transition-all"
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName || user.email}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-border bg-card shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.displayName || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>

          <div className="px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border">
            <SyncIcon className={`h-3.5 w-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
            <span>{syncLabel[syncStatus]}</span>
            {lastSyncAt && syncStatus !== "syncing" && (
              <span className="ml-auto text-[10px]">
                {formatSyncTime(lastSyncAt)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={syncStatus === "syncing"}
            onClick={manualSync}
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors border-b border-border"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
            {"\u624b\u52a8\u540c\u6b65\u5f53\u524d\u9875\u9762"}
          </button>

          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{"\u540c\u6b65\u6a21\u5f0f"}</span>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setSyncMode("manual")}
                className={`px-2 py-1 transition-colors ${syncMode === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {"\u624b\u52a8"}
              </button>
              <button
                type="button"
                onClick={() => setSyncMode("auto")}
                className={`px-2 py-1 transition-colors ${syncMode === "auto" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {"\u81ea\u52a8"}
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-border space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" />
                {"\u9875\u9762\u5927\u5c0f"}
              </span>
              <span className="text-[11px] tabular-nums">{visualScale}%</span>
            </div>
            <input
              type="range"
              min={85}
              max={125}
              step={5}
              value={visualScale}
              onChange={(e) => setVisualScale(Number(e.target.value))}
              className="w-full accent-primary"
              title={"\u9875\u9762\u5927\u5c0f"}
            />
          </div>

          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{"\u7f51\u9875\u6253\u5f00\u65b9\u5f0f"}</span>
            <select
              value={linkOpenMode}
              onChange={(e) => setLinkOpenMode(e.target.value as LinkOpenMode)}
              className="h-7 max-w-[128px] rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              title={"\u7f51\u9875\u6253\u5f00\u65b9\u5f0f"}
            >
              <option value="new-background-tab">{"\u7559\u5728 WebCollect"}</option>
              <option value="new-active-tab">{"\u5207\u5230\u65b0\u6807\u7b7e"}</option>
              <option value="current-tab">{"\u5f53\u524d\u9875\u6253\u5f00"}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSnapshotOpen(true);
            }}
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 transition-colors border-b border-border"
          >
            <History className="h-3.5 w-3.5" />
            {"\u7248\u672c\u56de\u6863"}
          </button>

          <button
            type="button"
            disabled={clearingData || syncStatus === "syncing"}
            onClick={saveVersionAndClearData}
            className="w-full px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-wait flex items-center gap-2 transition-colors border-b border-border"
          >
            {clearingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {"\u4fdd\u5b58\u7248\u672c\u5e76\u6e05\u7a7a\u6570\u636e"}
          </button>

          <button
            type="button"
            disabled={repairingLayout}
            onClick={repairImportedLayout}
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-wait flex items-center gap-2 transition-colors border-b border-border"
          >
            {repairingLayout ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
            {"\u4fee\u590d\u5bfc\u5165\u7ed3\u6784"}
          </button>

          {repairMessage && (
            <div className="px-3 py-2 border-b border-border text-[11px] leading-relaxed text-muted-foreground">
              {repairMessage}
            </div>
          )}

          {clearMessage && (
            <div className="px-3 py-2 border-b border-border text-[11px] leading-relaxed text-muted-foreground">
              {clearMessage}
            </div>
          )}

          {syncStatus === "error" && error && (
            <div className="max-h-32 overflow-y-auto break-words px-3 py-2 border-b border-border text-[11px] leading-relaxed text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {"\u9000\u51fa\u767b\u5f55"}
          </button>
        </div>
      )}
    </div>
  );
}

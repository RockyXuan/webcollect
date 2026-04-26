"use client";

/**
 * UserMenu — displays login button or user avatar/menu when logged in
 * 
 * Integrated into TopNav. Shows:
 * - Not logged in: "登录" button with Google icon
 * - Logged in: Avatar + dropdown menu (sync status, logout)
 */

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { LogOut, RefreshCw, User, Check, AlertCircle, Loader2 } from "lucide-react";

export function UserMenu() {
  const { user, isLoggedIn, isLoading, syncStatus, lastSyncAt, loginWithGoogle, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }

  // Not logged in — show login button
  if (!isLoggedIn) {
    return (
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
        登录
      </button>
    );
  }

  // Logged in — show avatar + dropdown
  const syncLabel: Record<string, string> = {
    idle: "未同步",
    syncing: "同步中...",
    success: "已同步",
    error: "同步失败",
  };

  const SyncIcon = syncStatus === "syncing"
    ? Loader2
    : syncStatus === "success"
    ? Check
    : syncStatus === "error"
    ? AlertCircle
    : RefreshCw;

  return (
    <div className="relative" ref={menuRef}>
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
          {/* User info */}
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.displayName || "用户"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>

          {/* Sync status */}
          <div className="px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border">
            <SyncIcon className={`h-3.5 w-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
            <span>{syncLabel[syncStatus]}</span>
            {lastSyncAt && syncStatus !== "syncing" && (
              <span className="ml-auto text-[10px]">
                {new Date(lastSyncAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={() => { setMenuOpen(false); logout(); }}
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

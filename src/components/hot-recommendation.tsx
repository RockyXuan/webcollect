"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Plus,
  Search,
  ExternalLink,
} from "lucide-react";
import { hotSites, hotSiteCategories } from "@/lib/hot-sites";
import type { SafetyStatus, HotSite } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

/* ── HotSiteCard ── */
function HotSiteCard({
  site,
  onAdd,
  onCheckSafety,
  safetyStatus,
}: {
  site: HotSite;
  onAdd: (site: HotSite) => void;
  onCheckSafety: (url: string) => void;
  safetyStatus?: SafetyStatus;
}) {
  const [imgError, setImgError] = useState(false);

  const faviconUrl = useMemo(() => {
    if (site.imageUrl) return site.imageUrl;
    try {
      const u = new URL(site.url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch {
      return "";
    }
  }, [site.imageUrl, site.url]);

  const abbr = site.title.slice(0, 2).toUpperCase();

  const safetyIcon = (() => {
    switch (safetyStatus) {
      case "safe":
        return <ShieldCheck className="w-3 h-3 text-green-600" />;
      case "warning":
        return <ShieldAlert className="w-3 h-3 text-amber-500" />;
      case "danger":
        return <ShieldX className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  })();

  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors min-w-[180px] max-w-[240px] cursor-default">
      {/* 图标 */}
      <div className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center bg-muted overflow-hidden">
        {faviconUrl && !imgError ? (
          <img
            src={faviconUrl}
            alt={site.title}
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {abbr}
          </span>
        )}
      </div>

      {/* 名称 + 简介 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium truncate">{site.title}</span>
          {safetyIcon}
        </div>
        <span className="text-[11px] text-muted-foreground truncate block">
          {site.shortDesc}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onCheckSafety(site.url)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="安全检查"
        >
          <Shield className="w-3 h-3" />
        </button>
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="访问网站"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={() => onAdd(site)}
          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
          title="添加到我的收藏"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ── SafetyResultBadge ── */
function SafetyResultBadge({
  result,
}: {
  result: { status: SafetyStatus; details: string[] } | null;
}) {
  if (!result) return null;

  const config = {
    safe: {
      icon: <ShieldCheck className="w-4 h-4" />,
      label: "安全",
      bg: "bg-green-50 text-green-700 border-green-200",
    },
    warning: {
      icon: <ShieldAlert className="w-4 h-4" />,
      label: "警告",
      bg: "bg-amber-50 text-amber-700 border-amber-200",
    },
    danger: {
      icon: <ShieldX className="w-4 h-4" />,
      label: "危险",
      bg: "bg-red-50 text-red-700 border-red-200",
    },
    unknown: {
      icon: <Shield className="w-4 h-4" />,
      label: "未知",
      bg: "bg-muted text-muted-foreground border-border",
    },
  }[result.status];

  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-2 rounded-md border text-xs",
        config.bg
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div>
        <span className="font-medium">{config.label}</span>
        <ul className="mt-1 space-y-0.5">
          {result.details.map((d, i) => (
            <li key={i} className="text-[11px] opacity-80">
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── HotRecommendation ── */
export default function HotRecommendation() {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [safetyResults, setSafetyResults] = useState<
    Record<string, { status: SafetyStatus; details: string[] }>
  >({});
  const [checkingUrl, setCheckingUrl] = useState<string | null>(null);
  const [activeSafetyUrl, setActiveSafetyUrl] = useState<string | null>(null);

  const addCard = useAppStore((s) => s.addCard);
  const categories = useAppStore((s) => s.categories);

  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return hotSites;
    const q = searchQuery.toLowerCase();
    return hotSites.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.shortDesc.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const groupedSites = useMemo(() => {
    const groups: Record<string, typeof hotSites> = {};
    for (const cat of hotSiteCategories) {
      const sites = filteredSites.filter((s) => s.category === cat);
      if (sites.length > 0) groups[cat] = sites;
    }
    return groups;
  }, [filteredSites]);

  const handleAdd = (site: HotSite) => {
    const targetCategoryId = categories[0]?.id || "";
    const now = Date.now();
    addCard({
      id: crypto.randomUUID(),
      url: site.url,
      title: site.title,
      shortDesc: site.shortDesc,
      fullDesc: "",
      note: "",
      abbreviation: site.title.slice(0, 2).toUpperCase(),
      imageUrl: site.imageUrl,
      categoryId: targetCategoryId,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  };

  const handleCheckSafety = async (url: string) => {
    if (checkingUrl) return;
    setCheckingUrl(url);
    setActiveSafetyUrl(url);

    try {
      const res = await fetch("/api/check-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.status) {
        setSafetyResults((prev) => ({
          ...prev,
          [url]: { status: data.status, details: data.details },
        }));
      }
    } catch {
      setSafetyResults((prev) => ({
        ...prev,
        [url]: {
          status: "unknown",
          details: ["安全检查请求失败"],
        },
      }));
    } finally {
      setCheckingUrl(null);
    }
  };

  return (
    <div className="mt-6 border-t border-border/50 pt-4">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-0.5 hover:bg-muted rounded transition-colors"
        >
          {collapsed ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <h2 className="text-sm font-serif font-semibold text-foreground">
          热门网站推荐
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {hotSites.length} 个网站
        </span>
        <div className="flex-1" />
        {/* 搜索 */}
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索网站..."
            className="h-6 w-32 pl-6 pr-2 text-[11px] rounded-md border border-border/60 bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        {/* 批量安全检查 */}
        <button
          onClick={async () => {
            const allUrls = [...new Set(hotSites.map((s) => s.url))];
            for (const url of allUrls.slice(0, 5)) {
              await handleCheckSafety(url);
            }
          }}
          disabled={!!checkingUrl}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-border/60 hover:bg-muted transition-colors disabled:opacity-50"
          title="检查前5个网站安全性"
        >
          <Shield className="w-3 h-3" />
          {checkingUrl ? "检查中..." : "安全检查"}
        </button>
      </div>

      {/* 安全检查结果 */}
      {activeSafetyUrl && safetyResults[activeSafetyUrl] && (
        <div className="mb-3 px-1">
          <SafetyResultBadge result={safetyResults[activeSafetyUrl]} />
        </div>
      )}

      {/* 内容区 */}
      {!collapsed && (
        <div className="space-y-2">
          {Object.entries(groupedSites).map(([category, sites]) => (
            <div key={category}>
              <div className="flex items-center gap-1.5 px-1 mb-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {category}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {sites.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {sites.map((site) => (
                  <HotSiteCard
                    key={site.id}
                    site={site}
                    onAdd={handleAdd}
                    onCheckSafety={handleCheckSafety}
                    safetyStatus={safetyResults[site.url]?.status}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

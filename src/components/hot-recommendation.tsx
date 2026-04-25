"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { hotSites } from "@/lib/hot-sites";
import type { HotSite } from "@/lib/hot-sites";
import type { SafetyCheckResult } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react";

/* ── safety badge ── */
function SafetyBadge({ status }: { status: SafetyCheckResult | undefined }) {
  if (!status) return null;
  const map: Record<string, { icon: typeof ShieldCheck; cls: string; label: string }> = {
    safe: { icon: ShieldCheck, cls: "text-emerald-500", label: "安全" },
    warning: { icon: ShieldAlert, cls: "text-amber-500", label: "警告" },
    danger: { icon: ShieldX, cls: "text-red-500", label: "危险" },
  };
  const info = map[status.status] || map.safe;
  const Icon = info.icon;
  return (
    <span title={info.label} className="inline-flex items-center">
      <Icon className={`h-3 w-3 ${info.cls}`} />
    </span>
  );
}

/* ── main component ── */
export function HotRecommendation() {
  const cards = useAppStore((s) => s.cards);
  const categories = useAppStore((s) => s.categories);
  const addCard = useAppStore((s) => s.addCard);

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [safetyMap, setSafetyMap] = useState<Record<string, SafetyCheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());

  /* dedup: filter out sites user already has */
  const userUrls = useMemo(
    () =>
      new Set(
        cards.map((c) => {
          try {
            return new URL(c.url).hostname;
          } catch {
            return c.url;
          }
        }),
      ),
    [cards],
  );

  /* group by category and dedup */
  const groupedSites = useMemo(() => {
    const filtered = hotSites.filter((site) => {
      try {
        const hostname = new URL(site.url).hostname;
        return !userUrls.has(hostname) && !addedUrls.has(site.url);
      } catch {
        return !addedUrls.has(site.url);
      }
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return filtered
        .filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.shortDesc.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q),
        );
    }

    const groups: Record<string, HotSite[]> = {};
    for (const site of filtered) {
      if (!groups[site.category]) groups[site.category] = [];
      groups[site.category].push(site);
    }
    return Object.entries(groups);
  }, [userUrls, addedUrls, searchQuery]);

  const flatFiltered = useMemo(() => {
    if (searchQuery) return groupedSites as HotSite[];
    return (groupedSites as [string, HotSite[]][]).flatMap(([, sites]) => sites);
  }, [groupedSites, searchQuery]);

  /* expand first category by default */
  useEffect(() => {
    if (!searchQuery && expandedCats.size === 0) {
      const cats = groupedSites as [string, HotSite[]][];
      if (cats.length > 0) setExpandedCats(new Set([cats[0][0]]));
    }
  }, [groupedSites, expandedCats.size, searchQuery]);

  const toggleCat = useCallback((cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  /* add to inbox (uncategorized) */
  const handleQuickAdd = useCallback(
    (site: HotSite) => {
      const inboxCat = categories.find((c) => c.id === "cat-inbox");
      const targetCatId = inboxCat ? "cat-inbox" : categories[0]?.id || "";
      const existingInCat = cards.filter((c) => c.categoryId === targetCatId);
      const newCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: site.url,
        title: site.title,
        shortDesc: site.shortDesc,
        fullDesc: "",
        note: "",
        abbreviation: site.title.slice(0, 2).toUpperCase(),
        imageUrl: site.imageUrl,
        categoryId: targetCatId,
        order: existingInCat.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addCard(newCard);
      setAddedUrls((prev) => new Set(prev).add(site.url));
    },
    [categories, cards, addCard],
  );

  /* add to specific category */
  const handleAddToCategory = useCallback(
    (site: HotSite, categoryId: string) => {
      const existingInCat = cards.filter((c) => c.categoryId === categoryId);
      const newCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: site.url,
        title: site.title,
        shortDesc: site.shortDesc,
        fullDesc: "",
        note: "",
        abbreviation: site.title.slice(0, 2).toUpperCase(),
        imageUrl: site.imageUrl,
        categoryId,
        order: existingInCat.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addCard(newCard);
      setAddedUrls((prev) => new Set(prev).add(site.url));
    },
    [cards, addCard],
  );

  /* safety check */
  const checkSafety = useCallback(async () => {
    if (flatFiltered.length === 0) return;
    setChecking(true);
    try {
      const res = await fetch("/api/check-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: flatFiltered.map((s) => s.url),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, SafetyCheckResult> = {};
        for (const r of data.results as SafetyCheckResult[]) {
          map[r.url] = r;
        }
        setSafetyMap(map);
      }
    } catch {
      /* ignore */
    }
    setChecking(false);
  }, [flatFiltered]);

  /* auto-check on first load */
  const autoChecked = useRef(false);
  useEffect(() => {
    if (!autoChecked.current && flatFiltered.length > 0) {
      autoChecked.current = true;
      checkSafety();
    }
  }, [flatFiltered.length, checkSafety]);

  /* render a single site card */
  const renderSite = (site: HotSite) => {
    const safety = safetyMap[site.url];
    const isAdded = addedUrls.has(site.url);
    return (
      <div
        key={site.id}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors group min-w-0"
      >
        {/* icon */}
        <img
          src={site.imageUrl}
          alt=""
          className="h-5 w-5 rounded-sm flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />

        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium truncate">{site.title}</span>
            <SafetyBadge status={safety} />
          </div>
          <span className="text-[10px] text-muted-foreground truncate block">
            {site.shortDesc}
          </span>
        </div>

        {/* add button */}
        {isAdded ? (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">已添加</span>
        ) : (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => handleQuickAdd(site)}
              title="添加到收集箱"
              className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
            >
              <Inbox className="h-3.5 w-3.5" />
            </button>
            <select
              className="text-[10px] bg-transparent border border-border/50 rounded px-0.5 py-0.5 max-w-[60px] cursor-pointer"
              value=""
              onChange={(e) => {
                if (e.target.value) handleAddToCategory(site, e.target.value);
              }}
              title="添加到分类"
            >
              <option value="">分类</option>
              {categories
                .filter((c) => c.id !== "cat-inbox")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
    );
  };

  if (flatFiltered.length === 0 && !searchQuery) return null;

  return (
    <div className="mt-6">
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-serif font-semibold flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-primary" />
          热门网站推荐
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="搜索推荐网站..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs border border-border/50 rounded-md px-2 py-1 w-36 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={checkSafety}
            disabled={checking}
            className="text-[10px] px-2 py-1 rounded-md border border-border/50 hover:bg-muted/50 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <Shield className="h-3 w-3" />
            {checking ? "扫描中..." : "安全扫描"}
          </button>
        </div>
      </div>

      {/* search results */}
      {searchQuery ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
          {(flatFiltered as HotSite[]).map(renderSite)}
        </div>
      ) : (
        /* grouped display */
        <div className="space-y-1.5">
          {(groupedSites as [string, HotSite[]][]).map(([catName, sites]) => (
            <div key={catName}>
              <button
                onClick={() => toggleCat(catName)}
                className="flex items-center gap-1.5 w-full text-left py-1 px-1 hover:bg-muted/30 rounded transition-colors"
              >
                {expandedCats.has(catName) ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">{catName}</span>
                <span className="text-[10px] text-muted-foreground">({sites.length})</span>
              </button>
              {expandedCats.has(catName) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 mt-1">
                  {sites.map(renderSite)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { hotSites, hotSiteCategories } from "@/lib/hot-sites";
import type { HotSite } from "@/lib/hot-sites";
import type { SafetyCheckResult } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import {
  Inbox,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Check,
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
  const [safetyMap, setSafetyMap] = useState<Record<string, SafetyCheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());

  /* dedup: track which domains user already has */
  const userDomains = useMemo(
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

  /* check if a site is already in user's collection or just added */
  const isSiteAdded = useCallback(
    (site: HotSite) => {
      if (addedUrls.has(site.url)) return true;
      try {
        const hostname = new URL(site.url).hostname;
        return userDomains.has(hostname);
      } catch {
        return false;
      }
    },
    [userDomains, addedUrls],
  );

  /* group by category, keeping ALL sites (including already-added ones) */
  const groupedSites = useMemo(() => {
    const filtered = searchQuery
      ? hotSites.filter(
          (s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.category.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : hotSites;

    const groups: [string, HotSite[]][] = [];
    for (const catName of hotSiteCategories) {
      const sites = filtered.filter((s) => s.category === catName);
      if (sites.length > 0) {
        groups.push([catName, sites]);
      }
    }
    /* add any categories not in hotSiteCategories */
    const coveredCats = new Set(hotSiteCategories);
    const extraGroups: Record<string, HotSite[]> = {};
    for (const site of filtered) {
      if (!coveredCats.has(site.category)) {
        if (!extraGroups[site.category]) extraGroups[site.category] = [];
        extraGroups[site.category].push(site);
      }
    }
    for (const [catName, sites] of Object.entries(extraGroups)) {
      groups.push([catName, sites]);
    }
    return groups;
  }, [searchQuery]);

  /* add to inbox */
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
  const flatFiltered = useMemo(() => groupedSites.flatMap(([, sites]) => sites), [groupedSites]);

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

  /* render a single site item */
  const renderSite = (site: HotSite) => {
    const safety = safetyMap[site.url];
    const added = isSiteAdded(site);
    return (
      <div
        key={site.id}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors group min-w-0 ${
          added
            ? "bg-muted/20 opacity-60"
            : "bg-muted/40 hover:bg-muted/70"
        }`}
      >
        {/* icon */}
        <img
          src={site.imageUrl}
          alt=""
          className="h-4 w-4 rounded-sm flex-shrink-0"
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
          <span className="text-[10px] text-muted-foreground truncate block leading-tight">
            {site.shortDesc}
          </span>
        </div>

        {/* action */}
        {added ? (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
            <Check className="h-3 w-3" />
            已添加
          </span>
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

      {/* search results - flat grid */}
      {searchQuery ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
          {flatFiltered.map(renderSite)}
        </div>
      ) : (
        /* grouped display - multi-column layout to fill space */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(groupedSites as [string, HotSite[]][]).map(([catName, sites]) => (
            <div
              key={catName}
              className="rounded-lg border border-border/40 bg-card/50 p-2.5"
            >
              {/* category header - always visible, no collapse */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold">{catName}</span>
                <span className="text-[10px] text-muted-foreground">({sites.length})</span>
              </div>
              {/* sites list - always expanded */}
              <div className="space-y-1">
                {sites.map(renderSite)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

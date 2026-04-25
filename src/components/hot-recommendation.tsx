"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { hotSites, extraHotSites, hotSiteCategories } from "@/lib/hot-sites";
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
  ChevronDown,
  ChevronRight,
  RefreshCw,
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

/* ── Category group with smart collapse ── */
interface CategoryGroupProps {
  catName: string;
  newSites: HotSite[];
  addedSites: HotSite[];
  safetyMap: Record<string, SafetyCheckResult>;
  isSiteAdded: (site: HotSite) => boolean;
  onQuickAdd: (site: HotSite) => void;
  onAddToCategory: (site: HotSite, categoryId: string) => void;
  categories: { id: string; name: string }[];
  allAdded: boolean;
}

function CategoryGroup({
  catName,
  newSites,
  addedSites,
  safetyMap,
  onQuickAdd,
  onAddToCategory,
  categories,
  allAdded,
}: CategoryGroupProps) {
  const [showAdded, setShowAdded] = useState(false);

  /* If all sites are added, default collapsed */
  if (allAdded) {
    return (
      <div className="rounded-lg border border-border/30 bg-muted/20 p-2.5 opacity-70">
        <button
          onClick={() => setShowAdded(!showAdded)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {showAdded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-muted-foreground">{catName}</span>
          <span className="text-[10px] text-muted-foreground/60">
            全部已添加 ({addedSites.length})
          </span>
        </button>
        {showAdded && (
          <div className="mt-1.5 space-y-1">
            {addedSites.map((site) => (
              <AddedSiteItem key={site.id} site={site} safety={safetyMap[site.url]} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5">
      {/* header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-semibold">{catName}</span>
        <span className="text-[10px] text-emerald-600/70">{newSites.length} 可添加</span>
        {addedSites.length > 0 && (
          <button
            onClick={() => setShowAdded(!showAdded)}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            {showAdded ? (
              <ChevronDown className="h-2.5 w-2.5" />
            ) : (
              <ChevronRight className="h-2.5 w-2.5" />
            )}
            已添加 {addedSites.length}
          </button>
        )}
      </div>

      {/* new (unadded) sites */}
      <div className="space-y-1">
        {newSites.map((site) => (
          <NewSiteItem
            key={site.id}
            site={site}
            safety={safetyMap[site.url]}
            onQuickAdd={onQuickAdd}
            onAddToCategory={onAddToCategory}
            categories={categories}
          />
        ))}
      </div>

      {/* added sites - collapsed by default */}
      {showAdded && addedSites.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
          {addedSites.map((site) => (
            <AddedSiteItem key={site.id} site={site} safety={safetyMap[site.url]} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── New (unadded) site item ── */
function NewSiteItem({
  site,
  safety,
  onQuickAdd,
  onAddToCategory,
  categories,
}: {
  site: HotSite;
  safety: SafetyCheckResult | undefined;
  onQuickAdd: (site: HotSite) => void;
  onAddToCategory: (site: HotSite, categoryId: string) => void;
  categories: { id: string; name: string }[];
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors group min-w-0">
      <img
        src={site.imageUrl}
        alt=""
        className="h-4 w-4 rounded-sm flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium truncate">{site.title}</span>
          <SafetyBadge status={safety} />
        </div>
        <span className="text-[10px] text-muted-foreground truncate block leading-tight">
          {site.shortDesc}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onQuickAdd(site)}
          title="添加到收集箱"
          className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
        >
          <Inbox className="h-3.5 w-3.5" />
        </button>
        <select
          className="text-[10px] bg-transparent border border-border/50 rounded px-0.5 py-0.5 max-w-[60px] cursor-pointer"
          value=""
          onChange={(e) => {
            if (e.target.value) onAddToCategory(site, e.target.value);
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
    </div>
  );
}

/* ── Added site item (grey, compact) ── */
function AddedSiteItem({
  site,
  safety,
}: {
  site: HotSite;
  safety: SafetyCheckResult | undefined;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/15 min-w-0">
      <img
        src={site.imageUrl}
        alt=""
        className="h-3.5 w-3.5 rounded-sm flex-shrink-0 opacity-50"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground truncate">{site.title}</span>
          <SafetyBadge status={safety} />
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground/50 flex items-center gap-0.5 flex-shrink-0">
        <Check className="h-2.5 w-2.5" />
        已添加
      </span>
    </div>
  );
}

/* ── Main component ── */
export function HotRecommendation() {
  const cards = useAppStore((s) => s.cards);
  const categories = useAppStore((s) => s.categories);
  const addCard = useAppStore((s) => s.addCard);

  const [searchQuery, setSearchQuery] = useState("");
  const [safetyMap, setSafetyMap] = useState<Record<string, SafetyCheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [showExtra, setShowExtra] = useState(false);

  /* Combine main + extra sites */
  const allSites = useMemo(
    () => (showExtra ? [...hotSites, ...extraHotSites] : hotSites),
    [showExtra],
  );

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

  /* group by category, split into new/added, sort: partial categories first, all-added last */
  const categorizedGroups = useMemo(() => {
    const filtered = searchQuery
      ? allSites.filter(
          (s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.category.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : allSites;

    const groups: {
      catName: string;
      newSites: HotSite[];
      addedSites: HotSite[];
      allAdded: boolean;
    }[] = [];

    const seenCats = new Set<string>();

    for (const catName of hotSiteCategories) {
      const catSites = filtered.filter((s) => s.category === catName);
      if (catSites.length === 0) continue;
      seenCats.add(catName);

      const newSites = catSites.filter((s) => !isSiteAdded(s));
      const addedSites = catSites.filter((s) => isSiteAdded(s));
      const allAdded = newSites.length === 0;

      groups.push({ catName, newSites, addedSites, allAdded });
    }

    /* handle any categories not in hotSiteCategories */
    for (const site of filtered) {
      if (!seenCats.has(site.category)) {
        seenCats.add(site.category);
        const catSites = filtered.filter((s) => s.category === site.category);
        const newSites = catSites.filter((s) => !isSiteAdded(s));
        const addedSites = catSites.filter((s) => isSiteAdded(s));
        groups.push({ catName: site.category, newSites, addedSites, allAdded: newSites.length === 0 });
      }
    }

    /* Sort: partial categories first, all-added categories last */
    groups.sort((a, b) => {
      if (a.allAdded !== b.allAdded) return a.allAdded ? 1 : -1;
      return 0;
    });

    return groups;
  }, [allSites, isSiteAdded, searchQuery]);

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
  const flatFiltered = useMemo(
    () => allSites.filter((s) => !isSiteAdded(s)),
    [allSites, isSiteAdded],
  );

  const checkSafety = useCallback(async () => {
    if (flatFiltered.length === 0) return;
    setChecking(true);
    try {
      const res = await fetch("/api/check-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: flatFiltered.slice(0, 20).map((s) => s.url),
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

  /* count new vs added across all */
  const totalNew = useMemo(
    () => categorizedGroups.reduce((sum, g) => sum + g.newSites.length, 0),
    [categorizedGroups],
  );
  const totalAdded = useMemo(
    () => categorizedGroups.reduce((sum, g) => sum + g.addedSites.length, 0),
    [categorizedGroups],
  );

  if (categorizedGroups.length === 0 && !searchQuery) return null;

  return (
    <div className="mt-6">
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-serif font-semibold flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-primary" />
          热门网站推荐
          <span className="text-[10px] text-muted-foreground font-normal ml-1">
            {totalNew} 可添加 / {totalAdded} 已添加
          </span>
        </h2>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="搜索推荐网站..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs border border-border/50 rounded-md px-2 py-1 w-32 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={() => setShowExtra(!showExtra)}
            className="text-[10px] px-2 py-1 rounded-md border border-border/50 hover:bg-muted/50 transition-colors flex items-center gap-1"
            title={showExtra ? "收起更多推荐" : "加载更多推荐"}
          >
            <RefreshCw className={`h-3 w-3 ${showExtra ? "text-primary" : ""}`} />
            {showExtra ? "收起" : "更多"}
          </button>
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
          {allSites
            .filter(
              (s) =>
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((site) => {
              const added = isSiteAdded(site);
              return added ? (
                <AddedSiteItem key={site.id} site={site} safety={safetyMap[site.url]} />
              ) : (
                <NewSiteItem
                  key={site.id}
                  site={site}
                  safety={safetyMap[site.url]}
                  onQuickAdd={handleQuickAdd}
                  onAddToCategory={handleAddToCategory}
                  categories={categories}
                />
              );
            })}
        </div>
      ) : (
        /* grouped display - multi-column layout */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categorizedGroups.map((group) => (
            <CategoryGroup
              key={group.catName}
              catName={group.catName}
              newSites={group.newSites}
              addedSites={group.addedSites}
              safetyMap={safetyMap}
              isSiteAdded={isSiteAdded}
              onQuickAdd={handleQuickAdd}
              onAddToCategory={handleAddToCategory}
              categories={categories}
              allAdded={group.allAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

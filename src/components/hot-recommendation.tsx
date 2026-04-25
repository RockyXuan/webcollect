"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { hotSites, extraHotSites, hotSiteCategories } from "@/lib/hot-sites";
import type { HotSite } from "@/lib/hot-sites";
import type { SafetyCheckResult } from "@/lib/types";
import { HIDE_DURATION_LABELS, type HideDuration } from "@/lib/types";
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
  EyeOff,
  Settings,
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

/* ── Settings panel ── */
function SettingsPanel({
  open,
  onClose,
  defaultDuration,
  onDurationChange,
  totalNew,
  totalAdded,
  totalHidden,
  onSafetyCheck,
  checking,
}: {
  open: boolean;
  onClose: () => void;
  defaultDuration: HideDuration;
  onDurationChange: (d: HideDuration) => void;
  totalNew: number;
  totalAdded: number;
  totalHidden: number;
  onSafetyCheck: () => void;
  checking: boolean;
}) {
  if (!open) return null;

  return (
    <div className="absolute right-0 top-8 z-30 bg-popover border border-border rounded-lg shadow-lg py-2 min-w-[180px]">
      <div className="px-3 py-1 text-xs font-semibold border-b border-border/30 text-foreground">
        推荐设置
      </div>

      {/* Statistics */}
      <div className="px-3 py-2 border-b border-border/20">
        <div className="text-[10px] text-muted-foreground mb-1">统计</div>
        <div className="flex gap-3 text-[11px]">
          <span className="text-emerald-600/80">{totalNew} 可添加</span>
          <span className="text-muted-foreground">{totalAdded} 已添加</span>
          <span className="text-muted-foreground/60">{totalHidden} 已隐藏</span>
        </div>
      </div>

      {/* Hide duration setting */}
      <div className="px-3 py-2 border-b border-border/20">
        <div className="text-[10px] text-muted-foreground mb-1.5">默认屏蔽时长</div>
        <div className="space-y-1">
          {(Object.entries(HIDE_DURATION_LABELS) as [HideDuration, string][]).map(
            ([val, label]) => (
              <label
                key={val}
                className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-muted/30 px-1 py-0.5 rounded"
              >
                <input
                  type="radio"
                  name="hideDuration"
                  checked={defaultDuration === val}
                  onChange={() => onDurationChange(val)}
                  className="accent-primary"
                />
                {label}
              </label>
            ),
          )}
        </div>
      </div>

      {/* Safety scan */}
      <div className="px-3 py-2">
        <button
          onClick={onSafetyCheck}
          disabled={checking}
          className="w-full text-[11px] px-2 py-1.5 rounded-md border border-border/50 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Shield className="h-3 w-3" />
          {checking ? "扫描中..." : "安全扫描"}
        </button>
      </div>

      <button
        onClick={onClose}
        className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
      >
        关闭
      </button>
    </div>
  );
}

/* ── Category group with smart collapse ── */
interface CategoryGroupProps {
  catName: string;
  newSites: HotSite[];
  addedSites: HotSite[];
  hiddenCount: number;
  safetyMap: Record<string, SafetyCheckResult>;
  isSiteAdded: (site: HotSite) => boolean;
  onQuickAdd: (site: HotSite) => void;
  onAddToCategory: (site: HotSite, categoryId: string) => void;
  onHideSite: (siteId: string, siteUrl: string) => void;
  categories: { id: string; name: string }[];
  allAdded: boolean;
  defaultHideDuration: HideDuration;
}

function CategoryGroup({
  catName,
  newSites,
  addedSites,
  hiddenCount,
  safetyMap,
  isSiteAdded,
  onQuickAdd,
  onAddToCategory,
  onHideSite,
  categories,
  allAdded,
  defaultHideDuration,
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
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
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
        {hiddenCount > 0 && (
          <span className="text-[10px] text-muted-foreground/50 ml-1">
            不感兴趣 {hiddenCount}
          </span>
        )}
      </div>

      {/* new (unadded) sites - hidden sites are NOT shown */}
      <div className="space-y-1">
        {newSites.map((site) => (
          <NewSiteItem
            key={site.id}
            site={site}
            safety={safetyMap[site.url]}
            onQuickAdd={onQuickAdd}
            onAddToCategory={onAddToCategory}
            onHideSite={onHideSite}
            categories={categories}
            defaultHideDuration={defaultHideDuration}
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
  onHideSite,
  categories,
  defaultHideDuration,
}: {
  site: HotSite;
  safety: SafetyCheckResult | undefined;
  onQuickAdd: (site: HotSite) => void;
  onAddToCategory: (site: HotSite, categoryId: string) => void;
  onHideSite: (siteId: string, siteUrl: string) => void;
  categories: { id: string; name: string }[];
  defaultHideDuration: HideDuration;
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
        <button
          onClick={() => onHideSite(site.id, site.url)}
          title="可在'热门网站推荐设置'中选择屏蔽时长"
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <EyeOff className="h-3 w-3" />
        </button>
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
  const hiddenSites = useAppStore((s) => s.hiddenSites);
  const hideSite = useAppStore((s) => s.hideSite);
  const defaultHideDuration = useAppStore((s) => s.defaultHideDuration);
  const setDefaultHideDuration = useAppStore((s) => s.setDefaultHideDuration);

  const [searchQuery, setSearchQuery] = useState("");
  const [safetyMap, setSafetyMap] = useState<Record<string, SafetyCheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [showExtra, setShowExtra] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  /* check if a site is hidden */
  const isSiteHidden = useCallback(
    (siteId: string) => {
      const entry = hiddenSites.find((h) => h.siteId === siteId);
      if (!entry) return false;
      if (entry.duration === "permanent") return true;
      const now = Date.now();
      const durationMs: Record<string, number> = {
        "1w": 7 * 24 * 60 * 60 * 1000,
        "2w": 14 * 24 * 60 * 60 * 1000,
        "1m": 30 * 24 * 60 * 60 * 1000,
      };
      return now - entry.hiddenAt < (durationMs[entry.duration] || 0);
    },
    [hiddenSites],
  );

  /* hide a site - uses default duration, no picker */
  const handleHideSite = useCallback(
    (siteId: string, siteUrl: string) => {
      hideSite(siteId, siteUrl, defaultHideDuration);
    },
    [hideSite, defaultHideDuration],
  );

  /* group by category, split into new/added, filter hidden, sort */
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
      hiddenCount: number;
      allAdded: boolean;
    }[] = [];

    const seenCats = new Set<string>();

    for (const catName of hotSiteCategories) {
      const catSites = filtered.filter((s) => s.category === catName);
      if (catSites.length === 0) continue;
      seenCats.add(catName);

      /* Split into added / hidden / new (visible, not added, not hidden) */
      const addedSites = catSites.filter((s) => isSiteAdded(s));
      const hiddenSitesInCat = catSites.filter(
        (s) => !isSiteAdded(s) && isSiteHidden(s.id),
      );
      const newSites = catSites.filter(
        (s) => !isSiteAdded(s) && !isSiteHidden(s.id),
      );
      const allAdded = newSites.length === 0;

      groups.push({
        catName,
        newSites,
        addedSites,
        hiddenCount: hiddenSitesInCat.length,
        allAdded,
      });
    }

    /* handle any categories not in hotSiteCategories */
    for (const site of filtered) {
      if (!seenCats.has(site.category)) {
        seenCats.add(site.category);
        const catSites = filtered.filter((s) => s.category === site.category);
        const addedSites = catSites.filter((s) => isSiteAdded(s));
        const hiddenSitesInCat = catSites.filter(
          (s) => !isSiteAdded(s) && isSiteHidden(s.id),
        );
        const newSites = catSites.filter(
          (s) => !isSiteAdded(s) && !isSiteHidden(s.id),
        );
        groups.push({
          catName: site.category,
          newSites,
          addedSites,
          hiddenCount: hiddenSitesInCat.length,
          allAdded: newSites.length === 0,
        });
      }
    }

    /* Sort: partial categories first, all-added categories last */
    groups.sort((a, b) => {
      if (a.allAdded !== b.allAdded) return a.allAdded ? 1 : -1;
      return 0;
    });

    return groups;
  }, [allSites, isSiteAdded, isSiteHidden, searchQuery]);

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
    () =>
      allSites.filter((s) => !isSiteAdded(s) && !isSiteHidden(s.id)),
    [allSites, isSiteAdded, isSiteHidden],
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

  /* count totals across all */
  const totalNew = useMemo(
    () => categorizedGroups.reduce((sum, g) => sum + g.newSites.length, 0),
    [categorizedGroups],
  );
  const totalAdded = useMemo(
    () => categorizedGroups.reduce((sum, g) => sum + g.addedSites.length, 0),
    [categorizedGroups],
  );
  const totalHidden = useMemo(
    () => categorizedGroups.reduce((sum, g) => sum + g.hiddenCount, 0),
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
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-md border border-border/50 hover:bg-muted/50 transition-colors"
              title="推荐设置"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <SettingsPanel
              open={showSettings}
              onClose={() => setShowSettings(false)}
              defaultDuration={defaultHideDuration}
              onDurationChange={setDefaultHideDuration}
              totalNew={totalNew}
              totalAdded={totalAdded}
              totalHidden={totalHidden}
              onSafetyCheck={checkSafety}
              checking={checking}
            />
          </div>
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
            .filter((s) => !isSiteHidden(s.id))
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
                  onHideSite={handleHideSite}
                  categories={categories}
                  defaultHideDuration={defaultHideDuration}
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
              hiddenCount={group.hiddenCount}
              safetyMap={safetyMap}
              isSiteAdded={isSiteAdded}
              onQuickAdd={handleQuickAdd}
              onAddToCategory={handleAddToCategory}
              onHideSite={handleHideSite}
              categories={categories}
              allAdded={group.allAdded}
              defaultHideDuration={defaultHideDuration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { hotSites, extraHotSites, hotSiteCategories } from "@/lib/hot-sites";
import type { HotSite } from "@/lib/hot-sites";
import type { SafetyCheckResult } from "@/lib/types";
import { HIDE_DURATION_LABELS, type HideDuration } from "@/lib/types";
import { checkSafety as apiCheckSafety } from "@/lib/platform";
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
  Pin,
  FolderPlus,
  Compass,
  Search,
  Sparkles,
  Star,
  Plus,
  Layers3,
  Bot,
  Zap,
  Github,
  Palette,
  UsersRound,
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  Wrench,
  Newspaper,
  ShoppingBag,
  Clapperboard,
  Music,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const featuredTitles = ["ChatGPT", "Notion", "Figma", "Midjourney", "GitHub", "DeepSeek"];

const categoryAccents = [
  "linear-gradient(135deg, #2563eb, #4f46e5)",
  "linear-gradient(135deg, #7c3aed, #db2777)",
  "linear-gradient(135deg, #06b6d4, #2563eb)",
  "linear-gradient(135deg, #10b981, #0d9488)",
  "linear-gradient(135deg, #f43f5e, #f97316)",
  "linear-gradient(135deg, #475569, #2563eb)",
];

function categoryMatches(name: string, terms: string[]) {
  const normalized = name.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function renderCategoryIcon(name: string) {
  const props = { className: "h-5 w-5", strokeWidth: 2.35 };
  if (categoryMatches(name, ["AI", "智能"])) return <Bot {...props} />;
  if (categoryMatches(name, ["效率", "办公", "协作"])) return <Zap {...props} />;
  if (categoryMatches(name, ["开发", "代码", "程序", "技术"])) return <Github {...props} />;
  if (categoryMatches(name, ["设计", "创意", "图片"])) return <Palette {...props} />;
  if (categoryMatches(name, ["社交", "媒体", "社区"])) return <UsersRound {...props} />;
  if (categoryMatches(name, ["阅读", "读书", "图书", "知识"])) return <BookOpen {...props} />;
  if (categoryMatches(name, ["商业", "工作", "职场"])) return <BriefcaseBusiness {...props} />;
  if (categoryMatches(name, ["学习", "教育", "课程"])) return <GraduationCap {...props} />;
  if (categoryMatches(name, ["新闻", "资讯", "博客"])) return <Newspaper {...props} />;
  if (categoryMatches(name, ["购物", "电商", "消费"])) return <ShoppingBag {...props} />;
  if (categoryMatches(name, ["视频", "电影", "影视"])) return <Clapperboard {...props} />;
  if (categoryMatches(name, ["音乐", "音频"])) return <Music {...props} />;
  if (categoryMatches(name, ["工具", "实用"])) return <Wrench {...props} />;
  return <Layers3 {...props} />;
}

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
    <div className="absolute right-0 top-14 z-30 min-w-[240px] rounded-3xl border border-white/75 bg-white/90 p-3 shadow-[0_24px_70px_rgba(37,99,235,0.16)] backdrop-blur-2xl">
      <div className="px-2 pb-2 text-xs font-bold text-slate-900">
        推荐设置
      </div>

      {/* Statistics */}
      <div className="rounded-2xl bg-blue-50/60 px-3 py-2">
        <div className="mb-1 text-[10px] font-bold text-slate-500">统计</div>
        <div className="flex gap-3 text-[11px]">
          <span className="text-emerald-600/80">{totalNew} 可添加</span>
          <span className="text-slate-500">{totalAdded} 已添加</span>
          <span className="text-slate-400">{totalHidden} 已隐藏</span>
        </div>
      </div>

      {/* Hide duration setting */}
      <div className="mt-2 rounded-2xl bg-white/70 px-3 py-2">
        <div className="mb-1.5 text-[10px] font-bold text-slate-500">默认屏蔽时长</div>
        <div className="space-y-1">
          {(Object.entries(HIDE_DURATION_LABELS) as [HideDuration, string][]).map(
            ([val, label]) => (
              <label
                key={val}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-1 py-0.5 text-[11px] text-slate-600 hover:bg-blue-50"
              >
                <input
                  type="radio"
                  name="hideDuration"
                  checked={defaultDuration === val}
                  onChange={() => onDurationChange(val)}
                  className="wc-range"
                />
                {label}
              </label>
            ),
          )}
        </div>
      </div>

      {/* Safety scan */}
      <div className="mt-2">
        <button
          onClick={onSafetyCheck}
          disabled={checking}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/70 bg-white/75 px-2 py-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-white disabled:opacity-50"
        >
          <Shield className="h-3 w-3" />
          {checking ? "扫描中..." : "安全扫描"}
        </button>
      </div>

      <button
        onClick={onClose}
        className="mt-1 w-full py-1 text-[10px] text-slate-400 transition-colors hover:text-slate-700"
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
  onQuickAdd: (site: HotSite) => void;
  onAddToCategory: (site: HotSite, categoryId: string) => void;
  onHideSite: (siteId: string, siteUrl: string) => void;
  categories: { id: string; name: string }[];
  allAdded: boolean;
  pinnedCategoryIds: string[];
  onTogglePin: (categoryId: string) => void;
}

function CategoryGroup({
  catName,
  newSites,
  addedSites,
  hiddenCount,
  safetyMap,
  onQuickAdd,
  onAddToCategory,
  onHideSite,
  categories,
  allAdded,
  pinnedCategoryIds,
  onTogglePin,
}: CategoryGroupProps) {
  const [showAdded, setShowAdded] = useState(false);

  /* If all sites are added, default collapsed */
  if (allAdded) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/45 p-3 opacity-75 shadow-sm">
        <button
          onClick={() => setShowAdded(!showAdded)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {showAdded ? (
            <ChevronDown className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          )}
          <span className="text-xs font-medium text-slate-600">{catName}</span>
          <span className="text-[10px] text-slate-400">
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
    <div className="rounded-2xl border border-white/70 bg-white/60 p-3 shadow-sm shadow-blue-100/40">
      {/* header */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-800">{catName}</span>
        <span className="text-[10px] text-emerald-600/70">{newSites.length} 可添加</span>
        {addedSites.length > 0 && (
          <button
            onClick={() => setShowAdded(!showAdded)}
            className="ml-1 flex items-center gap-0.5 text-[10px] text-slate-500 transition-colors hover:text-blue-700"
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
          <span className="ml-1 text-[10px] text-slate-400">
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
            pinnedCategoryIds={pinnedCategoryIds}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>

      {/* added sites - collapsed by default */}
      {showAdded && addedSites.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/60 pt-2">
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
  pinnedCategoryIds,
  onTogglePin,
}: {
  site: HotSite;
  safety: SafetyCheckResult | undefined;
  onQuickAdd: (site: HotSite) => void;
  onAddToCategory: (site: HotSite, categoryId: string) => void;
  onHideSite: (siteId: string, siteUrl: string) => void;
  categories: { id: string; name: string }[];
  pinnedCategoryIds: string[];
  onTogglePin: (categoryId: string) => void;
}) {
  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm shadow-blue-100/30 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
      <div
        aria-hidden="true"
        className="h-7 w-7 flex-shrink-0 rounded-xl bg-white bg-center bg-no-repeat shadow-sm"
        style={{ backgroundImage: `url(${site.imageUrl})`, backgroundSize: "18px 18px" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium truncate">{site.title}</span>
          <SafetyBadge status={safety} />
        </div>
        <span className="block truncate text-[10px] leading-tight text-slate-500">
          {site.shortDesc}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onQuickAdd(site)}
          title="添加到收集箱"
          className="rounded-xl p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
        >
          <Inbox className="h-3.5 w-3.5" />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              title="添加到分类"
              className="rounded-xl p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="z-50 w-80 rounded-2xl border-white/70 bg-white/95 p-3 shadow-[0_20px_50px_rgba(37,99,235,0.16)] backdrop-blur-xl"
          >
            <div className="mb-1.5 text-[10px] font-medium text-slate-500">选择分类</div>
            <div className="grid grid-cols-3 gap-1">
              {[
                ...categories.filter((c) => c.id !== "cat-inbox" && pinnedCategoryIds.includes(c.id)),
                ...categories.filter((c) => c.id !== "cat-inbox" && !pinnedCategoryIds.includes(c.id)),
              ].map((c) => {
                const isPinned = pinnedCategoryIds.includes(c.id);
                return (
                  <div key={c.id} className="group relative">
                    <button
                      onClick={() => onAddToCategory(site, c.id)}
                      className={`w-full flex items-center gap-1 px-1.5 py-1 text-[11px] rounded transition-colors text-left truncate ${
                        isPinned
                          ? "bg-blue-50 font-medium text-blue-700"
                          : "text-slate-600 hover:bg-blue-50"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onTogglePin(c.id); }}
                      className={`absolute -top-0.5 -right-0.5 p-0.5 rounded-full transition-opacity ${
                        isPinned
                          ? "bg-blue-50 text-blue-700 opacity-100"
                          : "bg-white text-slate-400 opacity-0 shadow-sm group-hover:opacity-100 hover:text-blue-700"
                      }`}
                      title={isPinned ? "取消置顶" : "置顶"}
                    >
                      <Pin className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        <button
          onClick={() => onHideSite(site.id, site.url)}
          title="可在'热门网站推荐设置'中选择屏蔽时长"
          className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/50 bg-white/35 px-2 py-1.5">
      <div
        aria-hidden="true"
        className="h-3.5 w-3.5 flex-shrink-0 rounded-sm bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: `url(${site.imageUrl})`, backgroundSize: "14px 14px" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-[11px] text-slate-500">{site.title}</span>
          <SafetyBadge status={safety} />
        </div>
      </div>
      <span className="flex flex-shrink-0 items-center gap-0.5 text-[9px] text-slate-400">
        <Check className="h-2.5 w-2.5" />
        已添加
      </span>
    </div>
  );
}

function FeaturedSiteCard({
  site,
  safety,
  added,
  categories,
  pinnedCategoryIds,
  onQuickAdd,
  onAddToCategory,
  onHideSite,
  onTogglePin,
}: {
  site: HotSite;
  safety: SafetyCheckResult | undefined;
  added: boolean;
  categories: { id: string; name: string }[];
  pinnedCategoryIds: string[];
  onQuickAdd: (site: HotSite) => void;
  onAddToCategory: (site: HotSite, categoryId: string) => void;
  onHideSite: (siteId: string, siteUrl: string) => void;
  onTogglePin: (categoryId: string) => void;
}) {
  return (
    <div className="wc-featured-site p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="h-12 w-12 shrink-0 rounded-2xl border border-white/80 bg-white bg-center bg-no-repeat shadow-sm"
            style={{ backgroundImage: `url(${site.imageUrl})`, backgroundSize: "28px 28px" }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-bold text-slate-950">{site.title}</h3>
              <SafetyBadge status={safety} />
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{site.shortDesc}</p>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
          {site.category}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onQuickAdd(site)}
          disabled={added}
          className="wc-featured-action inline-flex h-8 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] font-bold disabled:cursor-default disabled:opacity-60"
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {added ? "已添加" : "加入收集箱"}
        </button>
        {!added && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="添加到分类"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/75 text-blue-600 transition-colors hover:bg-white"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="z-50 w-80 rounded-2xl border-white/70 bg-white/95 p-3 shadow-[0_20px_50px_rgba(37,99,235,0.16)] backdrop-blur-xl"
            >
              <div className="mb-1.5 text-[10px] font-medium text-slate-500">选择分类</div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  ...categories.filter((c) => c.id !== "cat-inbox" && pinnedCategoryIds.includes(c.id)),
                  ...categories.filter((c) => c.id !== "cat-inbox" && !pinnedCategoryIds.includes(c.id)),
                ].map((c) => {
                  const isPinned = pinnedCategoryIds.includes(c.id);
                  return (
                    <div key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onAddToCategory(site, c.id)}
                        className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors ${
                          isPinned
                            ? "bg-blue-50 font-medium text-blue-700"
                            : "text-slate-600 hover:bg-blue-50"
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onTogglePin(c.id); }}
                        className={`absolute -right-0.5 -top-0.5 rounded-full p-0.5 transition-opacity ${
                          isPinned
                            ? "bg-blue-50 text-blue-700 opacity-100"
                            : "bg-white text-slate-400 opacity-0 shadow-sm group-hover:opacity-100 hover:text-blue-700"
                        }`}
                        title={isPinned ? "取消置顶" : "置顶"}
                      >
                        <Pin className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {!added && (
          <button
            type="button"
            onClick={() => onHideSite(site.id, site.url)}
            title="不感兴趣"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/75 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function DiscoverCategoryCard({
  name,
  newCount,
  addedCount,
  index,
  onSelect,
}: {
  name: string;
  newCount: number;
  addedCount: number;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="wc-discover-category min-w-0 p-4 text-left"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.18)]"
          style={{ background: categoryAccents[index % categoryAccents.length] }}
        >
          {renderCategoryIcon(name)}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
      <div className="truncate text-sm font-bold text-slate-950">{name}</div>
      <div className="mt-1 text-xs text-slate-500">
        {newCount} 可添加 · {addedCount} 已收录
      </div>
    </button>
  );
}

/* ── Main component ── */
export function HotRecommendation() {
  const cards = useAppStore((s) => s.cards);
  const categories = useAppStore((s) => s.categories);
  const activeSectionId = useAppStore((s) => s.activeSectionId);
  const addCard = useAppStore((s) => s.addCard);
  const hiddenSites = useAppStore((s) => s.hiddenSites);
  const hideSite = useAppStore((s) => s.hideSite);
  const defaultHideDuration = useAppStore((s) => s.defaultHideDuration);
  const setDefaultHideDuration = useAppStore((s) => s.setDefaultHideDuration);
  const pinnedCategoryIds = useAppStore((s) => s.pinnedCategoryIds);
  const togglePinCategory = useAppStore((s) => s.togglePinCategory);

  const [searchQuery, setSearchQuery] = useState("");
  const [safetyMap, setSafetyMap] = useState<Record<string, SafetyCheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [showExtra, setShowExtra] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const discoverRef = useRef<HTMLDivElement | null>(null);

  const visibleCategories = useMemo(
    () => categories.filter((cat) => (cat.sectionId || "section-default") === activeSectionId),
    [categories, activeSectionId],
  );

  const visibleCategoryIds = useMemo(
    () => new Set(visibleCategories.map((cat) => cat.id)),
    [visibleCategories],
  );

  const visibleCards = useMemo(
    () => cards.filter((card) => visibleCategoryIds.has(card.categoryId)),
    [cards, visibleCategoryIds],
  );

  /* Combine main + extra sites */
  const allSites = useMemo(
    () => (showExtra ? [...hotSites, ...extraHotSites] : hotSites),
    [showExtra],
  );

  /* dedup: track which domains user already has */
  const userDomains = useMemo(
    () =>
      new Set(
        visibleCards.map((c) => {
          try {
            return new URL(c.url).hostname;
          } catch {
            return c.url;
          }
        }),
      ),
    [visibleCards],
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
      const inboxCat = visibleCategories.find((c) => c.id === "cat-inbox");
      const targetCatId = inboxCat ? "cat-inbox" : visibleCategories[0]?.id || "";
      if (!targetCatId) return;
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
    [visibleCategories, cards, addCard],
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
      const results = await apiCheckSafety(flatFiltered.slice(0, 20).map((s) => s.url));
      const map: Record<string, SafetyCheckResult> = {};
      for (const r of results) {
        map[r.url] = r;
      }
      setSafetyMap(map);
    } catch {
      /* ignore */
    }
    setChecking(false);
  }, [flatFiltered]);

  /* auto-check once the recommendation panel enters the viewport */
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || flatFiltered.length === 0) return;

    const node = discoverRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      autoChecked.current = true;
      checkSafety();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      autoChecked.current = true;
      observer.disconnect();
      checkSafety();
    }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
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

  const featuredSites = useMemo(
    () =>
      featuredTitles
        .map((title) => allSites.find((site) => site.title === title))
        .filter((site): site is HotSite => !!site && !isSiteHidden(site.id))
        .slice(0, 6),
    [allSites, isSiteHidden],
  );

  const categoryOverview = useMemo(
    () => categorizedGroups.slice(0, 6),
    [categorizedGroups],
  );

  const searchResults = useMemo(
    () =>
      allSites
        .filter(
          (s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.category.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .filter((s) => !isSiteHidden(s.id)),
    [allSites, isSiteHidden, searchQuery],
  );

  if (categorizedGroups.length === 0 && !searchQuery) return null;

  return (
    <div ref={discoverRef} className="wc-discover-shell mt-8 p-6 sm:p-7">
      <div className="wc-discover-hero mb-8">
        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/65 px-3 py-2 text-xs font-bold text-blue-700 shadow-sm">
              <Compass className="h-3.5 w-3.5" />
              发现中心
            </div>
            <h2 className="font-serif text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              为你的网页墙补充高质量入口
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              精选常用工具、创作平台和效率网站；添加、屏蔽、查重和安全扫描仍沿用原有推荐逻辑。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="wc-input flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl px-4">
              <Search className="h-4 w-4 shrink-0 text-blue-500" />
              <input
                type="text"
                placeholder="搜索推荐网站、分类或用途..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
            <button
              onClick={() => setShowExtra(!showExtra)}
              className="wc-action-primary inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold"
              title={showExtra ? "收起更多推荐" : "加载更多推荐"}
            >
              <RefreshCw className={`h-4 w-4 ${showExtra ? "rotate-180" : ""}`} />
              {showExtra ? "收起更多" : "查看更多"}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/75 text-slate-500 shadow-sm transition-all hover:bg-white hover:text-blue-600"
                title="推荐设置"
              >
                <Settings className="h-4 w-4" />
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

        <div className="wc-discover-orbit hidden p-5 sm:block">
          <div className="wc-orbit-node left-[12%] top-[18%]">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            AI 工具
          </div>
          <div className="wc-orbit-node right-[10%] top-[25%]">
            <Layers3 className="h-3.5 w-3.5 text-blue-500" />
            效率工作台
          </div>
          <div className="wc-orbit-node bottom-[18%] left-[24%]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            安全扫描
          </div>
          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28px] bg-[var(--wc-primary-gradient)] text-white shadow-[0_22px_52px_rgba(37,99,235,0.30)]">
            <Star className="h-8 w-8" />
          </div>
        </div>
      </div>

      {featuredSites.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl font-semibold text-slate-950">精选推荐</h3>
            <span className="text-xs text-slate-500">{totalNew} 个可添加 · {totalAdded} 个已添加</span>
          </div>
          <div className="wc-featured-row">
            {featuredSites.map((site) => (
              <FeaturedSiteCard
                key={site.id}
                site={site}
                safety={safetyMap[site.url]}
                added={isSiteAdded(site)}
                categories={visibleCategories}
                pinnedCategoryIds={pinnedCategoryIds}
                onQuickAdd={handleQuickAdd}
                onAddToCategory={handleAddToCategory}
                onHideSite={handleHideSite}
                onTogglePin={togglePinCategory}
              />
            ))}
          </div>
        </section>
      )}

      {categoryOverview.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl font-semibold text-slate-950">热门分类</h3>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="rounded-2xl border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-white"
              >
                清除筛选
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {categoryOverview.map((group, index) => (
              <DiscoverCategoryCard
                key={group.catName}
                name={group.catName}
                newCount={group.newSites.length}
                addedCount={group.addedSites.length}
                index={index}
                onSelect={() => setSearchQuery(group.catName)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-serif text-xl font-semibold text-slate-950">
            {searchQuery ? "搜索结果" : "分类推荐"}
          </h3>
          <span className="text-xs text-slate-500">
            {searchQuery ? `${searchResults.length} 条结果` : `${categorizedGroups.length} 个分类`}
          </span>
        </div>
        {searchQuery ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {searchResults.map((site) => {
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
                  categories={visibleCategories}
                  pinnedCategoryIds={pinnedCategoryIds}
                  onTogglePin={togglePinCategory}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categorizedGroups.map((group) => (
              <CategoryGroup
                key={group.catName}
                catName={group.catName}
                newSites={group.newSites}
                addedSites={group.addedSites}
                hiddenCount={group.hiddenCount}
                safetyMap={safetyMap}
                onQuickAdd={handleQuickAdd}
                onAddToCategory={handleAddToCategory}
                onHideSite={handleHideSite}
                categories={visibleCategories}
                allAdded={group.allAdded}
                pinnedCategoryIds={pinnedCategoryIds}
                onTogglePin={togglePinCategory}
              />
            ))}
          </div>
        )}
      </section>

      <div className="wc-value-strip grid gap-3 p-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["精心筛选", "只保留常用、可信、高频入口"],
          ["安全可靠", checking ? "安全扫描进行中" : "支持一键安全扫描"],
          ["持续更新", showExtra ? "已展开更多推荐" : "可继续加载更多工具"],
          ["一键收藏", "直接进入现有添加与查重流程"],
        ].map(([title, desc]) => (
          <div key={title} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-blue-600 shadow-sm">
              <Check className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-bold text-slate-800">{title}</span>
              <span className="mt-0.5 block text-slate-500">{desc}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

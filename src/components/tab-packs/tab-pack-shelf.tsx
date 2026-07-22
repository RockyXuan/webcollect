"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Briefcase,
  Check,
  Clapperboard,
  Code2,
  Layers,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlySiteIcon } from "@/components/mindmap/read-only-site-icon";
import { openTabPackUrls } from "@/lib/platform";
import { useAppStore } from "@/lib/store";
import { CREATE_TAB_PACK_FROM_CARD_EVENT } from "@/lib/tab-pack-events";
import { MAX_TAB_PACK_ITEMS, TAB_PACK_CONFIRM_THRESHOLD, tabPackShortLabel } from "@/lib/tab-packs";
import { useTabPackStore } from "@/lib/tab-pack-store";
import { PRESET_COLORS, type SavedTabPack, type TabPackOpenMode, type WebCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON_OPTIONS = [
  { value: "layers", label: "组合" },
  { value: "star", label: "常用" },
  { value: "sparkles", label: "灵感" },
  { value: "clapperboard", label: "视频" },
  { value: "code", label: "开发" },
  { value: "briefcase", label: "工作" },
  { value: "book-open", label: "阅读" },
  { value: "palette", label: "设计" },
] as const;

function TabPackIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "star": return <Star className={className} />;
    case "sparkles": return <Sparkles className={className} />;
    case "clapperboard": return <Clapperboard className={className} />;
    case "code": return <Code2 className={className} />;
    case "briefcase": return <Briefcase className={className} />;
    case "book-open": return <BookOpen className={className} />;
    case "palette": return <Palette className={className} />;
    default: return <Layers className={className} />;
  }
}

function snapshotItemAsCard(pack: SavedTabPack, item: SavedTabPack["items"][number]): WebCard {
  return {
    id: item.sourceCardId || item.id,
    url: item.url,
    title: item.title,
    shortDesc: pack.name,
    fullDesc: "",
    note: "",
    abbreviation: tabPackShortLabel(item.title),
    imageUrl: item.iconUrl || "",
    categoryId: "tab-pack",
    order: item.order,
    createdAt: item.addedAt,
    updatedAt: item.addedAt,
  };
}

function modeLabel(mode: TabPackOpenMode): string {
  return mode === "first-active" ? "第一个标签页置前" : "全部后台打开";
}

export function TabPackShelf() {
  const cards = useAppStore((state) => state.cards);
  const {
    packs,
    openMode,
    isLoaded,
    loadData,
    createPack,
    updatePack,
    addCard,
    removeItem,
    reorderItems,
    reorderPacks,
    deletePack,
    setOpenMode,
  } = useTabPackStore();
  const [dialogMode, setDialogMode] = useState<"closed" | "create" | "manage">("closed");
  const [selectedPackId, setSelectedPackId] = useState("");
  const [initialCard, setInitialCard] = useState<WebCard | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("layers");
  const [color, setColor] = useState("#4A6FA5");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpenPack, setConfirmOpenPack] = useState<SavedTabPack | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SavedTabPack | null>(null);

  const selectedPack = packs.find((pack) => pack.id === selectedPackId) || null;
  const filteredCards = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return cards.slice(0, 12);
    return cards.filter((card) => [card.title, card.url, card.shortDesc, card.note]
      .some((value) => value.toLocaleLowerCase().includes(query))).slice(0, 20);
  }, [cards, search]);

  useEffect(() => {
    void loadData();
    const reload = () => void loadData();
    window.addEventListener("webcollect:local-change", reload);
    const createFromCard = (event: Event) => {
      const card = (event as CustomEvent<WebCard>).detail;
      if (!card?.id) return;
      setInitialCard(card);
      setName("");
      setIcon("layers");
      setColor("#4A6FA5");
      setDialogMode("create");
    };
    window.addEventListener(CREATE_TAB_PACK_FROM_CARD_EVENT, createFromCard);
    return () => {
      window.removeEventListener("webcollect:local-change", reload);
      window.removeEventListener(CREATE_TAB_PACK_FROM_CARD_EVENT, createFromCard);
    };
  }, [loadData]);

  useEffect(() => {
    if (!selectedPack && packs[0]) setSelectedPackId(packs[0].id);
    if (selectedPack && dialogMode === "manage") {
      setName(selectedPack.name);
      setIcon(selectedPack.icon);
      setColor(selectedPack.color);
    }
  }, [dialogMode, packs, selectedPack]);

  const openCreate = () => {
    setInitialCard(null);
    setName("");
    setIcon("layers");
    setColor("#4A6FA5");
    setMessage("");
    setDialogMode("create");
  };

  const openManager = (pack?: SavedTabPack) => {
    const next = pack || selectedPack || packs[0] || null;
    setSelectedPackId(next?.id || "");
    setName(next?.name || "");
    setIcon(next?.icon || "layers");
    setColor(next?.color || "#4A6FA5");
    setSearch("");
    setMessage("");
    setDialogMode(next ? "manage" : "create");
  };

  const performOpen = async (pack: SavedTabPack) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await openTabPackUrls(pack.items.map((item) => item.url), openMode);
      setMessage(result.blocked > 0
        ? `已打开 ${result.opened} 个，另有 ${result.blocked} 个被浏览器拦截。`
        : `已按“${modeLabel(openMode)}”打开 ${result.opened} 个网页。`);
    } finally {
      setBusy(false);
    }
  };

  const requestOpen = (pack: SavedTabPack) => {
    if (pack.items.length === 0) {
      openManager(pack);
      setMessage("这个标签组还没有网页，请先添加。");
      return;
    }
    if (pack.items.length > TAB_PACK_CONFIRM_THRESHOLD) {
      setConfirmOpenPack(pack);
      return;
    }
    void performOpen(pack);
  };

  const submitCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await createPack({ name, icon, color, cards: initialCard ? [initialCard] : [] });
      setSelectedPackId(created.id);
      setDialogMode("manage");
      setInitialCard(null);
      setMessage("标签组已保存，并会随 Google Drive 同步。");
    } finally {
      setBusy(false);
    }
  };

  const submitUpdate = async () => {
    if (!selectedPack || !name.trim()) return;
    setBusy(true);
    try {
      await updatePack(selectedPack.id, { name, icon, color });
      setMessage("标签组设置已保存。");
    } finally {
      setBusy(false);
    }
  };

  const moveItem = (itemId: string, direction: -1 | 1) => {
    if (!selectedPack) return;
    const ids = selectedPack.items.map((item) => item.id);
    const from = ids.indexOf(itemId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void reorderItems(selectedPack.id, ids);
  };

  const movePack = (direction: -1 | 1) => {
    if (!selectedPack) return;
    const ids = packs.map((pack) => pack.id);
    const from = ids.indexOf(selectedPack.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void reorderPacks(ids);
  };

  return (
    <>
      <div className="wc-tab-pack-divider" aria-hidden="true" />
      <div className="wc-tab-pack-shelf" aria-label="标签组">
        <div className="wc-tab-pack-track">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="wc-tab-pack-wrap"
              data-tab-pack-drop-id={pack.id}
              style={{ "--wc-tab-pack-color": pack.color } as CSSProperties}
            >
              <button
                type="button"
                className="wc-tab-pack-button"
                onClick={() => requestOpen(pack)}
                title={`${pack.name} · ${pack.items.length} 个网页 · 点击一键打开`}
                aria-label={`打开标签组 ${pack.name}，共 ${pack.items.length} 个网页`}
              >
                <TabPackIcon name={pack.icon} className="h-3.5 w-3.5" />
                <span>{tabPackShortLabel(pack.name)}</span>
                <span className="wc-tab-pack-count">{pack.items.length}</span>
              </button>
              <button
                type="button"
                className="wc-tab-pack-edit"
                onClick={() => openManager(pack)}
                title={`管理 ${pack.name}`}
                aria-label={`管理标签组 ${pack.name}`}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="wc-tab-pack-new"
            data-tab-pack-drop-id="__new__"
            onClick={openCreate}
            title="新建标签组；也可以把网页卡片拖到这里"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>标签组</span>
          </button>
          {packs.length > 0 && (
            <button type="button" className="wc-tab-pack-manager" onClick={() => openManager()} title="管理标签组">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {message && dialogMode === "closed" && (
        <div className="wc-tab-pack-toast" role="status">
          {message}
          <button type="button" onClick={() => setMessage("")} aria-label="关闭提示"><X /></button>
        </div>
      )}

      <Dialog open={dialogMode !== "closed"} onOpenChange={(open) => !open && setDialogMode("closed")}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "新建标签组" : "管理标签组"}</DialogTitle>
            <DialogDescription>
              标签组是固定网页模板。收藏以后被修改、移动或删除，都不会改写这里已保存的网址。
            </DialogDescription>
          </DialogHeader>

          {dialogMode === "manage" && packs.length > 1 && (
            <div className="wc-tab-pack-picker" role="tablist" aria-label="选择标签组">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  role="tab"
                  aria-selected={pack.id === selectedPackId}
                  className={cn("wc-tab-pack-picker-item", pack.id === selectedPackId && "wc-tab-pack-picker-item-active")}
                  onClick={() => {
                    setSelectedPackId(pack.id);
                    setName(pack.name);
                    setIcon(pack.icon);
                    setColor(pack.color);
                    setSearch("");
                  }}
                >
                  <TabPackIcon name={pack.icon} className="h-3.5 w-3.5" />
                  {pack.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="space-y-4 rounded-xl border border-border bg-card p-4">
              {dialogMode === "manage" && selectedPack && packs.length > 1 && (
                <div className="flex items-center justify-between gap-3">
                  <Label>标签组位置</Label>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => movePack(-1)} disabled={packs[0]?.id === selectedPack.id} aria-label="标签组左移"><ArrowUp className="h-3.5 w-3.5 -rotate-90" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => movePack(1)} disabled={packs[packs.length - 1]?.id === selectedPack.id} aria-label="标签组右移"><ArrowDown className="h-3.5 w-3.5 -rotate-90" /></Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="tab-pack-name">名称</Label>
                <Input id="tab-pack-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：AI 视频" maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label>图标</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ICON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn("wc-tab-pack-option", icon === option.value && "wc-tab-pack-option-active")}
                      onClick={() => setIcon(option.value)}
                      title={option.label}
                    >
                      <TabPackIcon name={option.value} className="h-4 w-4" />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>颜色</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn("wc-tab-pack-color", color === option.value && "wc-tab-pack-color-active")}
                      onClick={() => setColor(option.value)}
                      title={option.name}
                      aria-label={option.name}
                    >
                      <span style={{ backgroundColor: option.value }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>一键打开方式（全部标签组共用）</Label>
                <div className="grid gap-2">
                  {(["all-background", "first-active"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn("wc-tab-pack-mode", openMode === mode && "wc-tab-pack-mode-active")}
                      onClick={() => void setOpenMode(mode)}
                    >
                      {openMode === mode && <Check className="h-3.5 w-3.5" />}
                      <span>{modeLabel(mode)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              {dialogMode === "create" ? (
                <div className="text-sm text-muted-foreground">
                  {initialCard ? `创建后会先加入“${initialCard.title || initialCard.url}”。` : "创建后可以拖入网页，或在管理界面搜索添加。"}
                </div>
              ) : selectedPack ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <Label>网页（{selectedPack.items.length}/{MAX_TAB_PACK_ITEMS}）</Label>
                    <button type="button" className="wc-tab-pack-delete-link" onClick={() => setDeleteCandidate(selectedPack)}>
                      <Trash2 className="h-3.5 w-3.5" /> 删除标签组
                    </button>
                  </div>
                  <div className="wc-tab-pack-item-list">
                    {selectedPack.items.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">还没有网页</p>}
                    {selectedPack.items.map((item, index) => {
                      const card = snapshotItemAsCard(selectedPack, item);
                      return (
                        <div key={item.id} className="wc-tab-pack-item">
                          <ReadOnlySiteIcon card={card} className="h-7 w-7" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{item.title}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{item.url}</div>
                          </div>
                          <button type="button" disabled={index === 0} onClick={() => moveItem(item.id, -1)} aria-label={`上移 ${item.title}`}><ArrowUp /></button>
                          <button type="button" disabled={index === selectedPack.items.length - 1} onClick={() => moveItem(item.id, 1)} aria-label={`下移 ${item.title}`}><ArrowDown /></button>
                          <button type="button" onClick={() => void removeItem(selectedPack.id, item.id)} aria-label={`移除 ${item.title}`}><X /></button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="搜索收藏并加入（导图模式也可用）" />
                  </div>
                  <div className="wc-tab-pack-search-results">
                    {filteredCards.map((card) => {
                      const alreadyAdded = selectedPack.items.some((item) => item.sourceCardId === card.id || item.url === card.url);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          disabled={alreadyAdded || selectedPack.items.length >= MAX_TAB_PACK_ITEMS}
                          onClick={() => void addCard(selectedPack.id, card)}
                        >
                          <ReadOnlySiteIcon card={card} className="h-6 w-6" />
                          <span className="truncate">{card.title || card.url}</span>
                          <span>{alreadyAdded ? "已加入" : "加入"}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </section>
          </div>

          {message && <div className="wc-inline-message px-3 py-2 text-xs">{message}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode("closed")}>关闭</Button>
            <Button
              onClick={() => void (dialogMode === "create" ? submitCreate() : submitUpdate())}
              disabled={!name.trim() || busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {dialogMode === "create" ? "创建标签组" : "保存设置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmOpenPack)} onOpenChange={(open) => !open && setConfirmOpenPack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一次打开 {confirmOpenPack?.items.length || 0} 个网页？</AlertDialogTitle>
            <AlertDialogDescription>网页数量较多，浏览器可能需要一点时间。保存的标签组不会被修改。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const pack = confirmOpenPack;
              setConfirmOpenPack(null);
              if (pack) void performOpen(pack);
            }}>确认打开</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除标签组“{deleteCandidate?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>只删除这个固定模板，不会删除收藏中的网页。云端会保存删除记录，避免旧设备把它恢复出来。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => {
              const pack = deleteCandidate;
              setDeleteCandidate(null);
              if (!pack) return;
              void deletePack(pack.id).then(() => {
                const remaining = packs.filter((item) => item.id !== pack.id);
                if (remaining[0]) {
                  setSelectedPackId(remaining[0].id);
                  setName(remaining[0].name);
                  setIcon(remaining[0].icon);
                  setColor(remaining[0].color);
                } else {
                  setDialogMode("closed");
                }
              });
            }}>删除标签组</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isLoaded && <span className="sr-only" aria-live="polite">正在读取标签组</span>}
    </>
  );
}

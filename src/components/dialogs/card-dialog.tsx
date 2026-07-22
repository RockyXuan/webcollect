"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe2, Layers, Link2, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { WebCard } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { fetchMeta as apiFetchMeta } from "@/lib/platform";

interface CardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCard?: WebCard | null;
  defaultCategoryId?: string;
}

export function CardDialog({ open, onOpenChange, editingCard, defaultCategoryId }: CardDialogProps) {
  const { categories, activeSectionId, addCard, updateCard } = useAppStore();
  const visibleCategories = useMemo(
    () => categories.filter((cat) => (cat.sectionId || "section-default") === activeSectionId),
    [categories, activeSectionId]
  );

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [note, setNote] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [fetching, setFetching] = useState(false);

  const isEditing = !!editingCard;

  const safeCategoryId = useCallback((): string => {
    if (categoryId && visibleCategories.some((c) => c.id === categoryId)) return categoryId;
    if (defaultCategoryId && visibleCategories.some((c) => c.id === defaultCategoryId)) return defaultCategoryId;
    return visibleCategories[0]?.id || "";
  }, [categoryId, defaultCategoryId, visibleCategories]);

  useEffect(() => {
    if (!open) return;
    if (editingCard) {
      setUrl(editingCard.url || "");
      setTitle(editingCard.title || "");
      setShortDesc(editingCard.shortDesc || "");
      setFullDesc(editingCard.fullDesc || "");
      setNote(editingCard.note || "");
      setAbbreviation(editingCard.abbreviation || "");
      setImageUrl(editingCard.imageUrl || "");
      setCategoryId(editingCard.categoryId || "");
      return;
    }

    setUrl("");
    setTitle("");
    setShortDesc("");
    setFullDesc("");
    setNote("");
    setAbbreviation("");
    setImageUrl("");
    const defaultVisibleCategory = defaultCategoryId && visibleCategories.some((c) => c.id === defaultCategoryId)
      ? defaultCategoryId
      : visibleCategories[0]?.id || "";
    setCategoryId(defaultVisibleCategory);
  }, [open, editingCard, visibleCategories, defaultCategoryId]);

  const fetchMeta = useCallback(async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const data = await apiFetchMeta(url.trim());
      if (!data) return;
      if (data.title && !title) setTitle(data.title);
      if (data.description && !shortDesc) {
        setShortDesc(data.description.slice(0, 48));
        setFullDesc(data.description);
      }
      if (data.favicon && !imageUrl) {
        setImageUrl(data.favicon);
      } else if (data.image && !imageUrl) {
        setImageUrl(data.image);
      } else if (!imageUrl) {
        try {
          const hostname = new URL(url.trim()).hostname;
          setImageUrl(`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`);
        } catch {
          // Metadata is optional; invalid URLs are handled by the required field guard.
        }
      }
    } catch {
      // Metadata fetching is best-effort; users can still save manually entered fields.
    } finally {
      setFetching(false);
    }
  }, [url, title, shortDesc, imageUrl]);

  const handleSubmit = () => {
    if (!url.trim() || !title.trim()) return;

    const finalCategoryId = safeCategoryId();
    if (!finalCategoryId) return;

    const finalFullDesc = fullDesc.trim() || shortDesc.trim();
    const finalShortDesc = shortDesc.trim() || finalFullDesc;

    const payload: WebCard = {
      id: editingCard?.id || `card-${Date.now()}`,
      url: url.trim(),
      title: title.trim(),
      shortDesc: finalShortDesc.slice(0, 48),
      fullDesc: finalFullDesc,
      note: note.trim(),
      abbreviation: abbreviation.trim(),
      imageUrl: imageUrl.trim(),
      categoryId: finalCategoryId,
      order: editingCard?.order ?? 999,
      createdAt: editingCard?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    if (isEditing) {
      updateCard(payload);
    } else {
      addCard(payload);
    }
    onOpenChange(false);
  };

  const currentCategoryId = safeCategoryId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wc-modal-shell max-h-[92vh] overflow-y-auto p-0 sm:max-w-[940px]">
        <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
          <aside className="wc-modal-visual hidden p-7 lg:block">
            <div className="relative z-10 flex h-full min-h-[620px] flex-col justify-between gap-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/62 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  WebCollect
                </div>
                <div>
                  <h3 className="font-serif text-3xl font-semibold leading-tight text-slate-950">
                    {isEditing ? "整理这张网站卡片" : "收进你的网页墙"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    链接、分类、摘要和备注都保留在原来的收藏流程里。
                  </p>
                </div>
              </div>

              <div className="wc-modal-artboard">
                <div className="wc-modal-preview-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wc-primary-gradient)] text-white shadow-[0_16px_34px_rgba(37,99,235,0.25)]">
                      <Globe2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2.5 w-28 rounded-full bg-slate-800/80" />
                      <div className="mt-2 h-2 w-40 rounded-full bg-blue-200/80" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {["URL", "分类", "备注"].map((label) => (
                      <div key={label} className="rounded-xl bg-blue-50/80 px-2 py-2 text-center text-[11px] font-semibold text-blue-700">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="wc-modal-preview-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Layers className="h-4 w-4 text-violet-500" />
                    当前分项
                  </div>
                  <div className="space-y-2">
                    <div className="h-2.5 rounded-full bg-violet-200/80" />
                    <div className="h-2.5 w-4/5 rounded-full bg-blue-200/80" />
                    <div className="h-2.5 w-2/3 rounded-full bg-slate-200/90" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/70 bg-white/70 p-3 text-xs font-semibold text-slate-600 shadow-sm">
                    <Wand2 className="mb-2 h-4 w-4 text-blue-600" />
                    自动抓取
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/70 p-3 text-xs font-semibold text-slate-600 shadow-sm">
                    <Link2 className="mb-2 h-4 w-4 text-violet-600" />
                    快速归档
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="font-serif text-2xl text-slate-950">
                {isEditing ? "编辑网站" : "添加网站"}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {isEditing ? "调整这个网页卡片的信息。" : "保存到当前分项，继续使用现有分类结构。"}
              </DialogDescription>
            </DialogHeader>

            {visibleCategories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/50 py-12 text-center text-sm text-slate-500">
                请先创建一个分类
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="url" className="wc-field-label">网页链接</Label>
                  <div className="flex gap-2">
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="wc-input h-11 flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={fetchMeta}
                      disabled={fetching || !url.trim()}
                      title="自动抓取信息"
                      className="h-11 w-11 rounded-2xl border-blue-100 bg-white/80 text-blue-600 hover:bg-blue-50"
                    >
                      {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="wc-field-label">分类</Label>
                  {currentCategoryId ? (
                    <Select value={currentCategoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="wc-input h-11 w-full" aria-label="分类">
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-slate-500">暂无分类</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="wc-field-label">网站名称</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="网站名称"
                    className="wc-input h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortDesc" className="wc-field-label">一句话简介</Label>
                  <Input
                    id="shortDesc"
                    value={shortDesc}
                    onChange={(e) => setShortDesc(e.target.value)}
                    placeholder="简短描述网站的主要功能"
                    maxLength={20}
                    className="wc-input h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="abbreviation" className="wc-field-label">简称</Label>
                  <Input
                    id="abbreviation"
                    value={abbreviation}
                    onChange={(e) => setAbbreviation(e.target.value)}
                    placeholder="如：GPT"
                    maxLength={4}
                    className="wc-input h-11"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fullDesc" className="wc-field-label">详细介绍</Label>
                  <Textarea
                    id="fullDesc"
                    value={fullDesc}
                    onChange={(e) => setFullDesc(e.target.value)}
                    placeholder="详细描述网站用途、特色或使用说明..."
                    rows={3}
                    className="wc-input min-h-24 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note" className="wc-field-label">备注</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="个人备注信息..."
                    className="wc-input h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="wc-field-label">图标链接</Label>
                  <Input
                    id="imageUrl"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="留空自动获取"
                    className="wc-input h-11"
                  />
                </div>
              </div>
            )}

            {visibleCategories.length > 0 && (
              <DialogFooter className="mt-8">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="wc-action-secondary h-11 rounded-2xl px-6"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!url.trim() || !title.trim()}
                  className="wc-action-primary h-11 px-8"
                >
                  {isEditing ? "保存" : "添加"}
                </Button>
              </DialogFooter>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

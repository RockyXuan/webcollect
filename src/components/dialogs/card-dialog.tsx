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
import { Loader2, Link2 } from "lucide-react";
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

  // Derive a safe categoryId: must match an existing category
  const safeCategoryId = useCallback((): string => {
    if (categoryId && visibleCategories.some((c) => c.id === categoryId)) return categoryId;
    if (defaultCategoryId && visibleCategories.some((c) => c.id === defaultCategoryId)) return defaultCategoryId;
    return visibleCategories[0]?.id || "";
  }, [categoryId, defaultCategoryId, visibleCategories]);

  useEffect(() => {
    if (open) {
      if (editingCard) {
        setUrl(editingCard.url || "");
        setTitle(editingCard.title || "");
        setShortDesc(editingCard.shortDesc || "");
        setFullDesc(editingCard.fullDesc || "");
        setNote(editingCard.note || "");
        setAbbreviation(editingCard.abbreviation || "");
        setImageUrl(editingCard.imageUrl || "");
        setCategoryId(editingCard.categoryId || "");
      } else {
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
      }
    }
  }, [open, editingCard, visibleCategories, defaultCategoryId]);

  const fetchMeta = useCallback(async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const data = await apiFetchMeta(url.trim());
      if (!data) return;
      if (data.title && !title) setTitle(data.title);
      if (data.description && !shortDesc) {
        setShortDesc(data.description.slice(0, 20));
        setFullDesc(data.description);
      }
      if (data.image && !imageUrl) {
        setImageUrl(data.image);
      } else if (data.favicon && !imageUrl) {
        setImageUrl(data.favicon);
      } else if (!imageUrl) {
        try {
          const hostname = new URL(url.trim()).hostname;
          setImageUrl(`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`);
        } catch {
          // ignore
        }
      }
    } catch {
      // silently fail
    } finally {
      setFetching(false);
    }
  }, [url, title, shortDesc, imageUrl]);

  const handleSubmit = () => {
    if (!url.trim() || !title.trim()) return;

    const finalCategoryId = safeCategoryId();
    if (!finalCategoryId) return; // No valid category

    const payload: WebCard = {
      id: editingCard?.id || `card-${Date.now()}`,
      url: url.trim(),
      title: title.trim(),
      shortDesc: shortDesc.trim(),
      fullDesc: fullDesc.trim(),
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

  // Don't render dialog content until categories are available
  const currentCategoryId = safeCategoryId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEditing ? "编辑卡片" : "添加网站"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? "编辑网站卡片信息" : "添加新的网站到收藏墙"}
          </DialogDescription>
        </DialogHeader>

        {visibleCategories.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            请先创建一个分类
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">网页链接</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchMeta}
                  disabled={fetching || !url.trim()}
                  title="自动抓取信息"
                >
                  {fetching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>分类</Label>
              {currentCategoryId ? (
                <Select value={currentCategoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
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
                <div className="text-sm text-muted-foreground">暂无分类</div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">网站名称</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="网站名称"
              />
            </div>

            {/* Short desc */}
            <div className="space-y-2">
              <Label htmlFor="shortDesc">一句话简介（7-8字）</Label>
              <Input
                id="shortDesc"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="简短描述"
                maxLength={20}
              />
            </div>

            {/* Full desc */}
            <div className="space-y-2">
              <Label htmlFor="fullDesc">详细介绍</Label>
              <Textarea
                id="fullDesc"
                value={fullDesc}
                onChange={(e) => setFullDesc(e.target.value)}
                placeholder="详细描述（鼠标悬停时显示）"
                rows={2}
              />
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">备注</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="个人备注"
              />
            </div>

            {/* Abbreviation */}
            <div className="space-y-2">
              <Label htmlFor="abbreviation">简写（用于无图标时显示）</Label>
              <Input
                id="abbreviation"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
                placeholder="如：GPT"
                maxLength={4}
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="imageUrl">图标链接（可选，留空自动获取）</Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="图标 URL"
              />
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!url.trim() || !title.trim()}>
              {isEditing ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

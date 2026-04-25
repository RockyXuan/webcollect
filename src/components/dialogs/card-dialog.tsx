"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

interface CardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCard?: WebCard | null;
  defaultCategoryId?: string;
}

export function CardDialog({ open, onOpenChange, editingCard, defaultCategoryId }: CardDialogProps) {
  const { categories, addCard, updateCard } = useAppStore();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [note, setNote] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fetching, setFetching] = useState(false);

  const isEditing = !!editingCard;

  useEffect(() => {
    if (open) {
      if (editingCard) {
        setUrl(editingCard.url);
        setTitle(editingCard.title);
        setShortDesc(editingCard.shortDesc);
        setFullDesc(editingCard.fullDesc);
        setNote(editingCard.note);
        setAbbreviation(editingCard.abbreviation);
        setImageUrl(editingCard.imageUrl);
        setCategoryId(editingCard.categoryId);
      } else {
        setUrl("");
        setTitle("");
        setShortDesc("");
        setFullDesc("");
        setNote("");
        setAbbreviation("");
        setImageUrl("");
        setCategoryId(defaultCategoryId || categories[0]?.id || "");
      }
    }
  }, [open, editingCard, categories, defaultCategoryId]);

  const fetchMeta = useCallback(async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const res = await fetch("/api/fetch-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.title && !title) setTitle(data.title);
      if (data.description && !shortDesc) {
        setShortDesc(data.description.slice(0, 20));
        setFullDesc(data.description);
      }
      if (data.image && !imageUrl) setImageUrl(data.image);
      if (data.favicon && !imageUrl) setImageUrl(data.favicon);
    } catch {
      // silently fail
    } finally {
      setFetching(false);
    }
  }, [url, title, shortDesc, imageUrl]);

  const handleSubmit = () => {
    if (!url.trim() || !title.trim()) return;

    const payload: WebCard = {
      id: editingCard?.id || `card-${Date.now()}`,
      url: url.trim(),
      title: title.trim(),
      shortDesc: shortDesc.trim(),
      fullDesc: fullDesc.trim(),
      note: note.trim(),
      abbreviation: abbreviation.trim(),
      imageUrl: imageUrl.trim(),
      categoryId: categoryId || categories[0]?.id || "",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEditing ? "编辑卡片" : "添加网站"}
          </DialogTitle>
        </DialogHeader>

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
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              placeholder="详细介绍（鼠标悬停时显示）"
              rows={3}
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
            <Label htmlFor="abbr">简写 / 缩写</Label>
            <Input
              id="abbr"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="如 GPT、GH"
            />
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="img">图片链接（自动抓取或手动填写）</Label>
            <Input
              id="img"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
            {imageUrl && (
              <img
                src={imageUrl}
                alt="preview"
                className="w-full h-24 object-cover rounded-md border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim() || !title.trim()}>
            {isEditing ? "保存" : "添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

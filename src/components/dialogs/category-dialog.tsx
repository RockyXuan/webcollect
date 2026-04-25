"use client";

import { useState, useEffect } from "react";
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
import type { Category } from "@/lib/types";
import { PRESET_COLORS, PRESET_ICONS } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { getLucideIcon } from "@/lib/icons";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory?: Category | null;
}

export function CategoryDialog({ open, onOpenChange, editingCategory }: CategoryDialogProps) {
  const { addCategory, updateCategory } = useAppStore();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setName(editingCategory.name);
        setIcon(editingCategory.icon);
        setColor(editingCategory.color);
      } else {
        setName("");
        setIcon(PRESET_ICONS[0].value);
        setColor(PRESET_COLORS[0].value);
      }
    }
  }, [open, editingCategory]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const payload: Category = {
      id: editingCategory?.id || `cat-${Date.now()}`,
      name: name.trim(),
      icon,
      color,
      order: editingCategory?.order ?? 999,
      createdAt: editingCategory?.createdAt ?? Date.now(),
    };

    if (editingCategory) {
      updateCategory(payload);
    } else {
      addCategory(payload);
    }
    onOpenChange(false);
  };

  const getIcon = getLucideIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {editingCategory ? "编辑分类" : "新建分类"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">分类名称</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：常用、设计灵感"
            />
          </div>

          <div className="space-y-2">
            <Label>图标</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_ICONS.map((ic) => {
                const IconEl = getIcon(ic.value);
                return (
                  <button
                    key={ic.value}
                    onClick={() => setIcon(ic.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                      icon === ic.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                    title={ic.name}
                  >
                    <IconEl className="w-4 h-4" />
                    <span className="text-[10px] text-muted-foreground">{ic.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>主题色</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-all",
                    color === c.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/10"
                    style={{ backgroundColor: c.value }}
                  />
                  <span className="text-xs">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {editingCategory ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

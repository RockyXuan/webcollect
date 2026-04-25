"use client";

import { useState, useEffect } from "react";
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
import type { SuperCategory } from "@/lib/types";
import { useAppStore } from "@/lib/store";

interface SuperCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSuperCategory?: SuperCategory | null;
}

export function SuperCategoryDialog({ open, onOpenChange, editingSuperCategory }: SuperCategoryDialogProps) {
  const { addSuperCategory, updateSuperCategory } = useAppStore();

  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      if (editingSuperCategory) {
        setName(editingSuperCategory.name || "");
      } else {
        setName("");
      }
    }
  }, [open, editingSuperCategory]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    if (editingSuperCategory) {
      updateSuperCategory({
        ...editingSuperCategory,
        name: name.trim(),
      });
    } else {
      addSuperCategory({
        id: `sc-${Date.now()}`,
        name: name.trim(),
        order: useAppStore.getState().superCategories.length,
        createdAt: Date.now(),
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {editingSuperCategory ? "编辑分类" : "新建分类"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {editingSuperCategory ? "编辑大分类名称" : "创建新的大分类容器"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sc-name">分类名称</Label>
            <Input
              id="sc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：AI、工作、生活"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSubmit();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {editingSuperCategory ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

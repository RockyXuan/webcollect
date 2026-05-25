"use client";

import React, { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface EditAction {
  id: string;
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
}

interface EditActionDockProps {
  actions: EditAction[];
  trigger: React.ReactElement;
  align?: "header" | "card";
  className?: string;
}

export function EditActionDock({
  actions,
  trigger,
  align = "header",
  className,
}: EditActionDockProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 180);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn(
            "wc-edit-dock-trigger-wrap",
            align === "card" ? "wc-edit-dock-trigger-wrap-card" : "wc-edit-dock-trigger-wrap-header"
          )}
          onClick={(event) => {
            event.stopPropagation();
            if (!event.defaultPrevented) setOpen(true);
          }}
          onFocus={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          {trigger}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        collisionPadding={16}
        onMouseEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          "wc-edit-dock",
          align === "card" ? "wc-edit-dock-card" : "wc-edit-dock-header",
          className
        )}
      >
        <div className="wc-edit-dock-rail" role="toolbar" aria-label="编辑操作">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className={cn(
                  "wc-edit-dock-button",
                  action.tone === "danger" && "wc-edit-dock-button-danger"
                )}
                disabled={action.disabled}
                title={action.label}
                aria-label={action.label}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onSelect();
                  setOpen(false);
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import type { LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

export function getLucideIcon(iconName: string): LucideIcon {
  const key = iconName
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[key];
  return Icon || LucideIcons.Circle;
}

import {
  Star,
  Wrench,
  Palette,
  Code,
  BookOpen,
  Music,
  Video,
  ShoppingBag,
  GraduationCap,
  Briefcase,
  Coffee,
  Gamepad2,
  Circle,
  LucideIcon,
} from "lucide-react";

// Static icon registry - all icons pre-imported, no dynamic component creation
const ICON_MAP: Record<string, LucideIcon> = {
  star: Star,
  wrench: Wrench,
  palette: Palette,
  code: Code,
  "book-open": BookOpen,
  music: Music,
  video: Video,
  "shopping-bag": ShoppingBag,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  coffee: Coffee,
  "gamepad-2": Gamepad2,
};

// Returns the icon component reference (safe to call outside render)
export function getLucideIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Circle;
}

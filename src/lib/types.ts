export interface WebCard {
  id: string;
  url: string;
  title: string;
  shortDesc: string;
  fullDesc: string;
  note: string;
  abbreviation: string;
  imageUrl: string;
  categoryId: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  superCategoryId: string; // 所属大分类ID，空字符串表示未分组
  createdAt: number;
}

export interface SuperCategory {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface FetchMetaResult {
  title: string;
  description: string;
  image: string;
  favicon: string;
}

export interface HotSite {
  id: string;
  url: string;
  title: string;
  shortDesc: string;
  imageUrl: string;
  category: string;
}

export type SafetyStatus = "safe" | "warning" | "danger" | "unknown";

export interface SafetyCheckResult {
  url: string;
  status: SafetyStatus;
  details: string[];
  checkedAt: number;
}

/** Duration for hiding a recommended site */
export type HideDuration = "1w" | "2w" | "1m" | "permanent";

/** A site hidden by the user from recommendations */
export interface HiddenSite {
  siteId: string;
  siteUrl: string;
  hiddenAt: number;       // timestamp when hidden
  duration: HideDuration; // how long to hide
}

/** Per-user preferences (future: keyed by userId) */
export interface UserPreferences {
  hiddenSites: HiddenSite[];
}

export const HIDE_DURATION_LABELS: Record<HideDuration, string> = {
  "1w": "一周",
  "2w": "两周",
  "1m": "一个月",
  permanent: "永久",
};

export const PRESET_COLORS = [
  { name: "暖棕", value: "#8B6F5C", label: "warm-brown" },
  { name: "雾灰", value: "#6B7280", label: "fog-grey" },
  { name: "松绿", value: "#4A7C59", label: "pine-green" },
  { name: "砖红", value: "#A0524D", label: "brick-red" },
  { name: "黛蓝", value: "#4A6FA5", label: "indigo-blue" },
  { name: "藤黄", value: "#B8860B", label: "vine-yellow" },
  { name: "藕荷", value: "#9B7E8E", label: "lotus-purple" },
  { name: "墨青", value: "#2F5D62", label: "ink-cyan" },
];

export const PRESET_ICONS = [
  { name: "星标", value: "star" },
  { name: "工具", value: "wrench" },
  { name: "设计", value: "palette" },
  { name: "代码", value: "code" },
  { name: "阅读", value: "book-open" },
  { name: "音乐", value: "music" },
  { name: "视频", value: "video" },
  { name: "购物", value: "shopping-bag" },
  { name: "学习", value: "graduation-cap" },
  { name: "工作", value: "briefcase" },
  { name: "生活", value: "coffee" },
  { name: "游戏", value: "gamepad-2" },
];

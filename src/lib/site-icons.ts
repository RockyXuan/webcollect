import {
  AppWindow,
  BookOpen,
  Bookmark,
  Bot,
  Chrome,
  Clapperboard,
  Cloud,
  Code,
  Download,
  FileText,
  Flag,
  FlaskConical,
  Globe2,
  Github,
  LayoutGrid,
  Mail,
  MapPinned,
  MessageCircle,
  Puzzle,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { WebCard } from "./types";

export type SemanticSiteIcon = {
  key: string;
  Icon: LucideIcon;
  prefer: boolean;
  background: string;
  color: string;
};

type SemanticIconRule = SemanticSiteIcon & { terms: string[] };

const semanticIconRules: SemanticIconRule[] = [
  {
    key: "settings",
    terms: ["settings", "setting", "preferences", "config", "配置", "设置"],
    Icon: Settings,
    prefer: true,
    background: "linear-gradient(135deg, rgba(219,234,254,0.96), rgba(255,255,255,0.82))",
    color: "#2563eb",
  },
  {
    key: "extensions",
    terms: ["extensions", "extension", "plugin", "plugins", "addon", "addons", "扩展", "插件"],
    Icon: Puzzle,
    prefer: true,
    background: "linear-gradient(135deg, rgba(237,233,254,0.98), rgba(255,255,255,0.84))",
    color: "#7c3aed",
  },
  {
    key: "flags",
    terms: ["flags", "flag", "实验", "开关"],
    Icon: Flag,
    prefer: true,
    background: "linear-gradient(135deg, rgba(254,243,199,0.96), rgba(255,255,255,0.84))",
    color: "#d97706",
  },
  {
    key: "applications",
    terms: ["applications", "application", "apps", "app", "应用"],
    Icon: AppWindow,
    prefer: true,
    background: "linear-gradient(135deg, rgba(207,250,254,0.95), rgba(255,255,255,0.84))",
    color: "#0891b2",
  },
  {
    key: "video",
    terms: ["bilibili", "b站", "哔哩", "youtube", "yt", "video", "movie", "film", "影视", "电影", "视频"],
    Icon: Clapperboard,
    prefer: false,
    background: "linear-gradient(135deg, rgba(254,226,226,0.96), rgba(255,255,255,0.84))",
    color: "#e11d48",
  },
  {
    key: "bookmarks",
    terms: ["bookmarks", "bookmark", "favorites", "favorite", "书签", "收藏"],
    Icon: Bookmark,
    prefer: true,
    background: "linear-gradient(135deg, rgba(220,252,231,0.96), rgba(255,255,255,0.84))",
    color: "#16a34a",
  },
  {
    key: "download",
    terms: ["downloads", "download", "下载"],
    Icon: Download,
    prefer: true,
    background: "linear-gradient(135deg, rgba(224,242,254,0.98), rgba(255,255,255,0.84))",
    color: "#0284c7",
  },
  {
    key: "chrome",
    terms: ["chrome", "web store", "browser", "浏览器"],
    Icon: Chrome,
    prefer: false,
    background: "linear-gradient(135deg, rgba(219,234,254,0.96), rgba(255,255,255,0.82))",
    color: "#2563eb",
  },
  {
    key: "mail",
    terms: ["mail", "gmail", "email", "邮箱", "邮件"],
    Icon: Mail,
    prefer: false,
    background: "linear-gradient(135deg, rgba(254,226,226,0.96), rgba(255,255,255,0.84))",
    color: "#dc2626",
  },
  {
    key: "github",
    terms: ["github", "git", "repo", "repository", "代码", "仓库"],
    Icon: Github,
    prefer: false,
    background: "linear-gradient(135deg, rgba(241,245,249,0.98), rgba(255,255,255,0.86))",
    color: "#111827",
  },
  {
    key: "chat",
    terms: ["discord", "telegram", "slack", "chat", "群", "聊天", "社群"],
    Icon: MessageCircle,
    prefer: false,
    background: "linear-gradient(135deg, rgba(237,233,254,0.98), rgba(255,255,255,0.84))",
    color: "#5865f2",
  },
  {
    key: "ai",
    terms: ["ai", "gpt", "bot", "assistant", "deepseek", "claude", "gemini", "智能"],
    Icon: Bot,
    prefer: false,
    background: "linear-gradient(135deg, rgba(237,233,254,0.98), rgba(255,255,255,0.84))",
    color: "#6d28d9",
  },
  {
    key: "cloud",
    terms: ["drive", "cloud", "quark", "icloud", "盘", "网盘", "云"],
    Icon: Cloud,
    prefer: false,
    background: "linear-gradient(135deg, rgba(224,242,254,0.98), rgba(255,255,255,0.84))",
    color: "#0284c7",
  },
  {
    key: "search",
    terms: ["search", "find", "google", "搜索", "查询"],
    Icon: Search,
    prefer: false,
    background: "linear-gradient(135deg, rgba(219,234,254,0.96), rgba(255,255,255,0.82))",
    color: "#2563eb",
  },
  {
    key: "map",
    terms: ["map", "maps", "地图", "导航"],
    Icon: MapPinned,
    prefer: false,
    background: "linear-gradient(135deg, rgba(220,252,231,0.96), rgba(255,255,255,0.84))",
    color: "#059669",
  },
  {
    key: "book",
    terms: ["book", "books", "read", "reading", "library", "z-library", "阅读", "读书", "图书"],
    Icon: BookOpen,
    prefer: false,
    background: "linear-gradient(135deg, rgba(220,252,231,0.96), rgba(255,255,255,0.84))",
    color: "#15803d",
  },
  {
    key: "document",
    terms: ["docs", "doc", "document", "file", "paper", "pdf", "文档", "文件", "论文"],
    Icon: FileText,
    prefer: false,
    background: "linear-gradient(135deg, rgba(241,245,249,0.98), rgba(255,255,255,0.86))",
    color: "#475569",
  },
  {
    key: "shopping",
    terms: ["shop", "shopping", "store", "market", "商城", "购物", "商店"],
    Icon: ShoppingBag,
    prefer: false,
    background: "linear-gradient(135deg, rgba(255,237,213,0.96), rgba(255,255,255,0.84))",
    color: "#ea580c",
  },
  {
    key: "security",
    terms: ["security", "scan", "safe", "vpn", "安全", "扫描"],
    Icon: Shield,
    prefer: false,
    background: "linear-gradient(135deg, rgba(220,252,231,0.96), rgba(255,255,255,0.84))",
    color: "#059669",
  },
  {
    key: "code",
    terms: ["code", "dev", "developer", "api", "开发", "编程"],
    Icon: Code,
    prefer: false,
    background: "linear-gradient(135deg, rgba(241,245,249,0.98), rgba(255,255,255,0.86))",
    color: "#334155",
  },
  {
    key: "tools",
    terms: ["tools", "tool", "workspace", "dashboard", "平台", "工具"],
    Icon: LayoutGrid,
    prefer: false,
    background: "linear-gradient(135deg, rgba(219,234,254,0.96), rgba(255,255,255,0.82))",
    color: "#2563eb",
  },
  {
    key: "labs",
    terms: ["experiments", "experiment", "labs", "lab"],
    Icon: FlaskConical,
    prefer: false,
    background: "linear-gradient(135deg, rgba(250,232,255,0.98), rgba(255,255,255,0.84))",
    color: "#c026d3",
  },
];

const knownIconCandidates: Array<{ domains: string[]; terms?: string[]; urls: string[] }> = [
  {
    domains: ["mail.google.com"],
    terms: ["gmail"],
    urls: ["https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico"],
  },
  {
    domains: ["bilibili.com", "www.bilibili.com"],
    terms: ["bilibili", "b站", "哔哩"],
    urls: ["https://www.bilibili.com/favicon.ico"],
  },
  {
    domains: ["youtube.com", "www.youtube.com", "youtu.be"],
    terms: ["youtube", "yt"],
    urls: ["https://www.youtube.com/favicon.ico"],
  },
  {
    domains: ["github.com"],
    terms: ["github"],
    urls: ["https://github.githubassets.com/favicons/favicon.svg"],
  },
  {
    domains: ["discord.com"],
    terms: ["discord"],
    urls: ["https://discord.com/assets/favicon.ico"],
  },
  {
    domains: ["x.com", "twitter.com"],
    terms: ["x list", "twitter"],
    urls: ["https://abs.twimg.com/favicons/twitter.3.ico"],
  },
  {
    domains: ["google.com", "www.google.com"],
    terms: ["google"],
    urls: ["https://www.google.com/favicon.ico"],
  },
  {
    domains: ["openai.com", "chatgpt.com"],
    terms: ["chatgpt", "openai"],
    urls: ["https://openai.com/favicon.ico"],
  },
  {
    domains: ["creator.douyin.com", "douyin.com"],
    terms: ["抖音创作", "抖音创作者"],
    urls: ["https://www.douyin.com/favicon.ico"],
  },
  {
    domains: ["creator.xiaohongshu.com", "xiaohongshu.com"],
    terms: ["小红书创作", "小红书创作者"],
    urls: ["https://creator.xiaohongshu.com/favicon.ico"],
  },
  {
    domains: ["book.douban.com", "movie.douban.com", "douban.com"],
    terms: ["豆瓣读书", "豆瓣电影"],
    urls: ["https://book.douban.com/favicon.ico", "https://movie.douban.com/favicon.ico"],
  },
];

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
}

function getUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function getHostname(url: string): string {
  return getUrl(url)?.hostname.replace(/^www\./, "").toLowerCase() || "";
}

function getOrigin(url: string): string {
  const parsed = getUrl(url);
  return parsed && (parsed.protocol === "http:" || parsed.protocol === "https:") ? parsed.origin : "";
}

function matchesDomain(hostname: string, domain: string): boolean {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  return hostname === normalized || hostname.endsWith(`.${normalized}`);
}

function getHaystack(card: WebCard): string {
  return [
    card.title,
    card.shortDesc,
    card.fullDesc,
    card.note,
    card.url,
    card.abbreviation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getCardTokens(text: string) {
  return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean);
}

function hasSemanticTerm(text: string, tokens: string[], term: string) {
  const normalizedTerm = term.toLowerCase();
  if (normalizedTerm.includes(" ")) return text.includes(normalizedTerm);
  if (/^[a-z0-9]+$/.test(normalizedTerm)) return tokens.includes(normalizedTerm);
  return text.includes(normalizedTerm);
}

export function isGenericFaviconProvider(url: string): boolean {
  const parsed = getUrl(url);
  if (!parsed) return false;
  return (
    parsed.hostname === "www.google.com" && parsed.pathname.startsWith("/s2/favicons")
  ) || (
    parsed.hostname === "icons.duckduckgo.com"
  );
}

export function getChromeFaviconUrl(pageUrl: string, size = 64): string {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.getURL || !chrome.runtime.id) return "";
    const parsed = getUrl(pageUrl);
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) return "";
    const boundedSize = Math.max(16, Math.min(256, Math.round(size)));
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(parsed.href)}&size=${boundedSize}`);
  } catch {
    return "";
  }
}

export function getSiteIconCandidates(card: WebCard): string[] {
  const parsed = getUrl(card.url);
  const hostname = getHostname(card.url);
  const origin = getOrigin(card.url);
  const haystack = getHaystack(card);
  const genericStored = card.imageUrl && isGenericFaviconProvider(card.imageUrl) ? card.imageUrl : "";
  const specificStored = card.imageUrl && !genericStored ? card.imageUrl : "";
  const chromeFavicon = getChromeFaviconUrl(card.url);
  const known = knownIconCandidates
    .filter((entry) => {
      const domainMatch = hostname && entry.domains.some((domain) => matchesDomain(hostname, domain));
      const termMatch = entry.terms?.some((term) => haystack.includes(term.toLowerCase())) || false;
      return domainMatch || termMatch;
    })
    .flatMap((entry) => entry.urls);

  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return unique([specificStored, ...known, genericStored].filter(Boolean));
  }

  return unique([
    specificStored,
    chromeFavicon,
    ...known,
    origin ? `${origin}/favicon.ico` : "",
    origin ? `${origin}/apple-touch-icon.png` : "",
    genericStored,
    hostname ? `https://icons.duckduckgo.com/ip3/${hostname}.ico` : "",
    hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128` : "",
  ]);
}

export function shouldPersistSiteIcon(currentImageUrl: string, loadedUrl: string): boolean {
  if (!loadedUrl || currentImageUrl === loadedUrl) return false;
  if (isGenericFaviconProvider(loadedUrl)) return false;
  const loaded = getUrl(loadedUrl);
  if (!loaded || (loaded.protocol !== "http:" && loaded.protocol !== "https:")) return false;
  return !currentImageUrl || isGenericFaviconProvider(currentImageUrl);
}

export function getSemanticSiteIcon(card: WebCard): SemanticSiteIcon | null {
  const haystack = getHaystack(card);
  const tokens = getCardTokens(haystack);
  const protocol = getUrl(card.url)?.protocol || "";
  const isBrowserInternal = ["chrome:", "edge:", "about:", "brave:"].includes(protocol);

  for (const rule of semanticIconRules) {
    if (rule.terms.some((term) => hasSemanticTerm(haystack, tokens, term))) {
      return { ...rule, prefer: rule.prefer || isBrowserInternal };
    }
  }

  if (isBrowserInternal) {
    return {
      key: "browser-internal",
      Icon: Globe2,
      prefer: true,
      background: "linear-gradient(135deg, rgba(219,234,254,0.96), rgba(255,255,255,0.82))",
      color: "#2563eb",
    };
  }

  return {
    key: "generic-site",
    Icon: Globe2,
    prefer: false,
    background: "linear-gradient(135deg, rgba(241,245,249,0.98), rgba(255,255,255,0.86))",
    color: "#64748b",
  };
}

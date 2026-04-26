/**
 * Homely JSON 解析器 — 将 Homely 导出的 JSON 转换为 WebCollect 数据模型
 *
 * Homely 结构:
 *   links.content[] → 每个 item = 一个"分组" (title + buttons)
 *     buttons[] → 直接链接型 {title, url, style} 或 下拉菜单型 {title, menu: [{title, url}]}
 *
 * 映射策略:
 *   - DROPDOWN-ONLY / MIXED 分组 → 父分类 (isParent=true) + 子分组 + 卡片
 *   - DIRECT-ONLY 分组 → 子分组（无父分类）+ 卡片
 *   - 过滤无效链接（空 URL、chrome-extension:// 链接），保留 chrome:// 内部链接
 */

import type { WarehouseCard, WarehouseCategory } from "./db-warehouse";

/* ── Homely JSON 类型定义 ── */

interface HomelyMenuItem {
  title: string;
  url: string;
}

interface HomelyButton {
  title: string;
  url?: string;
  style?: string;
  menu?: HomelyMenuItem[];
  external?: boolean;
}

interface HomelyGroup {
  title: string;
  buttons: HomelyButton[];
}

interface HomelyData {
  links: {
    content: HomelyGroup[];
  };
}

/* ── 解析结果 ── */

/* ── 跳过项记录 ── */

export interface SkippedItem {
  groupTitle: string;
  itemTitle: string;
  url: string;
  reason: "empty-url" | "invalid-url" | "chrome-extension";
  /** 是否可以被重新识别（chrome-extension 类型可以尝试在浏览器中打开） */
  retryable: boolean;
}

/* ── 解析结果 ── */

export interface ImportPreview {
  source: string;
  fileName: string;
  totalGroups: number;
  parentCategories: number;  // 将映射为父分类的分组数
  subGroups: number;         // 将映射为子分组的数量
  totalCards: number;        // 有效卡片总数
  skippedItems: SkippedItem[]; // 未识别的条目及原因
  groups: ImportedGroupPreview[];
}

export interface ImportedGroupPreview {
  originalTitle: string;
  type: "parent-category" | "sub-group";
  buttonCount: number;
  directLinks: number;
  dropdownMenus: number;
  menuItemCount: number;
}

export interface ParseResult {
  categories: WarehouseCategory[];
  cards: WarehouseCard[];
  preview: ImportPreview;
  skippedItems: SkippedItem[];
}

/* ── 工具函数 ── */

function isValidUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  // chrome:// 内部链接是有效的 Chrome 快捷方式，允许导入
  if (url.startsWith("chrome://")) return true;
  // chrome-extension:// 链接依赖特定扩展，标记为跳过
  if (url.startsWith("chrome-extension://")) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function generateId(prefix: string, batchId: string, index: number): string {
  return `${prefix}-${batchId}-${index}`;
}

function generateBatchId(): string {
  return `batch-${Date.now()}`;
}

function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return "";
  }
}

function getAbbreviation(title: string): string {
  if (!title) return "?";
  // For Chinese titles, take first 1-2 chars
  const chineseMatch = title.match(/[\u4e00-\u9fff]/g);
  if (chineseMatch && chineseMatch.length >= 2) {
    return chineseMatch.slice(0, 2).join("");
  }
  // For English titles, take first letters of words
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
  }
  return title.slice(0, 2).toUpperCase();
}

/* ── 颜色映射：Homely style → hex color ── */
const STYLE_COLORS: Record<string, string> = {
  primary: "#3B82F6",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  info: "#06B6D4",
  dark: "#374151",
  light: "#9CA3AF",
  default: "#6B7280",
};

/* ── 分类图标智能选择 ── */
function guessIcon(name: string): string {
  const lower = name.toLowerCase();

  // Crypto / DeFi
  if (lower.includes("defi") || lower.includes("coin") || lower.includes("swap") || lower.includes("bridge")) return "coins";
  if (lower.includes("nft")) return "image";
  if (lower.includes("gamefi") || lower.includes("game")) return "gamepad-2";
  if (lower.includes("airdrop")) return "parachute";
  if (lower.includes("market") || lower.includes("stock")) return "trending-up";
  if (lower.includes("macro")) return "globe";
  if (lower.includes("meme")) return "laugh";
  if (lower.includes("hodl") || lower.includes("crypto") || lower.includes("btc")) return "bitcoin";

  // AI
  if (lower.includes("ai") || lower.includes("agent")) return "brain";

  // Dev
  if (lower.includes("dev") || lower.includes("code") || lower.includes("github")) return "terminal";
  if (lower.includes("layerzero") || lower.includes("l0") || lower.includes("zk") || lower.includes("stark")) return "blocks";

  // Tools
  if (lower.includes("tool")) return "wrench";
  if (lower.includes("download")) return "download";
  if (lower.includes("search")) return "search";
  if (lower.includes("chrome")) return "chrome";
  if (lower.includes("lens") || lower.includes("social")) return "users";

  // Academic
  if (lower.includes("paper") || lower.includes("论文") || lower.includes("学术")) return "graduation-cap";
  if (lower.includes("研究生") || lower.includes("教务")) return "school";

  // Content
  if (lower.includes("platform") || lower.includes("平台")) return "layout-grid";
  if (lower.includes("阅读") || lower.includes("read")) return "book-open";
  if (lower.includes("video") || lower.includes("影视")) return "play-circle";

  // Infrastructure
  if (lower.includes("pc") || lower.includes("net") || lower.includes("proxy")) return "wifi";
  if (lower.includes("lrt") || lower.includes("lst")) return "layers";
  if (lower.includes("l2") || lower.includes("layer")) return "git-branch";
  if (lower.includes("sol") || lower.includes("solana")) return "sun";

  // Default
  return "folder";
}

/* ── 主解析函数 ── */

export function parseHomelyJSON(
  jsonData: unknown,
  fileName: string
): ParseResult {
  const data = jsonData as HomelyData;
  const content = data?.links?.content;

  if (!content || !Array.isArray(content)) {
    throw new Error("无法识别的 Homely JSON 格式：缺少 links.content 数组");
  }

  const batchId = generateBatchId();
  const categories: WarehouseCategory[] = [];
  const cards: WarehouseCard[] = [];
  const groups: ImportedGroupPreview[] = [];
  const skippedItems: SkippedItem[] = [];
  let catIndex = 0;
  let cardIndex = 0;

  for (const group of content) {
    const groupTitle = group.title || "未命名";
    const buttons = group.buttons || [];

    // Classify buttons
    const menuButtons = buttons.filter((b) => b.menu && b.menu.length > 0);
    const directButtons = buttons.filter((b) => !b.menu || b.menu.length === 0);

    const hasDropdowns = menuButtons.length > 0;

    // Count valid links and track skipped
    const validDirectLinks = directButtons.filter((b) => b.url && isValidUrl(b.url));
    const invalidDirectLinks = directButtons.filter((b) => b.url && !isValidUrl(b.url));
    // Also track buttons with no URL at all (that aren't menu buttons)
    const noUrlDirectLinks = directButtons.filter((b) => !b.url || b.url.trim() === "");
    for (const btn of invalidDirectLinks) {
      const isChromeExt = btn.url?.startsWith("chrome-extension://");
      skippedItems.push({
        groupTitle: groupTitle,
        itemTitle: btn.title || "未命名",
        url: btn.url || "",
        reason: isChromeExt ? "chrome-extension" : "invalid-url",
        retryable: !!isChromeExt,
      });
    }
    for (const btn of noUrlDirectLinks) {
      skippedItems.push({
        groupTitle: groupTitle,
        itemTitle: btn.title || "未命名",
        url: "",
        reason: "empty-url",
        retryable: false,
      });
    }

    // Count menu items
    let validMenuItems = 0;
    for (const btn of menuButtons) {
      for (const item of btn.menu || []) {
        if (isValidUrl(item.url)) {
          validMenuItems++;
        } else {
          const isChromeExt = item.url?.startsWith("chrome-extension://");
          const isEmpty = !item.url || item.url.trim() === "";
          skippedItems.push({
            groupTitle: groupTitle,
            itemTitle: item.title || "未命名",
            url: item.url || "",
            reason: isChromeExt ? "chrome-extension" : (isEmpty ? "empty-url" : "invalid-url"),
            retryable: !!isChromeExt,
          });
        }
      }
    }

    if (hasDropdowns) {
      // This group becomes a PARENT CATEGORY with SUB-GROUPS
      const parentCatId = generateId("whc", batchId, catIndex++);

      categories.push({
        id: parentCatId,
        name: groupTitle,
        icon: guessIcon(groupTitle),
        color: STYLE_COLORS[menuButtons[0]?.style || "default"] || "#6B7280",
        order: categories.length,
        createdAt: Date.now(),
        isParent: true,
        importBatchId: batchId,
      });

      // Create sub-groups from menu buttons
      for (const btn of menuButtons) {
        const subCatId = generateId("whc", batchId, catIndex++);
        categories.push({
          id: subCatId,
          name: btn.title || "未命名",
          icon: guessIcon(btn.title || ""),
          color: STYLE_COLORS[btn.style || "default"] || "#6B7280",
          order: categories.filter((c) => c.parentId === parentCatId).length,
          createdAt: Date.now(),
          parentId: parentCatId,
          importBatchId: batchId,
        });

        // Add menu items as cards
        for (const item of btn.menu || []) {
          if (isValidUrl(item.url)) {
            cards.push({
              id: generateId("whk", batchId, cardIndex++),
              url: item.url,
              title: item.title || new URL(item.url).hostname,
              shortDesc: "",
              fullDesc: "",
              note: "",
              abbreviation: getAbbreviation(item.title || ""),
              imageUrl: getFaviconUrl(item.url),
              categoryId: subCatId,
              order: cards.filter((c) => c.categoryId === subCatId).length,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              importBatchId: batchId,
            });
          }
        }
      }

      // Handle direct links: create a "其他" sub-group
      if (validDirectLinks.length > 0) {
        const otherSubCatId = generateId("whc", batchId, catIndex++);
        categories.push({
          id: otherSubCatId,
          name: "其他",
          icon: "more-horizontal",
          color: "#9CA3AF",
          order: categories.filter((c) => c.parentId === parentCatId).length,
          createdAt: Date.now(),
          parentId: parentCatId,
          importBatchId: batchId,
        });

        for (const btn of validDirectLinks) {
          if (isValidUrl(btn.url || "")) {
            cards.push({
              id: generateId("whk", batchId, cardIndex++),
              url: btn.url!,
              title: btn.title || new URL(btn.url!).hostname,
              shortDesc: "",
              fullDesc: "",
              note: "",
              abbreviation: getAbbreviation(btn.title || ""),
              imageUrl: getFaviconUrl(btn.url!),
              categoryId: otherSubCatId,
              order: cards.filter((c) => c.categoryId === otherSubCatId).length,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              importBatchId: batchId,
            });
          }
        }
      }

      groups.push({
        originalTitle: groupTitle,
        type: "parent-category",
        buttonCount: buttons.length,
        directLinks: validDirectLinks.length,
        dropdownMenus: menuButtons.length,
        menuItemCount: validMenuItems,
      });
    } else {
      // DIRECT-ONLY group → becomes a standalone sub-group (no parent)
      const subCatId = generateId("whc", batchId, catIndex++);

      categories.push({
        id: subCatId,
        name: groupTitle,
        icon: guessIcon(groupTitle),
        color: STYLE_COLORS[directButtons[0]?.style || "default"] || "#6B7280",
        order: categories.length,
        createdAt: Date.now(),
        importBatchId: batchId,
      });

      for (const btn of validDirectLinks) {
        if (isValidUrl(btn.url || "")) {
          cards.push({
            id: generateId("whk", batchId, cardIndex++),
            url: btn.url!,
            title: btn.title || new URL(btn.url!).hostname,
            shortDesc: "",
            fullDesc: "",
            note: "",
            abbreviation: getAbbreviation(btn.title || ""),
            imageUrl: getFaviconUrl(btn.url!),
            categoryId: subCatId,
            order: cards.filter((c) => c.categoryId === subCatId).length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            importBatchId: batchId,
          });
        }
      }

      groups.push({
        originalTitle: groupTitle,
        type: "sub-group",
        buttonCount: buttons.length,
        directLinks: validDirectLinks.length,
        dropdownMenus: 0,
        menuItemCount: 0,
      });
    }
  }

  return {
    categories,
    cards,
    preview: {
      source: "homely",
      fileName,
      totalGroups: content.length,
      parentCategories: groups.filter((g) => g.type === "parent-category").length,
      subGroups: groups.filter((g) => g.type === "sub-group").length,
      totalCards: cards.length,
      skippedItems,
      groups,
    },
    skippedItems,
  };
}

/**
 * 检测 JSON 格式类型
 */
export function detectJsonFormat(jsonData: unknown): "homely" | "generic" | "unknown" {
  // Homely format: has links.content array
  const data = jsonData as Record<string, unknown>;
  if (data?.links && typeof data.links === "object") {
    const links = data.links as Record<string, unknown>;
    if (Array.isArray(links.content)) {
      return "homely";
    }
  }

  // Could add more format detection here for other bookmark tools

  return "unknown";
}

/**
 * 通用解析入口：自动检测格式并解析
 */
export function parseImportJSON(
  jsonData: unknown,
  fileName: string
): ParseResult {
  const format = detectJsonFormat(jsonData);

  switch (format) {
    case "homely":
      return parseHomelyJSON(jsonData, fileName);
    default:
      throw new Error("无法识别的 JSON 格式。目前仅支持 Homely 导出格式。");
  }
}

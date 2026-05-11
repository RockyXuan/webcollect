import homelyImport from "../../assets/homely411.json";
import type { Category, CollectionSection, WebCard } from "./types";
import {
  getActiveSectionId,
  getCards,
  getCategories,
  getSections,
  saveActiveSectionId,
  saveCards,
  saveCategories,
  saveSections,
} from "./db";
import { createLocalDataSnapshot } from "./local-snapshots";

const DEFAULT_SECTION_ID = "section-default";

type HomelyMenuItem = {
  title?: string;
  url?: string;
};

type HomelyButton = {
  title?: string;
  url?: string;
  style?: string;
  menu?: HomelyMenuItem[];
};

type HomelyGroup = {
  title?: string;
  buttons?: HomelyButton[];
};

type HomelyData = {
  links?: {
    content?: HomelyGroup[];
  };
};

type LayoutSpec = {
  title: string;
  parentTitle?: string;
  urls: string[];
  color: string;
  icon: string;
  order: number;
  sectionId: string;
};

type RepairResult = {
  sections: number;
  categoriesTouched: number;
  cardsMoved: number;
  cardsCreated: number;
};

const SECTION_NAMES = {
  home: "\u4e3b\u9875",
  hodl: "HODL",
  ai: "AI",
  fom: "FOM",
  unused: "\u4e0d\u5e38\u7528",
};

const SECTION_IDS = {
  home: DEFAULT_SECTION_ID,
  hodl: "section-recovered-hodl",
  ai: "section-recovered-ai",
  fom: "section-recovered-fom",
  unused: "section-recovered-unused",
};

const FOM_TITLES = new Set([
  "Chrome",
  "\u7814\u7a76\u751f\u76f8\u5173",
  "PC/NET",
  "\u57ce\u5efa",
  "\u5e73\u53f0",
  "\u5e38\u7528\u641c\u7d22",
  "download",
  "\u4e2d\u6587\u8bba\u6587\u68c0\u7d22",
  "Paper",
  "\u725b\u9a6c",
  "\u7535\u5b50\u4e66",
  "\u4e66\u6d41",
]);

const AI_TITLES = new Set(["AI", "AI\u00d7C", "MEME / AI agent"]);

const UNUSED_TITLES = new Set(["OLD data/defi", "OLD defi", "OLD data"]);

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

const MANUAL_PARENT_HINTS: Record<string, string[]> = {
  Chrome: ["Settings", "Content"],
  "\u5e73\u53f0": ["\u7535\u5b50\u4e66", "\u4e66\u6d41"],
  download: ["YT TT INS X"],
  "\u725b\u9a6c": ["\u57ce\u5efa", "\u9a6c\u7f30"],
  "\u5e38\u89c4": ["chrome", "\u5e38\u7528\u641c\u7d22"],
};

function normalizeTitle(title: string | undefined): string {
  return (title || "").trim();
}

function normalizeUrl(url: string | undefined): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("chrome://")) return raw.replace(/\/+$/, "");
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function isValidUrl(url: string | undefined): boolean {
  const raw = (url || "").trim();
  if (!raw) return false;
  if (raw.startsWith("chrome://")) return true;
  if (raw.startsWith("chrome-extension://")) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function guessIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("swap") || lower.includes("bridge") || lower.includes("coin") || lower.includes("defi")) return "coins";
  if (lower.includes("ai") || lower.includes("agent")) return "brain";
  if (lower.includes("chrome")) return "chrome";
  if (lower.includes("download")) return "download";
  if (lower.includes("market") || lower.includes("stock")) return "trending-up";
  if (lower.includes("nft")) return "image";
  if (lower.includes("paper") || name.includes("\u8bba\u6587") || name.includes("\u7814\u7a76")) return "graduation-cap";
  if (lower.includes("tool")) return "wrench";
  if (lower.includes("lens")) return "users";
  if (lower.includes("zk") || lower.includes("stark")) return "blocks";
  return "folder";
}

function sectionIdForTitle(title: string): string {
  if (FOM_TITLES.has(title)) return SECTION_IDS.fom;
  if (AI_TITLES.has(title)) return SECTION_IDS.ai;
  if (UNUSED_TITLES.has(title)) return SECTION_IDS.unused;
  if (title === "\u6536\u96c6\u7bb1") return DEFAULT_SECTION_ID;
  return SECTION_IDS.hodl;
}

function buildSpecs(): LayoutSpec[] {
  const data = homelyImport as HomelyData;
  const content = data.links?.content || [];
  const specs: LayoutSpec[] = [];

  for (const group of content) {
    const groupTitle = normalizeTitle(group.title);
    if (!groupTitle) continue;
    const buttons = group.buttons || [];
    const menuButtons = buttons.filter((button) => button.menu && button.menu.length > 0);
    const directButtons = buttons.filter((button) => !button.menu || button.menu.length === 0);
    const sectionId = sectionIdForTitle(groupTitle);

    if (menuButtons.length > 0) {
      menuButtons.forEach((button, index) => {
        const urls = (button.menu || [])
          .map((item) => normalizeUrl(item.url))
          .filter((url) => isValidUrl(url));
        specs.push({
          title: normalizeTitle(button.title) || "\u6536\u96c6\u7bb1",
          parentTitle: groupTitle,
          urls,
          color: STYLE_COLORS[button.style || "default"] || "#6B7280",
          icon: guessIcon(normalizeTitle(button.title)),
          order: index,
          sectionId,
        });
      });

      const directUrls = directButtons
        .map((button) => normalizeUrl(button.url))
        .filter((url) => isValidUrl(url));
      if (directUrls.length > 0) {
        specs.push({
          title: "\u5176\u4ed6",
          parentTitle: groupTitle,
          urls: directUrls,
          color: "#9CA3AF",
          icon: "more-horizontal",
          order: menuButtons.length,
          sectionId,
        });
      }
    } else {
      const urls = directButtons
        .map((button) => normalizeUrl(button.url))
        .filter((url) => isValidUrl(url));
      specs.push({
        title: groupTitle,
        urls,
        color: STYLE_COLORS[directButtons[0]?.style || "default"] || "#6B7280",
        icon: guessIcon(groupTitle),
        order: specs.length,
        sectionId,
      });
    }
  }

  return specs;
}

function ensureRecoveredSections(existing: CollectionSection[]): CollectionSection[] {
  const now = Date.now();
  const byId = new Map(existing.map((section) => [section.id, { ...section }]));
  const wanted: CollectionSection[] = [
    { id: SECTION_IDS.home, name: SECTION_NAMES.home, order: 0, createdAt: now, updatedAt: now },
    { id: SECTION_IDS.hodl, name: SECTION_NAMES.hodl, order: 1, createdAt: now, updatedAt: now },
    { id: SECTION_IDS.ai, name: SECTION_NAMES.ai, order: 2, createdAt: now, updatedAt: now },
    { id: SECTION_IDS.fom, name: SECTION_NAMES.fom, order: 3, createdAt: now, updatedAt: now },
    { id: SECTION_IDS.unused, name: SECTION_NAMES.unused, order: 4, createdAt: now, updatedAt: now },
  ];

  for (const section of wanted) {
    const current = byId.get(section.id);
    byId.set(section.id, current ? { ...current, name: section.name, order: section.order } : section);
  }

  return Array.from(byId.values()).sort((a, b) => a.order - b.order);
}

function findBestCategoryForSpec(
  categories: Category[],
  cards: WebCard[],
  spec: LayoutSpec
): Category | undefined {
  const targetUrls = new Set(spec.urls.map(normalizeUrl));
  const candidates = categories.filter((category) => normalizeTitle(category.name) === spec.title);
  if (candidates.length === 0) return undefined;

  let best: Category | undefined;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = cards.filter((card) => card.categoryId === candidate.id && targetUrls.has(normalizeUrl(card.url))).length;
    const emptyBonus = cards.some((card) => card.categoryId === candidate.id) ? 0 : 0.2;
    const total = score + emptyBonus;
    if (total > bestScore) {
      best = candidate;
      bestScore = total;
    }
  }
  return best;
}

function findOrCreateCategory(
  categories: Category[],
  name: string,
  now: number,
  defaults: Partial<Category>
): Category {
  const existing = categories.find((category) => normalizeTitle(category.name) === name && !category.parentId);
  if (existing) return existing;

  const category: Category = {
    id: `cat-repair-${now}-${categories.length}`,
    name,
    icon: defaults.icon || guessIcon(name),
    color: defaults.color || "#6B7280",
    order: defaults.order ?? categories.length,
    createdAt: now,
    updatedAt: now,
    sectionId: defaults.sectionId || DEFAULT_SECTION_ID,
    isParent: defaults.isParent,
  };
  categories.push(category);
  return category;
}

function applyManualParentHints(categories: Category[], now: number): number {
  let touched = 0;
  for (const [parentName, childNames] of Object.entries(MANUAL_PARENT_HINTS)) {
    const parent = findOrCreateCategory(categories, parentName, now, {
      isParent: true,
      sectionId: sectionIdForTitle(parentName),
      icon: guessIcon(parentName),
    });
    parent.isParent = true;
    parent.sectionId = parent.sectionId || sectionIdForTitle(parentName);
    for (const childName of childNames) {
      for (const child of categories.filter((category) => normalizeTitle(category.name) === childName && category.id !== parent.id)) {
        if (child.parentId === parent.id) continue;
        child.parentId = parent.id;
        child.isParent = false;
        child.sectionId = parent.sectionId;
        child.updatedAt = now;
        touched += 1;
      }
    }
  }
  return touched;
}

export async function repairLayoutFromHomelyImport(): Promise<RepairResult> {
  await createLocalDataSnapshot("before-homely-layout-repair", "\u4fee\u590d\u5bfc\u5165\u7ed3\u6784\u524d\u672c\u5730\u7248\u672c", { force: true });

  const [storedCards, storedCategories, storedSections] = await Promise.all([
    getCards(),
    getCategories(),
    getSections(),
  ]);
  const now = Date.now();
  const specs = buildSpecs();
  const sections = ensureRecoveredSections(storedSections);
  const categories = storedCategories.map((category) => ({ ...category }));
  const cards = storedCards.map((card) => ({ ...card }));
  const cardsByUrl = new Map<string, WebCard[]>();
  for (const card of cards) {
    const key = normalizeUrl(card.url);
    if (!key) continue;
    const list = cardsByUrl.get(key) || [];
    list.push(card);
    cardsByUrl.set(key, list);
  }

  let categoriesTouched = 0;
  let cardsMoved = 0;
  const cardsCreated = 0;

  for (const spec of specs) {
    let parent: Category | undefined;
    if (spec.parentTitle) {
      parent = findOrCreateCategory(categories, spec.parentTitle, now, {
        color: spec.color,
        icon: guessIcon(spec.parentTitle),
        isParent: true,
        sectionId: spec.sectionId,
      });
      parent.isParent = true;
      parent.parentId = undefined;
      parent.sectionId = spec.sectionId;
      parent.updatedAt = now;
    }

    let target = findBestCategoryForSpec(categories, cards, spec);
    if (!target) {
      target = {
        id: `cat-repair-${now}-${categories.length}`,
        name: spec.title,
        icon: spec.icon,
        color: spec.color,
        order: spec.order,
        createdAt: now,
        updatedAt: now,
        sectionId: spec.sectionId,
        parentId: parent?.id,
      };
      categories.push(target);
      categoriesTouched += 1;
    }

    const oldParentId = target.parentId;
    const oldSectionId = target.sectionId;
    target.parentId = parent?.id;
    target.isParent = false;
    target.sectionId = parent?.sectionId || spec.sectionId;
    target.order = spec.order;
    target.updatedAt = now;
    if (oldParentId !== target.parentId || oldSectionId !== target.sectionId) {
      categoriesTouched += 1;
    }

    spec.urls.forEach((url, order) => {
      const existingCards = cardsByUrl.get(normalizeUrl(url)) || [];
      if (existingCards.length === 0) {
        return;
      }

      for (const card of existingCards) {
        if (card.categoryId !== target.id || card.order !== order) {
          card.categoryId = target.id;
          card.order = order;
          card.updatedAt = now;
          cardsMoved += 1;
        }
      }
    });
  }

  categoriesTouched += applyManualParentHints(categories, now);

  await saveSections(sections);
  await saveCategories(categories);
  await saveCards(cards);
  const activeSection = await getActiveSectionId();
  if (!activeSection || !sections.some((section) => section.id === activeSection)) {
    await saveActiveSectionId(DEFAULT_SECTION_ID);
  }

  return {
    sections: sections.length,
    categoriesTouched,
    cardsMoved,
    cardsCreated,
  };
}

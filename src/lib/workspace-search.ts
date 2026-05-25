import type { Category, CollectionSection, WebCard } from "./types";

const DEFAULT_SECTION_ID = "section-default";
const MAX_RESULTS_PER_GROUP = 8;
const CJK_STOP_WORDS = new Set(["的", "了", "和", "与", "及", "或", "在", "为", "是"]);

export type WorkspaceSearchResultType = "card" | "category" | "section";

export interface WorkspaceSearchInput {
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
}

export interface WorkspaceSearchContext {
  section?: CollectionSection;
  category?: Category;
  parentCategory?: Category;
  pathLabels: string[];
}

interface SearchFields {
  name: string[];
  url: string[];
  context: string[];
  description: string[];
}

interface SearchEntryBase extends WorkspaceSearchContext {
  id: string;
  type: WorkspaceSearchResultType;
  label: string;
  fields: SearchFields;
  searchableText: string;
}

export interface CardSearchEntry extends SearchEntryBase {
  type: "card";
  card: WebCard;
}

export interface CategorySearchEntry extends SearchEntryBase {
  type: "category";
  category: Category;
}

export interface SectionSearchEntry extends SearchEntryBase {
  type: "section";
  section: CollectionSection;
}

export type WorkspaceSearchEntry = CardSearchEntry | CategorySearchEntry | SectionSearchEntry;

export interface CardSearchResult extends CardSearchEntry {
  score: number;
  matchedTokens: string[];
}

export interface CategorySearchResult extends CategorySearchEntry {
  score: number;
  matchedTokens: string[];
}

export interface SectionSearchResult extends SectionSearchEntry {
  score: number;
  matchedTokens: string[];
}

export interface WorkspaceSearchIndex {
  cardEntries: CardSearchEntry[];
  categoryEntries: CategorySearchEntry[];
  sectionEntries: SectionSearchEntry[];
  allEntries: WorkspaceSearchEntry[];
}

export interface WorkspaceSearchResults {
  query: string;
  tokens: string[];
  cards: CardSearchResult[];
  categories: CategorySearchResult[];
  sections: SectionSearchResult[];
  total: number;
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/([a-z0-9])([\u3400-\u9fff])/giu, "$1 $2")
    .replace(/([\u3400-\u9fff])([a-z0-9])/giu, "$1 $2")
    .replace(/[_\-–—·•.,，。:：;；!?！？()[\]{}<>《》"'“”‘’|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const tokens = new Set<string>();
  for (const part of normalized.split(/\s+/)) {
    const chunks = part.match(/[a-z0-9]+|[\u3400-\u9fff]+/giu) ?? [];
    for (const chunk of chunks) {
      if (/^[a-z0-9]+$/i.test(chunk)) {
        tokens.add(chunk);
        continue;
      }

      const chars = Array.from(chunk).filter((char) => !CJK_STOP_WORDS.has(char));
      if (chars.length <= 2) {
        const token = chars.join("");
        if (token) tokens.add(token);
        continue;
      }

      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.add(chars.slice(index, index + 2).join(""));
      }
    }
  }

  return Array.from(tokens);
}

export function buildWorkspaceSearchIndex(input: WorkspaceSearchInput): WorkspaceSearchIndex {
  const sections = normalizeSections(input.sections);
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));

  const resolveCategoryContext = (category: Category): WorkspaceSearchContext => {
    const parentCategory = category.parentId ? categoryById.get(category.parentId) : undefined;
    const sectionId = category.sectionId || parentCategory?.sectionId || DEFAULT_SECTION_ID;
    const section = sectionById.get(sectionId) || sectionById.get(DEFAULT_SECTION_ID) || sections[0];
    const pathLabels = [section?.name, parentCategory?.name, category.name].filter(Boolean) as string[];
    return { section, parentCategory, category, pathLabels };
  };

  const categoryEntries: CategorySearchEntry[] = input.categories.map((category) => {
    const context = resolveCategoryContext(category);
    const fields: SearchFields = {
      name: [category.name],
      url: [],
      context: context.pathLabels,
      description: [category.icon, category.color],
    };
    return {
      id: category.id,
      type: "category",
      label: category.name,
      category,
      ...context,
      fields,
      searchableText: buildSearchableText(fields),
    };
  });

  const cardEntries: CardSearchEntry[] = input.cards.map((card) => {
    const category = categoryById.get(card.categoryId);
    const context = category
      ? resolveCategoryContext(category)
      : {
          section: sectionById.get(DEFAULT_SECTION_ID) || sections[0],
          category: undefined,
          parentCategory: undefined,
          pathLabels: [sectionById.get(DEFAULT_SECTION_ID)?.name || "主页"],
        };
    const domain = getUrlDomain(card.url);
    const fields: SearchFields = {
      name: [card.title, card.abbreviation],
      url: [card.url, domain],
      context: context.pathLabels,
      description: [card.shortDesc, card.fullDesc, card.note],
    };
    return {
      id: card.id,
      type: "card",
      label: card.title,
      card,
      ...context,
      fields,
      searchableText: buildSearchableText(fields),
    };
  });

  const sectionEntries: SectionSearchEntry[] = sections.map((section) => {
    const fields: SearchFields = {
      name: [section.name],
      url: [],
      context: [section.name],
      description: [],
    };
    return {
      id: section.id,
      type: "section",
      label: section.name,
      section,
      pathLabels: [section.name],
      fields,
      searchableText: buildSearchableText(fields),
    };
  });

  return {
    cardEntries,
    categoryEntries,
    sectionEntries,
    allEntries: [...cardEntries, ...categoryEntries, ...sectionEntries],
  };
}

export function searchWorkspace(input: WorkspaceSearchInput, query: string): WorkspaceSearchResults {
  return searchWorkspaceIndex(buildWorkspaceSearchIndex(input), query);
}

export function searchWorkspaceIndex(index: WorkspaceSearchIndex, query: string): WorkspaceSearchResults {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return { query, tokens, cards: [], categories: [], sections: [], total: 0 };
  }

  const cards = scoreEntries(index.cardEntries, query, tokens).slice(0, MAX_RESULTS_PER_GROUP) as CardSearchResult[];
  const categories = scoreEntries(index.categoryEntries, query, tokens).slice(0, MAX_RESULTS_PER_GROUP) as CategorySearchResult[];
  const sections = scoreEntries(index.sectionEntries, query, tokens).slice(0, MAX_RESULTS_PER_GROUP) as SectionSearchResult[];

  return {
    query,
    tokens,
    cards,
    categories,
    sections,
    total: cards.length + categories.length + sections.length,
  };
}

export function getSearchMatchedCategoryIds(results: WorkspaceSearchResults): Set<string> {
  const ids = new Set<string>();

  for (const categoryResult of results.categories) {
    ids.add(categoryResult.category.id);
    if (categoryResult.parentCategory) ids.add(categoryResult.parentCategory.id);
  }

  for (const cardResult of results.cards) {
    if (cardResult.category) ids.add(cardResult.category.id);
    if (cardResult.parentCategory) ids.add(cardResult.parentCategory.id);
  }

  return ids;
}

export function getSearchMatchedCardIds(results: WorkspaceSearchResults): Set<string> {
  return new Set(results.cards.map((result) => result.card.id));
}

function normalizeSections(sections: CollectionSection[]): CollectionSection[] {
  if (sections.length > 0) return sections;
  const now = Date.now();
  return [{ id: DEFAULT_SECTION_ID, name: "主页", order: 0, createdAt: now, updatedAt: now }];
}

function buildSearchableText(fields: SearchFields): string {
  return normalizeSearchText(
    [...fields.name, ...fields.url, ...fields.context, ...fields.description]
      .filter(Boolean)
      .join(" "),
  );
}

function getUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function scoreEntries<T extends WorkspaceSearchEntry>(
  entries: T[],
  query: string,
  tokens: string[],
): Array<T & { score: number; matchedTokens: string[] }> {
  return entries
    .map((entry) => {
      const score = scoreEntry(entry, query, tokens);
      return score > 0 ? { ...entry, score, matchedTokens: tokens } : null;
    })
    .filter((entry): entry is T & { score: number; matchedTokens: string[] } => Boolean(entry))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "zh-Hans-CN"));
}

function scoreEntry(entry: WorkspaceSearchEntry, query: string, tokens: string[]): number {
  const phrase = normalizeSearchText(query);
  let score = 0;

  for (const token of tokens) {
    const tokenScore = scoreToken(entry, token);
    if (tokenScore <= 0) return 0;
    score += tokenScore;
  }

  const normalizedName = normalizeSearchText(entry.fields.name.join(" "));
  if (normalizedName === phrase) score += 800;
  if (normalizedName.startsWith(phrase)) score += 360;
  if (entry.searchableText.includes(phrase)) score += 180;

  if (entry.type === "card") score += 30;
  if (entry.type === "category") score += 20;

  return score;
}

function scoreToken(entry: WorkspaceSearchEntry, token: string): number {
  const name = normalizeSearchText(entry.fields.name.join(" "));
  const url = normalizeSearchText(entry.fields.url.join(" "));
  const context = normalizeSearchText(entry.fields.context.join(" "));
  const description = normalizeSearchText(entry.fields.description.join(" "));

  if (name === token) return 1200;
  if (name.startsWith(token)) return 950;
  if (name.includes(token)) return 760;
  if (url === token) return 720;
  if (url.includes(token)) return 620;
  if (context === token) return 560;
  if (context.includes(token)) return 440;
  if (description.includes(token)) return 260;
  if (entry.searchableText.includes(token)) return 120;
  return 0;
}

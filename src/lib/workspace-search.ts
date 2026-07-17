import type { Category, CollectionSection, WebCard } from "./types";

const DEFAULT_SECTION_ID = "section-default";
const MAX_RESULTS_PER_GROUP = 8;
const CJK_STOP_WORDS = new Set(["的", "了", "和", "与", "及", "或", "在", "为", "是"]);
const MATCH_REASON_ORDER: WorkspaceSearchMatchReason[] = ["title", "url", "path", "description", "fuzzy"];

export type WorkspaceSearchMatchReason = "title" | "url" | "path" | "description" | "fuzzy";
export type WorkspaceSearchMatchKind = "exact" | "lexical" | "fuzzy";

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

interface NormalizedSearchFields {
  name: string;
  url: string;
  context: string;
  description: string;
}

interface SearchEntryBase extends WorkspaceSearchContext {
  id: string;
  type: WorkspaceSearchResultType;
  label: string;
  fields: SearchFields;
  normalizedFields: NormalizedSearchFields;
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
  matchReasons: WorkspaceSearchMatchReason[];
  matchKind: WorkspaceSearchMatchKind;
  exactMatch: boolean;
}

export interface CategorySearchResult extends CategorySearchEntry {
  score: number;
  matchedTokens: string[];
  matchReasons: WorkspaceSearchMatchReason[];
  matchKind: WorkspaceSearchMatchKind;
  exactMatch: boolean;
}

export interface SectionSearchResult extends SectionSearchEntry {
  score: number;
  matchedTokens: string[];
  matchReasons: WorkspaceSearchMatchReason[];
  matchKind: WorkspaceSearchMatchKind;
  exactMatch: boolean;
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
      normalizedFields: normalizeSearchFields(fields),
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
      normalizedFields: normalizeSearchFields(fields),
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
      normalizedFields: normalizeSearchFields(fields),
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

function normalizeSearchFields(fields: SearchFields): NormalizedSearchFields {
  return {
    name: normalizeSearchText(fields.name.filter(Boolean).join(" ")),
    url: normalizeSearchText(fields.url.filter(Boolean).join(" ")),
    context: normalizeSearchText(fields.context.filter(Boolean).join(" ")),
    description: normalizeSearchText(fields.description.filter(Boolean).join(" ")),
  };
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
): Array<T & {
  score: number;
  matchedTokens: string[];
  matchReasons: WorkspaceSearchMatchReason[];
  matchKind: WorkspaceSearchMatchKind;
  exactMatch: boolean;
}> {
  return entries
    .map((entry) => {
      const match = scoreEntry(entry, query, tokens);
      return match ? { ...entry, ...match } : null;
    })
    .filter((entry): entry is T & {
      score: number;
      matchedTokens: string[];
      matchReasons: WorkspaceSearchMatchReason[];
      matchKind: WorkspaceSearchMatchKind;
      exactMatch: boolean;
    } => Boolean(entry))
    .sort((a, b) => Number(b.exactMatch) - Number(a.exactMatch)
      || b.score - a.score
      || a.label.localeCompare(b.label, "zh-Hans-CN"));
}

interface TokenScore {
  score: number;
  reason: Exclude<WorkspaceSearchMatchReason, "fuzzy">;
  fuzzy: boolean;
}

interface EntryScore {
  score: number;
  matchedTokens: string[];
  matchReasons: WorkspaceSearchMatchReason[];
  matchKind: WorkspaceSearchMatchKind;
  exactMatch: boolean;
}

function scoreEntry(entry: WorkspaceSearchEntry, query: string, tokens: string[]): EntryScore | null {
  const phrase = normalizeSearchText(query);
  let score = 0;
  let fuzzyMatched = false;
  const matchedTokens: string[] = [];
  const reasons = new Set<WorkspaceSearchMatchReason>();

  for (const token of tokens) {
    const tokenScore = scoreToken(entry, token);
    if (!tokenScore) continue;
    score += tokenScore.score;
    matchedTokens.push(token);
    reasons.add(tokenScore.reason);
    if (tokenScore.fuzzy) {
      fuzzyMatched = true;
      reasons.add("fuzzy");
    }
  }

  const minimumMatches = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.6);
  if (matchedTokens.length < minimumMatches) return null;

  const { name } = entry.normalizedFields;
  const exactMatch = entry.fields.name.some((value) => normalizeSearchText(value) === phrase)
    || entry.fields.url.some((value) => normalizeSearchText(value) === phrase);
  if (exactMatch) score += 800;
  if (name.startsWith(phrase)) score += 360;
  if (entry.searchableText.includes(phrase)) score += 180;
  score -= (tokens.length - matchedTokens.length) * 90;

  if (entry.type === "card") score += 30;
  if (entry.type === "category") score += 20;

  return {
    score,
    matchedTokens,
    matchReasons: MATCH_REASON_ORDER.filter((reason) => reasons.has(reason)),
    matchKind: exactMatch ? "exact" : fuzzyMatched ? "fuzzy" : "lexical",
    exactMatch,
  };
}

function scoreToken(entry: WorkspaceSearchEntry, token: string): TokenScore | null {
  const { name, url, context, description } = entry.normalizedFields;

  if (name === token) return { score: 1200, reason: "title", fuzzy: false };
  if (name.startsWith(token)) return { score: 950, reason: "title", fuzzy: false };
  if (name.includes(token)) return { score: 760, reason: "title", fuzzy: false };
  if (url === token) return { score: 720, reason: "url", fuzzy: false };
  if (url.includes(token)) return { score: 620, reason: "url", fuzzy: false };
  if (context === token) return { score: 560, reason: "path", fuzzy: false };
  if (context.includes(token)) return { score: 440, reason: "path", fuzzy: false };
  if (description.includes(token)) return { score: 260, reason: "description", fuzzy: false };

  if (!/^[a-z0-9]+$/i.test(token) || token.length < 4) return null;

  const fuzzyCandidates: Array<{ value: string; score: number; reason: TokenScore["reason"] }> = [
    { value: name, score: 520, reason: "title" },
    { value: url, score: 400, reason: "url" },
    { value: context, score: 300, reason: "path" },
    { value: description, score: 180, reason: "description" },
  ];

  let best: TokenScore | null = null;
  for (const candidate of fuzzyCandidates) {
    const similarity = bestLatinWordSimilarity(token, candidate.value);
    if (similarity < 0.72) continue;
    const next = {
      score: Math.round(candidate.score * similarity),
      reason: candidate.reason,
      fuzzy: true,
    };
    if (!best || next.score > best.score) best = next;
  }
  return best;
}

function bestLatinWordSimilarity(token: string, field: string): number {
  let best = 0;
  const words = field.match(/[a-z0-9]+/giu) ?? [];
  for (const word of words) {
    if (word.length < 4 || Math.abs(word.length - token.length) > 2) continue;
    const maxLength = Math.max(word.length, token.length);
    const maxDistance = maxLength <= 5 ? 1 : 2;
    const distance = damerauLevenshteinDistance(token, word, maxDistance);
    if (distance > maxDistance) continue;
    best = Math.max(best, 1 - distance / maxLength);
  }
  return best;
}

function damerauLevenshteinDistance(left: string, right: string, limit: number): number {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > limit) return limit + 1;

  let previousPrevious = Array.from({ length: right.length + 1 }, (_, index) => index);
  let previous = previousPrevious.slice();

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      let value = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
      if (
        leftIndex > 1
        && rightIndex > 1
        && left[leftIndex - 1] === right[rightIndex - 2]
        && left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        value = Math.min(value, previousPrevious[rightIndex - 2] + 1);
      }
      current[rightIndex] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > limit) return limit + 1;
    previousPrevious = previous;
    previous = current;
  }

  return previous[right.length];
}

import { pinyin } from "pinyin-pro";
import type { Category, CollectionSection, WebCard } from "./types";

const DEFAULT_SECTION_ID = "section-default";
const MAX_CARD_RESULTS = 20;
const MAX_STRUCTURE_RESULTS = 8;
export const MAX_SEARCH_QUERY_CHARACTERS = 200;
const CJK_STOP_WORDS = new Set(["的", "了", "和", "与", "及", "或", "在", "为", "是"]);
const GENERIC_ALIAS_TOKENS = new Set(["ai", "代码", "工具", "网站", "网页", "设计", "视频", "搜索", "管理"]);
const MATCH_REASON_ORDER: WorkspaceSearchMatchReason[] = [
  "title",
  "url",
  "path",
  "description",
  "knowledge",
  "alias",
  "pinyin",
  "fuzzy",
];
const BM25_K = 1.2;
const BM25_B = 0.75;

const SEARCH_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ["思维导图", "脑图", "心智图", "概念图", "mindmap", "mind map", "导图工具", "知识图谱", "白板", "流程图"],
  ["下载视频", "视频下载", "保存视频", "视频解析", "下载器", "yt dlp", "ytdlp", "video downloader"],
  ["ai 写代码", "ai编程", "智能编程", "代码助手", "编程助手", "coding assistant", "copilot", "写程序"],
  ["画图", "绘图", "图片生成", "生成图片", "ai绘画", "图像生成", "设计图片"],
  ["记笔记", "笔记", "知识管理", "文档管理", "第二大脑", "notetaking", "notes"],
  ["部署网站", "网站部署", "发布网站", "前端部署", "托管网站", "hosting", "deploy"],
  ["代码仓库", "代码托管", "版本控制", "git 仓库", "git repository", "源码管理"],
  ["邮件", "邮箱", "电子邮件", "email", "mail"],
  ["搜索引擎", "网页搜索", "查资料", "找资料", "search engine"],
  ["设计灵感", "设计参考", "创意灵感", "作品集", "design inspiration"],
] as const;

export type WorkspaceSearchMatchReason =
  | "title"
  | "url"
  | "path"
  | "description"
  | "knowledge"
  | "alias"
  | "pinyin"
  | "fuzzy";
export type WorkspaceSearchMatchKind = "exact" | "lexical" | "fuzzy";

export type WorkspaceSearchResultType = "card" | "category" | "section";

export interface WorkspaceSearchInput {
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
  knowledgeDocuments?: readonly KnowledgeSearchDocument[];
}

export interface KnowledgeSearchDocument {
  cardId: string;
  text: string;
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
  knowledge: string[];
}

interface NormalizedSearchFields {
  name: string;
  url: string;
  context: string;
  description: string;
  knowledge: string;
}

interface PinyinSearchFields {
  full: string;
  initials: string;
}

interface SearchEntryBase extends WorkspaceSearchContext {
  id: string;
  type: WorkspaceSearchResultType;
  label: string;
  fields: SearchFields;
  normalizedFields: NormalizedSearchFields;
  pinyinFields: PinyinSearchFields;
  searchableText: string;
}

export interface CardSearchEntry extends SearchEntryBase {
  type: "card";
  card: WebCard;
  knowledgeText: string;
  documentLength: number;
  termFrequency: ReadonlyMap<string, number>;
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
  cardDocumentFrequency: ReadonlyMap<string, number>;
  averageCardDocumentLength: number;
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

/**
 * Bounds user-entered search work before normalization. Iterating only until
 * the limit avoids scanning an arbitrarily long pasted query, while counting
 * astral symbols as one Unicode code point instead of two UTF-16 code units.
 */
export function limitSearchQuery(query: string): string {
  let codeUnitEnd = 0;
  let characterCount = 0;

  for (const character of query) {
    if (characterCount >= MAX_SEARCH_QUERY_CHARACTERS) break;
    codeUnitEnd += character.length;
    characterCount += 1;
  }

  return codeUnitEnd === query.length ? query : query.slice(0, codeUnitEnd);
}

export function normalizeSearchQuery(query: string): string {
  return normalizeSearchText(limitSearchQuery(query));
}

export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  return Array.from(new Set(tokenizeNormalizedSearchText(normalized)));
}

function tokenizeNormalizedSearchText(normalized: string): string[] {
  const tokens: string[] = [];
  for (const part of normalized.split(/\s+/)) {
    const chunks = part.match(/[a-z0-9]+|[\u3400-\u9fff]+/giu) ?? [];
    for (const chunk of chunks) {
      if (/^[a-z0-9]+$/i.test(chunk)) {
        tokens.push(chunk);
        continue;
      }

      const chars = Array.from(chunk).filter((char) => !CJK_STOP_WORDS.has(char));
      if (chars.length <= 2) {
        const token = chars.join("");
        if (token) tokens.push(token);
        continue;
      }

      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.push(chars.slice(index, index + 2).join(""));
      }
    }
  }

  return tokens;
}

export function buildWorkspaceSearchIndex(input: WorkspaceSearchInput): WorkspaceSearchIndex {
  const sections = normalizeSections(input.sections);
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const knowledgeByCardId = new Map(
    (input.knowledgeDocuments ?? [])
      .filter((document) => document.cardId && document.text.trim())
      .map((document) => [document.cardId, document.text] as const),
  );

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
      knowledge: [],
    };
    return {
      id: category.id,
      type: "category",
      label: category.name,
      category,
      ...context,
      fields,
      normalizedFields: normalizeSearchFields(fields),
      pinyinFields: buildPinyinSearchFields(fields),
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
    const knowledgeText = knowledgeByCardId.get(card.id) ?? "";
    const fields: SearchFields = {
      name: [card.title, card.abbreviation],
      url: [card.url, domain],
      context: context.pathLabels,
      description: [card.shortDesc, card.fullDesc, card.note],
      knowledge: [knowledgeText],
    };
    const searchableText = buildSearchableText(fields);
    const termFrequency = buildTermFrequency(searchableText);
    return {
      id: card.id,
      type: "card",
      label: card.title,
      card,
      ...context,
      fields,
      normalizedFields: normalizeSearchFields(fields),
      pinyinFields: buildPinyinSearchFields(fields),
      searchableText,
      knowledgeText,
      documentLength: sumTermFrequency(termFrequency),
      termFrequency,
    };
  });

  const sectionEntries: SectionSearchEntry[] = sections.map((section) => {
    const fields: SearchFields = {
      name: [section.name],
      url: [],
      context: [section.name],
      description: [],
      knowledge: [],
    };
    return {
      id: section.id,
      type: "section",
      label: section.name,
      section,
      pathLabels: [section.name],
      fields,
      normalizedFields: normalizeSearchFields(fields),
      pinyinFields: buildPinyinSearchFields(fields),
      searchableText: buildSearchableText(fields),
    };
  });

  const cardDocumentFrequency = buildDocumentFrequency(cardEntries);
  const averageCardDocumentLength = cardEntries.length === 0
    ? 0
    : cardEntries.reduce((total, entry) => total + entry.documentLength, 0) / cardEntries.length;

  return {
    cardEntries,
    categoryEntries,
    sectionEntries,
    allEntries: [...cardEntries, ...categoryEntries, ...sectionEntries],
    cardDocumentFrequency,
    averageCardDocumentLength,
  };
}

export function searchWorkspace(input: WorkspaceSearchInput, query: string): WorkspaceSearchResults {
  return searchWorkspaceIndex(buildWorkspaceSearchIndex(input), query);
}

export function searchWorkspaceIndex(index: WorkspaceSearchIndex, query: string): WorkspaceSearchResults {
  const limitedQuery = limitSearchQuery(query);
  const tokens = tokenizeSearchQuery(limitedQuery);
  if (tokens.length === 0) {
    return { query: limitedQuery, tokens, cards: [], categories: [], sections: [], total: 0 };
  }

  const expandedTokens = expandSearchTokens(limitedQuery, tokens);
  const cards = scoreEntries(
    index.cardEntries,
    limitedQuery,
    tokens,
    expandedTokens,
    index,
  ).slice(0, MAX_CARD_RESULTS) as CardSearchResult[];
  const categories = scoreEntries(
    index.categoryEntries,
    limitedQuery,
    tokens,
    expandedTokens,
  ).slice(0, MAX_STRUCTURE_RESULTS) as CategorySearchResult[];
  const sections = scoreEntries(
    index.sectionEntries,
    limitedQuery,
    tokens,
    expandedTokens,
  ).slice(0, MAX_STRUCTURE_RESULTS) as SectionSearchResult[];

  return {
    query: limitedQuery,
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
    [...fields.name, ...fields.url, ...fields.context, ...fields.description, ...fields.knowledge]
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
    knowledge: normalizeSearchText(fields.knowledge.filter(Boolean).join(" ")),
  };
}

function buildPinyinSearchFields(fields: SearchFields): PinyinSearchFields {
  const source = [...fields.name, ...fields.context, ...fields.description]
    .filter(Boolean)
    .join(" ");
  if (!/[\u3400-\u9fff]/u.test(source)) return { full: "", initials: "" };

  try {
    const fullParts = pinyin(source, {
      toneType: "none",
      type: "array",
      nonZh: "removed",
      v: true,
    });
    const initialParts = pinyin(source, {
      toneType: "none",
      pattern: "first",
      type: "array",
      nonZh: "removed",
      v: true,
    });
    return {
      full: normalizeSearchText(`${fullParts.join("")} ${fullParts.join(" ")}`),
      initials: normalizeSearchText(initialParts.join("")),
    };
  } catch {
    return { full: "", initials: "" };
  }
}

function buildTermFrequency(searchableText: string): ReadonlyMap<string, number> {
  const frequency = new Map<string, number>();
  for (const token of tokenizeNormalizedSearchText(searchableText)) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }
  return frequency;
}

function sumTermFrequency(frequency: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const count of frequency.values()) total += count;
  return total;
}

function buildDocumentFrequency(entries: readonly CardSearchEntry[]): ReadonlyMap<string, number> {
  const frequency = new Map<string, number>();
  for (const entry of entries) {
    for (const token of entry.termFrequency.keys()) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return frequency;
}

function expandSearchTokens(query: string, directTokens: readonly string[]): string[] {
  const normalizedQuery = normalizeSearchQuery(query);
  const expanded = new Set<string>();
  const direct = new Set(directTokens);

  for (const group of SEARCH_ALIAS_GROUPS) {
    const groupMatches = group.some((alias) => {
      const normalizedAlias = normalizeSearchQuery(alias);
      return normalizedAlias.length > 0 && (
        normalizedQuery.includes(normalizedAlias)
        || normalizedAlias.includes(normalizedQuery)
      );
    });
    if (!groupMatches) continue;
    for (const alias of group) {
      for (const token of tokenizeSearchQuery(alias)) {
        if (!direct.has(token)) expanded.add(token);
      }
    }
  }

  return Array.from(expanded).slice(0, 32);
}

function getUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function scoreEntries<T extends WorkspaceSearchEntry>(
  entries: readonly T[],
  query: string,
  tokens: readonly string[],
  expandedTokens: readonly string[] = [],
  searchIndex?: WorkspaceSearchIndex,
): Array<T & {
  score: number;
  matchedTokens: string[];
  matchReasons: WorkspaceSearchMatchReason[];
  matchKind: WorkspaceSearchMatchKind;
  exactMatch: boolean;
}> {
  return entries
    .map((entry) => {
      const match = scoreEntry(entry, query, tokens, expandedTokens, searchIndex);
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

function scoreEntry(
  entry: WorkspaceSearchEntry,
  query: string,
  tokens: readonly string[],
  expandedTokens: readonly string[],
  searchIndex?: WorkspaceSearchIndex,
): EntryScore | null {
  const phrase = normalizeSearchText(query);
  let score = 0;
  let fuzzyMatched = false;
  let pinyinMatches = 0;
  let aliasMatches = 0;
  let aliasEvidenceMatches = 0;
  const matchedTokens: string[] = [];
  const reasons = new Set<WorkspaceSearchMatchReason>();

  for (const token of tokens) {
    const tokenScore = scoreToken(entry, token);
    if (tokenScore) {
      score += tokenScore.score;
      matchedTokens.push(token);
      reasons.add(tokenScore.reason);
      if (tokenScore.fuzzy) {
        fuzzyMatched = true;
        reasons.add("fuzzy");
      }
      continue;
    }

    const pinyinScore = scorePinyinToken(entry, token);
    if (pinyinScore > 0) {
      score += pinyinScore;
      pinyinMatches += 1;
      matchedTokens.push(token);
      reasons.add("pinyin");
    }
  }

  const minimumMatches = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.6);

  for (const token of expandedTokens) {
    const tokenScore = scoreToken(entry, token);
    if (!tokenScore) continue;
    score += Math.round(tokenScore.score * 0.35);
    aliasMatches += 1;
    if (!GENERIC_ALIAS_TOKENS.has(token)) aliasEvidenceMatches += 1;
    reasons.add("alias");
  }

  const hasEnoughDirectMatches = matchedTokens.length >= minimumMatches;
  const hasEnoughPinyinMatches = pinyinMatches > 0 && matchedTokens.length >= minimumMatches;
  const hasAliasIntentMatch = expandedTokens.length > 0
    && aliasMatches > 0
    && aliasEvidenceMatches > 0;
  if (!hasEnoughDirectMatches && !hasEnoughPinyinMatches && !hasAliasIntentMatch) return null;

  if (entry.type === "card" && searchIndex) {
    score += Math.round(bm25Score(entry, tokens, searchIndex) * 90);
    score += Math.round(bm25Score(entry, expandedTokens, searchIndex) * 22);
  }

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
  const { name, url, context, description, knowledge } = entry.normalizedFields;

  if (name === token) return { score: 1200, reason: "title", fuzzy: false };
  if (name.startsWith(token)) return { score: 950, reason: "title", fuzzy: false };
  if (name.includes(token)) return { score: 760, reason: "title", fuzzy: false };
  if (url === token) return { score: 720, reason: "url", fuzzy: false };
  if (url.includes(token)) return { score: 620, reason: "url", fuzzy: false };
  if (context === token) return { score: 560, reason: "path", fuzzy: false };
  if (context.includes(token)) return { score: 440, reason: "path", fuzzy: false };
  if (description.includes(token)) return { score: 260, reason: "description", fuzzy: false };
  if (knowledge.includes(token)) return { score: 210, reason: "knowledge", fuzzy: false };

  if (!/^[a-z0-9]+$/i.test(token) || token.length < 4) return null;

  const fuzzyCandidates: Array<{ value: string; score: number; reason: TokenScore["reason"] }> = [
    { value: name, score: 520, reason: "title" },
    { value: url, score: 400, reason: "url" },
    { value: context, score: 300, reason: "path" },
    { value: description, score: 180, reason: "description" },
    { value: knowledge, score: 150, reason: "knowledge" },
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

function scorePinyinToken(entry: WorkspaceSearchEntry, token: string): number {
  if (!/^[a-z]+$/i.test(token) || token.length < 2) return 0;
  const normalizedToken = normalizeSearchText(token).replace(/\s+/g, "");
  if (!normalizedToken) return 0;

  if (entry.pinyinFields.initials === normalizedToken) return 720;
  if (entry.pinyinFields.initials.includes(normalizedToken)) return 610;

  const compactFull = entry.pinyinFields.full.replace(/\s+/g, "");
  if (compactFull === normalizedToken) return 680;
  if (compactFull.includes(normalizedToken)) return 560;
  return 0;
}

function bm25Score(
  entry: CardSearchEntry,
  tokens: readonly string[],
  index: WorkspaceSearchIndex,
): number {
  if (tokens.length === 0 || index.cardEntries.length === 0) return 0;
  const averageLength = Math.max(1, index.averageCardDocumentLength);
  let score = 0;

  for (const token of new Set(tokens)) {
    const termFrequency = entry.termFrequency.get(token) ?? 0;
    if (termFrequency === 0) continue;
    const documentFrequency = index.cardDocumentFrequency.get(token) ?? 0;
    const inverseDocumentFrequency = Math.log(
      1 + (index.cardEntries.length - documentFrequency + 0.5) / (documentFrequency + 0.5),
    );
    const lengthNormalization = BM25_K * (
      1 - BM25_B + BM25_B * entry.documentLength / averageLength
    );
    score += inverseDocumentFrequency
      * (termFrequency * (BM25_K + 1))
      / (termFrequency + lengthNormalization);
  }

  return Number.isFinite(score) ? score : 0;
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

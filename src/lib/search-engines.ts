export type SearchEngineId = "google" | "baidu" | "bing";

export interface SearchEngineOption {
  id: SearchEngineId;
  label: string;
  shortLabel: string;
  hint: string;
  buildUrl: (query: string) => string;
}

export const DEFAULT_SEARCH_ENGINE_ID: SearchEngineId = "google";

export const SEARCH_ENGINE_OPTIONS: SearchEngineOption[] = [
  {
    id: "google",
    label: "Google",
    shortLabel: "Google",
    hint: "Google 全网搜索",
    buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "baidu",
    label: "百度",
    shortLabel: "百度",
    hint: "百度全网搜索",
    buildUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
  },
  {
    id: "bing",
    label: "Bing",
    shortLabel: "Bing",
    hint: "Bing 全网搜索",
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
];

export function isSearchEngineId(value: unknown): value is SearchEngineId {
  return value === "google" || value === "baidu" || value === "bing";
}

export function getSearchEngineOption(id: SearchEngineId): SearchEngineOption {
  return SEARCH_ENGINE_OPTIONS.find((option) => option.id === id) || SEARCH_ENGINE_OPTIONS[0];
}

export function buildSearchEngineUrl(id: SearchEngineId, query: string): string {
  return getSearchEngineOption(id).buildUrl(query);
}

import assert from "node:assert/strict";
import {
  buildWorkspaceSearchIndex,
  searchWorkspace,
  tokenizeSearchQuery,
} from "../src/lib/workspace-search";
import {
  DEFAULT_SEARCH_ENGINE_ID,
  SEARCH_ENGINE_OPTIONS,
  buildSearchEngineUrl,
  getSearchEngineOption,
  isSearchEngineId,
} from "../src/lib/search-engines";
import type { Category, CollectionSection, WebCard } from "../src/lib/types";

const now = 1_777_777_777;

const sections: CollectionSection[] = [
  { id: "section-default", name: "主页", order: 0, createdAt: now, updatedAt: now },
  { id: "section-hodl", name: "HODL", order: 1, createdAt: now, updatedAt: now },
];

const categories: Category[] = [
  {
    id: "cat-defi",
    name: "DEFI",
    icon: "layers",
    color: "#2563eb",
    order: 0,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-hodl",
    isParent: true,
  },
  {
    id: "cat-pendle",
    name: "pendle",
    icon: "wallet",
    color: "#22c55e",
    order: 0,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-hodl",
    parentId: "cat-defi",
  },
  {
    id: "cat-accounts",
    name: "账号资料",
    icon: "key",
    color: "#7c3aed",
    order: 1,
    createdAt: now,
    updatedAt: now,
    sectionId: "section-default",
  },
];

const cards: WebCard[] = [
  {
    id: "card-pendle",
    title: "pendle YT 计算器",
    url: "https://app.pendle.finance/trade/markets",
    shortDesc: "收益拆分工具",
    fullDesc: "Pendle yield trading calculator for defi pools",
    note: "defi curve war",
    abbreviation: "PD",
    imageUrl: "",
    categoryId: "cat-pendle",
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "card-vpn",
    title: "X 的推荐 VPN 账户",
    url: "https://vpn.example.com",
    shortDesc: "机场订阅与备用节点",
    fullDesc: "账号、订阅地址和设备配置",
    note: "clash 推荐 备用",
    abbreviation: "VPN",
    imageUrl: "",
    categoryId: "cat-accounts",
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
];

assert.deepEqual(tokenizeSearchQuery(" X  推荐   VPN "), ["x", "推荐", "vpn"]);

const index = buildWorkspaceSearchIndex({ cards, categories, sections });
assert.equal(index.cardEntries.length, 2);
assert.equal(index.categoryEntries.length, 3);
assert.equal(index.sectionEntries.length, 2);

const pendleResults = searchWorkspace({ cards, categories, sections }, "pendle");
assert.equal(pendleResults.cards[0]?.card.id, "card-pendle");
assert.deepEqual(pendleResults.cards[0]?.pathLabels, ["HODL", "DEFI", "pendle"]);
assert.equal(pendleResults.categories[0]?.category.id, "cat-pendle");

const multiTermResults = searchWorkspace({ cards, categories, sections }, "X 推荐 VPN");
assert.equal(multiTermResults.cards[0]?.card.id, "card-vpn");

const noteResults = searchWorkspace({ cards, categories, sections }, "clash 备用");
assert.equal(noteResults.cards[0]?.card.id, "card-vpn");

const sectionResults = searchWorkspace({ cards, categories, sections }, "hodl defi");
assert.equal(sectionResults.categories[0]?.category.id, "cat-defi");

assert.equal(DEFAULT_SEARCH_ENGINE_ID, "google");
assert.deepEqual(SEARCH_ENGINE_OPTIONS.map((option) => option.id), ["google", "baidu", "bing"]);
assert.equal(isSearchEngineId("google"), true);
assert.equal(isSearchEngineId("duckduckgo"), false);
assert.equal(getSearchEngineOption("baidu").label, "百度");
assert.equal(buildSearchEngineUrl("google", "web collect"), "https://www.google.com/search?q=web%20collect");
assert.equal(buildSearchEngineUrl("baidu", "网页收藏"), "https://www.baidu.com/s?wd=%E7%BD%91%E9%A1%B5%E6%94%B6%E8%97%8F");
assert.equal(buildSearchEngineUrl("bing", "AI 工具"), "https://www.bing.com/search?q=AI%20%E5%B7%A5%E5%85%B7");

console.log("workspace-search tests passed");

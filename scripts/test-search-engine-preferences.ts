import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SEARCH_ENGINE_ID,
  SEARCH_ENGINE_OPTIONS,
  buildSearchEngineUrl,
  getSearchEngineOption,
  isSearchEngineId,
} from "../src/lib/search-engines";

const topNavSource = readFileSync("src/components/nav/top-nav.tsx", "utf8");
const dbSource = readFileSync("src/lib/db.ts", "utf8");
const storeSource = readFileSync("src/lib/store.ts", "utf8");
const localSnapshotsSource = readFileSync("src/lib/local-snapshots.ts", "utf8");

assert.equal(DEFAULT_SEARCH_ENGINE_ID, "google", "search engine should default to Google");
assert.deepEqual(SEARCH_ENGINE_OPTIONS.map((option) => option.id), ["google", "baidu", "bing"]);
assert.equal(isSearchEngineId("baidu"), true);
assert.equal(isSearchEngineId("yahoo"), false);
assert.equal(getSearchEngineOption("bing").label, "Bing");
assert.equal(buildSearchEngineUrl("google", "docu.md"), "https://www.google.com/search?q=docu.md");
assert.equal(buildSearchEngineUrl("baidu", "网页 收藏"), "https://www.baidu.com/s?wd=%E7%BD%91%E9%A1%B5%20%E6%94%B6%E8%97%8F");
assert.equal(buildSearchEngineUrl("bing", "AI 写作"), "https://www.bing.com/search?q=AI%20%E5%86%99%E4%BD%9C");

assert.ok(dbSource.includes("SEARCH_ENGINE_KEY"), "search engine preference should be stored in IndexedDB");
assert.ok(dbSource.includes("getSearchEngine"), "db should expose getSearchEngine");
assert.ok(dbSource.includes("saveSearchEngine"), "db should expose saveSearchEngine");
assert.ok(storeSource.includes("searchEngine: SearchEngineId"), "store should expose the selected search engine");
assert.ok(storeSource.includes("setSearchEngine"), "store should update the selected search engine");
assert.ok(localSnapshotsSource.includes("searchEngine?: SearchEngineId"), "local snapshots should carry the search engine preference");
assert.ok(localSnapshotsSource.includes("saveSearchEngine"), "snapshot restore should save the search engine preference");
assert.ok(topNavSource.includes("wc-search-engine-select"), "TopNav should render a search engine selector");
assert.ok(topNavSource.includes("SEARCH_ENGINE_OPTIONS.map"), "TopNav should render all supported search engines");
assert.ok(topNavSource.includes("buildSearchEngineUrl(searchEngine, trimmedSearchQuery)"), "external search should use the selected engine");
assert.equal(topNavSource.includes("https://www.google.com/search?q=${encodeURIComponent(trimmedSearchQuery)}"), false, "TopNav must not hard-code Google for every search");

console.log("search engine preference tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { indexedDB } from "fake-indexeddb";
import { extractKnowledgeText, extractMetadataFromHtml } from "../shared/metadata-extractor.js";
import {
  buildGitHubReadmeCandidateUrls,
  extractGitHubReadmeSummary,
  parseGitHubRepositoryUrl,
} from "../shared/github-repository.js";
import { assertSafeRemoteUrl } from "../shared/remote-url-policy.js";

const backgroundSource = readFileSync("extension/background.js", "utf8")
  .replace(/^import \{ extractKnowledgeText, extractMetadataFromHtml \} from '\.\.\/shared\/metadata-extractor\.js';\s*/m, "")
  .replace(/^import \{[\s\S]*?\} from '\.\.\/shared\/github-repository\.js';\s*/m, "")
  .replace(/^import \{ assertSafeRemoteUrl \} from '\.\.\/shared\/remote-url-policy\.js';\s*/m, "");

const listeners: Record<string, unknown[]> = {};
const chromeStorageState: Record<string, unknown> = {};
const context = {
  console,
  URL,
  AbortSignal,
  TextDecoder,
  Uint8Array,
  indexedDB,
  extractKnowledgeText,
  extractMetadataFromHtml,
  buildGitHubReadmeCandidateUrls,
  extractGitHubReadmeSummary,
  parseGitHubRepositoryUrl,
  assertSafeRemoteUrl,
  chrome: {
    runtime: {
      lastError: null,
      onMessage: { addListener: (listener: unknown) => { listeners.message = [listener]; } },
      onInstalled: { addListener: (listener: unknown) => { listeners.installed = [listener]; } },
      onStartup: { addListener: (listener: unknown) => { listeners.startup = [listener]; } },
      sendMessage: (_message: unknown, callback?: () => void) => callback?.(),
      getManifest: () => ({ version: "test" }),
    },
    storage: {
      local: {
        get: (keys: string[] | string, callback: (value: Record<string, unknown>) => void) => {
          const requested = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(requested.map((key) => [key, chromeStorageState[key]])));
        },
        set: (value: Record<string, unknown>, callback: () => void) => {
          Object.assign(chromeStorageState, value);
          callback();
        },
      },
    },
    contextMenus: {
      removeAll: (callback: () => void) => callback(),
      create: () => undefined,
      onClicked: { addListener: (listener: unknown) => { listeners.contextMenu = [listener]; } },
    },
    tabs: {
      sendMessage: () => undefined,
    },
  },
};

vm.createContext(context);
vm.runInContext(backgroundSource, context, { filename: "extension/background.js" });

type BackgroundContext = typeof context & {
  handleFetchMeta: (url: string) => Promise<{
    title: string;
    description: string;
    image: string;
    favicon: string;
    descriptionSource?: string;
  }>;
  handleFetchKnowledge: (url: string) => Promise<{ resolvedUrl: string; text: string; truncated: boolean; segmentCount: number }>;
  findCaptureDuplicates: (url: string) => Promise<{
    available: boolean;
    matches: Array<{ id: string; title: string; description: string; updatedAt: number; categoryId: string }>;
  }>;
  addCaptureQueueItemUnlocked: (draft: Record<string, unknown>) => Promise<{
    draft: Record<string, unknown>;
  }>;
};

const bg = context as BackgroundContext;

async function main() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("WebCollect", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("webcollect_data");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("webcollect_data", "readwrite");
    transaction.objectStore("webcollect_data").put([{
      id: "card-existing",
      url: "https://github.com/nexu-io/codex-slides",
      title: "Existing title",
      shortDesc: "Existing short",
      fullDesc: "Existing description",
      categoryId: "group-slides",
      updatedAt: 1234,
    }], "cards");
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
  database.close();

  const duplicates = await bg.findCaptureDuplicates("https://github.com/nexu-io/codex-slides");
  assert.equal(duplicates.available, true);
  assert.equal(JSON.stringify(duplicates.matches), JSON.stringify([{
    id: "card-existing",
    title: "Existing title",
    description: "Existing description",
    updatedAt: 1234,
    categoryId: "group-slides",
  }]));

  await bg.addCaptureQueueItemUnlocked({
    url: "https://github.com/nexu-io/codex-slides",
    title: "Old pending title",
    sourceType: "context-menu",
  });
  const replacedPending = await bg.addCaptureQueueItemUnlocked({
    url: "https://github.com/nexu-io/codex-slides",
    title: "codex-slides",
    description: "Updated summary",
    sourceType: "floating-button",
    duplicateResolution: {
      action: "update-metadata",
      cardId: "card-existing",
      expectedUpdatedAt: 1234,
    },
  });
  assert.equal(replacedPending.draft.title, "codex-slides");
  assert.equal(JSON.stringify(replacedPending.draft.duplicateResolution), JSON.stringify({
    action: "update-metadata",
    cardId: "card-existing",
    expectedUpdatedAt: 1234,
  }));

  let requestCount = 0;
  (context as typeof context & { fetch: typeof fetch }).fetch = async () => {
    requestCount += 1;
    return new Response("should not be reached", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };

  const blocked = await bg.handleFetchMeta("http://127.0.0.1/private");
  assert.equal(requestCount, 0, "private targets must be rejected before extension fetch");
  assert.equal(blocked.title, "");
  assert.equal(blocked.description, "");
  assert.equal(blocked.image, "");
  assert.equal(blocked.favicon, "");

  (context as typeof context & { fetch: typeof fetch }).fetch = async () => {
    requestCount += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "http://192.168.1.1/private" },
    });
  };
  const redirected = await bg.handleFetchMeta("https://example.com/start");
  assert.equal(requestCount, 1, "unsafe redirect must be rejected before its second request");
  assert.equal(redirected.title, "");
  assert.equal(redirected.description, "");
  assert.equal(redirected.image, "");
  assert.equal(redirected.favicon, "");

  (context as typeof context & { fetch: typeof fetch }).fetch = async () => new Response(
    `
      <html>
        <head><title>docu.md — AI writes it. docu.md does the rest.</title></head>
        <body><main><h1>AI writes it.</h1><p>docu.md does the rest.</p></main></body>
      </html>
    `,
    { status: 200, headers: { "content-type": "text/html" } }
  ) as Response;

  const fetched = await bg.handleFetchMeta("https://docu.md/");

  assert.equal(fetched.title, "Docu.md");
  assert.equal(fetched.description, "AI writes it. docu.md does the rest.");

  const knowledge = await bg.handleFetchKnowledge("https://docu.md/");
  assert.equal(knowledge.resolvedUrl, "https://docu.md/");
  assert.match(knowledge.text, /AI writes it/);
  assert.ok(knowledge.segmentCount > 0);

  const beforeBlockedKnowledge = requestCount;
  await assert.rejects(() => bg.handleFetchKnowledge("http://127.0.0.1/private"));
  assert.equal(requestCount, beforeBlockedKnowledge, "knowledge fetch must reject private targets before network access");

  const githubRequests: string[] = [];
  (context as typeof context & { fetch: typeof fetch }).fetch = async (input) => {
    const url = String(input);
    githubRequests.push(url);
    if (url === "https://github.com/nexu-io/codex-slides") {
      return new Response(
        "<html><head><title>nexu-io/codex-slides: long generic GitHub title</title><meta name=\"description\" content=\"GitHub is where people build software.\"></head></html>",
        { status: 200, headers: { "content-type": "text/html" } }
      );
    }
    if (url.endsWith("/HEAD/README.md")) {
      return new Response(
        "# Codex Slides\n\n[![Build](https://img.shields.io/a.svg)](https://example.com)\n\nOpen-source AI slide studio for creating image-native presentations and exporting finished decks.",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }
    return new Response("not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  };

  const github = await bg.handleFetchMeta("https://github.com/nexu-io/codex-slides");
  assert.equal(github.title, "codex-slides");
  assert.equal(
    github.description,
    "Open-source AI slide studio for creating image-native presentations and exporting finished decks."
  );
  assert.equal(github.descriptionSource, "github-readme");
  assert.deepEqual(githubRequests, [
    "https://github.com/nexu-io/codex-slides",
    "https://raw.githubusercontent.com/nexu-io/codex-slides/HEAD/README.md",
  ]);

  console.log("floating capture metadata tests passed");
}

void main();

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { assertSafeRemoteUrl } from "../shared/remote-url-policy.js";

const backgroundSource = readFileSync("extension/background.js", "utf8")
  .replace(/^import \{ assertSafeRemoteUrl \} from '\.\/remote-url-policy\.js';\s*/m, "");

const listeners: Record<string, unknown[]> = {};
const context = {
  console,
  URL,
  AbortSignal,
  TextDecoder,
  Uint8Array,
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
        get: (_keys: unknown, callback: (value: Record<string, unknown>) => void) => callback({}),
        set: (_value: unknown, callback: () => void) => callback(),
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
  extractDescriptionFromTitle: (title: string, url: string) => string;
  extractReadableDescription: (html: string, title: string, url: string) => string;
  handleFetchMeta: (url: string) => Promise<{ title: string; description: string; image: string; favicon: string }>;
  compactTitleForCapture: (title: string, url: string) => string;
};

const bg = context as BackgroundContext;

assert.equal(
  bg.compactTitleForCapture("docu.md — AI writes it. docu.md does the rest.", "https://docu.md/"),
  "Docu.md",
  "docu.md capture title should prefer the concise product name"
);

assert.equal(
  bg.extractDescriptionFromTitle("docu.md — AI writes it. docu.md does the rest.", "https://docu.md/"),
  "AI writes it. docu.md does the rest.",
  "docu.md title slogan should be usable as the target-page description"
);

assert.equal(
  bg.extractReadableDescription(
    `
      <html>
        <head><title>docu.md — AI writes it. docu.md does the rest.</title></head>
        <body>
          <nav>Features Docs</nav>
          <main>
            <p>The aftercare for AI-written markdown</p>
            <h1>AI writes it.</h1>
            <p>docu.md does the rest.</p>
            <p>Turn AI-generated markdown into work you can hand in.</p>
          </main>
        </body>
      </html>
    `,
    "docu.md — AI writes it. docu.md does the rest.",
    "https://docu.md/"
  ),
  "AI writes it. docu.md does the rest.",
  "readable fallback should prefer the hero promise over unrelated source-page text"
);

async function main() {
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

  console.log("floating capture metadata tests passed");
}

void main();

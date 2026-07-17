import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.WEBCOLLECT_EVIDENCE_PORT || 5020);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = resolve(ROOT, "docs/audit/screenshots");
const VIEWPORT = { width: 1920, height: 1080 };

const refs = {
  "logic-right": "docs/design/mockups/2026-07-15-mindmap-logic-right.png",
  bilateral: "docs/design/mockups/2026-07-15-mindmap-bilateral.png",
  "tree-down": "docs/design/mockups/2026-07-15-mindmap-tree-down.png",
  hover: "docs/design/mockups/2026-07-15-mindmap-hover-preview.png",
  classic: "docs/design/mockups/2026-07-15-mindmap-classic-mode.png",
};

const sections = [
  { id: "section-default", name: "主页", order: 0, createdAt: 1, updatedAt: 1 },
];
const categories = [
  { id: "cat-work", name: "工作", icon: "briefcase", color: "#b8860b", order: 0, createdAt: 1, sectionId: "section-default", isParent: true },
  { id: "cat-ai", name: "AI", icon: "brain", color: "#8b5cf6", order: 1, createdAt: 2, sectionId: "section-default", isParent: true },
  { id: "cat-dev", name: "开发", icon: "terminal", color: "#4a7c59", order: 2, createdAt: 3, sectionId: "section-default", isParent: true },
  { id: "group-common", name: "常用", icon: "star", color: "#b8860b", order: 0, createdAt: 4, sectionId: "section-default", parentId: "cat-work" },
  { id: "group-design", name: "设计灵感", icon: "palette", color: "#9b7e8e", order: 1, createdAt: 5, sectionId: "section-default", parentId: "cat-work" },
  { id: "group-tools", name: "AI工具", icon: "wrench", color: "#4a6fa5", order: 0, createdAt: 6, sectionId: "section-default", parentId: "cat-ai" },
  { id: "group-dev", name: "开发者", icon: "code-2", color: "#4a7c59", order: 0, createdAt: 7, sectionId: "section-default", parentId: "cat-dev" },
  { id: "group-reading", name: "阅读", icon: "book-open", color: "#8b6f5c", order: 1, createdAt: 8, sectionId: "section-default", parentId: "cat-dev" },
];

function card(id, title, categoryId, order, url = `https://${id}.example.com`) {
  return {
    id,
    title,
    categoryId,
    order,
    createdAt: 100 + order,
    updatedAt: 100 + order,
    url,
    shortDesc: `${title} description`,
    fullDesc: "",
    note: "",
    abbreviation: title.slice(0, 1),
    imageUrl: "/assets/mascots/chipmunk-head.png",
  };
}

const cards = [
  card("chrome", "Chrome", "group-common", 0, "https://www.google.com/chrome/"),
  card("x-list", "X List", "group-common", 1, "https://x.com"),
  card("download", "Download", "group-common", 2, "https://example.com/download"),
  card("figma", "Figma", "group-design", 3, "https://www.figma.com"),
  card("dribbble", "Dribbble", "group-design", 4, "https://dribbble.com"),
  card("chatgpt", "ChatGPT", "group-tools", 5, "https://chat.openai.com"),
  card("claude", "Claude", "group-tools", 6, "https://claude.ai"),
  card("gemini", "Gemini", "group-tools", 7, "https://gemini.google.com"),
  card("github", "GitHub", "group-dev", 8, "https://github.com"),
  card("npm", "npm", "group-dev", 9, "https://www.npmjs.com"),
  card("yt-dlp", "yt-dlp", "group-dev", 10, "https://github.com/yt-dlp/yt-dlp"),
  card("juejin", "掘金", "group-reading", 11, "https://juejin.cn"),
  card("medium", "Medium", "group-reading", 12, "https://medium.com"),
];

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok || response.status < 500) return;
    } catch {
      // Keep waiting while Next starts.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

async function openCollection(page) {
  const brand = page.getByText("WebCollect", { exact: true });
  const wallpaper = page.locator('[data-wallpaper-ready="true"]');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await brand.isVisible().catch(() => false)) break;
    if (await wallpaper.isVisible().catch(() => false)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(250);
  if (await wallpaper.isVisible().catch(() => false)) await wallpaper.press("Enter");
  await brand.waitFor({ state: "visible", timeout: 15_000 });
}

async function seedFixture(page) {
  await page.evaluate(async (fixture) => {
    let database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!database.objectStoreNames.contains("webcollect_data")) {
      const nextVersion = database.version + 1;
      database.close();
      database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("WebCollect", nextVersion);
        request.onupgradeneeded = () => {
          const upgradeDb = request.result;
          if (!upgradeDb.objectStoreNames.contains("webcollect_data")) {
            upgradeDb.createObjectStore("webcollect_data");
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    try {
      const transaction = database.transaction("webcollect_data", "readwrite");
      const store = transaction.objectStore("webcollect_data");
      for (const [key, value] of Object.entries(fixture)) store.put(value, key);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, {
    cards,
    categories,
    collectionSections: sections,
    activeCollectionSectionId: "section-default",
    pinnedBookmarkItems: [],
    linkOpenMode: "new-active-tab",
    initialized: true,
  });
}

async function capturePage(page, name) {
  const path = resolve(OUT_DIR, `webcollect-v1.2.0-mindmap-${name}-1920x1080-2026-07-16.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function captureComparison(browser, name, referencePath, implementationPath) {
  if (!referencePath) return null;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1120 }, deviceScaleFactor: 1 });
  const refUrl = `data:image/png;base64,${readFileSync(resolve(ROOT, referencePath)).toString("base64")}`;
  const implUrl = `data:image/png;base64,${readFileSync(implementationPath).toString("base64")}`;
  await page.setContent(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { margin: 0; background: #f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; }
          .panel { overflow: hidden; border: 1px solid #dbe3ef; border-radius: 18px; background: #fff; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
          .label { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px; font-weight: 760; }
          img { display: block; width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <div class="grid">
          <div class="panel"><div class="label">Fable reference · ${name}</div><img src="${refUrl}" /></div>
          <div class="panel"><div class="label">WebCollect V1.2.0 implementation · ${name}</div><img src="${implUrl}" /></div>
        </div>
      </body>
    </html>`, { waitUntil: "load" });
  const comparisonPath = resolve(OUT_DIR, `webcollect-v1.2.0-mindmap-${name}-comparison-2026-07-16.png`);
  await page.screenshot({ path: comparisonPath, fullPage: true });
  await page.close();
  return comparisonPath;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = spawn("corepack", ["pnpm@9.0.0", "exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));

  try {
    await waitForServer();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    await page.goto(BASE_URL);
    await openCollection(page);
    await seedFixture(page);
    await page.reload({ waitUntil: "networkidle" });
    await openCollection(page);
    await page.getByRole("button", { name: /^导图/ }).click();
    await page.getByTestId("mindmap-stage").waitFor({ state: "visible" });
    await page.waitForTimeout(250);

    const implementations = {};
    for (const [name, buttonName] of [
      ["logic-right", "右侧逻辑图（默认）"],
      ["bilateral", "双侧脑图"],
      ["tree-down", "下行组织图"],
      ["indent", "缩进树"],
    ]) {
      await page.getByRole("button", { name: buttonName }).click();
      await page.waitForTimeout(250);
      implementations[name] = await capturePage(page, name);
    }

    await page.getByRole("button", { name: "右侧逻辑图（默认）" }).click();
    await page.locator('[data-mindmap-node="card:chrome"]').hover();
    await page.getByTestId("mindmap-hover-preview").waitFor({ state: "visible" });
    implementations.hover = await capturePage(page, "hover-preview");

    await page.getByRole("button", { name: /^经典/ }).click();
    await page.getByTestId("collection-view-classic").waitFor({ state: "visible" });
    await page.waitForTimeout(250);
    implementations.classic = await capturePage(page, "classic-mode");

    const comparisons = [];
    comparisons.push(await captureComparison(browser, "logic-right", refs["logic-right"], implementations["logic-right"]));
    comparisons.push(await captureComparison(browser, "bilateral", refs.bilateral, implementations.bilateral));
    comparisons.push(await captureComparison(browser, "tree-down", refs["tree-down"], implementations["tree-down"]));
    comparisons.push(await captureComparison(browser, "hover-preview", refs.hover, implementations.hover));
    comparisons.push(await captureComparison(browser, "classic-mode", refs.classic, implementations.classic));
    await browser.close();

    console.log(JSON.stringify({ implementations, comparisons: comparisons.filter(Boolean) }, null, 2));
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

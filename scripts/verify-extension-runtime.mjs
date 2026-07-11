import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = resolve(import.meta.dirname, "..");
const extensionPath = resolve(projectRoot, "extension", "dist");
const outputDir = resolve(projectRoot, "output", "playwright");
const profileDir = await mkdtemp(resolve(tmpdir(), "webcollect-extension-audit-"));
const manifest = JSON.parse(await readFile(resolve(extensionPath, "manifest.json"), "utf8"));
const extensionId = createHash("sha256")
  .update(Buffer.from(manifest.key, "base64"))
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)));
await mkdir(outputDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileDir, {
  channel: "chromium",
  headless: false,
  ignoreDefaultArgs: ["--disable-extensions"],
  viewport: { width: 1440, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

try {
  const page = context.pages()[0] || await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(`chrome-extension://${extensionId}/newtab.html`, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await page.locator("body").waitFor({ state: "visible" });
  const worker = context.serviceWorkers()[0]
    || await context.waitForEvent("serviceworker", { timeout: 15_000 });

  const privateCheck = await page.evaluate(() => new Promise((resolveMessage) => {
    chrome.runtime.sendMessage({
      type: "CHECK_SAFETY",
      urls: ["http://127.0.0.1/private"],
    }, resolveMessage);
  }));
  const privateMetadata = await page.evaluate(() => new Promise((resolveMessage) => {
    chrome.runtime.sendMessage({
      type: "FETCH_META",
      url: "http://169.254.169.254/latest/meta-data",
    }, resolveMessage);
  }));
  const publicMetadata = await page.evaluate(() => new Promise((resolveMessage) => {
    chrome.runtime.sendMessage({
      type: "FETCH_META",
      url: "https://example.com/",
    }, resolveMessage);
  }));
  const wallpaperState = await page.evaluate(() => ({
    title: document.title,
    text: (document.body.innerText || "").slice(0, 500),
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  await page.screenshot({
    path: resolve(outputDir, "extension-runtime-wallpaper-1440x900.png"),
    fullPage: false,
  });

  if (!wallpaperState.text.includes("WebCollect")) {
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.body.innerText.includes("WebCollect"), null, {
      timeout: 10_000,
    });
  }
  const collectionState = await page.evaluate(() => ({
    title: document.title,
    text: (document.body.innerText || "").slice(0, 500),
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  await page.screenshot({
    path: resolve(outputDir, "extension-runtime-collection-1440x900.png"),
    fullPage: false,
  });

  const privateResult = privateCheck?.data?.[0];
  if (!privateCheck?.success || privateResult?.level !== "danger") {
    throw new Error(`Private URL basic check failed: ${JSON.stringify(privateCheck)}`);
  }
  if (!privateMetadata?.success || Object.values(privateMetadata.data || {}).some(Boolean)) {
    throw new Error(`Private metadata request was not refused: ${JSON.stringify(privateMetadata)}`);
  }
  if (!publicMetadata?.success || !publicMetadata.data?.title) {
    throw new Error(`Public metadata control failed: ${JSON.stringify(publicMetadata)}`);
  }
  if (!collectionState.text.includes("WebCollect")) {
    throw new Error("Extension new-tab UI did not render WebCollect");
  }
  if (consoleErrors.length > 0) {
    throw new Error(`Extension console errors: ${consoleErrors.join(" | ")}`);
  }

  console.log(JSON.stringify({
    extensionId,
    serviceWorker: worker.url(),
    privateCheck: privateResult,
    privateMetadata: privateMetadata.data,
    publicMetadata: publicMetadata.data,
    wallpaperState,
    collectionState,
    consoleErrors,
    screenshots: [
      resolve(outputDir, "extension-runtime-wallpaper-1440x900.png"),
      resolve(outputDir, "extension-runtime-collection-1440x900.png"),
    ],
    profileDir,
  }, null, 2));
} finally {
  await context.close();
}

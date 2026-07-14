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

async function readWallpaperGeometry(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector)?.getBoundingClientRect();
      return value ? { left: value.left, top: value.top, right: value.right, bottom: value.bottom } : null;
    };
    return {
      quote: rect(".wc-zoom-quote"),
      hint: rect(".wc-zoom-idle-hint-visible"),
      controls: rect(".wc-wallpaper-controls"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

function rectanglesIntersect(left, right) {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

function assertWallpaperGeometry(label, geometry) {
  if (!geometry.quote || !geometry.hint || !geometry.controls) {
    throw new Error(`${label} wallpaper geometry is incomplete: ${JSON.stringify(geometry)}`);
  }
  if (
    rectanglesIntersect(geometry.quote, geometry.hint)
    || rectanglesIntersect(geometry.quote, geometry.controls)
    || rectanglesIntersect(geometry.hint, geometry.controls)
  ) {
    throw new Error(`${label} wallpaper layers overlap: ${JSON.stringify(geometry)}`);
  }
  if (geometry.scrollWidth > geometry.viewportWidth + 1) {
    throw new Error(`${label} wallpaper overflows horizontally: ${JSON.stringify(geometry)}`);
  }
}

async function sendRuntimeMessage(page, message) {
  return page.evaluate((payload) => new Promise((resolveMessage) => {
    chrome.runtime.sendMessage(payload, resolveMessage);
  }), message);
}

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
  await page.waitForTimeout(2_300);
  const desktopWallpaperGeometry = await readWallpaperGeometry(page);
  assertWallpaperGeometry("desktop", desktopWallpaperGeometry);

  await page.screenshot({
    path: resolve(outputDir, "extension-runtime-wallpaper-1440x900.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWallpaperGeometry = await readWallpaperGeometry(page);
  assertWallpaperGeometry("mobile", mobileWallpaperGeometry);
  await page.screenshot({
    path: resolve(outputDir, "extension-runtime-wallpaper-390x844.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 900 });

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

  const captureProbeTitle = "WebCollect Runtime Target Probe";
  const captureProbe = await sendRuntimeMessage(page, {
    type: "CAPTURE_QUEUE_ADD",
    draft: {
      url: "https://example.com/webcollect-runtime-target-probe",
      title: captureProbeTitle,
      description: "Isolated extension runtime destination check",
      sourceType: "context-menu",
      destination: {
        createSectionName: "Runtime Audit",
        createGroupName: "Runtime Inbox",
      },
    },
  });
  if (!captureProbe?.success || !captureProbe.item?.id) {
    throw new Error(`Capture runtime probe was not queued: ${JSON.stringify(captureProbe)}`);
  }

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  let captureQueue;
  const captureDeadline = Date.now() + 10_000;
  do {
    captureQueue = await sendRuntimeMessage(page, { type: "CAPTURE_QUEUE_LIST" });
    const status = captureQueue?.queue?.find((entry) => entry.id === captureProbe.item.id)?.status;
    if (status === "imported" || status === "failed") break;
    await page.waitForTimeout(200);
  } while (Date.now() < captureDeadline);

  const captureDestinations = await sendRuntimeMessage(page, { type: "CAPTURE_GET_DESTINATIONS" });
  const importedCapture = captureQueue?.queue?.find((entry) => entry.id === captureProbe.item.id);
  const runtimeSections = captureDestinations?.cache?.sections?.filter((section) => section.name === "Runtime Audit") || [];
  const runtimeGroups = captureDestinations?.cache?.categories?.filter((category) => category.name === "Runtime Inbox") || [];
  const runtimeSection = runtimeSections[0];
  const runtimeGroup = runtimeGroups[0];

  if (
    importedCapture?.status !== "imported"
    || importedCapture?.destinationError
    || importedCapture?.resolvedDestinationPath !== "Runtime Audit / Runtime Inbox"
  ) {
    throw new Error(`Capture runtime probe landed incorrectly: ${JSON.stringify(importedCapture)}`);
  }
  if (!runtimeSection || !runtimeGroup || runtimeGroup.sectionId !== runtimeSection.id) {
    throw new Error(`Capture runtime destination cache is inconsistent: ${JSON.stringify(captureDestinations)}`);
  }
  if (runtimeSections.length !== 1 || runtimeGroups.length !== 1) {
    throw new Error(`Concurrent capture drain created duplicate destinations: ${JSON.stringify({ runtimeSections, runtimeGroups })}`);
  }

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
    desktopWallpaperGeometry,
    mobileWallpaperGeometry,
    collectionState,
    captureProbe: {
      id: captureProbe.item.id,
      status: importedCapture.status,
      resolvedDestinationPath: importedCapture.resolvedDestinationPath,
      sectionId: runtimeSection.id,
      groupId: runtimeGroup.id,
      matchingSectionCount: runtimeSections.length,
      matchingGroupCount: runtimeGroups.length,
    },
    consoleErrors,
    screenshots: [
      resolve(outputDir, "extension-runtime-wallpaper-1440x900.png"),
      resolve(outputDir, "extension-runtime-wallpaper-390x844.png"),
      resolve(outputDir, "extension-runtime-collection-1440x900.png"),
    ],
    profileDir,
  }, null, 2));
} finally {
  await context.close();
}

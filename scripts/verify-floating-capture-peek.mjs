import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = resolve(import.meta.dirname, "..");
const extensionPath = resolve(projectRoot, "extension", "dist");
const profileDir = await mkdtemp(resolve(tmpdir(), "webcollect-floating-peek-"));
const restScreenshot = resolve(tmpdir(), "webcollect-floating-peek-rest.png");
const hoverScreenshot = resolve(tmpdir(), "webcollect-floating-peek-hover.png");

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
    <html lang="zh-CN">
      <head><title>WebCollect floating peek verification</title></head>
      <body style="margin:0;min-height:100vh;background:#f5f8ff;font:16px system-ui;color:#1e293b">
        <main style="max-width:760px;margin:0 auto;padding:80px 32px">
          <h1>WebCollect 浮窗验收页</h1>
          <p>验证收起时半脸偷看，悬停后完整展示。</p>
        </main>
      </body>
    </html>`);
});

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", resolveListen);
});

const address = server.address();
if (!address || typeof address === "string") throw new Error("Floating peek test server did not start");
const pageUrl = `http://127.0.0.1:${address.port}/`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readFloatingState(page) {
  return page.evaluate(() => {
    const host = document.querySelector("#webcollect-floating-capture-host");
    const shadow = host?.shadowRoot;
    const button = shadow?.querySelector(".wc-button");
    const peek = shadow?.querySelector(".wc-peek-head");
    const mascot = shadow?.querySelector(".wc-peek-head .wc-chipmunk-art");
    const pill = shadow?.querySelector(".wc-pill-art");
    if (!(button instanceof HTMLElement) || !(mascot instanceof HTMLElement) || !(peek instanceof HTMLElement) || !(pill instanceof HTMLElement)) {
      return null;
    }
    const buttonRect = button.getBoundingClientRect();
    const mascotRect = mascot.getBoundingClientRect();
    const visibleWidth = (rect) => Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left));
    return {
      side: button.dataset.side,
      button: {
        left: buttonRect.left,
        right: buttonRect.right,
        width: buttonRect.width,
        visibleWidth: visibleWidth(buttonRect),
        top: buttonRect.top,
        bottom: buttonRect.bottom,
      },
      mascot: {
        left: mascotRect.left,
        right: mascotRect.right,
        width: mascotRect.width,
        visibleWidth: visibleWidth(mascotRect),
        visibleRatio: mascotRect.width > 0 ? visibleWidth(mascotRect) / mascotRect.width : 0,
      },
      peekOpacity: Number.parseFloat(getComputedStyle(peek).opacity),
      pillOpacity: Number.parseFloat(getComputedStyle(pill).opacity),
      panelOpen: shadow?.querySelector(".wc-panel")?.getAttribute("data-open") === "true",
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
}

function assertRestingPeek(label, state) {
  assert(state, `${label}: floating capture state is missing`);
  assert(
    state.mascot.visibleRatio >= 0.38 && state.mascot.visibleRatio <= 0.62,
    `${label}: expected about half of the mascot face, received ${JSON.stringify(state.mascot)}`
  );
  assert(
    state.button.visibleWidth >= 24 && state.button.visibleWidth <= 36,
    `${label}: collapsed hit target width is unexpected: ${JSON.stringify(state.button)}`
  );
  assert(state.peekOpacity >= 0.95, `${label}: peek face should be visible at rest`);
  assert(state.pillOpacity <= 0.05, `${label}: full pill should be hidden at rest`);
}

const context = await chromium.launchPersistentContext(profileDir, {
  channel: "chromium",
  headless: false,
  ignoreDefaultArgs: ["--disable-extensions"],
  viewport: { width: 1280, height: 720 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

const consoleErrors = [];

try {
  const page = context.pages()[0] || await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForFunction(() => Boolean(document.querySelector("#webcollect-floating-capture-host")?.shadowRoot));
  await page.mouse.move(20, 20);
  await page.waitForTimeout(320);

  const rightRest = await readFloatingState(page);
  assert(rightRest?.side === "right", `Expected the default right dock: ${JSON.stringify(rightRest)}`);
  assertRestingPeek("right dock", rightRest);
  await page.screenshot({ path: restScreenshot, fullPage: false });

  await page.mouse.move(rightRest.viewport.width - 8, (rightRest.button.top + rightRest.button.bottom) / 2);
  await page.waitForTimeout(320);
  const hover = await readFloatingState(page);
  assert(hover, "Hover state is missing");
  assert(hover.button.visibleWidth >= hover.button.width - 1, `Hover should reveal the full button: ${JSON.stringify(hover.button)}`);
  assert(hover.peekOpacity <= 0.05, "Hover should hide the standalone peek face");
  assert(hover.pillOpacity >= 0.95, "Hover should reveal the full WebCollect pill");
  await page.screenshot({ path: hoverScreenshot, fullPage: false });

  await page.mouse.click(hover.viewport.width - 24, (hover.button.top + hover.button.bottom) / 2);
  await page.waitForTimeout(120);
  const clicked = await readFloatingState(page);
  assert(clicked?.panelOpen, "Clicking the revealed mascot should still open the capture panel");

  await page.evaluate(() => {
    localStorage.setItem("webcollect.capture.dock", JSON.stringify({ side: "left", topRatio: 0.55 }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(document.querySelector("#webcollect-floating-capture-host")?.shadowRoot));
  await page.mouse.move(640, 40);
  await page.waitForTimeout(320);
  const leftRest = await readFloatingState(page);
  assert(leftRest?.side === "left", `Expected the persisted left dock: ${JSON.stringify(leftRest)}`);
  assertRestingPeek("left dock", leftRest);

  assert(consoleErrors.length === 0, `Floating peek console errors: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    pageUrl,
    rightRest,
    hover,
    clicked: { panelOpen: clicked.panelOpen },
    leftRest,
    consoleErrors,
    screenshots: [restScreenshot, hoverScreenshot],
    profileDir,
  }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

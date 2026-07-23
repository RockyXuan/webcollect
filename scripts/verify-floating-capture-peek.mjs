import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import nodeAssert from "node:assert/strict";
import { chromium } from "@playwright/test";

const projectRoot = resolve(import.meta.dirname, "..");
const extensionPath = resolve(projectRoot, "extension", "dist");
const profileDir = await mkdtemp(resolve(tmpdir(), "webcollect-floating-peek-"));
const restScreenshot = resolve(tmpdir(), "webcollect-floating-peek-rest.png");
const hoverScreenshot = resolve(tmpdir(), "webcollect-floating-peek-hover.png");
const duplicateScreenshot = resolve(tmpdir(), "webcollect-floating-duplicate-confirmation.png");

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
        <script>
          window.__webcollectHostKeyboardEvents = [];
          window.__resetWebCollectHostKeyboardEvents = () => {
            window.__webcollectHostKeyboardEvents.length = 0;
            document.documentElement.removeAttribute("data-host-shortcut-open");
          };
          const recordHostKeyboardEvent = (event) => {
            window.__webcollectHostKeyboardEvents.push({
              type: event.type,
              key: event.key,
              phase: event.eventPhase,
              target: event.target instanceof Element ? event.target.tagName : "unknown",
            });
            if (String(event.key || "").toLowerCase() === "s") {
              document.documentElement.setAttribute("data-host-shortcut-open", "true");
            }
          };
          for (const type of ["keydown", "keypress", "keyup"]) {
            document.addEventListener(type, recordHostKeyboardEvent, true);
            document.addEventListener(type, recordHostKeyboardEvent, false);
          }
        </script>
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
      buttonHovered: button.matches(":hover"),
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
    `${label}: expected about half of the mascot face, received ${JSON.stringify(state)}`
  );
  assert(
    state.button.visibleWidth >= 24 && state.button.visibleWidth <= 36,
    `${label}: collapsed hit target width is unexpected: ${JSON.stringify(state.button)}`
  );
  assert(
    state.button.visibleWidth >= state.button.width - 1,
    `${label}: collapsed hit target must remain fully inside the viewport: ${JSON.stringify(state.button)}`
  );
  assert(state.peekOpacity >= 0.95, `${label}: peek face should be visible at rest`);
  assert(state.pillOpacity <= 0.05, `${label}: full pill should be hidden at rest`);
}

async function readHostKeyboardState(page) {
  return page.evaluate(() => ({
    events: Array.isArray(window.__webcollectHostKeyboardEvents)
      ? [...window.__webcollectHostKeyboardEvents]
      : [],
    shortcutOpen: document.documentElement.getAttribute("data-host-shortcut-open") === "true",
  }));
}

async function resetHostKeyboardState(page) {
  await page.evaluate(() => window.__resetWebCollectHostKeyboardEvents?.());
}

async function verifyKeyboardIsolation(page) {
  const host = page.locator("#webcollect-floating-capture-host");
  const titleInput = host.locator('[data-field="title"]');
  const urlInput = host.locator('[data-field="url"]');
  const descriptionInput = host.locator('[data-field="description"]');
  const sectionSelect = host.locator('[data-field="section"]');
  const sectionCreateInput = host.locator('[data-create-field="section"]');
  const closeButton = host.locator('.wc-icon-button[data-action="close"]');

  await resetHostKeyboardState(page);
  await titleInput.fill("归藏");
  await titleInput.click();
  await page.keyboard.type("sS");
  nodeAssert.equal(await titleInput.inputValue(), "归藏sS", "lowercase and uppercase typing should stay in the title field");
  nodeAssert.deepEqual(await readHostKeyboardState(page), { events: [], shortcutOpen: false }, "title typing must not reach the host page");

  await resetHostKeyboardState(page);
  await urlInput.fill("https://example.com/");
  await urlInput.click();
  await page.keyboard.type("s");
  nodeAssert.equal(await urlInput.inputValue(), "https://example.com/s", "URL typing should remain functional");
  nodeAssert.deepEqual(await readHostKeyboardState(page), { events: [], shortcutOpen: false }, "URL typing must not reach the host page");

  await resetHostKeyboardState(page);
  await descriptionInput.fill("简介");
  await descriptionInput.click();
  await page.keyboard.type("s");
  nodeAssert.equal(await descriptionInput.inputValue(), "简介s", "description typing should remain functional");
  nodeAssert.deepEqual(await readHostKeyboardState(page), { events: [], shortcutOpen: false }, "description typing must not reach the host page");

  await sectionSelect.selectOption("__webcollect_create_section__");
  await resetHostKeyboardState(page);
  await sectionCreateInput.fill("新分项");
  await sectionCreateInput.click();
  await page.keyboard.type("s");
  nodeAssert.equal(await sectionCreateInput.inputValue(), "新分项s", "create-name typing should remain functional");
  nodeAssert.deepEqual(await readHostKeyboardState(page), { events: [], shortcutOpen: false }, "create-name typing must not reach the host page");

  await resetHostKeyboardState(page);
  const compositionResult = await titleInput.evaluate((input) => {
    input.focus();
    const start = new CompositionEvent("compositionstart", { bubbles: true, composed: true, data: "" });
    input.dispatchEvent(start);
    const down = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "KeyS",
      composed: true,
      isComposing: true,
      key: "s",
    });
    const notCanceled = input.dispatchEvent(down);
    input.value = `${input.value}搜索`;
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: "搜索",
      inputType: "insertCompositionText",
    }));
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, composed: true, data: "搜索" }));
    input.dispatchEvent(new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      code: "KeyS",
      composed: true,
      isComposing: false,
      key: "s",
    }));
    return { notCanceled, value: input.value };
  });
  nodeAssert.equal(compositionResult.notCanceled, true, "IME key events must not be prevented");
  nodeAssert.match(compositionResult.value, /搜索$/, "IME composition text should remain in the field");
  nodeAssert.deepEqual(await readHostKeyboardState(page), { events: [], shortcutOpen: false }, "IME key events must not reach the host page");

  await resetHostKeyboardState(page);
  await titleInput.fill("copy-source");
  await titleInput.click();
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${modifier}+A`);
  await page.keyboard.press(`${modifier}+C`);
  await titleInput.fill("");
  await titleInput.click();
  await page.keyboard.press(`${modifier}+V`);
  nodeAssert.equal(await titleInput.inputValue(), "copy-source", "copy and paste should retain browser-default behavior");
  nodeAssert.deepEqual(await readHostKeyboardState(page), { events: [], shortcutOpen: false }, "modifier shortcuts must not reach the host page");

  await resetHostKeyboardState(page);
  await titleInput.click();
  await page.keyboard.press("Tab");
  const activeField = await page.evaluate(() => {
    const host = document.querySelector("#webcollect-floating-capture-host");
    return host?.shadowRoot?.activeElement?.getAttribute("data-field") || null;
  });
  nodeAssert.equal(activeField, "url", "Tab should continue moving focus inside the floating panel");
  nodeAssert.deepEqual(await readHostKeyboardState(page), { events: [], shortcutOpen: false }, "Tab must not reach the host page");

  await closeButton.click();
  await resetHostKeyboardState(page);
  await page.locator("h1").click();
  await page.keyboard.press("s");
  const outsideState = await readHostKeyboardState(page);
  nodeAssert.equal(outsideState.shortcutOpen, true, "host-page shortcuts should still work outside WebCollect");
  nodeAssert.ok(outsideState.events.length > 0, "outside key events should still reach the host page");

  return {
    titleValue: compositionResult.value,
    copyPasteValue: await titleInput.inputValue(),
    activeFieldAfterTab: activeField,
    outsideHostEventCount: outsideState.events.length,
  };
}

async function readCardsFromExtensionPage(extensionPage) {
  return extensionPage.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("webcollect_data", "readonly");
        const request = transaction.objectStore("webcollect_data").get("cards");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      });
    } finally {
      database.close();
    }
  });
}

async function seedDuplicateCard(extensionPage, url) {
  await extensionPage.evaluate(async ({ targetUrl }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("webcollect_data", "readwrite");
        const store = transaction.objectStore("webcollect_data");
        const request = store.get("cards");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cards = Array.isArray(request.result) ? request.result : [];
          store.put([
            ...cards.filter((card) => card?.id !== "card-floating-duplicate-test"),
            {
              id: "card-floating-duplicate-test",
              url: targetUrl,
              title: "原始收藏标题",
              shortDesc: "原始简介",
              fullDesc: "原始详细简介",
              note: "必须保留的备注",
              abbreviation: "KEEP",
              imageUrl: "https://example.com/original-icon.png",
              categoryId: cards[0]?.categoryId || "cat-inbox",
              order: 999,
              createdAt: 1000,
              updatedAt: 2000,
            },
          ], "cards");
        };
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
    } finally {
      database.close();
    }
  }, { targetUrl: url });
}

async function verifyDuplicateConfirmation(page, extensionPage, targetUrl, screenshotPath) {
  const host = page.locator("#webcollect-floating-capture-host");
  const floatingButton = host.locator(".wc-button");
  const titleInput = host.locator('[data-field="title"]');
  const descriptionInput = host.locator('[data-field="description"]');
  const saveButton = host.locator('[data-action="save"]');
  const confirmation = host.locator(".wc-duplicate-confirm");
  const updateButton = host.locator('[data-action="confirm-duplicate-update"]');
  const keepButton = host.locator('[data-action="keep-duplicate"]');

  await floatingButton.hover();
  await page.waitForTimeout(220);
  await floatingButton.click();
  await titleInput.fill("新的收藏标题");
  await descriptionInput.fill("新的项目简介");
  await saveButton.click();
  await confirmation.waitFor({ state: "visible" });
  nodeAssert.match(await confirmation.innerText(), /原始收藏标题/);
  nodeAssert.match(await confirmation.innerText(), /新的收藏标题/);
  nodeAssert.match(await confirmation.innerText(), /原始详细简介/);
  nodeAssert.match(await confirmation.innerText(), /新的项目简介/);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await keepButton.click();
  await page.waitForTimeout(750);

  let cards = await readCardsFromExtensionPage(extensionPage);
  let targetCard = cards.find((card) => card.id === "card-floating-duplicate-test");
  nodeAssert.equal(targetCard.title, "原始收藏标题", "keeping existing content must not write the draft");
  nodeAssert.equal(targetCard.fullDesc, "原始详细简介");

  await floatingButton.hover();
  await page.waitForTimeout(220);
  await floatingButton.click();
  await titleInput.fill("codex-slides");
  await descriptionInput.fill("开源 AI 幻灯片工作室，用于创建演示文稿。");
  await saveButton.click();
  await confirmation.waitFor({ state: "visible" });
  await updateButton.click();

  await extensionPage.waitForFunction(async ({ id, expectedTitle }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("WebCollect");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const cards = await new Promise((resolve, reject) => {
        const transaction = database.transaction("webcollect_data", "readonly");
        const request = transaction.objectStore("webcollect_data").get("cards");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      });
      return cards.some((card) => card?.id === id && card?.title === expectedTitle);
    } finally {
      database.close();
    }
  }, { id: "card-floating-duplicate-test", expectedTitle: "codex-slides" }, { timeout: 10_000 });

  cards = await readCardsFromExtensionPage(extensionPage);
  targetCard = cards.find((card) => card.id === "card-floating-duplicate-test");
  nodeAssert.equal(targetCard.url, targetUrl);
  nodeAssert.equal(targetCard.title, "codex-slides");
  nodeAssert.equal(targetCard.fullDesc, "开源 AI 幻灯片工作室，用于创建演示文稿。");
  nodeAssert.equal(targetCard.note, "必须保留的备注");
  nodeAssert.equal(targetCard.abbreviation, "KEEP");
  nodeAssert.equal(targetCard.imageUrl, "https://example.com/original-icon.png");
  nodeAssert.equal(targetCard.order, 999);
  nodeAssert.equal(targetCard.createdAt, 1000);

  return {
    confirmationText: "新旧标题和简介均可见",
    preservedFields: ["url", "note", "abbreviation", "imageUrl", "order", "createdAt"],
  };
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
  const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const extensionUrl = new URL(serviceWorker.url());
  const extensionOrigin = `chrome-extension://${extensionUrl.host}`;
  const extensionPage = context.pages()[0] || await context.newPage();
  await extensionPage.goto(`${extensionOrigin}/newtab.html`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await extensionPage.waitForTimeout(900);
  await seedDuplicateCard(extensionPage, pageUrl);
  await extensionPage.reload({ waitUntil: "domcontentloaded" });
  await extensionPage.waitForTimeout(900);

  const page = await context.newPage();
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

  const floatingButton = page.locator("#webcollect-floating-capture-host").locator(".wc-button");
  await floatingButton.hover();
  await page.waitForTimeout(320);
  const hover = await readFloatingState(page);
  assert(hover, "Hover state is missing");
  assert(hover.buttonHovered, `Hover should activate the floating button hit target: ${JSON.stringify(hover)}`);
  assert(hover.button.visibleWidth >= hover.button.width - 1, `Hover should reveal the full button: ${JSON.stringify(hover)}`);
  assert(hover.peekOpacity <= 0.05, "Hover should hide the standalone peek face");
  assert(hover.pillOpacity >= 0.95, "Hover should reveal the full WebCollect pill");
  await page.screenshot({ path: hoverScreenshot, fullPage: false });

  await floatingButton.click();
  await page.waitForTimeout(120);
  const clicked = await readFloatingState(page);
  assert(clicked?.panelOpen, "Clicking the revealed mascot should still open the capture panel");
  const keyboardIsolation = await verifyKeyboardIsolation(page);
  const duplicateConfirmation = await verifyDuplicateConfirmation(page, extensionPage, pageUrl, duplicateScreenshot);

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
    keyboardIsolation,
    duplicateConfirmation,
    leftRest,
    consoleErrors,
    screenshots: [restScreenshot, hoverScreenshot, duplicateScreenshot],
    profileDir,
  }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

(() => {
  const QUEUE_MESSAGE = "CAPTURE_QUEUE_ADD";
  const PREFS_GET_MESSAGE = "CAPTURE_GET_PREFS";
  const PREFS_SET_MESSAGE = "CAPTURE_SET_PREFS";
  const DESTINATIONS_GET_MESSAGE = "CAPTURE_GET_DESTINATIONS";
  const META_MESSAGE = "FETCH_META";
  const OPEN_PANEL_MESSAGE = "CAPTURE_OPEN_PANEL";
  const CAPTURE_PREFS_STORAGE_KEY = "webcollect.capture.prefs";

  type CaptureSourceType = "floating-button" | "hover-link" | "selection" | "current-page" | "context-menu";

  interface CaptureDestination {
    sectionId?: string;
    parentCategoryId?: string;
    groupId?: string;
    sectionName?: string;
    parentCategoryName?: string;
    groupName?: string;
  }

  interface CaptureDraft {
    url: string;
    title: string;
    description?: string;
    imageUrl?: string;
    favicon?: string;
    sourceType: CaptureSourceType;
    sourcePageUrl?: string;
    sourcePageTitle?: string;
    destination?: CaptureDestination;
  }

  interface FloatingCapturePrefs {
    enabled: boolean;
    buttonEnabled: boolean;
    hoverEnabled: boolean;
    allLinksHoverEnabled: boolean;
    contextMenuEnabled: boolean;
    mascot: "chipmunk" | "otter";
    pauseUntil: number | null;
    disabledHosts: string[];
  }

  type DockSide = "left" | "right";

  interface FloatingDockState {
    side: DockSide;
    topRatio: number;
  }

  interface DestinationSection {
    id: string;
    name: string;
    order: number;
  }

  interface DestinationCategory {
    id: string;
    name: string;
    order: number;
    parentId?: string;
    sectionId?: string;
    isParent?: boolean;
  }

  interface CaptureDestinationCache {
    updatedAt: number;
    activeSectionId?: string;
    sections: DestinationSection[];
    categories: DestinationCategory[];
  }

  const defaultPrefs: FloatingCapturePrefs = {
    enabled: true,
    buttonEnabled: true,
    hoverEnabled: true,
    allLinksHoverEnabled: false,
    contextMenuEnabled: true,
    mascot: "chipmunk",
    pauseUntil: null,
    disabledHosts: [],
  };
  const DOCK_STORAGE_KEY = "webcollect.capture.dock";
  const defaultDockState: FloatingDockState = { side: "right", topRatio: 0.55 };
  const mascotAssets = {
    chipmunk: {
      head: chrome.runtime.getURL("assets/mascots/chipmunk-head.png"),
    },
    otter: {
      head: chrome.runtime.getURL("assets/mascots/otter-head.png"),
    },
  };
  const pillAssets = {
    wc: chrome.runtime.getURL("assets/mascots/wc-3d.png"),
    plus: chrome.runtime.getURL("assets/mascots/plus-3d.png"),
  };

  let prefs: FloatingCapturePrefs = defaultPrefs;
  let destinationCache: CaptureDestinationCache = {
    updatedAt: 0,
    activeSectionId: "section-default",
    sections: [],
    categories: [],
  };
  let dockState: FloatingDockState = loadDockState();
  let hoveredDraft: CaptureDraft | null = null;
  let hoverDelayTimer: number | null = null;
  let hoverHideTimer: number | null = null;
  let scheduledHover: { link: HTMLAnchorElement; x: number; y: number } | null = null;
  let panelOpen = false;
  let dragState: { pointerId: number; startX: number; startY: number; moved: boolean } | null = null;
  let suppressNextButtonClick = false;
  const HOVER_DELAY_MS = 700;
  const HOVER_MOVE_TOLERANCE_PX = 8;

  const host = document.createElement("div");
  host.id = "webcollect-floating-capture-host";
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  shadow.innerHTML = `
    <style>
      :host { color-scheme: light; }
      .wc-button {
        --wc-button-width: 238px;
        --wc-button-height: 72px;
        --wc-peek-width: 44px;
        position: fixed;
        top: 50%;
        pointer-events: auto;
        display: block;
        width: var(--wc-button-width);
        height: var(--wc-button-height);
        border: 0;
        border-radius: 999px;
        background: transparent;
        box-shadow: none;
        padding: 0;
        cursor: pointer;
        user-select: none;
        touch-action: none;
        overflow: visible;
        transition:
          transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
          filter 180ms ease;
        will-change: transform;
      }
      .wc-button[data-side="right"] {
        right: 0;
        transform: translate(calc(100% - var(--wc-peek-width)), -50%);
      }
      .wc-button[data-side="left"] {
        left: 0;
        transform: translate(calc(-100% + var(--wc-peek-width)), -50%);
      }
      .wc-button:hover,
      .wc-button:focus-visible {
        outline: none;
      }
      .wc-button[data-side="right"]:hover,
      .wc-button[data-side="right"]:focus-visible,
      .wc-button[data-side="right"][data-dragging="true"],
      .wc-button[data-side="right"][data-open="true"] {
        transform: translate(0, -50%);
      }
      .wc-button[data-side="left"]:hover,
      .wc-button[data-side="left"]:focus-visible,
      .wc-button[data-side="left"][data-dragging="true"],
      .wc-button[data-side="left"][data-open="true"] {
        transform: translate(0, -50%);
      }
      .wc-button[data-dragging="true"] {
        cursor: grabbing;
        filter: drop-shadow(0 18px 28px rgba(64, 91, 180, 0.20));
      }
      .wc-pill-art,
      .wc-peek-head {
        position: absolute;
        inset: 0;
        display: grid;
        align-items: center;
        pointer-events: none;
        transition:
          opacity 180ms ease,
          transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .wc-pill-art {
        justify-items: center;
        opacity: 0;
        transform: translateX(9px) scale(0.985);
      }
      .wc-button[data-side="left"] .wc-pill-art {
        transform: translateX(-9px) scale(0.985);
      }
      .wc-peek-head {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      .wc-button[data-side="right"] .wc-peek-head {
        justify-items: start;
      }
      .wc-button[data-side="left"] .wc-peek-head {
        justify-items: end;
      }
      .wc-button:hover .wc-pill-art,
      .wc-button:focus-visible .wc-pill-art,
      .wc-button[data-dragging="true"] .wc-pill-art,
      .wc-button[data-open="true"] .wc-pill-art {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      .wc-button:hover .wc-peek-head,
      .wc-button:focus-visible .wc-peek-head,
      .wc-button[data-dragging="true"] .wc-peek-head,
      .wc-button[data-open="true"] .wc-peek-head {
        opacity: 0;
        transform: scale(0.985);
      }
      .wc-pill-shell {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 62px 94px 46px;
        width: var(--wc-button-width);
        height: var(--wc-button-height);
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1.5px solid rgba(91, 143, 255, 0.72);
        border-radius: 999px;
        background:
          radial-gradient(circle at 15% 18%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.66) 36%, transparent 37%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 249, 255, 0.82));
        box-shadow:
          inset 0 2px 0 rgba(255, 255, 255, 0.92),
          inset 0 -2px 0 rgba(104, 153, 255, 0.20),
          0 16px 30px rgba(64, 91, 180, 0.16),
          0 5px 12px rgba(47, 109, 246, 0.10);
        padding: 5px 8px;
        overflow: hidden;
      }
      .wc-pill-head {
        display: grid;
        place-items: center;
        width: 62px;
        height: 62px;
        overflow: visible;
      }
      .wc-pill-head img,
      .wc-peek-head img {
        display: none;
        object-fit: contain;
        user-select: none;
        -webkit-user-drag: none;
      }
      .wc-pill-head img {
        width: 62px;
        height: 62px;
        filter: drop-shadow(0 8px 14px rgba(64, 91, 180, 0.14));
      }
      .wc-peek-head img {
        width: 62px;
        height: 62px;
        filter: drop-shadow(0 9px 18px rgba(64, 91, 180, 0.16));
      }
      .wc-button[data-side="right"] .wc-peek-head img {
        transform: translateX(-8px);
      }
      .wc-button[data-side="left"] .wc-peek-head img {
        transform: translateX(8px);
      }
      .wc-button[data-mascot="chipmunk"] .wc-chipmunk-art,
      .wc-button[data-mascot="otter"] .wc-otter-art {
        display: block;
      }
      .wc-wc-mark,
      .wc-plus-mark {
        display: block;
        object-fit: contain;
        user-select: none;
        -webkit-user-drag: none;
      }
      .wc-wc-mark {
        width: 94px;
        height: 54px;
        filter: drop-shadow(0 7px 12px rgba(68, 83, 220, 0.18));
      }
      .wc-plus-mark {
        width: 46px;
        height: 46px;
        filter: drop-shadow(0 8px 14px rgba(79, 70, 229, 0.24));
      }
      .wc-hover {
        --wc-ring-angle: 0deg;
        position: fixed;
        pointer-events: auto;
        display: none;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 999px;
        background: conic-gradient(#2563eb var(--wc-ring-angle), #dbeafe 0deg);
        box-shadow:
          0 12px 28px rgba(37, 99, 235, 0.18),
          0 2px 8px rgba(15, 23, 42, 0.08);
        padding: 0;
        cursor: pointer;
        overflow: hidden;
        animation: wc-ring-progress 520ms linear forwards;
      }
      .wc-hover::before {
        content: "";
        position: absolute;
        inset: 3px;
        border-radius: inherit;
        background:
          radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.72)),
          linear-gradient(145deg, rgba(239, 246, 255, 0.94), rgba(255, 255, 255, 0.86));
        border: 1px solid rgba(191, 219, 254, 0.88);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
      }
      .wc-hover img {
        position: relative;
        z-index: 1;
        display: none;
        width: 34px;
        height: 34px;
        object-fit: contain;
        user-select: none;
        -webkit-user-drag: none;
        filter: drop-shadow(0 5px 10px rgba(64, 91, 180, 0.16));
      }
      .wc-hover[data-mascot="chipmunk"] .wc-chipmunk-art,
      .wc-hover[data-mascot="otter"] .wc-otter-art {
        display: block;
      }
      .wc-hover:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 32px rgba(37, 99, 235, 0.25);
      }
      @property --wc-ring-angle {
        syntax: "<angle>";
        inherits: false;
        initial-value: 0deg;
      }
      @keyframes wc-ring-progress {
        to { --wc-ring-angle: 360deg; }
      }
      .wc-panel {
        position: fixed;
        right: 18px;
        top: 74px;
        width: 360px;
        max-width: calc(100vw - 36px);
        pointer-events: auto;
        display: none;
        border: 1px solid rgba(255, 255, 255, 0.82);
        border-radius: 24px;
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(248, 251, 255, 0.80)),
          radial-gradient(circle at 92% 0%, rgba(96, 165, 250, 0.20), transparent 34%),
          radial-gradient(circle at 0% 100%, rgba(124, 58, 237, 0.12), transparent 34%);
        color: #0f172a;
        box-shadow: 0 28px 80px rgba(37, 99, 235, 0.18);
        font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
        backdrop-filter: blur(24px);
      }
      .wc-panel[data-open="true"] { display: block; }
      .wc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 15px 16px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.70);
        background: rgba(255, 255, 255, 0.44);
      }
      .wc-title { font-weight: 800; font-size: 15px; letter-spacing: -0.01em; }
      .wc-icon-button {
        border: 0;
        background: transparent;
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        font-size: 18px;
        line-height: 1;
      }
      .wc-icon-button:hover { color: #2563eb; }
      .wc-body { padding: 14px 16px 16px; }
      .wc-grid { display: grid; gap: 9px; }
      .wc-label { display: grid; gap: 4px; font-weight: 700; color: #334155; }
      .wc-label span { font-size: 12px; }
      .wc-input, .wc-textarea, .wc-select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.76);
        color: #0f172a;
        outline: none;
        padding: 9px 10px;
        font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
      }
      .wc-input:focus, .wc-textarea:focus, .wc-select:focus {
        border-color: rgba(96, 165, 250, 0.68);
        box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.13);
      }
      .wc-textarea { min-height: 62px; resize: vertical; }
      .wc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .wc-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 12px;
      }
      .wc-secondary, .wc-primary, .wc-small {
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 13px;
        cursor: pointer;
        padding: 8px 10px;
        font: 650 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wc-primary {
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        border-color: transparent;
        color: #fff;
        box-shadow: 0 14px 30px rgba(37, 99, 235, 0.24);
      }
      .wc-secondary, .wc-small {
        background: rgba(255, 255, 255, 0.68);
        color: #334155;
      }
      .wc-secondary:hover, .wc-small:hover { background: rgba(255, 255, 255, 0.92); color: #1d4ed8; }
      .wc-small { padding: 6px 7px; font-size: 12px; }
      .wc-muted { color: #64748b; font-size: 12px; }
      .wc-status { min-height: 18px; margin-top: 8px; font-size: 12px; color: #64748b; }
      .wc-status[data-tone="error"] { color: #e11d48; }
      .wc-status[data-tone="ok"] { color: #059669; }
      .wc-quick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .wc-quick-note {
        margin-top: 10px;
        color: #64748b;
        font-size: 12px;
        line-height: 1.45;
      }
      .wc-quick-help {
        margin-top: 6px;
        color: #94a3b8;
        font-size: 11px;
        line-height: 1.45;
      }
    </style>
    <button class="wc-button" type="button" title="收集到 WebCollect">
      <span class="wc-peek-head" aria-hidden="true">
        <img class="wc-chipmunk-art" src="${mascotAssets.chipmunk.head}" alt="" draggable="false" />
        <img class="wc-otter-art" src="${mascotAssets.otter.head}" alt="" draggable="false" />
      </span>
      <span class="wc-pill-art" aria-hidden="true">
        <span class="wc-pill-shell">
          <span class="wc-pill-head">
            <img class="wc-chipmunk-art" src="${mascotAssets.chipmunk.head}" alt="" draggable="false" />
            <img class="wc-otter-art" src="${mascotAssets.otter.head}" alt="" draggable="false" />
          </span>
          <img class="wc-wc-mark" src="${pillAssets.wc}" alt="" draggable="false" />
          <img class="wc-plus-mark" src="${pillAssets.plus}" alt="" draggable="false" />
        </span>
      </span>
    </button>
    <button class="wc-hover" type="button" title="收集到 WebCollect" aria-label="收集到 WebCollect">
      <img class="wc-chipmunk-art" src="${mascotAssets.chipmunk.head}" alt="" draggable="false" />
      <img class="wc-otter-art" src="${mascotAssets.otter.head}" alt="" draggable="false" />
    </button>
    <section class="wc-panel" aria-label="WebCollect 浮窗收集">
      <div class="wc-head">
        <div>
          <div class="wc-title">收集到 WebCollect</div>
          <div class="wc-muted">名称和地址必填，未选目标时进入收集箱</div>
        </div>
        <button class="wc-icon-button" type="button" data-action="close" aria-label="关闭">×</button>
      </div>
      <div class="wc-body">
        <div class="wc-grid">
          <label class="wc-label"><span>名称 *</span><input class="wc-input" data-field="title" /></label>
          <label class="wc-label"><span>地址 *</span><input class="wc-input" data-field="url" /></label>
          <label class="wc-label"><span>简介</span><textarea class="wc-textarea" data-field="description"></textarea></label>
          <div class="wc-row">
            <label class="wc-label"><span>分项</span><select class="wc-select" data-field="section"></select></label>
            <label class="wc-label"><span>分类</span><select class="wc-select" data-field="parent"></select></label>
          </div>
          <label class="wc-label"><span>分组</span><select class="wc-select" data-field="group"></select></label>
        </div>
        <p class="wc-quick-note">WebCollect 浮窗栏可以在当前网页快速收集链接，保存后会进入 WebCollect，未选目标时默认进入主页收集箱。</p>
        <div class="wc-quick">
          <button class="wc-small" type="button" data-action="pause-hour">暂停 1 小时</button>
          <button class="wc-small" type="button" data-action="pause-today">今天不显示</button>
          <button class="wc-small" type="button" data-action="disable-site" title="只在当前网站永久隐藏浮窗，可在 WebCollect 账户设置里恢复">永久不显示</button>
        </div>
        <p class="wc-quick-help">选择永久不显示后，只会影响当前网站；后续可在 WebCollect 主页账户设置里重新开启。</p>
        <div class="wc-status"></div>
        <div class="wc-actions">
          <button class="wc-secondary" type="button" data-action="close">取消</button>
          <button class="wc-primary" type="button" data-action="save">保存</button>
        </div>
      </div>
    </section>
  `;

  const button = shadow.querySelector<HTMLButtonElement>(".wc-button")!;
  const hoverButton = shadow.querySelector<HTMLButtonElement>(".wc-hover")!;
  const panel = shadow.querySelector<HTMLElement>(".wc-panel")!;
  const statusEl = shadow.querySelector<HTMLElement>(".wc-status")!;
  const titleInput = shadow.querySelector<HTMLInputElement>('[data-field="title"]')!;
  const urlInput = shadow.querySelector<HTMLInputElement>('[data-field="url"]')!;
  const descriptionInput = shadow.querySelector<HTMLTextAreaElement>('[data-field="description"]')!;
  const sectionSelect = shadow.querySelector<HTMLSelectElement>('[data-field="section"]')!;
  const parentSelect = shadow.querySelector<HTMLSelectElement>('[data-field="parent"]')!;
  const groupSelect = shadow.querySelector<HTMLSelectElement>('[data-field="group"]')!;

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function loadDockState(): FloatingDockState {
    try {
      const raw = window.localStorage?.getItem(DOCK_STORAGE_KEY);
      if (!raw) return defaultDockState;
      const parsed = JSON.parse(raw) as Partial<FloatingDockState>;
      const side: DockSide = parsed.side === "left" ? "left" : "right";
      const topRatio = typeof parsed.topRatio === "number"
        ? clamp(parsed.topRatio, 0.12, 0.88)
        : defaultDockState.topRatio;
      return { side, topRatio };
    } catch {
      return defaultDockState;
    }
  }

  function saveDockState() {
    try {
      window.localStorage?.setItem(DOCK_STORAGE_KEY, JSON.stringify(dockState));
    } catch {
      // Position persistence is a visual convenience only.
    }
  }

  function getDockTopPx() {
    return clamp(Math.round(window.innerHeight * dockState.topRatio), 56, Math.max(56, window.innerHeight - 56));
  }

  function applyDockState() {
    const top = getDockTopPx();
    button.dataset.side = dockState.side;
    button.style.top = `${top}px`;
    if (dockState.side === "left") {
      button.style.left = "0px";
      button.style.right = "auto";
      panel.style.left = "18px";
      panel.style.right = "auto";
    } else {
      button.style.left = "auto";
      button.style.right = "0px";
      panel.style.left = "auto";
      panel.style.right = "18px";
    }
    const panelHeight = panel.offsetHeight || 520;
    const maxPanelTop = Math.max(16, window.innerHeight - Math.min(panelHeight, window.innerHeight - 32) - 16);
    panel.style.top = `${clamp(top - 126, 16, maxPanelTop)}px`;
  }

  function updateDockFromPointer(clientX: number, clientY: number) {
    dockState = {
      side: clientX < window.innerWidth / 2 ? "left" : "right",
      topRatio: clamp(clientY / Math.max(1, window.innerHeight), 0.12, 0.88),
    };
    applyDockState();
  }

  function normalizeUrl(input: string): string | null {
    const trimmed = input.trim().replace(/[)\]}>，。；、,.!?]+$/g, "");
    if (!trimmed) return null;
    if (/^(https?:\/\/|chrome:\/\/|edge:\/\/|about:)/i.test(trimmed)) return trimmed;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
    return null;
  }

  function extractFirstUrl(text: string): string | null {
    const match = text.match(/((?:https?:\/\/|chrome:\/\/|edge:\/\/|about:)[^\s<>"']+|(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/i);
    return match ? normalizeUrl(match[1]) : null;
  }

  function isRedirectUrl(url: string): boolean {
    try {
      const hostName = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
      return [
        "t.co",
        "bit.ly",
        "tinyurl.com",
        "lnkd.in",
        "t.cn",
        "href.li",
        "l.facebook.com",
        "lm.facebook.com",
        "out.reddit.com",
      ].includes(hostName);
    } catch {
      return false;
    }
  }

  function textFromMeta(name: string): string {
    return document.querySelector<HTMLMetaElement>(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() || "";
  }

  function normalizeCaptureText(text: string): string {
    return text
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\bwww\.\S+/gi, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function compactCaptureTitle(text: string, fallback: string): string {
    const candidates = text
      .split(/\n+/)
      .map((line) => normalizeCaptureText(line))
      .filter(Boolean)
      .filter((line) => !/^来自\s+/i.test(line))
      .filter((line) => !looksLikeExplicitUrlText(line));
    const rawCandidate = candidates[0] || normalizeCaptureText(text) || fallback;
    const sentence = rawCandidate
      .split(/[。！？!?]/)
      .map((part) => part.trim())
      .find(Boolean) || rawCandidate;
    return sentence.length > 36 ? `${sentence.slice(0, 36)}...` : sentence;
  }

  function extractContextText(link?: HTMLAnchorElement): string {
    const container = link?.closest?.('[data-testid="tweetText"], article, [role="article"], main, section') as HTMLElement | null;
    const text = container?.innerText || textFromMeta("og:description") || textFromMeta("description") || "";
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  function chooseOpenableLinkUrl(link: HTMLAnchorElement, visibleText: string): string | null {
    const href = normalizeUrl(link.href);
    const visibleUrl = extractFirstUrl(visibleText);
    if (visibleUrl && (!href || isRedirectUrl(href))) return visibleUrl;
    return href || visibleUrl;
  }

  function titleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname || parsed.pathname || url;
    } catch {
      return url;
    }
  }

  function runtimeMessage<T>(message: Record<string, unknown>): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve((response || null) as T | null);
      });
    });
  }

  function isTemporarilyPaused(): boolean {
    return typeof prefs.pauseUntil === "number" && prefs.pauseUntil > Date.now();
  }

  function isEnabledOnThisPage(): boolean {
    return prefs.enabled
      && !isTemporarilyPaused()
      && !prefs.disabledHosts.includes(window.location.host);
  }

  function updateButtonVisibility() {
    const mascot = prefs.mascot === "otter" ? "otter" : "chipmunk";
    button.dataset.mascot = mascot;
    hoverButton.dataset.mascot = mascot;
    button.style.display = isEnabledOnThisPage() && prefs.buttonEnabled ? "inline-flex" : "none";
    applyDockState();
    if (!isEnabledOnThisPage()) {
      hoverButton.style.display = "none";
      closePanel();
    }
  }

  function setStatus(text: string, tone: "ok" | "error" | "" = "") {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function buildCurrentPageDraft(sourceType: CaptureSourceType = "current-page"): CaptureDraft {
    const pageUrl = window.location.href;
    const metaTitle = textFromMeta("og:title") || document.title || titleFromUrl(pageUrl);
    const metaDescription = textFromMeta("og:description") || textFromMeta("description") || "";
    return {
      url: pageUrl,
      title: compactCaptureTitle(metaTitle, titleFromUrl(pageUrl)),
      description: metaDescription,
      sourceType,
      sourcePageUrl: pageUrl,
      sourcePageTitle: document.title,
    };
  }

  function buildDraftFromSelection(): CaptureDraft | null {
    const selectedText = window.getSelection()?.toString() || "";
    const selectedUrl = extractFirstUrl(selectedText);
    if (!selectedUrl) return null;
    const description = selectedText.length > 240 ? `${selectedText.slice(0, 240)}...` : selectedText;
    return {
      url: selectedUrl,
      title: compactCaptureTitle(selectedText, titleFromUrl(selectedUrl)),
      description,
      sourceType: "selection",
      sourcePageUrl: window.location.href,
      sourcePageTitle: document.title,
    };
  }

  function currentDraft(): CaptureDraft {
    return hoveredDraft || buildDraftFromSelection() || buildCurrentPageDraft("floating-button");
  }

  function sortedSections(): DestinationSection[] {
    return [...destinationCache.sections].sort((a, b) => a.order - b.order);
  }

  function categorySectionId(category: DestinationCategory): string {
    if (category.sectionId) return category.sectionId;
    if (category.parentId) {
      return destinationCache.categories.find((item) => item.id === category.parentId)?.sectionId || "section-default";
    }
    return "section-default";
  }

  function categoriesInSection(sectionId: string): DestinationCategory[] {
    return destinationCache.categories
      .filter((category) => categorySectionId(category) === sectionId)
      .sort((a, b) => a.order - b.order);
  }

  async function refreshDestinations(): Promise<void> {
    const response = await runtimeMessage<{ success?: boolean; cache?: CaptureDestinationCache }>({
      type: DESTINATIONS_GET_MESSAGE,
    });
    if (response?.success && response.cache) {
      destinationCache = response.cache;
    }
  }

  function childCountMap(categories: DestinationCategory[]): Map<string, number> {
    const childCount = new Map<string, number>();
    for (const category of categories) {
      if (category.parentId) {
        childCount.set(category.parentId, (childCount.get(category.parentId) || 0) + 1);
      }
    }
    return childCount;
  }

  function isParentCategory(category: DestinationCategory, childCount: Map<string, number>): boolean {
    return !category.parentId && (category.isParent === true || childCount.has(category.id));
  }

  function isGroupCandidate(category: DestinationCategory, childCount: Map<string, number>): boolean {
    return !!category.parentId || (!category.isParent && !childCount.has(category.id));
  }

  function renderDestinationSelects(destination?: CaptureDestination) {
    const sections = sortedSections();
    sectionSelect.innerHTML = "";
    for (const section of sections) {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = section.name;
      sectionSelect.appendChild(option);
    }
    if (sections.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "默认主页";
      sectionSelect.appendChild(option);
    }
    sectionSelect.value = destination?.sectionId || destinationCache.activeSectionId || sections[0]?.id || "";
    if (sectionSelect.selectedIndex < 0 && sections[0]) {
      sectionSelect.value = sections[0].id;
    }
    renderParentSelect(destination);
    renderGroupSelect(destination);
  }

  function renderParentSelect(destination?: CaptureDestination) {
    const sectionId = sectionSelect.value || "section-default";
    const sectionCategories = categoriesInSection(sectionId);
    const childCount = childCountMap(sectionCategories);
    const parents = sectionCategories.filter((category) => isParentCategory(category, childCount));
    parentSelect.innerHTML = "";
    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.textContent = "自动选择";
    parentSelect.appendChild(autoOption);
    for (const parent of parents) {
      const option = document.createElement("option");
      option.value = parent.id;
      option.textContent = parent.name;
      parentSelect.appendChild(option);
    }
    parentSelect.value = destination?.parentCategoryId || "";
    if (parentSelect.selectedIndex < 0) {
      parentSelect.value = "";
    }
  }

  function renderGroupSelect(destination?: CaptureDestination) {
    const sectionId = sectionSelect.value || "section-default";
    const parentId = parentSelect.value;
    const sectionCategories = categoriesInSection(sectionId);
    const childCount = childCountMap(sectionCategories);
    const groups = parentId
      ? sectionCategories.filter((category) => category.parentId === parentId)
      : sectionCategories.filter((category) => isGroupCandidate(category, childCount));
    groupSelect.innerHTML = "";
    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.textContent = "默认收集箱";
    groupSelect.appendChild(autoOption);
    for (const group of groups) {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.parentId
        ? `${sectionCategories.find((item) => item.id === group.parentId)?.name || "分类"} / ${group.name}`
        : group.name;
      groupSelect.appendChild(option);
    }
    groupSelect.value = destination?.groupId || "";
    if (groupSelect.selectedIndex < 0) {
      groupSelect.value = "";
    }
  }

  async function enrichDraft(draft: CaptureDraft) {
    if (!/^https?:\/\//i.test(draft.url)) return;
    const response = await runtimeMessage<{ success?: boolean; data?: { title?: string; description?: string; image?: string; favicon?: string } }>({
      type: META_MESSAGE,
      url: draft.url,
    });
    if (!response?.success || !response.data) return;
    if (!titleInput.value.trim() && response.data.title) titleInput.value = response.data.title;
    if (!descriptionInput.value.trim() && response.data.description) descriptionInput.value = response.data.description;
    if (response.data.image) panel.dataset.imageUrl = response.data.image;
    if (response.data.favicon) panel.dataset.favicon = response.data.favicon;
  }

  async function openPanel(draft: CaptureDraft) {
    if (!isEnabledOnThisPage()) return;
    await refreshDestinations();
    panelOpen = true;
    hoverButton.style.display = "none";
    if (hoverHideTimer) {
      window.clearTimeout(hoverHideTimer);
      hoverHideTimer = null;
    }
    panel.dataset.open = "true";
    button.dataset.open = "true";
    applyDockState();
    titleInput.value = draft.title || "";
    urlInput.value = draft.url || "";
    descriptionInput.value = draft.description || "";
    panel.dataset.sourceType = draft.sourceType;
    panel.dataset.sourcePageUrl = draft.sourcePageUrl || window.location.href;
    panel.dataset.sourcePageTitle = draft.sourcePageTitle || document.title || "";
    panel.dataset.imageUrl = draft.imageUrl || "";
    panel.dataset.favicon = draft.favicon || "";
    renderDestinationSelects(draft.destination);
    setStatus("");
    void enrichDraft(draft);
    titleInput.focus();
    titleInput.select();
  }

  function closePanel() {
    panelOpen = false;
    panel.dataset.open = "false";
    button.dataset.open = "false";
  }

  function getSelectedDestination(): CaptureDestination | undefined {
    const destination: CaptureDestination = {};
    const selectedGroup = groupSelect.value
      ? destinationCache.categories.find((category) => category.id === groupSelect.value)
      : undefined;
    const selectedParent = parentSelect.value
      ? destinationCache.categories.find((category) => category.id === parentSelect.value)
      : selectedGroup?.parentId
        ? destinationCache.categories.find((category) => category.id === selectedGroup.parentId)
        : undefined;
    const selectedSectionId = sectionSelect.value ||
      (selectedGroup ? categorySectionId(selectedGroup) : undefined) ||
      (selectedParent ? categorySectionId(selectedParent) : undefined);
    const selectedSection = selectedSectionId
      ? destinationCache.sections.find((section) => section.id === selectedSectionId)
      : undefined;

    if (selectedSectionId) destination.sectionId = selectedSectionId;
    if (selectedSection?.name) destination.sectionName = selectedSection.name;
    if (selectedParent?.id) destination.parentCategoryId = selectedParent.id;
    if (selectedParent?.name) destination.parentCategoryName = selectedParent.name;
    if (selectedGroup?.id) destination.groupId = selectedGroup.id;
    if (selectedGroup?.name) destination.groupName = selectedGroup.name;

    return destination.sectionId || destination.parentCategoryId || destination.groupId || destination.sectionName
      ? destination
      : undefined;
  }

  async function saveDraft() {
    const normalizedUrl = normalizeUrl(urlInput.value);
    const title = titleInput.value.trim();
    if (!normalizedUrl) {
      setStatus("地址格式不正确，请填写 http(s) 或支持的内部地址。", "error");
      return;
    }
    if (!title) {
      setStatus("名称不能为空。", "error");
      titleInput.focus();
      return;
    }

    const draft: CaptureDraft = {
      url: normalizedUrl,
      title,
      description: descriptionInput.value.trim(),
      imageUrl: panel.dataset.imageUrl || "",
      favicon: panel.dataset.favicon || "",
      sourceType: (panel.dataset.sourceType as CaptureSourceType) || "floating-button",
      sourcePageUrl: panel.dataset.sourcePageUrl || window.location.href,
      sourcePageTitle: panel.dataset.sourcePageTitle || document.title,
      destination: getSelectedDestination(),
    };
    setStatus("已保存到本地队列，打开 WebCollect 后会自动入库。");
    const response = await runtimeMessage<{ success?: boolean; error?: string }>({ type: QUEUE_MESSAGE, draft });
    if (!response?.success) {
      setStatus(response?.error || "保存失败。", "error");
      return;
    }
    setStatus("已加入 WebCollect。", "ok");
    setTimeout(closePanel, 650);
  }

  async function updatePrefs(next: FloatingCapturePrefs) {
    prefs = next;
    await runtimeMessage({ type: PREFS_SET_MESSAGE, prefs });
    updateButtonVisibility();
  }

  function pauseUntilTodayEnd(): number {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  }

  function clearHoverDelay() {
    if (hoverDelayTimer) {
      window.clearTimeout(hoverDelayTimer);
      hoverDelayTimer = null;
    }
  }

  function normalizeVisibleLinkText(link: HTMLAnchorElement): string {
    return (link.innerText || link.textContent || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksLikeExplicitUrlText(text: string): boolean {
    const compact = text
      .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
      .replace(/[，。；、]+$/g, "")
      .trim();
    return /^(?:https?:\/\/|www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/:?#._-]|$)/i.test(compact);
  }

  function shouldOfferHoverHint(link: HTMLAnchorElement): boolean {
    if (!isEnabledOnThisPage() || !prefs.hoverEnabled) return false;
    if (prefs.allLinksHoverEnabled) return true;
    return looksLikeExplicitUrlText(normalizeVisibleLinkText(link));
  }

  function scheduleHoverHint(link: HTMLAnchorElement, event: PointerEvent) {
    if (!shouldOfferHoverHint(link)) return;
    clearHoverDelay();
    scheduledHover = { link, x: event.clientX, y: event.clientY };
    hoverDelayTimer = window.setTimeout(() => {
      if (!scheduledHover || scheduledHover.link !== link || !link.isConnected || !link.matches(":hover")) return;
      showHoverHint(link);
    }, HOVER_DELAY_MS);
  }

  function showHoverHint(link: HTMLAnchorElement) {
    if (panelOpen) return;
    if (!shouldOfferHoverHint(link)) return;
    const visibleText = normalizeVisibleLinkText(link);
    const href = chooseOpenableLinkUrl(link, visibleText);
    if (!href) return;
    const contextText = extractContextText(link);
    const fallbackTitle = visibleText && !looksLikeExplicitUrlText(visibleText)
      ? visibleText
      : titleFromUrl(href);
    const description = normalizeCaptureText(contextText || visibleText);
    hoveredDraft = {
      url: href,
      title: compactCaptureTitle(contextText || visibleText || link.getAttribute("aria-label") || "", fallbackTitle),
      description: description.length > 240 ? `${description.slice(0, 240)}...` : description,
      sourceType: "hover-link",
      sourcePageUrl: window.location.href,
      sourcePageTitle: document.title,
    };
    const rect = link.getBoundingClientRect();
    hoverButton.style.left = `${Math.min(Math.max(8, rect.right + 8), window.innerWidth - 44)}px`;
    hoverButton.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - 44))}px`;
    hoverButton.style.animation = "none";
    void hoverButton.offsetWidth;
    hoverButton.style.animation = "";
    hoverButton.style.display = "inline-flex";
    if (hoverHideTimer) window.clearTimeout(hoverHideTimer);
    hoverHideTimer = window.setTimeout(() => {
      if (!panelOpen) {
        hoverButton.style.display = "none";
        hoveredDraft = null;
      }
    }, 3500);
  }

  sectionSelect.addEventListener("change", () => {
    renderParentSelect();
    renderGroupSelect();
  });
  parentSelect.addEventListener("change", () => renderGroupSelect());
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    button.dataset.dragging = "true";
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (moved > 4) dragState.moved = true;
    if (dragState.moved) {
      event.preventDefault();
      updateDockFromPointer(event.clientX, event.clientY);
    }
  });
  function finishDockDrag(event: PointerEvent) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    button.releasePointerCapture?.(event.pointerId);
    button.dataset.dragging = "false";
    if (dragState.moved) {
      suppressNextButtonClick = true;
      saveDockState();
      window.setTimeout(() => {
        suppressNextButtonClick = false;
      }, 0);
    }
    dragState = null;
  }
  button.addEventListener("pointerup", finishDockDrag);
  button.addEventListener("pointercancel", finishDockDrag);
  button.addEventListener("click", (event) => {
    if (suppressNextButtonClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    void openPanel(currentDraft());
  });
  hoverButton.addEventListener("click", () => {
    if (hoveredDraft) void openPanel(hoveredDraft);
  });
  hoverButton.addEventListener("pointerenter", () => {
    if (hoverHideTimer) {
      window.clearTimeout(hoverHideTimer);
      hoverHideTimer = null;
    }
  });
  hoverButton.addEventListener("pointerleave", () => {
    if (hoverHideTimer) window.clearTimeout(hoverHideTimer);
    hoverHideTimer = window.setTimeout(() => {
      if (!panelOpen) {
        hoverButton.style.display = "none";
        hoveredDraft = null;
      }
    }, 900);
  });
  shadow.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;
    if (action === "close") closePanel();
    if (action === "save") void saveDraft();
    if (action === "pause-hour") void updatePrefs({ ...prefs, pauseUntil: Date.now() + 60 * 60 * 1000 });
    if (action === "pause-today") void updatePrefs({ ...prefs, pauseUntil: pauseUntilTodayEnd() });
    if (action === "disable-site") {
      const disabledHosts = Array.from(new Set([...prefs.disabledHosts, window.location.host]));
      void updatePrefs({ ...prefs, disabledHosts });
    }
  });

  document.addEventListener("pointerover", (event) => {
    if (!prefs.hoverEnabled || !isEnabledOnThisPage()) return;
    if (event.target instanceof Node && host.contains(event.target)) return;
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (link) scheduleHoverHint(link, event);
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (!scheduledHover) return;
    if (event.target instanceof Node && host.contains(event.target)) return;
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (link !== scheduledHover.link) {
      clearHoverDelay();
      scheduledHover = null;
      return;
    }
    const moved = Math.hypot(event.clientX - scheduledHover.x, event.clientY - scheduledHover.y);
    if (moved > HOVER_MOVE_TOLERANCE_PX) scheduleHoverHint(link, event);
  }, true);

  document.addEventListener("pointerout", (event) => {
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link || scheduledHover?.link !== link) return;
    if (event.relatedTarget instanceof Node && link.contains(event.relatedTarget)) return;
    clearHoverDelay();
    scheduledHover = null;
    if (hoverHideTimer) window.clearTimeout(hoverHideTimer);
    hoverHideTimer = window.setTimeout(() => {
      if (!panelOpen && !hoverButton.matches(":hover")) {
        hoverButton.style.display = "none";
        hoveredDraft = null;
      }
    }, 900);
  }, true);

  window.addEventListener("resize", applyDockState);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === OPEN_PANEL_MESSAGE && message.draft) {
      void openPanel(message.draft as CaptureDraft);
    }
  });

  chrome.storage?.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const nextPrefs = changes[CAPTURE_PREFS_STORAGE_KEY]?.newValue as Partial<FloatingCapturePrefs> | undefined;
    if (!nextPrefs) return;
    prefs = {
      ...defaultPrefs,
      ...nextPrefs,
      mascot: nextPrefs.mascot === "otter" ? "otter" : "chipmunk",
      disabledHosts: Array.isArray(nextPrefs.disabledHosts) ? nextPrefs.disabledHosts : [],
    };
    updateButtonVisibility();
  });

  async function init() {
    const [prefResponse, destinationResponse] = await Promise.all([
      runtimeMessage<{ success?: boolean; prefs?: FloatingCapturePrefs }>({ type: PREFS_GET_MESSAGE }),
      runtimeMessage<{ success?: boolean; cache?: CaptureDestinationCache }>({ type: DESTINATIONS_GET_MESSAGE }),
    ]);
    prefs = {
      ...defaultPrefs,
      ...(prefResponse?.prefs || {}),
      mascot: prefResponse?.prefs?.mascot === "otter" ? "otter" : "chipmunk",
    };
    destinationCache = destinationResponse?.cache || destinationCache;
    updateButtonVisibility();
  }

  void init();
})();

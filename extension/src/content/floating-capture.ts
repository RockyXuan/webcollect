import { isMismatchedKnownSiteSummary, localizeDescriptionText } from "@/lib/description-translation";

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
    createSectionName?: string;
    createParentCategoryName?: string;
    createGroupName?: string;
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
    sizeScale: number;
    pauseUntil: number | null;
    disabledHosts: string[];
    hiddenByUserAt?: number | null;
    recoveredAt?: number | null;
  }

  interface FloatingCaptureHealth {
    injected: boolean;
    status: "booting" | "visible" | "hidden" | "recovered" | "error";
    hostId: string;
    updatedAt: number;
    buttonVisible: boolean;
    mascot: "chipmunk" | "otter";
    reason?: string;
    error?: string;
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
    sizeScale: 0.67,
    pauseUntil: null,
    disabledHosts: [],
    hiddenByUserAt: null,
    recoveredAt: null,
  };
  const DOCK_STORAGE_KEY = "webcollect.capture.dock";
  const PANEL_POSITION_STORAGE_KEY = "webcollect.capture.panelPosition";
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
  let panelPosition: { left: number; top: number } | null = loadPanelPosition();
  let hoveredDraft: CaptureDraft | null = null;
  let hoverDelayTimer: number | null = null;
  let hoverHideTimer: number | null = null;
  let scheduledHover: { link: HTMLAnchorElement; x: number; y: number } | null = null;
  let panelOpen = false;
  let dragState: { pointerId: number; startX: number; startY: number; moved: boolean } | null = null;
  let panelDragState: { pointerId: number; startX: number; startY: number; startLeft: number; startTop: number; moved: boolean } | null = null;
  let suppressNextButtonClick = false;
  const HOVER_DELAY_MS = 700;
  const HOVER_MOVE_TOLERANCE_PX = 8;
  const CREATE_SECTION_VALUE = "__webcollect_create_section__";
  const CREATE_PARENT_VALUE = "__webcollect_create_parent__";
  const CREATE_GROUP_VALUE = "__webcollect_create_group__";
  const HEALTH_KEY = "__WEBCOLLECT_FLOATING_CAPTURE_HEALTH__";

  function sanitizeFloatingCapturePrefs(
    input: Partial<FloatingCapturePrefs> | null | undefined,
    now = Date.now()
  ): FloatingCapturePrefs {
    const raw = input || {};
    const legacyGlobalHidden = (
      raw.enabled === false || raw.buttonEnabled === false
    ) && typeof raw.hiddenByUserAt !== "number";
    const pauseUntil = typeof raw.pauseUntil === "number" && raw.pauseUntil > now
      ? raw.pauseUntil
      : null;
    const disabledHosts = Array.isArray(raw.disabledHosts)
      ? Array.from(new Set(raw.disabledHosts.filter((host): host is string => typeof host === "string" && host.trim().length > 0)))
      : [];
    const sizeScale = typeof raw.sizeScale === "number" && Number.isFinite(raw.sizeScale)
      ? Math.min(1.15, Math.max(0.55, raw.sizeScale))
      : defaultPrefs.sizeScale;

    return {
      ...defaultPrefs,
      ...raw,
      enabled: legacyGlobalHidden ? true : raw.enabled !== false,
      buttonEnabled: legacyGlobalHidden ? true : raw.buttonEnabled !== false,
      hoverEnabled: raw.hoverEnabled !== false,
      allLinksHoverEnabled: raw.allLinksHoverEnabled === true,
      contextMenuEnabled: raw.contextMenuEnabled !== false,
      mascot: raw.mascot === "otter" ? "otter" : "chipmunk",
      sizeScale,
      pauseUntil,
      disabledHosts,
      hiddenByUserAt: typeof raw.hiddenByUserAt === "number" ? raw.hiddenByUserAt : null,
      recoveredAt: legacyGlobalHidden ? now : (typeof raw.recoveredAt === "number" ? raw.recoveredAt : null),
    };
  }

  const host = document.createElement("div");
  host.id = "webcollect-floating-capture-host";
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  shadow.innerHTML = `
    <style>
      :host { color-scheme: light; }
      .wc-button {
        --wc-button-width: 160px;
        --wc-button-height: 48px;
        --wc-peek-width: 30px;
        --wc-pill-head-size: 42px;
        --wc-pill-wc-width: 63px;
        --wc-pill-wc-height: 36px;
        --wc-pill-plus-size: 31px;
        --wc-pill-gap: 5px;
        --wc-pill-padding-y: 3px;
        --wc-pill-padding-x: 6px;
        position: fixed;
        top: 50%;
        pointer-events: auto;
        display: block;
        width: var(--wc-peek-width);
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
          width 220ms cubic-bezier(0.22, 1, 0.36, 1),
          filter 180ms ease;
        will-change: width;
      }
      .wc-button[data-side="right"] {
        right: 0;
        transform: translateY(-50%);
      }
      .wc-button[data-side="left"] {
        left: 0;
        transform: translateY(-50%);
      }
      .wc-button:hover,
      .wc-button:focus-visible {
        outline: none;
      }
      .wc-button[data-side="right"]:hover,
      .wc-button[data-side="right"]:focus-visible,
      .wc-button[data-side="right"][data-dragging="true"],
      .wc-button[data-side="right"][data-open="true"] {
        width: var(--wc-button-width);
      }
      .wc-button[data-side="left"]:hover,
      .wc-button[data-side="left"]:focus-visible,
      .wc-button[data-side="left"][data-dragging="true"],
      .wc-button[data-side="left"][data-open="true"] {
        width: var(--wc-button-width);
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
        justify-content: start;
        justify-items: start;
      }
      .wc-button[data-side="left"] .wc-peek-head {
        justify-content: end;
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
        grid-template-columns: var(--wc-pill-head-size) var(--wc-pill-wc-width) var(--wc-pill-plus-size);
        width: var(--wc-button-width);
        height: var(--wc-button-height);
        align-items: center;
        justify-content: center;
        gap: var(--wc-pill-gap);
        border: 1.25px solid rgba(91, 143, 255, 0.72);
        border-radius: 999px;
        background:
          radial-gradient(circle at 15% 18%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.66) 36%, transparent 37%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 249, 255, 0.82));
        box-shadow:
          inset 0 2px 0 rgba(255, 255, 255, 0.92),
          inset 0 -2px 0 rgba(104, 153, 255, 0.20),
          0 16px 30px rgba(64, 91, 180, 0.16),
          0 5px 12px rgba(47, 109, 246, 0.10);
        padding: var(--wc-pill-padding-y) var(--wc-pill-padding-x);
        overflow: hidden;
      }
      .wc-pill-head {
        display: grid;
        place-items: center;
        width: var(--wc-pill-head-size);
        height: var(--wc-pill-head-size);
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
        width: var(--wc-pill-head-size);
        height: var(--wc-pill-head-size);
        filter: drop-shadow(0 8px 14px rgba(64, 91, 180, 0.14));
      }
      .wc-peek-head img {
        width: var(--wc-pill-head-size);
        height: var(--wc-pill-head-size);
        filter: drop-shadow(0 9px 18px rgba(64, 91, 180, 0.16));
      }
      .wc-button[data-side="right"] .wc-peek-head img {
        transform: translateX(calc(var(--wc-peek-width) - 50%)) rotate(-6deg);
        transform-origin: center center;
      }
      .wc-button[data-side="left"] .wc-peek-head img {
        transform: translateX(calc(50% - var(--wc-peek-width))) rotate(6deg);
        transform-origin: center center;
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
        width: var(--wc-pill-wc-width);
        height: var(--wc-pill-wc-height);
        filter: drop-shadow(0 7px 12px rgba(68, 83, 220, 0.18));
      }
      .wc-plus-mark {
        width: var(--wc-pill-plus-size);
        height: var(--wc-pill-plus-size);
        filter: drop-shadow(0 8px 14px rgba(79, 70, 229, 0.24));
      }
      .wc-hover {
        --wc-ring-angle: 0deg;
        position: fixed;
        pointer-events: auto;
        display: none;
        align-items: center;
        justify-content: center;
        width: var(--wc-hover-size, 28px);
        height: var(--wc-hover-size, 28px);
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
        width: var(--wc-hover-art-size, 23px);
        height: var(--wc-hover-art-size, 23px);
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
        max-height: calc(100vh - 28px);
        pointer-events: auto;
        display: none;
        flex-direction: column;
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
      .wc-panel[data-open="true"] { display: flex; }
      .wc-panel[data-dragging="true"] {
        box-shadow: 0 30px 88px rgba(37, 99, 235, 0.24);
      }
      .wc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 15px 16px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.70);
        background: rgba(255, 255, 255, 0.44);
        cursor: move;
        user-select: none;
        flex: 0 0 auto;
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
      .wc-body {
        flex: 1 1 auto;
        min-height: 0;
        padding: 14px 16px 16px;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .wc-grid { display: grid; gap: 9px; }
      .wc-label { display: grid; gap: 4px; font-weight: 700; color: #334155; }
      .wc-label span { font-size: 12px; }
      .wc-label-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
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
      .wc-create-input {
        display: none;
        margin-top: 5px;
      }
      .wc-create-input[data-open="true"] {
        display: block;
      }
      .wc-textarea { min-height: 62px; resize: vertical; }
      .wc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .wc-actions {
        position: sticky;
        bottom: -16px;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 12px;
        padding: 10px 0 12px;
        background: linear-gradient(180deg, rgba(248, 251, 255, 0), rgba(248, 251, 255, 0.94) 30%, rgba(248, 251, 255, 0.98));
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
      .wc-translate {
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 11px;
        line-height: 1;
      }
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
          <label class="wc-label">
            <span class="wc-label-heading">
              <span>简介</span>
              <button class="wc-small wc-translate" type="button" data-action="translate-description">翻译</button>
            </span>
            <textarea class="wc-textarea" data-field="description"></textarea>
          </label>
          <div class="wc-row">
            <label class="wc-label">
              <span>分项</span>
              <select class="wc-select" data-field="section"></select>
              <input class="wc-input wc-create-input" data-create-field="section" placeholder="新分项名称" />
            </label>
            <label class="wc-label">
              <span>分类</span>
              <select class="wc-select" data-field="parent"></select>
              <input class="wc-input wc-create-input" data-create-field="parent" placeholder="新分类名称" />
            </label>
          </div>
          <label class="wc-label">
            <span>分组</span>
            <select class="wc-select" data-field="group"></select>
            <input class="wc-input wc-create-input" data-create-field="group" placeholder="新分组名称" />
          </label>
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
          <button class="wc-primary" type="button" data-action="save">保存</button>
          <button class="wc-secondary" type="button" data-action="close">取消</button>
        </div>
      </div>
    </section>
  `;

  const button = shadow.querySelector<HTMLButtonElement>(".wc-button")!;
  const hoverButton = shadow.querySelector<HTMLButtonElement>(".wc-hover")!;
  const panel = shadow.querySelector<HTMLElement>(".wc-panel")!;
  const panelHead = shadow.querySelector<HTMLElement>(".wc-head")!;
  const statusEl = shadow.querySelector<HTMLElement>(".wc-status")!;
  const titleInput = shadow.querySelector<HTMLInputElement>('[data-field="title"]')!;
  const urlInput = shadow.querySelector<HTMLInputElement>('[data-field="url"]')!;
  const descriptionInput = shadow.querySelector<HTMLTextAreaElement>('[data-field="description"]')!;
  const sectionSelect = shadow.querySelector<HTMLSelectElement>('[data-field="section"]')!;
  const parentSelect = shadow.querySelector<HTMLSelectElement>('[data-field="parent"]')!;
  const groupSelect = shadow.querySelector<HTMLSelectElement>('[data-field="group"]')!;
  const sectionCreateInput = shadow.querySelector<HTMLInputElement>('[data-create-field="section"]')!;
  const parentCreateInput = shadow.querySelector<HTMLInputElement>('[data-create-field="parent"]')!;
  const groupCreateInput = shadow.querySelector<HTMLInputElement>('[data-create-field="group"]')!;

  function updateHealth(patch: Partial<FloatingCaptureHealth>) {
    const health: FloatingCaptureHealth = {
      injected: true,
      status: patch.status || "booting",
      hostId: host.id,
      updatedAt: Date.now(),
      buttonVisible: button.style.display !== "none",
      mascot: prefs.mascot === "otter" ? "otter" : "chipmunk",
      ...patch,
    };
    host.dataset.webcollectFloatingCapture = health.status;
    (window as unknown as Record<string, unknown>)[HEALTH_KEY] = health;
  }

  updateHealth({ status: "booting", buttonVisible: false });

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function getCaptureButtonScale() {
    return clamp(prefs.sizeScale || defaultPrefs.sizeScale, 0.55, 1.15);
  }

  function applyCaptureButtonScale() {
    const scale = getCaptureButtonScale();
    const px = (value: number) => `${Math.round(value * scale)}px`;
    for (const target of [button, hoverButton]) {
      target.style.setProperty("--wc-button-width", px(238));
      target.style.setProperty("--wc-button-height", px(72));
      target.style.setProperty("--wc-peek-width", px(44));
      target.style.setProperty("--wc-pill-head-size", px(62));
      target.style.setProperty("--wc-pill-wc-width", px(94));
      target.style.setProperty("--wc-pill-wc-height", px(54));
      target.style.setProperty("--wc-pill-plus-size", px(46));
      target.style.setProperty("--wc-pill-gap", px(8));
      target.style.setProperty("--wc-pill-padding-y", px(5));
      target.style.setProperty("--wc-pill-padding-x", px(8));
      target.style.setProperty("--wc-hover-size", px(42));
      target.style.setProperty("--wc-hover-art-size", px(34));
    }
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

  function loadPanelPosition(): { left: number; top: number } | null {
    try {
      const raw = window.localStorage?.getItem(PANEL_POSITION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown };
      if (typeof parsed.left !== "number" || typeof parsed.top !== "number") return null;
      if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null;
      return { left: parsed.left, top: parsed.top };
    } catch {
      return null;
    }
  }

  function savePanelPosition() {
    try {
      if (!panelPosition) return;
      window.localStorage?.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(panelPosition));
    } catch {
      // Panel position is a visual convenience only.
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

  function getPanelBounds() {
    return {
      width: panel.offsetWidth || 360,
      height: Math.min(panel.offsetHeight || 520, Math.max(240, window.innerHeight - 28)),
    };
  }

  function applyPanelPosition() {
    const { width, height } = getPanelBounds();
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 8);

    if (panelPosition) {
      const left = clamp(panelPosition.left, 8, maxLeft);
      const top = clamp(panelPosition.top, 8, maxTop);
      panelPosition = { left, top };
      panel.style.left = `${left}px`;
      panel.style.right = "auto";
      panel.style.top = `${top}px`;
      return;
    }

    if (dockState.side === "left") {
      panel.style.left = "18px";
      panel.style.right = "auto";
    } else {
      panel.style.left = "auto";
      panel.style.right = "18px";
    }
    const top = getDockTopPx();
    panel.style.top = `${clamp(top - 126, 16, maxTop)}px`;
  }

  function applyDockState() {
    const top = getDockTopPx();
    button.dataset.side = dockState.side;
    button.style.top = `${top}px`;
    if (dockState.side === "left") {
      button.style.left = "0px";
      button.style.right = "auto";
    } else {
      button.style.left = "auto";
      button.style.right = "0px";
    }
    applyPanelPosition();
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

  function hostnameFromCaptureUrl(url?: string): string {
    try {
      return new URL(url || "").hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return "";
    }
  }

  function isXHost(hostname: string): boolean {
    return hostname === "x.com" || hostname.endsWith(".x.com") ||
      hostname === "twitter.com" || hostname.endsWith(".twitter.com");
  }

  function formatDomainTitle(value: string): string {
    const trimmed = value.trim();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed) && trimmed === trimmed.toLowerCase()) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    return trimmed;
  }

  function titlePartMatchesSite(part: string, fallback: string): boolean {
    const normalizedPart = normalizeCaptureText(part).toLowerCase();
    const normalizedFallback = normalizeCaptureText(fallback).replace(/^www\./i, "").toLowerCase();
    if (!normalizedPart || !normalizedFallback) return false;
    if (normalizedPart === normalizedFallback) return true;
    const fallbackRoot = normalizedFallback.split(".")[0];
    return Boolean(fallbackRoot && normalizedPart === fallbackRoot);
  }

  function compactCaptureTitle(text: string, fallback: string): string {
    const candidates = text
      .split(/\n+/)
      .map((line) => normalizeCaptureText(line))
      .filter(Boolean)
      .filter((line) => !/^来自\s+/i.test(line))
      .filter((line) => !looksLikeExplicitUrlText(line));
    const rawCandidate = candidates[0] || normalizeCaptureText(text) || fallback;
    const delimiterMatch = rawCandidate.match(/^(.{1,48}?)(?:\s+[—–-]\s+|\s+\|\s+|:\s+)(.{2,})$/);
    if (delimiterMatch && titlePartMatchesSite(delimiterMatch[1], fallback)) {
      return formatDomainTitle(delimiterMatch[1]);
    }
    const sentence = rawCandidate
      .split(/[。！？!?]/)
      .map((part) => part.trim())
      .find(Boolean) || rawCandidate;
    return sentence.length > 36 ? `${sentence.slice(0, 36)}...` : sentence;
  }

  function shouldReplaceCaptureTitle(current: string, incoming: string, draft: CaptureDraft): boolean {
    const currentTitle = normalizeCaptureText(current);
    const nextTitle = normalizeCaptureText(incoming);
    if (!nextTitle) return false;
    if (!currentTitle) return true;
    if (currentTitle === nextTitle) return false;
    const sourceHost = hostnameFromCaptureUrl(draft.sourcePageUrl);
    const targetHost = hostnameFromCaptureUrl(draft.url);
    const sourceTitle = normalizeCaptureText(draft.sourcePageTitle || "");
    if (sourceHost && targetHost && sourceHost !== targetHost && sourceTitle && currentTitle === sourceTitle) {
      return true;
    }
    return nextTitle.length < currentTitle.length && currentTitle.toLowerCase().startsWith(nextTitle.toLowerCase());
  }

  function shouldReplaceCaptureDescription(current: string, incoming: string, draft: CaptureDraft, incomingTitle: string): boolean {
    const currentDescription = normalizeCaptureText(current);
    const nextDescription = normalizeCaptureText(incoming);
    if (!nextDescription) return false;
    if (!currentDescription) return true;
    if (currentDescription === nextDescription) return false;
    if (isMismatchedKnownSiteSummary(currentDescription, { title: incomingTitle || draft.title, url: draft.url })) {
      return true;
    }
    const sourceHost = hostnameFromCaptureUrl(draft.sourcePageUrl);
    const targetHost = hostnameFromCaptureUrl(draft.url);
    if (sourceHost && targetHost && sourceHost !== targetHost && isXHost(sourceHost) && /X\/Twitter|Twitter|社交平台/.test(currentDescription)) {
      return true;
    }
    return currentDescription.length < 12 && nextDescription.length > currentDescription.length;
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
    applyCaptureButtonScale();
    button.dataset.mascot = mascot;
    hoverButton.dataset.mascot = mascot;
    const enabledOnPage = isEnabledOnThisPage();
    const buttonVisible = enabledOnPage && prefs.buttonEnabled;
    button.style.display = buttonVisible ? "inline-flex" : "none";
    applyDockState();
    updateHealth({
      status: buttonVisible ? "visible" : "hidden",
      buttonVisible,
      mascot,
      reason: buttonVisible
        ? undefined
        : !prefs.enabled
          ? "disabled"
          : isTemporarilyPaused()
            ? "paused"
            : prefs.disabledHosts.includes(window.location.host)
              ? "host-disabled"
              : !prefs.buttonEnabled
                ? "button-disabled"
                : "unknown",
    });
    if (!enabledOnPage) {
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
    const rawDescription = selectedText.length > 240 ? `${selectedText.slice(0, 240)}...` : selectedText;
    const description = rawDescription;
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
    const createOption = document.createElement("option");
    createOption.value = CREATE_SECTION_VALUE;
    createOption.textContent = "＋ 新建分项...";
    sectionSelect.appendChild(createOption);
    sectionSelect.value = destination?.sectionId || destinationCache.activeSectionId || sections[0]?.id || "";
    if (sectionSelect.selectedIndex < 0 && sections[0]) {
      sectionSelect.value = sections[0].id;
    }
    sectionCreateInput.value = destination?.createSectionName || "";
    renderParentSelect(destination);
    renderGroupSelect(destination);
    updateCreateInputs();
  }

  function renderParentSelect(destination?: CaptureDestination) {
    const sectionId = sectionSelect.value || "section-default";
    const sectionCategories = sectionSelect.value === CREATE_SECTION_VALUE ? [] : categoriesInSection(sectionId);
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
    const createOption = document.createElement("option");
    createOption.value = CREATE_PARENT_VALUE;
    createOption.textContent = "＋ 新建分类...";
    parentSelect.appendChild(createOption);
    parentSelect.value = destination?.parentCategoryId || "";
    if (parentSelect.selectedIndex < 0) {
      parentSelect.value = "";
    }
    parentCreateInput.value = destination?.createParentCategoryName || "";
    updateCreateInputs();
  }

  function renderGroupSelect(destination?: CaptureDestination) {
    const sectionId = sectionSelect.value || "section-default";
    const parentId = parentSelect.value;
    const sectionCategories = sectionSelect.value === CREATE_SECTION_VALUE ? [] : categoriesInSection(sectionId);
    const childCount = childCountMap(sectionCategories);
    const groups = sectionSelect.value === CREATE_SECTION_VALUE || parentId === CREATE_PARENT_VALUE
      ? []
      : parentId
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
    const createOption = document.createElement("option");
    createOption.value = CREATE_GROUP_VALUE;
    createOption.textContent = "＋ 新建分组...";
    groupSelect.appendChild(createOption);
    groupSelect.value = destination?.groupId || "";
    if (groupSelect.selectedIndex < 0) {
      groupSelect.value = "";
    }
    groupCreateInput.value = destination?.createGroupName || "";
    updateCreateInputs();
  }

  function updateCreateInputs() {
    sectionCreateInput.dataset.open = sectionSelect.value === CREATE_SECTION_VALUE ? "true" : "false";
    parentCreateInput.dataset.open = parentSelect.value === CREATE_PARENT_VALUE ? "true" : "false";
    groupCreateInput.dataset.open = groupSelect.value === CREATE_GROUP_VALUE ? "true" : "false";
  }

  async function enrichDraft(draft: CaptureDraft) {
    if (!/^https?:\/\//i.test(draft.url)) return;
    const response = await runtimeMessage<{ success?: boolean; data?: { title?: string; description?: string; image?: string; favicon?: string } }>({
      type: META_MESSAGE,
      url: draft.url,
    });
    if (!response?.success || !response.data) return;
    const fetchedTitle = response.data.title
      ? compactCaptureTitle(response.data.title, titleFromUrl(draft.url))
      : "";
    if (shouldReplaceCaptureTitle(titleInput.value, fetchedTitle, draft)) {
      titleInput.value = fetchedTitle;
    }
    if (response.data.description) {
      if (shouldReplaceCaptureDescription(descriptionInput.value, response.data.description, draft, fetchedTitle)) {
        descriptionInput.value = response.data.description;
      }
    }
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
    window.requestAnimationFrame(applyPanelPosition);
    titleInput.value = compactCaptureTitle(draft.title || "", titleFromUrl(draft.url));
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
    const sectionCreateName = sectionCreateInput.value.trim();
    const parentCreateName = parentCreateInput.value.trim();
    const groupCreateName = groupCreateInput.value.trim();
    const selectedGroup = groupSelect.value && groupSelect.value !== CREATE_GROUP_VALUE
      ? destinationCache.categories.find((category) => category.id === groupSelect.value)
      : undefined;
    const selectedParent = parentSelect.value && parentSelect.value !== CREATE_PARENT_VALUE
      ? destinationCache.categories.find((category) => category.id === parentSelect.value)
      : selectedGroup?.parentId
        ? destinationCache.categories.find((category) => category.id === selectedGroup.parentId)
        : undefined;
    const selectedSectionId = (
      sectionSelect.value && sectionSelect.value !== CREATE_SECTION_VALUE
        ? sectionSelect.value
        : undefined
    ) || (selectedGroup ? categorySectionId(selectedGroup) : undefined)
      || (selectedParent ? categorySectionId(selectedParent) : undefined);
    const selectedSection = selectedSectionId
      ? destinationCache.sections.find((section) => section.id === selectedSectionId)
      : undefined;

    if (selectedSectionId) destination.sectionId = selectedSectionId;
    if (selectedSection?.name) destination.sectionName = selectedSection.name;
    if (sectionSelect.value === CREATE_SECTION_VALUE && sectionCreateName) {
      destination.createSectionName = sectionCreateName;
      destination.sectionName = sectionCreateName;
    }
    if (selectedParent?.id) destination.parentCategoryId = selectedParent.id;
    if (selectedParent?.name) destination.parentCategoryName = selectedParent.name;
    if (parentSelect.value === CREATE_PARENT_VALUE && parentCreateName) {
      destination.createParentCategoryName = parentCreateName;
      destination.parentCategoryName = parentCreateName;
    }
    if (selectedGroup?.id) destination.groupId = selectedGroup.id;
    if (selectedGroup?.name) destination.groupName = selectedGroup.name;
    if (groupSelect.value === CREATE_GROUP_VALUE && groupCreateName) {
      destination.createGroupName = groupCreateName;
      destination.groupName = groupCreateName;
    }

    return destination.sectionId || destination.parentCategoryId || destination.groupId || destination.sectionName ||
      destination.createSectionName || destination.createParentCategoryName || destination.createGroupName
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
    if (sectionSelect.value === CREATE_SECTION_VALUE && !sectionCreateInput.value.trim()) {
      setStatus("请填写新分项名称。", "error");
      sectionCreateInput.focus();
      return;
    }
    if (parentSelect.value === CREATE_PARENT_VALUE && !parentCreateInput.value.trim()) {
      setStatus("请填写新分类名称。", "error");
      parentCreateInput.focus();
      return;
    }
    if (groupSelect.value === CREATE_GROUP_VALUE && !groupCreateInput.value.trim()) {
      setStatus("请填写新分组名称。", "error");
      groupCreateInput.focus();
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
    prefs = sanitizeFloatingCapturePrefs(next);
    await runtimeMessage({ type: PREFS_SET_MESSAGE, prefs });
    updateButtonVisibility();
  }

  function pauseUntilTodayEnd(): number {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  }

  function translateDescription() {
    const before = descriptionInput.value.trim();
    if (!before) {
      setStatus("简介为空，暂无可翻译内容。");
      descriptionInput.focus();
      return;
    }
    descriptionInput.value = localizeDescriptionText(descriptionInput.value.trim(), {
      title: titleInput.value.trim(),
      url: urlInput.value.trim(),
    });
    if (descriptionInput.value === before) {
      setStatus("当前简介已经是中文，或暂无可转换内容。");
    } else {
      setStatus("已翻译为中文简介。", "ok");
    }
    descriptionInput.focus();
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
    const hoverSize = Math.round(42 * getCaptureButtonScale());
    hoverButton.style.left = `${Math.min(Math.max(8, rect.right + 8), window.innerWidth - hoverSize - 8)}px`;
    hoverButton.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - hoverSize - 8))}px`;
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
    updateCreateInputs();
  });
  parentSelect.addEventListener("change", () => {
    renderGroupSelect();
    updateCreateInputs();
  });
  groupSelect.addEventListener("change", updateCreateInputs);

  function isPanelDragBlockedTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest("button, input, textarea, select, a");
  }

  panelHead.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || isPanelDragBlockedTarget(event.target)) return;
    const rect = panel.getBoundingClientRect();
    panelDragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    panel.dataset.dragging = "true";
    panelHead.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  panelHead.addEventListener("pointermove", (event) => {
    if (!panelDragState || panelDragState.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - panelDragState.startX, event.clientY - panelDragState.startY);
    if (moved > 3) panelDragState.moved = true;
    if (!panelDragState.moved) return;
    const { width, height } = getPanelBounds();
    panelPosition = {
      left: clamp(panelDragState.startLeft + event.clientX - panelDragState.startX, 8, Math.max(8, window.innerWidth - width - 8)),
      top: clamp(panelDragState.startTop + event.clientY - panelDragState.startY, 8, Math.max(8, window.innerHeight - height - 8)),
    };
    applyPanelPosition();
    savePanelPosition();
    event.preventDefault();
  });

  function finishPanelDrag(event: PointerEvent) {
    if (!panelDragState || panelDragState.pointerId !== event.pointerId) return;
    panelHead.releasePointerCapture?.(event.pointerId);
    panel.dataset.dragging = "false";
    if (panelDragState.moved) savePanelPosition();
    panelDragState = null;
  }

  panelHead.addEventListener("pointerup", finishPanelDrag);
  panelHead.addEventListener("pointercancel", finishPanelDrag);
  window.addEventListener("pointerup", finishPanelDrag, true);
  window.addEventListener("pointercancel", finishPanelDrag, true);

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
    if (action === "translate-description") translateDescription();
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
    prefs = sanitizeFloatingCapturePrefs(nextPrefs);
    updateButtonVisibility();
  });

  async function init() {
    try {
      const [prefResponse, destinationResponse] = await Promise.all([
        runtimeMessage<{ success?: boolean; prefs?: FloatingCapturePrefs }>({ type: PREFS_GET_MESSAGE }),
        runtimeMessage<{ success?: boolean; cache?: CaptureDestinationCache }>({ type: DESTINATIONS_GET_MESSAGE }),
      ]);
      prefs = sanitizeFloatingCapturePrefs(prefResponse?.prefs);
      destinationCache = destinationResponse?.cache || destinationCache;
      updateButtonVisibility();
      if (prefs.recoveredAt && prefResponse?.prefs?.recoveredAt !== prefs.recoveredAt) {
        void runtimeMessage({ type: PREFS_SET_MESSAGE, prefs });
        updateHealth({ status: "recovered", buttonVisible: button.style.display !== "none", reason: "legacy-hidden-prefs" });
      }
    } catch (error) {
      prefs = sanitizeFloatingCapturePrefs(defaultPrefs);
      updateButtonVisibility();
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[WebCollect] Floating capture recovered from init failure:", message);
      updateHealth({ status: "recovered", buttonVisible: button.style.display !== "none", reason: "init-failed", error: message });
    }
  }

  void init();
})();

/**
 * WebCollect - Background Service Worker (Manifest V3)
 * 
 * Handles:
 * - OG metadata fetching (bypasses CORS via extension context)
 * - Safety checks for URLs
 * - Message passing between newtab page and extension APIs
 * 
 * NOTE: This file must be pure JavaScript (no TypeScript syntax).
 * Chrome Service Workers do not support TS type annotations.
 */

import { extractKnowledgeText, extractMetadataFromHtml } from '../shared/metadata-extractor.js';
import { assertSafeRemoteUrl } from '../shared/remote-url-policy.js';

const CAPTURE_QUEUE_KEY = 'webcollect.capture.queue';
const CAPTURE_PREFS_KEY = 'webcollect.capture.prefs';
const CAPTURE_DESTINATIONS_KEY = 'webcollect.capture.destinations';
const CAPTURE_CONTEXT_MENU_ID = 'webcollect-capture-link';
let captureQueueMutationTail = Promise.resolve();

const DEFAULT_CAPTURE_PREFS = {
  enabled: true,
  buttonEnabled: true,
  hoverEnabled: true,
  allLinksHoverEnabled: false,
  contextMenuEnabled: true,
  mascot: 'chipmunk',
  sizeScale: 0.67,
  pauseUntil: null,
  disabledHosts: [],
  hiddenByUserAt: null,
  recoveredAt: null,
};

function normalizeCapturePrefs(stored, now = Date.now()) {
  const raw = stored || {};
  const legacyGlobalHidden = (raw.enabled === false || raw.buttonEnabled === false)
    && typeof raw.hiddenByUserAt !== 'number';
  const pauseUntil = typeof raw.pauseUntil === 'number' && raw.pauseUntil > now
    ? raw.pauseUntil
    : null;
  const disabledHosts = Array.isArray(raw.disabledHosts)
    ? Array.from(new Set(raw.disabledHosts.filter(host => typeof host === 'string' && host.trim().length > 0)))
    : [];
  const sizeScale = typeof raw.sizeScale === 'number' && Number.isFinite(raw.sizeScale)
    ? Math.min(1.15, Math.max(0.55, raw.sizeScale))
    : DEFAULT_CAPTURE_PREFS.sizeScale;

  return {
    ...DEFAULT_CAPTURE_PREFS,
    ...raw,
    enabled: legacyGlobalHidden ? true : raw.enabled !== false,
    buttonEnabled: legacyGlobalHidden ? true : raw.buttonEnabled !== false,
    hoverEnabled: raw.hoverEnabled !== false,
    allLinksHoverEnabled: raw.allLinksHoverEnabled === true,
    contextMenuEnabled: raw.contextMenuEnabled !== false,
    mascot: raw.mascot === 'otter' ? 'otter' : 'chipmunk',
    sizeScale,
    pauseUntil,
    disabledHosts,
    hiddenByUserAt: typeof raw.hiddenByUserAt === 'number' ? raw.hiddenByUserAt : null,
    recoveredAt: legacyGlobalHidden ? now : (typeof raw.recoveredAt === 'number' ? raw.recoveredAt : null),
  };
}

// Listen for messages from the newtab page and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_META') {
    handleFetchMeta(message.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep the message channel open for async response
  }

  if (message.type === 'FETCH_KNOWLEDGE') {
    handleFetchKnowledge(message.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CHECK_SAFETY') {
    handleCheckSafety(message.urls)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CAPTURE_GET_PREFS') {
    getCapturePrefs()
      .then(prefs => sendResponse({ success: true, prefs }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CAPTURE_SET_PREFS') {
    saveCapturePrefs(message.prefs)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CAPTURE_GET_DESTINATIONS') {
    getStorageValue(CAPTURE_DESTINATIONS_KEY, { updatedAt: 0, activeSectionId: 'section-default', sections: [], categories: [] })
      .then(cache => sendResponse({ success: true, cache }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CAPTURE_QUEUE_ADD') {
    addCaptureQueueItem(message.draft)
      .then(item => sendResponse({ success: true, item }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CAPTURE_QUEUE_REPLACE') {
    replaceCaptureQueueItems(message.previouslyReadIds, message.queue)
      .then(queue => sendResponse({ success: true, queue }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CAPTURE_QUEUE_LIST') {
    listCaptureQueueItems()
      .then(queue => sendResponse({ success: true, queue }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Fetch OG metadata from a URL (no CORS restrictions in extension context)
 */
async function handleFetchMeta(url) {
  try {
    const { response, text: html, url: resolvedUrl } = await fetchExtensionRemoteText(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9',
      },
      timeoutMs: 8000,
      maxRedirects: 4,
      maxBytes: 1500000,
    });

    if (!response.ok) {
      return { title: '', description: '', image: '', favicon: '' };
    }

    return extractMetadataFromHtml(html, resolvedUrl);
  } catch (e) {
    return { title: '', description: '', image: '', favicon: '' };
  }
}

/**
 * Fetch public page text for the rebuildable on-device search index.
 * The request never carries cookies and uses the same SSRF/redirect/size
 * protections as metadata fetching.
 */
async function handleFetchKnowledge(url) {
  const { response, text: html, url: resolvedUrl } = await fetchExtensionRemoteText(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml;q=0.9',
    },
    timeoutMs: 8000,
    maxRedirects: 4,
    maxBytes: 1500000,
  });
  if (!response.ok) throw new Error(`upstream-${response.status}`);
  return { resolvedUrl, ...extractKnowledgeText(html, { maxChars: 6000 }) };
}

async function readExtensionResponseText(response, maxBytes) {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new Error('Remote page is too large');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Remote page exceeds size limit');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function fetchExtensionRemoteText(input, options = {}) {
  let currentUrl = assertSafeRemoteUrl(input);
  const maxRedirects = options.maxRedirects ?? 4;
  const timeoutMs = options.timeoutMs ?? 8000;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      headers: options.headers,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (response.status === 0 || response.type === 'opaqueredirect') {
        throw new Error('Redirect target cannot be verified safely');
      }
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('text/html') && !contentType.startsWith('application/xhtml+xml')) {
        await response.body?.cancel();
        throw new Error('Unsupported remote content type');
      }
      const text = await readExtensionResponseText(response, options.maxBytes ?? 1500000);
      return { response, text, url: currentUrl.toString() };
    }

    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || response.type === 'opaqueredirect') {
      throw new Error('Redirect target cannot be verified safely');
    }
    if (redirectCount === maxRedirects) throw new Error('Too many redirects');
    currentUrl = assertSafeRemoteUrl(new URL(location, currentUrl).toString());
  }
  throw new Error('Too many redirects');
}

/**
 * Batch safety check for URLs
 */
async function handleCheckSafety(urls) {
  const WHITELIST_DOMAINS = [
    'google.com', 'github.com', 'stackoverflow.com', 'notion.so',
    'figma.com', 'dribbble.com', 'behance.net', 'vercel.com',
    'npmjs.com', 'medium.com', 'openai.com', 'anthropic.com',
    'claude.ai', 'gemini.google.com', 'midjourney.com',
    'chat.openai.com', 'mail.google.com', 'are.na',
    'juejin.cn', 'zhihu.com', 'bilibili.com', 'youtube.com',
    'twitter.com', 'x.com', 'linkedin.com', 'reddit.com',
    'facebook.com', 'instagram.com', 'apple.com', 'microsoft.com',
    'amazon.com', 'netflix.com', 'spotify.com', 'wikipedia.org',
    'w3.org', 'mozilla.org', 'chromium.org', 'webpack.js.org',
    'react.dev', 'nextjs.org', 'tailwindcss.com', 'typescriptlang.org',
    'python.org', 'nodejs.org', 'rust-lang.org', 'go.dev',
    'cloudflare.com', 'aws.amazon.com', 'azure.microsoft.com',
    'digitalocean.com', 'heroku.com', 'railway.app', 'render.com',
    'supabase.com', 'firebase.google.com', 'mongodb.com',
    'postman.com', 'docker.com', 'kubernetes.io', 'grafana.com',
    'notion.so', 'linear.app', 'slack.com', 'discord.com',
    'zoom.us', 'dropbox.com', 'box.com', 'atlassian.com',
    'gitlab.com', 'bitbucket.org', 'dev.to', 'hashnode.com',
    'producthunt.com', 'hackernews.com', 'news.ycombinator.com',
  ];

  const SUSPICIOUS_TLDS = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.buzz', '.icu'];

  const results = urls.map(url => {
    try {
      const parsed = assertSafeRemoteUrl(url);
      const hostname = parsed.hostname;
      const domain = hostname.replace(/^www\./, '');

      // Check HTTPS
      const isHttps = parsed.protocol === 'https:';

      // Check whitelist
      const isWhitelisted = WHITELIST_DOMAINS.some(d =>
        domain === d || domain.endsWith('.' + d)
      );

      // Check suspicious TLD
      const hasSuspiciousTld = SUSPICIOUS_TLDS.some(tld => domain.endsWith(tld));

      // Determine safety level (no TS type annotation)
      let level;
      if (isWhitelisted && isHttps) {
        level = 'safe';
      } else if (hasSuspiciousTld || !isHttps) {
        level = 'danger';
      } else {
        level = 'caution';
      }

      return { url, level, isHttps, isWhitelisted, hasSuspiciousTld };
    } catch (e) {
      return { url, level: 'danger', isHttps: false, isWhitelisted: false, hasSuspiciousTld: true };
    }
  });

  return results;
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '') || parsed.pathname || url;
  } catch (e) {
    return url;
  }
}

// Floating capture queue helpers

function getStorageValue(key, fallback) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        resolve(fallback);
        return;
      }
      resolve(result[key] ?? fallback);
    });
  });
}

function setStorageValue(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function runCaptureQueueMutation(operation) {
  const run = captureQueueMutationTail
    .catch(() => undefined)
    .then(operation);
  captureQueueMutationTail = run.then(() => undefined, () => undefined);
  return run;
}

function mergeCaptureQueueReplacement(currentQueue, previouslyReadIds, replacementQueue) {
  const previousIds = new Set(Array.isArray(previouslyReadIds) ? previouslyReadIds : []);
  const replacement = Array.isArray(replacementQueue) ? replacementQueue : [];
  const replacementIds = new Set(replacement.map(item => item?.id).filter(Boolean));
  return [
    ...replacement,
    ...(Array.isArray(currentQueue) ? currentQueue : []).filter(item =>
      item?.id && !previousIds.has(item.id) && !replacementIds.has(item.id)
    ),
  ];
}

function listCaptureQueueItems() {
  return runCaptureQueueMutation(() => getStorageValue(CAPTURE_QUEUE_KEY, []));
}

function replaceCaptureQueueItems(previouslyReadIds, replacementQueue) {
  return runCaptureQueueMutation(async () => {
    const currentQueue = await getStorageValue(CAPTURE_QUEUE_KEY, []);
    const mergedQueue = mergeCaptureQueueReplacement(currentQueue, previouslyReadIds, replacementQueue);
    await setStorageValue(CAPTURE_QUEUE_KEY, mergedQueue);
    return mergedQueue;
  });
}

async function getCapturePrefs() {
  const stored = await getStorageValue(CAPTURE_PREFS_KEY, {});
  return normalizeCapturePrefs(stored);
}

async function saveCapturePrefs(prefs) {
  await setStorageValue(CAPTURE_PREFS_KEY, normalizeCapturePrefs({
    ...(prefs || {}),
    hiddenByUserAt: (prefs?.enabled === false || prefs?.buttonEnabled === false)
      ? prefs?.hiddenByUserAt || Date.now()
      : prefs?.hiddenByUserAt ?? null,
  }));
}

function normalizeCaptureUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|chrome:\/\/|edge:\/\/|about:)/i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function extractFirstUrl(text) {
  const match = String(text || '').match(/((?:https?:\/\/|chrome:\/\/|edge:\/\/|about:)[^\s<>"']+|(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/i);
  return match ? normalizeCaptureUrl(match[1]) : null;
}

function hostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return '';
  }
}

function addCaptureQueueItem(draft) {
  return runCaptureQueueMutation(() => addCaptureQueueItemUnlocked(draft));
}

async function addCaptureQueueItemUnlocked(draft) {
  if (!draft) throw new Error('Missing capture draft');
  const normalizedUrl = normalizeCaptureUrl(draft.url);
  if (!normalizedUrl) throw new Error('Invalid URL');
  const title = String(draft.title || '').trim() || titleFromUrl(normalizedUrl);
  if (!title) throw new Error('Missing title');

  const queue = await getStorageValue(CAPTURE_QUEUE_KEY, []);
  const existing = queue.find((item) =>
    item.status === 'pending' && normalizeCaptureUrl(item.draft?.url || '') === normalizedUrl
  );
  if (existing) return existing;

  const now = Date.now();
  const item = {
    id: `capture-${now}-${Math.random().toString(36).slice(2, 9)}`,
    draft: {
      ...draft,
      url: normalizedUrl,
      title,
      description: String(draft.description || ''),
    },
    createdAt: now,
    updatedAt: now,
    status: 'pending',
  };
  queue.push(item);
  await setStorageValue(CAPTURE_QUEUE_KEY, queue);
  chrome.runtime.sendMessage({ type: 'CAPTURE_QUEUE_UPDATED' }, () => {
    void chrome.runtime.lastError;
  });
  return item;
}

function buildContextDraft(info, tab) {
  const url = normalizeCaptureUrl(info.linkUrl)
    || extractFirstUrl(info.selectionText)
    || normalizeCaptureUrl(info.pageUrl)
    || normalizeCaptureUrl(tab?.url);
  if (!url) return null;

  const selection = String(info.selectionText || '').trim();
  const currentPageUrl = normalizeCaptureUrl(info.pageUrl) || normalizeCaptureUrl(tab?.url);
  return {
    url,
    title: selection && selection.length <= 80 ? selection : (tab?.title || titleFromUrl(url)),
    description: selection && selection.length > 80 ? selection.slice(0, 240) : '',
    favicon: currentPageUrl === url ? String(tab?.favIconUrl || '') : '',
    sourceType: 'context-menu',
    sourcePageUrl: info.pageUrl || tab?.url || '',
    sourcePageTitle: tab?.title || '',
  };
}

function setupCaptureContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CAPTURE_CONTEXT_MENU_ID,
      title: '收集到 WebCollect',
      contexts: ['page', 'link', 'selection'],
    });
  });
}

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CAPTURE_CONTEXT_MENU_ID) return;
  void (async () => {
    const prefs = await getCapturePrefs();
    const host = hostFromUrl(info.pageUrl || tab?.url || '');
    const paused = typeof prefs.pauseUntil === 'number' && prefs.pauseUntil > Date.now();
    if (!prefs.enabled || !prefs.contextMenuEnabled || paused || prefs.disabledHosts.includes(host)) return;

    const draft = buildContextDraft(info, tab);
    if (!draft) return;

    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_OPEN_PANEL', draft }, async () => {
        if (chrome.runtime.lastError) {
          await addCaptureQueueItem(draft);
        }
      });
      return;
    }

    await addCaptureQueueItem(draft);
  })();
});

// ── Extension Install/Update ──

chrome.runtime.onInstalled.addListener((details) => {
  setupCaptureContextMenus();
  if (details.reason === 'install') {
    console.log('WebCollect extension installed');
  } else if (details.reason === 'update') {
    console.log('WebCollect extension updated to version', chrome.runtime.getManifest().version);
  }
});

chrome.runtime.onStartup?.addListener(() => {
  setupCaptureContextMenus();
});

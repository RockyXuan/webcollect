/**
 * Platform Detection & API Adapter
 * 
 * Provides a unified API interface that works in both:
 * 1. Web (Next.js) — calls /api/... routes
 * 2. Chrome Extension — uses chrome.runtime.sendMessage → background.js
 */

import type { LinkOpenMode, SafetyCheckResult, SafetyStatus, TabPackOpenMode } from "./types";

// ── Platform Detection ──

let _isExtension: boolean | null = null;

export function isChromeExtension(): boolean {
  if (_isExtension !== null) return _isExtension;
  try {
    _isExtension = typeof chrome !== 'undefined' 
      && !!chrome.runtime 
      && !!chrome.runtime.id;
  } catch {
    _isExtension = false;
  }
  return _isExtension;
}

// ── Types ──

export function openWebCollectUrl(url: string, mode: LinkOpenMode): void {
  if (!url) return;

  if (isChromeExtension() && typeof chrome !== "undefined" && chrome.tabs) {
    openExtensionTab(url, mode);
    return;
  }

  openBrowserWindow(url, mode);
}

export interface OpenTabPackResult {
  requested: number;
  opened: number;
  blocked: number;
}

/** Open a fixed set of URLs without mutating the saved template. */
export async function openTabPackUrls(
  urls: readonly string[],
  mode: TabPackOpenMode,
): Promise<OpenTabPackResult> {
  const safeUrls = urls.slice(0, 50);
  if (safeUrls.length === 0) return { requested: 0, opened: 0, blocked: 0 };

  if (isChromeExtension() && typeof chrome !== "undefined" && chrome.tabs?.create) {
    const createdTabIds: number[] = [];
    for (const url of safeUrls) {
      const tabId = await new Promise<number | null>((resolve) => {
        chrome.tabs.create({ url, active: false }, (tab) => {
          if (chrome.runtime.lastError || typeof tab?.id !== "number") {
            resolve(null);
            return;
          }
          resolve(tab.id);
        });
      });
      if (tabId !== null) createdTabIds.push(tabId);
    }
    if (mode === "first-active" && createdTabIds[0] !== undefined && chrome.tabs.update) {
      await new Promise<void>((resolve) => {
        chrome.tabs.update(createdTabIds[0], { active: true }, () => resolve());
      });
    }
    return {
      requested: safeUrls.length,
      opened: createdTabIds.length,
      blocked: safeUrls.length - createdTabIds.length,
    };
  }

  const openedWindows: Window[] = [];
  for (const url of safeUrls) {
    const opened = window.open(url, "_blank");
    if (!opened) continue;
    try {
      opened.opener = null;
    } catch {
      // The tab is still open when an older browser prevents clearing opener.
    }
    openedWindows.push(opened);
  }
  if (mode === "first-active") openedWindows[0]?.focus();
  return {
    requested: safeUrls.length,
    opened: openedWindows.length,
    blocked: safeUrls.length - openedWindows.length,
  };
}

function openExtensionTab(url: string, mode: LinkOpenMode): void {
  try {
    if (mode === "current-tab" && chrome.tabs.update) {
      if (chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent((tab) => {
          if (chrome.runtime.lastError || !tab?.id) {
            openBrowserWindow(url, mode);
            return;
          }
          chrome.tabs.update(tab.id, { url }, () => {
            if (chrome.runtime.lastError) openBrowserWindow(url, mode);
          });
        });
        return;
      }
      chrome.tabs.update({ url }, () => {
        if (chrome.runtime.lastError) openBrowserWindow(url, mode);
      });
      return;
    }

    if (chrome.tabs.create) {
      chrome.tabs.create({ url, active: mode === "new-active-tab" }, () => {
        if (chrome.runtime.lastError) openBrowserWindow(url, mode);
      });
      return;
    }
  } catch {
    // Fall through to browser APIs.
  }

  openBrowserWindow(url, mode);
}

function openBrowserWindow(url: string, mode: LinkOpenMode): void {
  if (mode === "current-tab") {
    window.location.href = url;
    return;
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (mode === "new-active-tab") {
    opened?.focus();
  }
}

export interface FetchMetaResult {
  title: string;
  description: string;
  image: string;
  favicon: string;
}

/** Internal format from extension background.js */
interface ExtensionSafetyResult {
  url: string;
  level: 'safe' | 'caution' | 'danger';
  isHttps: boolean;
  isWhitelisted: boolean;
  hasSuspiciousTld: boolean;
}

// ── Mapping Helpers ──

function mapExtensionSafetyResult(r: ExtensionSafetyResult): SafetyCheckResult {
  let status: SafetyStatus;
  if (r.isWhitelisted && r.isHttps) {
    status = 'safe';
  } else if (r.hasSuspiciousTld || !r.isHttps) {
    status = 'danger';
  } else {
    status = 'warning';
  }

  const details: string[] = [];
  if (!r.isHttps) details.push('不使用 HTTPS');
  if (r.hasSuspiciousTld) details.push('可疑顶级域名');
  if (r.isWhitelisted) details.push('常见网站名单匹配，不代表绝对安全');

  return {
    url: r.url,
    status,
    details,
    checkedAt: Date.now(),
  };
}

// ── API Functions ──

export async function fetchMeta(url: string): Promise<FetchMetaResult | null> {
  if (isChromeExtension()) {
    return fetchMetaExtension(url);
  }
  return fetchMetaWeb(url);
}

async function fetchMetaWeb(url: string): Promise<FetchMetaResult | null> {
  try {
    const res = await fetch('/api/fetch-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchMetaExtension(url: string): Promise<FetchMetaResult | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_META',
      url,
    });
    if (response?.success) return response.data;
    return null;
  } catch {
    return null;
  }
}

export async function checkSafety(urls: string[]): Promise<SafetyCheckResult[]> {
  if (isChromeExtension()) {
    return checkSafetyExtension(urls);
  }
  return checkSafetyWeb(urls);
}

async function checkSafetyWeb(urls: string[]): Promise<SafetyCheckResult[]> {
  try {
    const res = await fetch('/api/check-safety', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function checkSafetyExtension(urls: string[]): Promise<SafetyCheckResult[]> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_SAFETY',
      urls,
    });
    if (response?.success && Array.isArray(response.data)) {
      return response.data.map(mapExtensionSafetyResult);
    }
    return [];
  } catch {
    return [];
  }
}

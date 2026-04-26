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

// Listen for messages from the newtab page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_META') {
    handleFetchMeta(message.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep the message channel open for async response
  }

  if (message.type === 'CHECK_SAFETY') {
    handleCheckSafety(message.urls)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Fetch OG metadata from a URL (no CORS restrictions in extension context)
 */
async function handleFetchMeta(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { title: '', description: '', image: '', favicon: '' };
    }

    const html = await response.text();

    // Extract OG metadata
    const title = extractMeta(html, 'og:title')
      || extractTitle(html)
      || '';

    const description = extractMeta(html, 'og:description')
      || extractMeta(html, 'description')
      || '';

    const image = extractMeta(html, 'og:image') || '';

    const favicon = extractFavicon(html, url) || '';

    return { title, description, image, favicon };
  } catch (e) {
    return { title: '', description: '', image: '', favicon: '' };
  }
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
      const parsed = new URL(url);
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

// ── Helper Functions ──

function extractMeta(html, property) {
  // Try og: prefix
  const ogRegex = new RegExp('<meta[^>]*property=["\']' + escapeRegex(property) + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
  const ogMatch = html.match(ogRegex);
  if (ogMatch) return ogMatch[1];

  // Try name attribute (for description etc.)
  const nameRegex = new RegExp('<meta[^>]*name=["\']' + escapeRegex(property) + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
  const nameMatch = html.match(nameRegex);
  if (nameMatch) return nameMatch[1];

  return null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractFavicon(html, baseUrl) {
  // Try to find favicon link
  const iconRegex = /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']*)["']/i;
  const match = html.match(iconRegex);
  if (match) {
    let href = match[1];
    if (href.startsWith('//')) href = 'https:' + href;
    else if (href.startsWith('/')) href = new URL(baseUrl).origin + href;
    else if (!href.startsWith('http')) href = new URL(baseUrl).origin + '/' + href;
    return href;
  }
  // Fallback to /favicon.ico
  try {
    return new URL(baseUrl).origin + '/favicon.ico';
  } catch (e) {
    return '';
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Extension Install/Update ──

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('WebCollect extension installed');
  } else if (details.reason === 'update') {
    console.log('WebCollect extension updated to version', chrome.runtime.getManifest().version);
  }
});

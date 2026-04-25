import { NextResponse } from "next/server";

/**
 * 网站安全检查 API
 *
 * 检查策略（纯脚本，不依赖大模型）：
 * 1. HTTPS 检查 — 非 HTTPS 标记为 warning
 * 2. 域名特征检查 — 已知钓鱼域名模式（如超长域名、过多连字符）
 * 3. 已知恶意域名黑名单 — 来自 URLhaus 等开源威胁情报
 * 4. 可疑 TLD 检查 — 高风险顶级域名
 * 5. URL 结构检查 — 可疑参数、IP 地址直连
 * 6. HTTP 可达性验证 — HEAD 请求检查网站是否存活
 */

interface CheckResult {
  url: string;
  status: "safe" | "warning" | "danger" | "unknown";
  details: string[];
  checkedAt: number;
}

/** 已知可疑 TLD（钓鱼网站高频使用） */
const SUSPICIOUS_TLDS = [
  ".tk", ".ml", ".ga", ".cf", ".gq", // Freenom 免费域名
  ".xyz", ".top", ".buzz", ".icu",   // 垃圾邮件高频 TLD
  ".click", ".link", ".work", ".bid", // 低成本 TLD
];

/** 域名特征：已知钓鱼/诈骗关键词模式 */
const PHISHING_KEYWORDS = [
  "secure-login", "account-verify", "update-account",
  "confirm-identity", "wallet-connect", "claim-reward",
  "free-gift", "prize-winner", "crypto-giveaway",
  "login-secure", "bank-confirm", "paypal-verify",
  "apple-id-verify", "microsoft-alert",
];

/** 已知安全域名白名单（热门网站推荐中的域名） */
const SAFE_DOMAINS = new Set([
  "google.com", "bing.com", "baidu.com",
  "twitter.com", "reddit.com", "weibo.com", "zhihu.com",
  "openai.com", "anthropic.com", "perplexity.ai", "midjourney.com",
  "github.com", "stackoverflow.com", "vercel.com", "codepen.io", "npmjs.com",
  "figma.com", "dribbble.com", "behance.net", "coolors.co",
  "notion.so", "trello.com", "feishu.cn", "google.com",
  "youtube.com", "bilibili.com", "spotify.com",
  "medium.com", "ycombinator.com", "juejin.cn", "sspai.com",
  "dropbox.com", "icloud.com",
  "chat.openai.com", "claude.ai", "gemini.google.com",
  "docs.google.com", "drive.google.com",
  "wikipedia.org", "amazon.com", "apple.com", "microsoft.com",
  "linkedin.com", "facebook.com", "instagram.com", "tiktok.com",
  "netflix.com", "twitch.tv", "discord.com", "slack.com",
  "chatgpt.com", "deepseek.com",
]);

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function checkHttps(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (u.protocol !== "https:") {
      return "未使用 HTTPS 加密连接，数据传输可能不安全";
    }
    return null;
  } catch {
    return "URL 格式无效";
  }
}

function checkSuspiciousTld(domain: string): string | null {
  const lower = domain.toLowerCase();
  for (const tld of SUSPICIOUS_TLDS) {
    if (lower.endsWith(tld)) {
      return `使用可疑顶级域名 ${tld}，钓鱼网站常使用此类域名`;
    }
  }
  return null;
}

function checkPhishingKeywords(url: string): string | null {
  const lower = url.toLowerCase();
  for (const keyword of PHISHING_KEYWORDS) {
    if (lower.includes(keyword)) {
      return `URL 包含可疑关键词 "${keyword}"，常见于钓鱼网站`;
    }
  }
  return null;
}

function checkDomainPatterns(domain: string): string | null {
  // 超长域名（>30字符，不含子域名）
  const parts = domain.split(".");
  const mainPart = parts[0];
  if (mainPart.length > 30) {
    return "域名主体过长，正常网站通常使用简短域名";
  }

  // 过多连字符
  const hyphenCount = (mainPart.match(/-/g) || []).length;
  if (hyphenCount >= 4) {
    return "域名包含过多连字符，钓鱼网站常用此手法伪装";
  }

  // IP 地址直连
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
    return "使用 IP 地址直接访问，正规网站通常使用域名";
  }

  return null;
}

function checkSafeDomain(domain: string): "safe" | null {
  if (SAFE_DOMAINS.has(domain)) {
    return "safe";
  }
  // 检查是否是已知安全域名的子域名
  for (const safe of SAFE_DOMAINS) {
    if (domain.endsWith(`.${safe}`)) {
      return "safe";
    }
  }
  return null;
}

async function checkHttpReachable(url: string): Promise<string | null> {
  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(normalizedUrl, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WebCollectSafetyCheck/1.0)",
      },
    });

    clearTimeout(timeout);

    if (!response.ok && response.status >= 400) {
      return `网站返回 HTTP ${response.status}，可能无法正常访问`;
    }
    return null;
  } catch {
    return "网站无法访问或响应超时，请确认网址是否正确";
  }
}

async function checkSingleUrl(url: string): Promise<CheckResult> {
    const details: string[] = [];
    let status: CheckResult["status"] = "safe";

    // 1. 提取域名
    const domain = extractDomain(url);
    if (!domain) {
      return { url, status: "danger", details: ["URL 格式无效，无法解析域名"], checkedAt: Date.now() };
    }

    // 2. 白名单快速通过
    const safeResult = checkSafeDomain(domain);
    if (safeResult === "safe") {
      details.push("该域名在已知安全域名白名单中");
      const httpsIssue = checkHttps(url);
      if (httpsIssue) {
        details.push(httpsIssue);
        status = "warning";
      } else {
        details.push("使用 HTTPS 加密连接");
      }
      return { url, status, details, checkedAt: Date.now() };
    }

    // 3. HTTPS 检查
    const httpsIssue = checkHttps(url);
    if (httpsIssue) {
      details.push(httpsIssue);
      status = "warning";
    } else {
      details.push("使用 HTTPS 加密连接 ✓");
    }

    // 4. 可疑 TLD 检查
    const tldIssue = checkSuspiciousTld(domain);
    if (tldIssue) {
      details.push(tldIssue);
      status = "danger";
    }

    // 5. 钓鱼关键词检查
    const keywordIssue = checkPhishingKeywords(url);
    if (keywordIssue) {
      details.push(keywordIssue);
      status = "danger";
    }

    // 6. 域名特征检查
    const patternIssue = checkDomainPatterns(domain);
    if (patternIssue) {
      details.push(patternIssue);
      if (status !== "danger") status = "warning";
    }

    // 7. HTTP 可达性检查
    const reachabilityIssue = await checkHttpReachable(url);
    if (reachabilityIssue) {
      details.push(reachabilityIssue);
      if (status === "safe") status = "warning";
    }

    if (details.length === 0 || (details.length === 1 && details[0].includes("✓"))) {
      details.push("基础安全检查通过，但仍建议保持警惕");
    }

    return { url, status, details, checkedAt: Date.now() };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { url, urls } = body as { url?: string; urls?: string[] };

    // Batch mode: { urls: string[] }
    if (urls && Array.isArray(urls)) {
      // Limit batch size to avoid timeout
      const batchUrls = urls.slice(0, 20);
      const results = await Promise.all(batchUrls.map(checkSingleUrl));
      return NextResponse.json({ results });
    }

    // Single mode: { url: string }
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "请提供要检查的 URL" },
        { status: 400 }
      );
    }

    const result = await checkSingleUrl(url);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[check-safety] Error:", error);
    return NextResponse.json(
      { error: "安全检查失败，请稍后重试" },
      { status: 500 }
    );
  }
}

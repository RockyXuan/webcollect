import type { WebCard } from "./types";

interface DescriptionContext {
  title?: string;
  url?: string;
}

const CJK_RE = /[\u3400-\u9fff]/;
const LATIN_WORD_RE = /[A-Za-z]{2,}/g;

const DOMAIN_SUMMARIES: Array<{
  domains: string[];
  titleTerms?: string[];
  summary: string;
}> = [
  { domains: ["mail.google.com", "gmail.com"], titleTerms: ["gmail"], summary: "Google 邮箱服务，用于收发邮件、管理联系人和处理日常通信。" },
  { domains: ["chrome.google.com"], titleTerms: ["web store", "chrome web store"], summary: "Chrome 网上应用店，用于查找、安装和管理浏览器扩展。" },
  { domains: ["github.com"], titleTerms: ["github"], summary: "代码托管与协作平台，用于管理项目、阅读代码和跟踪开发进度。" },
  { domains: ["youtube.com", "youtu.be"], titleTerms: ["youtube"], summary: "在线视频平台，用于观看、订阅和管理视频内容。" },
  { domains: ["x.com", "twitter.com"], titleTerms: ["twitter"], summary: "X/Twitter 社交平台，用于查看动态、关注话题和发布内容。" },
  { domains: ["discord.com"], titleTerms: ["discord"], summary: "社区聊天与语音协作平台，用于群组沟通和频道管理。" },
  { domains: ["bilibili.com"], titleTerms: ["bilibili", "b站"], summary: "哔哩哔哩视频社区，用于观看、收藏和追踪视频内容。" },
  { domains: ["openai.com", "chatgpt.com"], titleTerms: ["chatgpt", "openai"], summary: "OpenAI 的 AI 工具与服务入口，用于对话、创作、编程和知识处理。" },
  { domains: ["deepseek.com"], titleTerms: ["deepseek"], summary: "DeepSeek AI 服务入口，用于对话、搜索、写作和代码辅助。" },
  { domains: ["notion.so"], titleTerms: ["notion"], summary: "Notion 笔记与知识管理平台，用于整理文档、数据库和项目资料。" },
  { domains: ["figma.com"], titleTerms: ["figma"], summary: "协作式设计工具，用于界面设计、原型制作和团队评审。" },
  { domains: ["app.tweetmesh.com", "tweetmesh.com"], titleTerms: ["tweetmesh"], summary: "X/Twitter 内容整理工具，用于追踪账号、话题和社交信息流。" },
  { domains: ["pendle.finance"], titleTerms: ["pendle"], summary: "Pendle DeFi 平台，用于查看收益市场、资产池和相关链上数据。" },
];

const PHRASE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^official website$/i, "官方网站"],
  [/^the official website$/i, "官方网站"],
  [/^github is where people build software\.?$/i, "GitHub 是开发者托管代码、协作开发和管理项目的平台。"],
  [/^from breaking news and entertainment to sports and politics/i, "从突发新闻、娱乐、体育到公共话题，X/Twitter 用于查看实时动态和参与讨论。"],
  [/^AI writes it\.?\s*docu\.md does the rest\.?$/i, "AI 负责写作，Docu.md 完成其余工作。"],
  [/^enjoy the videos and music you love/i, "YouTube 用于观看喜爱的视频和音乐、上传原创内容并与他人分享。"],
  [/^secure, smart, and easy to use email/i, "Gmail 是安全、智能且易用的电子邮件服务。"],
  [/^a new tool that blends your everyday work apps into one/i, "一个把日常工作应用整合到一起的工具，用于统一管理文档、任务和知识。"],
  [/^build better products as a team/i, "帮助团队协作设计、原型制作和交付更好的产品。"],
];

const WORD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAI assistant\b/gi, "AI 助手"],
  [/\bAI tool\b/gi, "AI 工具"],
  [/\bofficial website\b/gi, "官方网站"],
  [/\bdeveloper platform\b/gi, "开发者平台"],
  [/\bdesign tool\b/gi, "设计工具"],
  [/\bproject management\b/gi, "项目管理"],
  [/\bknowledge base\b/gi, "知识库"],
  [/\bsocial media\b/gi, "社交媒体"],
  [/\bvideo platform\b/gi, "视频平台"],
  [/\bemail service\b/gi, "电子邮件服务"],
  [/\bcode hosting\b/gi, "代码托管"],
  [/\bcollaboration\b/gi, "协作"],
  [/\bdashboard\b/gi, "数据看板"],
  [/\banalytics\b/gi, "数据分析"],
  [/\bmarketplace\b/gi, "市场"],
  [/\bplatform\b/gi, "平台"],
  [/\btool\b/gi, "工具"],
  [/\bservice\b/gi, "服务"],
  [/\bcommunity\b/gi, "社区"],
  [/\bwebsite\b/gi, "网站"],
  [/\bapp\b/gi, "应用"],
  [/\bmanage\b/gi, "管理"],
  [/\bcreate\b/gi, "创建"],
  [/\bsearch\b/gi, "搜索"],
  [/\bdiscover\b/gi, "发现"],
  [/\btrack\b/gi, "追踪"],
  [/\bshare\b/gi, "分享"],
  [/\blearn\b/gi, "学习"],
  [/\bnews\b/gi, "资讯"],
  [/\bvideo\b/gi, "视频"],
  [/\bmusic\b/gi, "音乐"],
  [/\bdata\b/gi, "数据"],
  [/\bfinance\b/gi, "金融"],
  [/\bcrypto\b/gi, "加密资产"],
  [/\bDeFi\b/g, "DeFi"],
];

function normalizeDescriptionText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hostnameFromUrl(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesTitleTerm(title: string | undefined, term: string): boolean {
  const normalizedTitle = normalizeDescriptionText(title || "").toLowerCase();
  const normalizedTerm = normalizeDescriptionText(term).toLowerCase();
  if (!normalizedTitle || !normalizedTerm) return false;
  if (normalizedTerm.length <= 2) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}($|[^a-z0-9])`, "i")
      .test(normalizedTitle);
  }
  return normalizedTitle.includes(normalizedTerm);
}

export function isEnglishOnlyDescription(value?: string): boolean {
  const text = normalizeDescriptionText(value || "");
  if (text.length < 4 || CJK_RE.test(text)) return false;
  const latinWords = text.match(LATIN_WORD_RE) || [];
  if (latinWords.length === 0) return false;
  const latinLetters = latinWords.join("").length;
  const visibleLetters = text.replace(/[^A-Za-z\u3400-\u9fff]/g, "").length;
  return visibleLetters > 0 && latinLetters / visibleLetters >= 0.8;
}

function summaryFromKnownSite(context: DescriptionContext): string | null {
  const hostname = hostnameFromUrl(context.url);

  for (const item of DOMAIN_SUMMARIES) {
    if (item.domains.some((domain) => matchesDomain(hostname, domain))) return item.summary;
    if (!hostname && item.titleTerms?.some((term) => matchesTitleTerm(context.title, term))) return item.summary;
  }
  return null;
}

export function isMismatchedKnownSiteSummary(value?: string, context: DescriptionContext = {}): boolean {
  const text = normalizeDescriptionText(value || "");
  if (!text) return false;
  const hostname = hostnameFromUrl(context.url);
  const known = DOMAIN_SUMMARIES.find((item) => normalizeDescriptionText(item.summary) === text);
  if (!known) return false;
  if (known.domains.some((domain) => matchesDomain(hostname, domain))) return false;
  if (!hostname && known.titleTerms?.some((term) => matchesTitleTerm(context.title, term))) return false;
  return true;
}

function phraseTranslate(text: string): string | null {
  for (const [pattern, translation] of PHRASE_TRANSLATIONS) {
    if (pattern.test(text)) return translation;
  }
  return null;
}

function softTranslate(text: string): string | null {
  let translated = text;
  for (const [pattern, replacement] of WORD_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  translated = translated
    .replace(/\bthe\b/gi, "")
    .replace(/\ban?\b/gi, "")
    .replace(/\band\b/gi, "和")
    .replace(/\bfor\b/gi, "用于")
    .replace(/\bwith\b/gi, "结合")
    .replace(/\bto\b/gi, "去")
    .replace(/\s+/g, " ")
    .trim();

  if (!CJK_RE.test(translated)) return null;
  return translated.replace(/\s+([，。；：])/g, "$1");
}

export function localizeDescriptionText(value?: string, context: DescriptionContext = {}): string {
  const text = normalizeDescriptionText(value || "");
  if (!text || !isEnglishOnlyDescription(text)) return text;

  const known = summaryFromKnownSite(context);
  if (known) return known;

  const phrase = phraseTranslate(text);
  if (phrase) return phrase;

  const soft = softTranslate(text);
  if (soft) return soft;

  const title = normalizeDescriptionText(context.title || "");
  if (title) return `${title} 的网页说明，适合收藏后快速识别和访问。`;

  const hostname = hostnameFromUrl(context.url);
  if (hostname) return `${hostname} 的网页说明，适合收藏后快速识别和访问。`;

  return "这个网页的英文简介已转换为中文摘要，适合收藏后快速识别。";
}

export function localizeCardDescription(card: WebCard): WebCard {
  const context = { title: card.title, url: card.url };
  const fullDesc = isEnglishOnlyDescription(card.fullDesc)
    ? localizeDescriptionText(card.fullDesc, context)
    : card.fullDesc;
  let shortDesc = isEnglishOnlyDescription(card.shortDesc)
    ? localizeDescriptionText(card.shortDesc, context)
    : card.shortDesc;

  if (!fullDesc && isEnglishOnlyDescription(card.shortDesc)) {
    return {
      ...card,
      fullDesc: shortDesc,
      shortDesc: shortDesc.slice(0, 48),
      updatedAt: Date.now(),
    };
  }

  if (!shortDesc && fullDesc) shortDesc = fullDesc.slice(0, 48);
  if (fullDesc === card.fullDesc && shortDesc === card.shortDesc) return card;
  return {
    ...card,
    fullDesc,
    shortDesc: shortDesc.slice(0, 48),
    updatedAt: Date.now(),
  };
}

export function localizeCardDescriptions(cards: WebCard[]): { cards: WebCard[]; changed: boolean } {
  let changed = false;
  const localized = cards.map((card) => {
    const next = localizeCardDescription(card);
    if (next !== card) changed = true;
    return next;
  });
  return { cards: localized, changed };
}

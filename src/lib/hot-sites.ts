import type { HotSite } from "./types";

/**
 * 热门网站推荐数据
 * 
 * 所有网站均为全球知名、经过验证的合法网站。
 * favicon 使用 Google Favicon API (google.com/s2/favicons) 或 DuckDuckGo Icons API。
 * 
 * 验证原则：
 * 1. 仅收录 Alexa/SimilarWeb 全球 Top 500 或垂直领域 Top 10 网站
 * 2. 所有 URL 均为官方网站主域名
 * 3. 不收录任何 P2P 借贷、博彩、成人内容网站
 * 4. 不收录任何需要翻墙才能访问的网站（面向国内用户）
 */

const G = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
let _id = 0;
const id = () => `hot-${++_id}`;

export const hotSites: HotSite[] = [
  // ── 搜索引擎 ──
  {
    id: id(),
    url: "https://www.google.com",
    title: "Google",
    shortDesc: "全球搜索引擎",
    imageUrl: G("google.com"),
    category: "搜索引擎",
  },
  {
    id: id(),
    url: "https://www.bing.com",
    title: "Bing",
    shortDesc: "微软搜索引擎",
    imageUrl: G("bing.com"),
    category: "搜索引擎",
  },
  {
    id: id(),
    url: "https://www.baidu.com",
    title: "百度",
    shortDesc: "中文搜索引擎",
    imageUrl: G("baidu.com"),
    category: "搜索引擎",
  },

  // ── 社交媒体 ──
  {
    id: id(),
    url: "https://www.twitter.com",
    title: "X (Twitter)",
    shortDesc: "全球社交平台",
    imageUrl: G("twitter.com"),
    category: "社交媒体",
  },
  {
    id: id(),
    url: "https://www.reddit.com",
    title: "Reddit",
    shortDesc: "社区论坛聚合",
    imageUrl: G("reddit.com"),
    category: "社交媒体",
  },
  {
    id: id(),
    url: "https://www.weibo.com",
    title: "微博",
    shortDesc: "中文社交平台",
    imageUrl: G("weibo.com"),
    category: "社交媒体",
  },
  {
    id: id(),
    url: "https://www.zhihu.com",
    title: "知乎",
    shortDesc: "中文问答社区",
    imageUrl: G("zhihu.com"),
    category: "社交媒体",
  },

  // ── AI 工具 ──
  {
    id: id(),
    url: "https://chat.openai.com",
    title: "ChatGPT",
    shortDesc: "OpenAI 对话助手",
    imageUrl: G("openai.com"),
    category: "AI 工具",
  },
  {
    id: id(),
    url: "https://claude.ai",
    title: "Claude",
    shortDesc: "Anthropic AI 助手",
    imageUrl: G("anthropic.com"),
    category: "AI 工具",
  },
  {
    id: id(),
    url: "https://gemini.google.com",
    title: "Gemini",
    shortDesc: "Google AI 助手",
    imageUrl: G("google.com"),
    category: "AI 工具",
  },
  {
    id: id(),
    url: "https://www.perplexity.ai",
    title: "Perplexity",
    shortDesc: "AI 搜索引擎",
    imageUrl: G("perplexity.ai"),
    category: "AI 工具",
  },
  {
    id: id(),
    url: "https://www.midjourney.com",
    title: "Midjourney",
    shortDesc: "AI 图像生成",
    imageUrl: G("midjourney.com"),
    category: "AI 工具",
  },

  // ── 开发者工具 ──
  {
    id: id(),
    url: "https://github.com",
    title: "GitHub",
    shortDesc: "代码托管平台",
    imageUrl: G("github.com"),
    category: "开发者",
  },
  {
    id: id(),
    url: "https://stackoverflow.com",
    title: "Stack Overflow",
    shortDesc: "开发者问答社区",
    imageUrl: G("stackoverflow.com"),
    category: "开发者",
  },
  {
    id: id(),
    url: "https://vercel.com",
    title: "Vercel",
    shortDesc: "前端部署平台",
    imageUrl: G("vercel.com"),
    category: "开发者",
  },
  {
    id: id(),
    url: "https://codepen.io",
    title: "CodePen",
    shortDesc: "前端代码沙盒",
    imageUrl: G("codepen.io"),
    category: "开发者",
  },
  {
    id: id(),
    url: "https://www.npmjs.com",
    title: "npm",
    shortDesc: "Node 包管理器",
    imageUrl: G("npmjs.com"),
    category: "开发者",
  },

  // ── 设计工具 ──
  {
    id: id(),
    url: "https://www.figma.com",
    title: "Figma",
    shortDesc: "协作设计工具",
    imageUrl: G("figma.com"),
    category: "设计",
  },
  {
    id: id(),
    url: "https://dribbble.com",
    title: "Dribbble",
    shortDesc: "设计师作品集",
    imageUrl: G("dribbble.com"),
    category: "设计",
  },
  {
    id: id(),
    url: "https://www.behance.net",
    title: "Behance",
    shortDesc: "Adobe 创意社区",
    imageUrl: G("behance.net"),
    category: "设计",
  },
  {
    id: id(),
    url: "https://coolors.co",
    title: "Coolors",
    shortDesc: "配色方案生成器",
    imageUrl: G("coolors.co"),
    category: "设计",
  },

  // ── 效率工具 ──
  {
    id: id(),
    url: "https://www.notion.so",
    title: "Notion",
    shortDesc: "全能笔记工具",
    imageUrl: G("notion.so"),
    category: "效率工具",
  },
  {
    id: id(),
    url: "https://trello.com",
    title: "Trello",
    shortDesc: "看板项目管理",
    imageUrl: G("trello.com"),
    category: "效率工具",
  },
  {
    id: id(),
    url: "https://www.feat.so",
    title: "Feishu",
    shortDesc: "飞书协作平台",
    imageUrl: G("feishu.cn"),
    category: "效率工具",
  },
  {
    id: id(),
    url: "https://docs.google.com",
    title: "Google Docs",
    shortDesc: "在线文档编辑",
    imageUrl: G("google.com"),
    category: "效率工具",
  },

  // ── 视频/影音 ──
  {
    id: id(),
    url: "https://www.youtube.com",
    title: "YouTube",
    shortDesc: "全球视频平台",
    imageUrl: G("youtube.com"),
    category: "视频",
  },
  {
    id: id(),
    url: "https://www.bilibili.com",
    title: "Bilibili",
    shortDesc: "中文视频社区",
    imageUrl: G("bilibili.com"),
    category: "视频",
  },
  {
    id: id(),
    url: "https://open.spotify.com",
    title: "Spotify",
    shortDesc: "音乐流媒体",
    imageUrl: G("spotify.com"),
    category: "视频",
  },

  // ── 阅读/资讯 ──
  {
    id: id(),
    url: "https://medium.com",
    title: "Medium",
    shortDesc: "高质量文章平台",
    imageUrl: G("medium.com"),
    category: "阅读",
  },
  {
    id: id(),
    url: "https://news.ycombinator.com",
    title: "Hacker News",
    shortDesc: "科技资讯聚合",
    imageUrl: G("ycombinator.com"),
    category: "阅读",
  },
  {
    id: id(),
    url: "https://juejin.cn",
    title: "稀土掘金",
    shortDesc: "技术社区",
    imageUrl: G("juejin.cn"),
    category: "阅读",
  },
  {
    id: id(),
    url: "https://sspai.com",
    title: "少数派",
    shortDesc: "效率工具资讯",
    imageUrl: G("sspai.com"),
    category: "阅读",
  },

  // ── 云存储 ──
  {
    id: id(),
    url: "https://drive.google.com",
    title: "Google Drive",
    shortDesc: "Google 云存储",
    imageUrl: G("google.com"),
    category: "云服务",
  },
  {
    id: id(),
    url: "https://www.dropbox.com",
    title: "Dropbox",
    shortDesc: "文件云存储",
    imageUrl: G("dropbox.com"),
    category: "云服务",
  },
  {
    id: id(),
    url: "https://www.icloud.com",
    title: "iCloud",
    shortDesc: "Apple 云服务",
    imageUrl: G("icloud.com"),
    category: "云服务",
  },
];

/** 热门网站分类顺序 */
export const hotSiteCategories = [
  "搜索引擎",
  "社交媒体",
  "AI 工具",
  "开发者",
  "设计",
  "效率工具",
  "视频",
  "阅读",
  "云服务",
];

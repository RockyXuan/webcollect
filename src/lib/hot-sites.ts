import type { HotSite } from "./types";
export type { HotSite } from "./types";

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
 */

const G = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
let _id = 0;
const id = () => `hot-${++_id}`;

/** 主推网站列表（默认展示） */
export const hotSites: HotSite[] = [
  // ── 搜索引擎 ──
  { id: id(), url: "https://www.google.com", title: "Google", shortDesc: "全球搜索引擎", imageUrl: G("google.com"), category: "搜索引擎" },
  { id: id(), url: "https://www.bing.com", title: "Bing", shortDesc: "微软搜索引擎", imageUrl: G("bing.com"), category: "搜索引擎" },
  { id: id(), url: "https://www.baidu.com", title: "百度", shortDesc: "中文搜索引擎", imageUrl: G("baidu.com"), category: "搜索引擎" },
  { id: id(), url: "https://duckduckgo.com", title: "DuckDuckGo", shortDesc: "隐私搜索引擎", imageUrl: G("duckduckgo.com"), category: "搜索引擎" },
  { id: id(), url: "https://www.sogou.com", title: "搜狗", shortDesc: "中文搜索引擎", imageUrl: G("sogou.com"), category: "搜索引擎" },

  // ── 社交媒体 ──
  { id: id(), url: "https://www.twitter.com", title: "X (Twitter)", shortDesc: "全球社交平台", imageUrl: G("twitter.com"), category: "社交媒体" },
  { id: id(), url: "https://www.reddit.com", title: "Reddit", shortDesc: "社区论坛聚合", imageUrl: G("reddit.com"), category: "社交媒体" },
  { id: id(), url: "https://www.weibo.com", title: "微博", shortDesc: "中文社交平台", imageUrl: G("weibo.com"), category: "社交媒体" },
  { id: id(), url: "https://www.zhihu.com", title: "知乎", shortDesc: "中文问答社区", imageUrl: G("zhihu.com"), category: "社交媒体" },
  { id: id(), url: "https://www.instagram.com", title: "Instagram", shortDesc: "图片社交平台", imageUrl: G("instagram.com"), category: "社交媒体" },
  { id: id(), url: "https://www.linkedin.com", title: "LinkedIn", shortDesc: "职业社交网络", imageUrl: G("linkedin.com"), category: "社交媒体" },
  { id: id(), url: "https://www.facebook.com", title: "Facebook", shortDesc: "全球社交网络", imageUrl: G("facebook.com"), category: "社交媒体" },
  { id: id(), url: "https://www.douban.com", title: "豆瓣", shortDesc: "文化兴趣社区", imageUrl: G("douban.com"), category: "社交媒体" },
  { id: id(), url: "https://www.xiaohongshu.com", title: "小红书", shortDesc: "生活方式分享", imageUrl: G("xiaohongshu.com"), category: "社交媒体" },

  // ── AI 工具 ──
  { id: id(), url: "https://chat.openai.com", title: "ChatGPT", shortDesc: "OpenAI 对话助手", imageUrl: G("openai.com"), category: "AI 工具" },
  { id: id(), url: "https://claude.ai", title: "Claude", shortDesc: "Anthropic AI 助手", imageUrl: G("anthropic.com"), category: "AI 工具" },
  { id: id(), url: "https://gemini.google.com", title: "Gemini", shortDesc: "Google AI 助手", imageUrl: G("google.com"), category: "AI 工具" },
  { id: id(), url: "https://www.perplexity.ai", title: "Perplexity", shortDesc: "AI 搜索引擎", imageUrl: G("perplexity.ai"), category: "AI 工具" },
  { id: id(), url: "https://www.midjourney.com", title: "Midjourney", shortDesc: "AI 图像生成", imageUrl: G("midjourney.com"), category: "AI 工具" },
  { id: id(), url: "https://chat.deepseek.com", title: "DeepSeek", shortDesc: "深度求索 AI", imageUrl: G("deepseek.com"), category: "AI 工具" },
  { id: id(), url: "https://copilot.microsoft.com", title: "Copilot", shortDesc: "微软 AI 助手", imageUrl: G("microsoft.com"), category: "AI 工具" },
  { id: id(), url: "https://www.cursor.com", title: "Cursor", shortDesc: "AI 代码编辑器", imageUrl: G("cursor.com"), category: "AI 工具" },
  { id: id(), url: "https://suno.com", title: "Suno", shortDesc: "AI 音乐生成", imageUrl: G("suno.com"), category: "AI 工具" },
  { id: id(), url: "https://runwayml.com", title: "Runway", shortDesc: "AI 视频生成", imageUrl: G("runwayml.com"), category: "AI 工具" },

  // ── 开发者 ──
  { id: id(), url: "https://github.com", title: "GitHub", shortDesc: "代码托管平台", imageUrl: G("github.com"), category: "开发者" },
  { id: id(), url: "https://stackoverflow.com", title: "Stack Overflow", shortDesc: "开发者问答社区", imageUrl: G("stackoverflow.com"), category: "开发者" },
  { id: id(), url: "https://vercel.com", title: "Vercel", shortDesc: "前端部署平台", imageUrl: G("vercel.com"), category: "开发者" },
  { id: id(), url: "https://codepen.io", title: "CodePen", shortDesc: "前端代码沙盒", imageUrl: G("codepen.io"), category: "开发者" },
  { id: id(), url: "https://www.npmjs.com", title: "npm", shortDesc: "Node 包管理器", imageUrl: G("npmjs.com"), category: "开发者" },
  { id: id(), url: "https://code.visualstudio.com", title: "VS Code", shortDesc: "代码编辑器", imageUrl: G("visualstudio.com"), category: "开发者" },
  { id: id(), url: "https://www.figma.com", title: "Figma", shortDesc: "协作设计工具", imageUrl: G("figma.com"), category: "开发者" },
  { id: id(), url: "https://gitlab.com", title: "GitLab", shortDesc: "DevOps 平台", imageUrl: G("gitlab.com"), category: "开发者" },
  { id: id(), url: "https://docker.com", title: "Docker", shortDesc: "容器化平台", imageUrl: G("docker.com"), category: "开发者" },
  { id: id(), url: "https://www.cloudflare.com", title: "Cloudflare", shortDesc: "CDN 与安全", imageUrl: G("cloudflare.com"), category: "开发者" },

  // ── 设计 ──
  { id: id(), url: "https://dribbble.com", title: "Dribbble", shortDesc: "设计师作品集", imageUrl: G("dribbble.com"), category: "设计" },
  { id: id(), url: "https://www.behance.net", title: "Behance", shortDesc: "Adobe 创意社区", imageUrl: G("behance.net"), category: "设计" },
  { id: id(), url: "https://coolors.co", title: "Coolors", shortDesc: "配色方案生成器", imageUrl: G("coolors.co"), category: "设计" },
  { id: id(), url: "https://www.canva.com", title: "Canva", shortDesc: "在线设计工具", imageUrl: G("canva.com"), category: "设计" },
  { id: id(), url: "https://unsplash.com", title: "Unsplash", shortDesc: "免费高清图片", imageUrl: G("unsplash.com"), category: "设计" },
  { id: id(), url: "https://www.pexels.com", title: "Pexels", shortDesc: "免费图片视频", imageUrl: G("pexels.com"), category: "设计" },
  { id: id(), url: "https://www.awwwards.com", title: "Awwwards", shortDesc: "网页设计评选", imageUrl: G("awwwards.com"), category: "设计" },
  { id: id(), url: "https://www.are.na", title: "Are.na", shortDesc: "灵感收集平台", imageUrl: G("are.na"), category: "设计" },

  // ── 效率工具 ──
  { id: id(), url: "https://www.notion.so", title: "Notion", shortDesc: "全能笔记工具", imageUrl: G("notion.so"), category: "效率工具" },
  { id: id(), url: "https://trello.com", title: "Trello", shortDesc: "看板项目管理", imageUrl: G("trello.com"), category: "效率工具" },
  { id: id(), url: "https://www.feishu.cn", title: "飞书", shortDesc: "协作办公平台", imageUrl: G("feishu.cn"), category: "效率工具" },
  { id: id(), url: "https://docs.google.com", title: "Google Docs", shortDesc: "在线文档编辑", imageUrl: G("google.com"), category: "效率工具" },
  { id: id(), url: "https://www.dingtalk.com", title: "钉钉", shortDesc: "企业协作平台", imageUrl: G("dingtalk.com"), category: "效率工具" },
  { id: id(), url: "https://todoist.com", title: "Todoist", shortDesc: "任务管理工具", imageUrl: G("todoist.com"), category: "效率工具" },
  { id: id(), url: "https://www.evernote.com", title: "Evernote", shortDesc: "笔记管理工具", imageUrl: G("evernote.com"), category: "效率工具" },
  { id: id(), url: "https://www.obsidian.md", title: "Obsidian", shortDesc: "知识管理工具", imageUrl: G("obsidian.md"), category: "效率工具" },

  // ── 视频 ──
  { id: id(), url: "https://www.youtube.com", title: "YouTube", shortDesc: "全球视频平台", imageUrl: G("youtube.com"), category: "视频" },
  { id: id(), url: "https://www.bilibili.com", title: "Bilibili", shortDesc: "中文视频社区", imageUrl: G("bilibili.com"), category: "视频" },
  { id: id(), url: "https://open.spotify.com", title: "Spotify", shortDesc: "音乐流媒体", imageUrl: G("spotify.com"), category: "视频" },
  { id: id(), url: "https://www.netflix.com", title: "Netflix", shortDesc: "流媒体影视", imageUrl: G("netflix.com"), category: "视频" },
  { id: id(), url: "https://www.iqiyi.com", title: "爱奇艺", shortDesc: "中文视频平台", imageUrl: G("iqiyi.com"), category: "视频" },
  { id: id(), url: "https://www.twitch.tv", title: "Twitch", shortDesc: "游戏直播平台", imageUrl: G("twitch.tv"), category: "视频" },

  // ── 阅读 ──
  { id: id(), url: "https://medium.com", title: "Medium", shortDesc: "高质量文章平台", imageUrl: G("medium.com"), category: "阅读" },
  { id: id(), url: "https://news.ycombinator.com", title: "Hacker News", shortDesc: "科技资讯聚合", imageUrl: G("ycombinator.com"), category: "阅读" },
  { id: id(), url: "https://juejin.cn", title: "稀土掘金", shortDesc: "技术社区", imageUrl: G("juejin.cn"), category: "阅读" },
  { id: id(), url: "https://sspai.com", title: "少数派", shortDesc: "效率工具资讯", imageUrl: G("sspai.com"), category: "阅读" },
  { id: id(), url: "https://www.36kr.com", title: "36氪", shortDesc: "科技商业资讯", imageUrl: G("36kr.com"), category: "阅读" },
  { id: id(), url: "https://www.producthunt.com", title: "Product Hunt", shortDesc: "新产品发现", imageUrl: G("producthunt.com"), category: "阅读" },
  { id: id(), url: "https://www.zhihu.com", title: "知乎", shortDesc: "中文问答社区", imageUrl: G("zhihu.com"), category: "阅读" },

  // ── 云服务 ──
  { id: id(), url: "https://drive.google.com", title: "Google Drive", shortDesc: "Google 云存储", imageUrl: G("google.com"), category: "云服务" },
  { id: id(), url: "https://www.dropbox.com", title: "Dropbox", shortDesc: "文件云存储", imageUrl: G("dropbox.com"), category: "云服务" },
  { id: id(), url: "https://www.icloud.com", title: "iCloud", shortDesc: "Apple 云服务", imageUrl: G("icloud.com"), category: "云服务" },
  { id: id(), url: "https://onedrive.live.com", title: "OneDrive", shortDesc: "微软云存储", imageUrl: G("onedrive.com"), category: "云服务" },

  // ── 购物 ──
  { id: id(), url: "https://www.amazon.com", title: "Amazon", shortDesc: "全球电商平台", imageUrl: G("amazon.com"), category: "购物" },
  { id: id(), url: "https://www.taobao.com", title: "淘宝", shortDesc: "中文电商平台", imageUrl: G("taobao.com"), category: "购物" },
  { id: id(), url: "https://www.jd.com", title: "京东", shortDesc: "综合电商平台", imageUrl: G("jd.com"), category: "购物" },
  { id: id(), url: "https://www.pinduoduo.com", title: "拼多多", shortDesc: "社交电商平台", imageUrl: G("pinduoduo.com"), category: "购物" },

  // ── 学习 ──
  { id: id(), url: "https://www.coursera.org", title: "Coursera", shortDesc: "在线课程平台", imageUrl: G("coursera.org"), category: "学习" },
  { id: id(), url: "https://www.udemy.com", title: "Udemy", shortDesc: "技能学习平台", imageUrl: G("udemy.com"), category: "学习" },
  { id: id(), url: "https://www.khanacademy.org", title: "Khan Academy", shortDesc: "免费教育平台", imageUrl: G("khanacademy.org"), category: "学习" },
  { id: id(), url: "https://leetcode.com", title: "LeetCode", shortDesc: "编程刷题平台", imageUrl: G("leetcode.com"), category: "学习" },
  { id: id(), url: "https://www.w3schools.com", title: "W3Schools", shortDesc: "Web 技术教程", imageUrl: G("w3schools.com"), category: "学习" },

  // ── 通讯 ──
  { id: id(), url: "https://discord.com", title: "Discord", shortDesc: "社区通讯平台", imageUrl: G("discord.com"), category: "通讯" },
  { id: id(), url: "https://slack.com", title: "Slack", shortDesc: "团队通讯工具", imageUrl: G("slack.com"), category: "通讯" },
  { id: id(), url: "https://web.telegram.org", title: "Telegram", shortDesc: "加密通讯工具", imageUrl: G("telegram.org"), category: "通讯" },
  { id: id(), url: "https://web.wechat.com", title: "微信", shortDesc: "社交通讯工具", imageUrl: G("wechat.com"), category: "通讯" },
  { id: id(), url: "https://mail.google.com", title: "Gmail", shortDesc: "Google 邮箱", imageUrl: G("google.com"), category: "通讯" },
];

/** 补充推荐网站（"刷新推荐"时加载） */
export const extraHotSites: HotSite[] = [
  // ── 更多 AI ──
  { id: id(), url: "https://poe.com", title: "Poe", shortDesc: "AI 聊天聚合", imageUrl: G("poe.com"), category: "AI 工具" },
  { id: id(), url: "https://huggingface.co", title: "Hugging Face", shortDesc: "AI 模型社区", imageUrl: G("huggingface.co"), category: "AI 工具" },
  { id: id(), url: "https://openart.ai", title: "OpenArt", shortDesc: "AI 艺术创作", imageUrl: G("openart.ai"), category: "AI 工具" },
  { id: id(), url: "https://stability.ai", title: "Stability AI", shortDesc: "开源 AI 生成", imageUrl: G("stability.ai"), category: "AI 工具" },

  // ── 更多开发 ──
  { id: id(), url: "https://replit.com", title: "Replit", shortDesc: "在线 IDE", imageUrl: G("replit.com"), category: "开发者" },
  { id: id(), url: "https://www.heroku.com", title: "Heroku", shortDesc: "云应用平台", imageUrl: G("heroku.com"), category: "开发者" },
  { id: id(), url: "https://www.digitalocean.com", title: "DigitalOcean", shortDesc: "云计算平台", imageUrl: G("digitalocean.com"), category: "开发者" },
  { id: id(), url: "https://aws.amazon.com", title: "AWS", shortDesc: "亚马逊云服务", imageUrl: G("amazon.com"), category: "开发者" },

  // ── 更多设计 ──
  { id: id(), url: "https://www.sketch.com", title: "Sketch", shortDesc: "UI 设计工具", imageUrl: G("sketch.com"), category: "设计" },
  { id: id(), url: "https://spline.design", title: "Spline", shortDesc: "3D 设计工具", imageUrl: G("spline.design"), category: "设计" },
  { id: id(), url: "https://www.framer.com", title: "Framer", shortDesc: "无代码建站", imageUrl: G("framer.com"), category: "设计" },
  { id: id(), url: "https://pixso.net", title: "Pixso", shortDesc: "协作设计工具", imageUrl: G("pixso.net"), category: "设计" },

  // ── 更多效率 ──
  { id: id(), url: "https://www.linear.app", title: "Linear", shortDesc: "项目管理工具", imageUrl: G("linear.app"), category: "效率工具" },
  { id: id(), url: "https://clickup.com", title: "ClickUp", shortDesc: "全能项目管理", imageUrl: G("clickup.com"), category: "效率工具" },
  { id: id(), url: "https://www.miro.com", title: "Miro", shortDesc: "在线白板协作", imageUrl: G("miro.com"), category: "效率工具" },

  // ── 更多阅读 ──
  { id: id(), url: "https://www.techcrunch.com", title: "TechCrunch", shortDesc: "科技新闻", imageUrl: G("techcrunch.com"), category: "阅读" },
  { id: id(), url: "https://www.theverge.com", title: "The Verge", shortDesc: "科技文化媒体", imageUrl: G("theverge.com"), category: "阅读" },
  { id: id(), url: "https://arxiv.org", title: "arXiv", shortDesc: "学术论文预印本", imageUrl: G("arxiv.org"), category: "阅读" },
  { id: id(), url: "https://www.infoq.cn", title: "InfoQ", shortDesc: "技术资讯平台", imageUrl: G("infoq.cn"), category: "阅读" },

  // ── 更多学习 ──
  { id: id(), url: "https://www.edx.org", title: "edX", shortDesc: "名校在线课程", imageUrl: G("edx.org"), category: "学习" },
  { id: id(), url: "https://www.codecademy.com", title: "Codecademy", shortDesc: "交互式编程学习", imageUrl: G("codecademy.com"), category: "学习" },
  { id: id(), url: "https://freeCodeCamp.org", title: "freeCodeCamp", shortDesc: "免费编程学习", imageUrl: G("freecodecamp.org"), category: "学习" },

  // ── 新闻 ──
  { id: id(), url: "https://news.qq.com", title: "腾讯新闻", shortDesc: "综合新闻门户", imageUrl: G("qq.com"), category: "新闻" },
  { id: id(), url: "https://www.bbc.com", title: "BBC", shortDesc: "英国广播公司", imageUrl: G("bbc.com"), category: "新闻" },
  { id: id(), url: "https://www.nytimes.com", title: "NY Times", shortDesc: "纽约时报", imageUrl: G("nytimes.com"), category: "新闻" },
  { id: id(), url: "https://www.reuters.com", title: "Reuters", shortDesc: "路透社新闻", imageUrl: G("reuters.com"), category: "新闻" },

  // ── 出行 ──
  { id: id(), url: "https://www.ctrip.com", title: "携程", shortDesc: "旅行预订平台", imageUrl: G("ctrip.com"), category: "出行" },
  { id: id(), url: "https://www.booking.com", title: "Booking", shortDesc: "全球酒店预订", imageUrl: G("booking.com"), category: "出行" },
  { id: id(), url: "https://www.airbnb.com", title: "Airbnb", shortDesc: "民宿预订平台", imageUrl: G("airbnb.com"), category: "出行" },
  { id: id(), url: "https://www.amap.com", title: "高德地图", shortDesc: "导航地图服务", imageUrl: G("amap.com"), category: "出行" },
];

/** 热门网站分类顺序 */
export const hotSiteCategories = [
  "AI 工具",
  "效率工具",
  "开发者",
  "设计",
  "社交媒体",
  "阅读",
  "视频",
  "搜索引擎",
  "学习",
  "云服务",
  "通讯",
  "购物",
  "新闻",
  "出行",
];

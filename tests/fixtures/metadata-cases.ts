export interface MetadataFixture {
  name: string;
  url: string;
  html: string;
  expected: {
    title: string;
    description: string;
    image?: string;
    favicon?: string;
  };
}

export const metadataFixtures: MetadataFixture[] = [
  {
    name: "docu title slogan",
    url: "https://docu.md/",
    html: `<title>docu.md — AI writes it. docu.md does the rest.</title><main><h1>AI writes it.</h1><p>docu.md does the rest.</p></main>`,
    expected: { title: "Docu.md", description: "AI writes it. docu.md does the rest." },
  },
  {
    name: "docu ignores X source summary",
    url: "https://docu.md/",
    html: `<meta name="description" content="X/Twitter 社交平台，用于查看动态、关注话题和发布内容。"><main><h1>AI writes it.</h1><p>docu.md does the rest.</p></main>`,
    expected: { title: "Docu.md", description: "AI writes it. docu.md does the rest." },
  },
  {
    name: "github repository title",
    url: "https://github.com/Leonxlnx/taste-skill/tree/main",
    html: `<meta property="og:title" content="GitHub - Leonxlnx/taste-skill: Taste-Skill - gives your AI good taste"><meta property="og:description" content="Taste-Skill gives your AI good taste and stops generic output.">`,
    expected: { title: "taste-skill", description: "Taste-Skill gives your AI good taste and stops generic output." },
  },
  {
    name: "github generic source summary",
    url: "https://github.com/Leonxlnx/taste-skill",
    html: `<meta name="description" content="GitHub is where people build software."><main><h1>taste-skill</h1><p>Taste-Skill gives your AI good taste and stops boring generic slop.</p></main>`,
    expected: { title: "taste-skill", description: "Taste-Skill gives your AI good taste and stops boring generic slop." },
  },
  {
    name: "json ld article",
    url: "https://journal.example.com/ai-writing",
    html: `<script type="application/ld+json">{"@type":"Article","headline":"How AI changes writing","description":"A practical field guide to editing AI-assisted drafts."}</script>`,
    expected: { title: "How AI changes writing", description: "A practical field guide to editing AI-assisted drafts." },
  },
  {
    name: "json ld graph product",
    url: "https://products.example.com/focus",
    html: `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},{"@type":"SoftwareApplication","name":"Focus Desk","description":"A calm workspace for planning deep work."}]}</script>`,
    expected: { title: "Focus Desk", description: "A calm workspace for planning deep work." },
  },
  {
    name: "open graph product",
    url: "https://linear.app/",
    html: `<meta property="og:title" content="Linear"><meta property="og:description" content="Plan and build products with a system crafted for modern teams.">`,
    expected: { title: "Linear", description: "Plan and build products with a system crafted for modern teams." },
  },
  {
    name: "twitter card only",
    url: "https://tool.example.com/",
    html: `<meta name="twitter:title" content="Tiny Tool"><meta name="twitter:description" content="Convert structured notes into clean project briefs.">`,
    expected: { title: "Tiny Tool", description: "Convert structured notes into clean project briefs." },
  },
  {
    name: "documentation lead",
    url: "https://docs.example.com/getting-started",
    html: `<nav>Docs API Pricing</nav><main><h1>Getting started</h1><p>Install the SDK and create your first verified workflow.</p></main>`,
    expected: { title: "Getting started", description: "Install the SDK and create your first verified workflow." },
  },
  {
    name: "article body lead",
    url: "https://writing.example.com/notes/attention",
    html: `<article><h1>Attention is a design material</h1><p>Interfaces shape what people notice before they shape what people do.</p><p>Subscribe for updates.</p></article>`,
    expected: { title: "Attention is a design material", description: "Interfaces shape what people notice before they shape what people do." },
  },
  {
    name: "youtube watch page",
    url: "https://www.youtube.com/watch?v=abc123",
    html: `<meta property="og:title" content="Build a personal knowledge system"><meta property="og:description" content="A complete walkthrough of capture, review, and retrieval.">`,
    expected: { title: "Build a personal knowledge system", description: "A complete walkthrough of capture, review, and retrieval." },
  },
  {
    name: "chinese article",
    url: "https://example.cn/article/123",
    html: `<article><h1>把收藏变成真正可用的知识库</h1><p>关键不是保存更多网页，而是让内容能够被重新找到和使用。</p></article>`,
    expected: { title: "把收藏变成真正可用的知识库", description: "关键不是保存更多网页，而是让内容能够被重新找到和使用。" },
  },
  {
    name: "navigation noise filtered",
    url: "https://service.example.com/overview",
    html: `<header><p>Home Product Pricing Login Sign up</p></header><main><h1>Signal Board</h1><p>Monitor project changes without turning every update into a meeting.</p></main>`,
    expected: { title: "Signal Board", description: "Monitor project changes without turning every update into a meeting." },
  },
  {
    name: "copyright noise filtered",
    url: "https://studio.example.com/",
    html: `<main><h1>Studio Notes</h1><p>Short field notes for people who design and build digital products.</p></main><footer>Copyright 2026 All rights reserved Privacy Terms</footer>`,
    expected: { title: "Studio Notes", description: "Short field notes for people who design and build digital products." },
  },
  {
    name: "malformed json ld fallback",
    url: "https://fallback.example.com/",
    html: `<script type="application/ld+json">{"@type":"Product",broken}</script><title>Fallback Product</title><main><p>A useful fallback description from the visible page.</p></main>`,
    expected: { title: "Fallback Product", description: "A useful fallback description from the visible page." },
  },
  {
    name: "json ld array chooses content object",
    url: "https://news.example.com/story",
    html: `<script type="application/ld+json">[{"@type":"Organization","name":"News Co"},{"@type":"NewsArticle","headline":"A quieter way to ship software","description":"Teams are replacing release drama with smaller verified changes."}]</script>`,
    expected: { title: "A quieter way to ship software", description: "Teams are replacing release drama with smaller verified changes." },
  },
  {
    name: "html entities decoded",
    url: "https://entities.example.com/",
    html: `<meta property="og:title" content="Research &amp; Practice"><meta property="og:description" content="Tools for R&amp;D teams that don&#39;t want another dashboard.">`,
    expected: { title: "Research & Practice", description: "Tools for R&D teams that don't want another dashboard." },
  },
  {
    name: "relative media URLs",
    url: "https://media.example.com/path/page",
    html: `<meta property="og:title" content="Media Page"><meta property="og:description" content="A page with resolvable preview and icon assets."><meta property="og:image" content="/images/cover.jpg"><link rel="icon" href="../icon.png">`,
    expected: {
      title: "Media Page",
      description: "A page with resolvable preview and icon assets.",
      image: "https://media.example.com/images/cover.jpg",
      favicon: "https://media.example.com/icon.png",
    },
  },
  {
    name: "domain title suffix becomes description",
    url: "https://noted.example/",
    html: `<title>noted.example — Capture ideas before they disappear.</title>`,
    expected: { title: "Noted.example", description: "Capture ideas before they disappear." },
  },
  {
    name: "long title is compacted",
    url: "https://long.example.com/article",
    html: `<title>This is a deliberately long article title that keeps going beyond a useful bookmark label and should be compacted cleanly</title><p>A concise introduction that still explains what the page is about.</p>`,
    expected: { title: "This is a deliberately long article title that keeps going beyond...", description: "A concise introduction that still explains what the page is about." },
  },
  {
    name: "empty document fallback",
    url: "https://empty.example.com/path",
    html: `<html><body></body></html>`,
    expected: { title: "Empty.example.com", description: "" },
  },
  {
    name: "final redirected URL determines fallback",
    url: "https://destination.example.org/product",
    html: `<main><p>A destination page whose title metadata is missing.</p></main>`,
    expected: { title: "Destination.example.org", description: "A destination page whose title metadata is missing." },
  },
  {
    name: "meta attributes in reverse order",
    url: "https://reverse.example.com/",
    html: `<meta content="Reverse Metadata" property="og:title"><meta content="Attribute order must not change extraction." name="description">`,
    expected: { title: "Reverse Metadata", description: "Attribute order must not change extraction." },
  },
  {
    name: "X generic description loses to target lead",
    url: "https://target.example.com/app",
    html: `<meta property="og:title" content="Target App"><meta name="description" content="X/Twitter is a social platform for posts and trending topics."><main><p>Turn rough research links into a reviewable project map.</p></main>`,
    expected: { title: "Target App", description: "Turn rough research links into a reviewable project map." },
  },
];

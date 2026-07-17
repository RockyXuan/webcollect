import { describe, expect, it } from "vitest";
import {
  extractKnowledgeText,
  extractMetadataFromHtml,
  extractPageContentFromHtml,
} from "../../shared/metadata-extractor.js";
import { metadataFixtures } from "../fixtures/metadata-cases";

describe("shared metadata extractor", () => {
  it("keeps at least twenty representative HTML fixtures", () => {
    expect(metadataFixtures.length).toBeGreaterThanOrEqual(20);
  });

  for (const fixture of metadataFixtures) {
    it(fixture.name, () => {
      const result = extractMetadataFromHtml(fixture.html, fixture.url);
      expect(result).toMatchObject(fixture.expected);
    });
  }

  it("extracts structured and visible knowledge text without repeating the same paragraph", () => {
    const html = `
      <html>
        <head>
          <title>Knowledge App</title>
          <script type="application/ld+json">
            {"@type":"SoftwareApplication","description":"Organize research visually.","articleBody":"Organize research visually. Connect notes into a reusable knowledge graph."}
          </script>
        </head>
        <body>
          <nav>Pricing Sign in</nav>
          <main>
            <h1>Knowledge App</h1>
            <p>Organize research visually.</p>
            <p>Connect notes into a reusable knowledge graph.</p>
          </main>
          <footer>Copyright 2026</footer>
        </body>
      </html>`;

    const result = extractKnowledgeText(html);

    expect(result.text).toContain("Connect notes into a reusable knowledge graph.");
    expect(result.text.match(/Organize research visually\./g)).toHaveLength(1);
    expect(result.text).not.toContain("Pricing Sign in");
    expect(result.text).not.toContain("Copyright 2026");
  });

  it("filters hidden, form and script noise from public page knowledge", () => {
    const result = extractKnowledgeText(`
      <main>
        <h1>下载助手</h1>
        <p>保存公开网页中的视频和媒体文件。</p>
        <p hidden>忽略隐藏关键词</p>
        <div aria-hidden="true"><p>忽略弹窗内容</p></div>
        <form><p>请输入密码后登录</p></form>
        <script>stealSecrets()</script>
      </main>`);

    expect(result.text).toBe("下载助手\n保存公开网页中的视频和媒体文件。");
  });

  it("caps knowledge text at a Unicode-safe paragraph boundary", () => {
    const paragraphs = Array.from({ length: 20 }, (_, index) => `<p>第${index}段 ${"内容".repeat(20)}</p>`).join("");
    const result = extractKnowledgeText(`<main>${paragraphs}</main>`, { maxChars: 256 });

    expect(Array.from(result.text).length).toBeLessThanOrEqual(256);
    expect(result.truncated).toBe(true);
    expect(result.segmentCount).toBeGreaterThan(0);
  });

  it("parses metadata and knowledge in one shared pass", () => {
    const html = `<title>Example</title><meta name="description" content="A useful public tool for research"><main><h1>Example</h1><p>Detailed feature overview.</p></main>`;
    const result = extractPageContentFromHtml(
      html,
      "https://example.com",
    );

    expect(result.metadata).toEqual(extractMetadataFromHtml(html, "https://example.com"));
    expect(result.knowledge.text).toContain("Detailed feature overview.");
  });
});

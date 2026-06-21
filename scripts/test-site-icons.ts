import assert from "node:assert/strict";
import type { WebCard } from "../src/lib/types";
import {
  getSemanticSiteIcon,
  getSiteIconCandidates,
  shouldPersistSiteIcon,
} from "../src/lib/site-icons";

const now = 1_700_000_000_000;

function card(overrides: Partial<WebCard>): WebCard {
  return {
    id: "card",
    url: "https://example.com",
    title: "Example",
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: "",
    imageUrl: "",
    categoryId: "cat",
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const gmail = card({
  title: "Gmail",
  url: "https://mail.google.com/mail/u/0/#inbox",
  imageUrl: "https://www.google.com/s2/favicons?domain=mail.google.com&sz=64",
});
const gmailCandidates = getSiteIconCandidates(gmail);
assert.equal(
  gmailCandidates[0],
  "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
  "known Gmail icon should beat generic Google favicon provider"
);
assert.equal(getSemanticSiteIcon(gmail)?.key, "mail");

const bilibili = card({
  title: "B站收藏",
  url: "https://www.bilibili.com/video/BV123",
});
const bilibiliCandidates = getSiteIconCandidates(bilibili);
assert.ok(
  bilibiliCandidates.includes("https://www.bilibili.com/favicon.ico"),
  "Bilibili should have a direct stable favicon candidate"
);
assert.equal(getSemanticSiteIcon(bilibili)?.key, "video");

const customIcon = "https://assets.example.com/icon.png";
const custom = card({ imageUrl: customIcon, url: "https://tool.example.com" });
assert.equal(getSiteIconCandidates(custom)[0], customIcon, "specific saved icon should be first");

const directIcon = "https://tool.example.com/favicon.ico";
assert.equal(shouldPersistSiteIcon("", directIcon), true);
assert.equal(shouldPersistSiteIcon(gmail.imageUrl, gmailCandidates[0]), true);
assert.equal(
  shouldPersistSiteIcon("", "https://www.google.com/s2/favicons?domain=tool.example.com&sz=128"),
  false,
  "generic providers should not be persisted as the stable cached icon"
);

const unknownTool = card({
  title: "小众 PDF 工具",
  url: "https://small-tool.example.com",
});
assert.equal(getSemanticSiteIcon(unknownTool)?.key, "document");

console.log("site-icons tests passed");

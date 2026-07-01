import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isEnglishOnlyDescription,
  localizeCardDescription,
  localizeDescriptionText,
} from "../src/lib/description-translation";
import type { WebCard } from "../src/lib/types";

assert.equal(isEnglishOnlyDescription("GitHub is where people build software."), true);
assert.equal(isEnglishOnlyDescription("代码托管与协作平台"), false);

assert.equal(
  localizeDescriptionText("Secure, smart, and easy to use email", {
    title: "Gmail",
    url: "https://mail.google.com/mail/u/0/",
  }),
  "Google 邮箱服务，用于收发邮件、管理联系人和处理日常通信。"
);

assert.equal(
  localizeDescriptionText("GitHub is where people build software.", {
    title: "github中学",
    url: "https://github.com/",
  }),
  "代码托管与协作平台，用于管理项目、阅读代码和跟踪开发进度。"
);

assert.match(
  localizeDescriptionText("A social media analytics dashboard for creators.", {
    title: "TweetMesh",
    url: "https://tweetmesh.com/",
  }),
  /X\/Twitter 内容整理工具|数据分析|平台/
);

assert.equal(
  localizeDescriptionText("AI writes it. docu.md does the rest.", {
    title: "docu.md — AI writes it. docu.md does the rest.",
    url: "https://docu.md/",
  }),
  "AI 负责写作，Docu.md 完成其余工作。"
);

assert.doesNotMatch(
  localizeDescriptionText("Export markdown to DOCX, PDF, and HTML.", {
    title: "docu.md — AI writes it. docu.md does the rest.",
    url: "https://docu.md/",
  }),
  /X\/Twitter/,
  "ordinary English text containing the letter x must not become an X/Twitter summary"
);

const card: WebCard = {
  id: "card-1",
  url: "https://www.youtube.com/",
  title: "YouTube",
  shortDesc: "Enjoy the videos and music you love",
  fullDesc: "Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world.",
  note: "",
  abbreviation: "",
  imageUrl: "",
  categoryId: "group-video",
  order: 0,
  createdAt: 1,
  updatedAt: 1,
};

const localizedCard = localizeCardDescription(card);
assert.notEqual(localizedCard, card);
assert.match(localizedCard.fullDesc, /YouTube|视频|音乐/);
assert.equal(isEnglishOnlyDescription(localizedCard.fullDesc), false);
assert.equal(isEnglishOnlyDescription(localizedCard.shortDesc), false);

const storeSource = readFileSync("src/lib/store.ts", "utf8");
assert.ok(
  storeSource.includes("localizeCardDescriptions(cards)"),
  "loadData should migrate existing English descriptions"
);

const contentSource = readFileSync("extension/src/content/floating-capture.ts", "utf8");
assert.ok(
  contentSource.includes("localizeDescriptionText"),
  "floating capture should localize descriptions before showing and saving"
);
assert.match(
  contentSource,
  /data-action="translate-description"[\s\S]*>翻译<\/button>/,
  "floating capture description field should expose a manual translate button"
);
assert.match(
  contentSource,
  /descriptionInput\.value\s*=\s*localizeDescriptionText\(descriptionInput\.value\.trim\(\),\s*{\s*title:\s*titleInput\.value\.trim\(\),\s*url:\s*urlInput\.value\.trim\(\),\s*}\s*\)/,
  "manual translate should localize the current description using the current title and url"
);

console.log("description translation tests passed");

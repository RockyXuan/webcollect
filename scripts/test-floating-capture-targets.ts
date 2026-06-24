import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCaptureDestinationCache,
  resolveOrCreateCaptureTargetCategory,
  resolveCaptureTargetCategoryId,
  type CaptureDraft,
} from "../src/lib/floating-capture";
import type { Category, CollectionSection } from "../src/lib/types";

const now = 1_777_000_000_000;
const floatingCaptureSource = readFileSync("extension/src/content/floating-capture.ts", "utf8");

const sections: CollectionSection[] = [
  { id: "section-home", name: "主页", order: 0, createdAt: now, updatedAt: now },
  { id: "section-jieliu", name: "节流", order: 1, createdAt: now, updatedAt: now },
];

const category = (input: Partial<Category> & Pick<Category, "id" | "name" | "order">): Category => ({
  icon: "folder",
  color: "#94a3b8",
  createdAt: now,
  updatedAt: now,
  ...input,
});

const categories: Category[] = [
  category({ id: "home-parent-common", name: "常用", order: 0, sectionId: "section-home", isParent: true }),
  category({ id: "home-group-world", name: "看世界", order: 0, sectionId: "section-home", parentId: "home-parent-common" }),
  category({ id: "home-group-zmt", name: "ZMT", order: 0, sectionId: "section-home", parentId: "home-parent-common" }),
  category({ id: "home-inbox", name: "收集箱", order: 99, sectionId: "section-home" }),
  category({ id: "jieliu-inbox", name: "收集箱", order: 99, sectionId: "section-jieliu" }),
];

function draft(destination: CaptureDraft["destination"]): CaptureDraft {
  return {
    url: "https://gingiris.tools/",
    title: "出海增长工具集",
    sourceType: "floating-button",
    destination,
  };
}

const cache = buildCaptureDestinationCache(sections, categories, "section-home", now);
assert.equal(cache.activeSectionId, "section-home");
assert.equal(cache.sections[0]?.id, "section-home");
assert.equal(cache.sections[1]?.id, "section-jieliu");

assert.equal(
  resolveCaptureTargetCategoryId(
    draft({ sectionId: "section-home", parentCategoryId: "home-parent-common", groupId: "home-group-zmt" }),
    categories,
    sections,
    "section-home"
  ),
  "home-group-zmt",
  "explicit selected group should win"
);

assert.equal(
  resolveCaptureTargetCategoryId(
    draft({
      sectionId: "section-home",
      sectionName: "主页",
      parentCategoryId: "home-parent-common",
      parentCategoryName: "常用",
      groupId: "home-group-world",
      groupName: "看世界",
    }),
    categories,
    sections,
    "section-jieliu"
  ),
  "home-group-world",
  "selected Home / Common / World destination should not fall back to the throttling inbox"
);

assert.equal(
  resolveCaptureTargetCategoryId(
    draft({
      sectionId: "old-section-id",
      parentCategoryId: "old-parent-id",
      groupId: "old-group-id",
      sectionName: "主页",
      parentCategoryName: "常用",
      groupName: "ZMT",
    }),
    categories,
    sections,
    "section-jieliu"
  ),
  "home-group-zmt",
  "stale IDs should fall back to selected names"
);

assert.equal(
  resolveCaptureTargetCategoryId(draft({ sectionId: "section-home" }), categories, sections, "section-jieliu"),
  "home-inbox",
  "section-only capture should use that section's inbox"
);

assert.notEqual(
  resolveCaptureTargetCategoryId(
    draft({ sectionName: "主页", parentCategoryName: "常用", groupName: "不存在的分组" }),
    categories,
    sections,
    "section-jieliu"
  ),
  "jieliu-inbox",
  "a missing home group must not fall into another section inbox"
);

assert.equal(
  resolveCaptureTargetCategoryId(
    draft({ sectionName: "主页", parentCategoryName: "常用", groupName: "不存在的分组" }),
    categories,
    sections,
    "section-jieliu"
  ),
  null,
  "an explicit missing group should fail instead of silently selecting a sibling or inbox"
);

assert.equal(
  resolveCaptureTargetCategoryId(
    draft({ sectionName: "主页", parentCategoryName: "不存在的分类" }),
    categories,
    sections,
    "section-jieliu"
  ),
  null,
  "an explicit missing parent category should fail instead of falling back to an inbox"
);

const createdSection = resolveOrCreateCaptureTargetCategory(
  draft({ createSectionName: "新世界" }),
  categories,
  sections,
  "section-home",
  now + 1
);
assert.equal(createdSection.changed, true);
assert.equal(createdSection.sections.some((section) => section.name === "新世界"), true);
assert.equal(
  createdSection.categories.find((category) => category.id === createdSection.categoryId)?.name,
  "收集箱",
  "creating a section should place the card in that section's inbox"
);

const createdParent = resolveOrCreateCaptureTargetCategory(
  draft({ sectionId: "section-jieliu", createParentCategoryName: "AI 工具" }),
  categories,
  sections,
  "section-home",
  now + 2
);
const aiParent = createdParent.categories.find((category) => category.name === "AI 工具");
assert.equal(createdParent.changed, true);
assert.equal(aiParent?.isParent, true);
assert.equal(aiParent?.sectionId, "section-jieliu");
assert.equal(
  createdParent.categories.find((category) => category.id === createdParent.categoryId)?.parentId,
  aiParent?.id,
  "creating only a parent category should create/use its inbox child as the target"
);

const createdGroup = resolveOrCreateCaptureTargetCategory(
  draft({
    sectionName: "主页",
    parentCategoryName: "常用",
    createGroupName: "临时研究",
  }),
  categories,
  sections,
  "section-home",
  now + 3
);
const tempResearch = createdGroup.categories.find((category) => category.name === "临时研究");
assert.equal(createdGroup.changed, true);
assert.equal(createdGroup.categoryId, tempResearch?.id);
assert.equal(tempResearch?.parentId, "home-parent-common");

const createdPath = resolveOrCreateCaptureTargetCategory(
  draft({
    createSectionName: "工作台",
    createParentCategoryName: "项目",
    createGroupName: "X 流量情报台",
  }),
  categories,
  sections,
  "section-home",
  now + 4
);
const workbench = createdPath.sections.find((section) => section.name === "工作台");
const project = createdPath.categories.find((category) => category.name === "项目");
const xReport = createdPath.categories.find((category) => category.name === "X 流量情报台");
assert.equal(createdPath.changed, true);
assert.equal(project?.sectionId, workbench?.id);
assert.equal(project?.isParent, true);
assert.equal(xReport?.parentId, project?.id);
assert.equal(createdPath.categoryId, xReport?.id);

const reusedExisting = resolveOrCreateCaptureTargetCategory(
  draft({
    createSectionName: "主页",
    createParentCategoryName: "常用",
    createGroupName: "ZMT",
  }),
  categories,
  sections,
  "section-jieliu",
  now + 5
);
assert.equal(reusedExisting.categoryId, "home-group-zmt");
assert.equal(
  reusedExisting.categories.filter((category) => category.name === "ZMT").length,
  1,
  "create-by-name should reuse an existing destination instead of duplicating it"
);

assert.ok(floatingCaptureSource.includes("＋ 新建分项"), "floating capture UI should expose section creation");
assert.ok(floatingCaptureSource.includes("＋ 新建分类"), "floating capture UI should expose parent category creation");
assert.ok(floatingCaptureSource.includes("＋ 新建分组"), "floating capture UI should expose group creation");
assert.ok(floatingCaptureSource.includes("createSectionName"), "floating capture draft should preserve new section names");
assert.ok(floatingCaptureSource.includes("createParentCategoryName"), "floating capture draft should preserve new parent category names");
assert.ok(floatingCaptureSource.includes("createGroupName"), "floating capture draft should preserve new group names");

console.log("Floating capture destination tests passed.");

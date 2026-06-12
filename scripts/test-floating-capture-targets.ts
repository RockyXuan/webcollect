import assert from "node:assert/strict";
import {
  buildCaptureDestinationCache,
  resolveCaptureTargetCategoryId,
  type CaptureDraft,
} from "../src/lib/floating-capture";
import type { Category, CollectionSection } from "../src/lib/types";

const now = 1_777_000_000_000;

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

console.log("Floating capture destination tests passed.");

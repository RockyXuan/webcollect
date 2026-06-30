import assert from "node:assert/strict";
import {
  drainCaptureQueueItemsForWorkspace,
  repairVerifiedCaptureMisfiledCardsFromQueue,
  type CaptureQueueItem,
} from "../src/lib/floating-capture";
import type { Category, CollectionSection, WebCard } from "../src/lib/types";

const now = 1_777_100_000_000;

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
  category({ id: "home-inbox", name: "收集箱", order: 99, sectionId: "section-home" }),
  category({ id: "jieliu-inbox", name: "收集箱", order: 99, sectionId: "section-jieliu" }),
];

function pending(id: string, url: string, destination: CaptureQueueItem["draft"]["destination"]): CaptureQueueItem {
  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    draft: {
      url,
      title: id,
      sourceType: "floating-button",
      destination,
    },
  };
}

const selectedExisting = drainCaptureQueueItemsForWorkspace(
  [
    pending("selected-existing", "https://example.com/selected", {
      sectionId: "section-home",
      sectionName: "主页",
      parentCategoryId: "home-parent-common",
      parentCategoryName: "常用",
      groupId: "home-group-world",
      groupName: "看世界",
    }),
  ],
  { cards: [], categories, sections, activeSectionId: "section-jieliu" },
  { now: () => now + 1, randomId: () => "fixed" }
);

assert.equal(selectedExisting.imported, 1);
assert.equal(selectedExisting.cards[0]?.categoryId, "home-group-world");
assert.equal(selectedExisting.queue[0]?.resolvedDestinationPath, "主页 / 常用 / 看世界");

const createdDestination = drainCaptureQueueItemsForWorkspace(
  [
    pending("created-destination", "https://example.com/created", {
      createSectionName: "工作台",
      createParentCategoryName: "项目",
      createGroupName: "X 情报",
    }),
  ],
  { cards: [], categories, sections, activeSectionId: "section-home" },
  { now: () => now + 2, randomId: () => "created" }
);

const workbench = createdDestination.sections.find((section) => section.name === "工作台");
const project = createdDestination.categories.find((item) => item.name === "项目");
const xIntel = createdDestination.categories.find((item) => item.name === "X 情报");
assert.equal(createdDestination.imported, 1);
assert.equal(project?.sectionId, workbench?.id);
assert.equal(xIntel?.parentId, project?.id);
assert.equal(createdDestination.cards[0]?.categoryId, xIntel?.id);

const missingExplicit = drainCaptureQueueItemsForWorkspace(
  [
    pending("missing-explicit", "https://example.com/missing", {
      sectionName: "主页",
      parentCategoryName: "常用",
      groupName: "不存在的分组",
    }),
  ],
  { cards: [], categories, sections, activeSectionId: "section-jieliu" },
  { now: () => now + 3, randomId: () => "missing" }
);

assert.equal(missingExplicit.failed, 1);
assert.equal(missingExplicit.cards.length, 0);
assert.equal(missingExplicit.queue[0]?.status, "failed");
assert.match(missingExplicit.queue[0]?.destinationError || "", /not found/i);

const wrongInboxCard: WebCard = {
  id: "card-wrong",
  url: "https://example.com/misfiled",
  title: "Misfiled",
  shortDesc: "",
  fullDesc: "",
  note: "",
  abbreviation: "",
  imageUrl: "",
  categoryId: "jieliu-inbox",
  order: 0,
  createdAt: now,
  updatedAt: now,
};

const repaired = repairVerifiedCaptureMisfiledCardsFromQueue(
  [
    {
      ...pending("already-imported", wrongInboxCard.url, {
        sectionId: "section-home",
        sectionName: "主页",
        parentCategoryId: "home-parent-common",
        parentCategoryName: "常用",
        groupId: "home-group-world",
        groupName: "看世界",
      }),
      status: "imported",
    },
  ],
  { cards: [wrongInboxCard], categories, sections, activeSectionId: "section-jieliu" },
  { now: () => now + 4 }
);

assert.equal(repaired.repaired, 1);
assert.equal(repaired.cards[0]?.categoryId, "home-group-world");

console.log("floating capture drain tests passed");

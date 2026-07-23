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

const existingCard: WebCard = {
  id: "card-existing",
  url: "https://github.com/nexu-io/codex-slides",
  title: "Old long GitHub title",
  shortDesc: "Old summary",
  fullDesc: "Old detailed summary",
  note: "Keep this personal note",
  abbreviation: "Slides",
  imageUrl: "https://example.com/custom-icon.png",
  categoryId: "home-inbox",
  order: 7,
  createdAt: now - 100,
  updatedAt: now,
};

const confirmedUpdate = pending(
  "confirmed-update",
  existingCard.url,
  {
    sectionId: "section-home",
    groupId: "home-group-world",
  }
);
confirmedUpdate.draft.title = "codex-slides";
confirmedUpdate.draft.description = "开源 AI 幻灯片工作室，用于创建和导出演示文稿。";
confirmedUpdate.draft.favicon = "https://example.com/new-icon.png";
confirmedUpdate.draft.duplicateResolution = {
  action: "update-metadata",
  cardId: existingCard.id,
  expectedUpdatedAt: existingCard.updatedAt,
};

const updatedExisting = drainCaptureQueueItemsForWorkspace(
  [confirmedUpdate],
  { cards: [existingCard], categories, sections, activeSectionId: "section-home" },
  { now: () => now + 5 }
);

assert.equal(updatedExisting.imported, 0);
assert.equal(updatedExisting.updated, 1);
assert.equal(updatedExisting.workspaceChanged, true);
assert.equal(updatedExisting.cards[0]?.title, "codex-slides");
assert.equal(updatedExisting.cards[0]?.fullDesc, confirmedUpdate.draft.description);
assert.equal(updatedExisting.cards[0]?.shortDesc, confirmedUpdate.draft.description?.slice(0, 48));
assert.equal(updatedExisting.cards[0]?.categoryId, existingCard.categoryId);
assert.equal(updatedExisting.cards[0]?.order, existingCard.order);
assert.equal(updatedExisting.cards[0]?.note, existingCard.note);
assert.equal(updatedExisting.cards[0]?.abbreviation, existingCard.abbreviation);
assert.equal(updatedExisting.cards[0]?.imageUrl, existingCard.imageUrl);
assert.equal(updatedExisting.cards[0]?.createdAt, existingCard.createdAt);

const emptyIconCard: WebCard = { ...existingCard, id: "card-empty-icon", imageUrl: "" };
const emptyIconDraft = structuredClone(confirmedUpdate);
emptyIconDraft.id = "confirmed-update-empty-icon";
emptyIconDraft.draft.duplicateResolution = {
  action: "update-metadata",
  cardId: emptyIconCard.id,
  expectedUpdatedAt: emptyIconCard.updatedAt,
};
const updatedEmptyIcon = drainCaptureQueueItemsForWorkspace(
  [emptyIconDraft],
  { cards: [emptyIconCard], categories, sections, activeSectionId: "section-home" },
  { now: () => now + 6 }
);
assert.equal(updatedEmptyIcon.updated, 1);
assert.equal(updatedEmptyIcon.cards[0]?.imageUrl, "");

const unchangedDraft = pending("unchanged-update", existingCard.url, undefined);
unchangedDraft.draft.title = existingCard.title;
unchangedDraft.draft.description = "";
unchangedDraft.draft.duplicateResolution = {
  action: "update-metadata",
  cardId: existingCard.id,
  expectedUpdatedAt: existingCard.updatedAt,
};
const unchangedExisting = drainCaptureQueueItemsForWorkspace(
  [unchangedDraft],
  { cards: [existingCard], categories, sections, activeSectionId: "section-home" },
  { now: () => now + 7 }
);
assert.equal(unchangedExisting.updated, 0);
assert.equal(unchangedExisting.skipped, 1);
assert.equal(unchangedExisting.workspaceChanged, false);
assert.deepEqual(unchangedExisting.cards, [existingCard]);

const staleDraft = structuredClone(confirmedUpdate);
staleDraft.id = "stale-update";
staleDraft.draft.duplicateResolution = {
  action: "update-metadata",
  cardId: existingCard.id,
  expectedUpdatedAt: existingCard.updatedAt - 1,
};
const staleUpdate = drainCaptureQueueItemsForWorkspace(
  [staleDraft],
  { cards: [existingCard], categories, sections, activeSectionId: "section-home" },
  { now: () => now + 8 }
);
assert.equal(staleUpdate.failed, 1);
assert.equal(staleUpdate.workspaceChanged, false);
assert.deepEqual(staleUpdate.cards, [existingCard]);

const ambiguousUpdate = drainCaptureQueueItemsForWorkspace(
  [confirmedUpdate],
  {
    cards: [
      existingCard,
      { ...existingCard, id: "card-existing-copy", categoryId: "home-group-world" },
    ],
    categories,
    sections,
    activeSectionId: "section-home",
  },
  { now: () => now + 9 }
);
assert.equal(ambiguousUpdate.failed, 1);
assert.equal(ambiguousUpdate.updated, 0);
assert.equal(ambiguousUpdate.workspaceChanged, false);

const legacyDuplicate = pending("legacy-duplicate", existingCard.url, undefined);
legacyDuplicate.draft.title = "Should not overwrite";
legacyDuplicate.draft.description = "Should not overwrite either";
const skippedLegacy = drainCaptureQueueItemsForWorkspace(
  [legacyDuplicate],
  { cards: [existingCard], categories, sections, activeSectionId: "section-home" },
  { now: () => now + 10 }
);
assert.equal(skippedLegacy.skipped, 1);
assert.equal(skippedLegacy.updated, 0);
assert.equal(skippedLegacy.workspaceChanged, false);
assert.deepEqual(skippedLegacy.cards, [existingCard]);

const noRelocationRepair = repairVerifiedCaptureMisfiledCardsFromQueue(
  updatedExisting.queue,
  {
    cards: updatedExisting.cards,
    categories,
    sections,
    activeSectionId: "section-home",
  },
  { now: () => now + 11 }
);
assert.equal(noRelocationRepair.repaired, 0);
assert.equal(noRelocationRepair.cards[0]?.categoryId, existingCard.categoryId);

console.log("floating capture drain tests passed");

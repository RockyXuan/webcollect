import type { Category, CollectionSection, WebCard } from "./types";
import {
  getDataSchemaVersion,
  saveActiveSectionId,
  saveCards,
  saveCategories,
  saveDataSchemaVersion,
  saveSections,
  withoutLocalChangeEvents,
} from "./db";
import { localizeCardDescriptions } from "./description-translation";

export const CURRENT_LOCAL_DATA_SCHEMA_VERSION = 1;
const DEFAULT_SECTION_ID = "section-default";

interface LocalMigrationInput {
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
  activeSectionId: string | null;
  workspaceResetAt: number;
}

interface LocalMigrationResult {
  cards: WebCard[];
  categories: Category[];
  sections: CollectionSection[];
  activeSectionId: string;
}

function createDefaultSection(now = Date.now()): CollectionSection {
  return {
    id: DEFAULT_SECTION_ID,
    name: "主页",
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeSectionName(section: CollectionSection): CollectionSection {
  const corruptedHomeNames = new Set(["涓婚〉", "滑婚", "捐婚", "娑撳銆?", "婊戝", "鎹愬", "主页"]);
  if (section.id === DEFAULT_SECTION_ID && corruptedHomeNames.has(section.name.trim())) {
    return { ...section, name: "主页", updatedAt: Date.now() };
  }
  return section;
}

export function getDefaultSectionId(sections: CollectionSection[]): string {
  return sections.some((section) => section.id === DEFAULT_SECTION_ID)
    ? DEFAULT_SECTION_ID
    : sections[0]?.id || DEFAULT_SECTION_ID;
}

function sameSnapshot<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pruneEmptyDuplicateCategories(categories: Category[], cards: WebCard[]): Category[] {
  const cardCountByCategory = new Map<string, number>();
  for (const card of cards) {
    cardCountByCategory.set(card.categoryId, (cardCountByCategory.get(card.categoryId) || 0) + 1);
  }
  const childCountByCategory = new Map<string, number>();
  for (const category of categories) {
    if (category.parentId) {
      childCountByCategory.set(category.parentId, (childCountByCategory.get(category.parentId) || 0) + 1);
    }
  }

  const bySemanticKey = new Map<string, Category[]>();
  for (const category of categories) {
    const sectionId = category.sectionId || DEFAULT_SECTION_ID;
    const parentName = category.parentId
      ? categories.find((item) => item.id === category.parentId)?.name || ""
      : "";
    const key = [
      sectionId,
      category.parentId ? `group:${parentName}` : category.isParent ? "parent" : "root",
      category.name.trim().toLowerCase(),
    ].join("|");
    const group = bySemanticKey.get(key) || [];
    group.push(category);
    bySemanticKey.set(key, group);
  }

  const removeIds = new Set<string>();
  for (const group of bySemanticKey.values()) {
    if (group.length < 2) continue;
    const nonEmpty = group.filter(
      (category) => (cardCountByCategory.get(category.id) || 0) > 0 || (childCountByCategory.get(category.id) || 0) > 0
    );
    if (nonEmpty.length === 0) continue;
    for (const category of group) {
      const isEmpty = (cardCountByCategory.get(category.id) || 0) === 0 && (childCountByCategory.get(category.id) || 0) === 0;
      if (isEmpty) removeIds.add(category.id);
    }
  }

  if (removeIds.size === 0) return categories;
  return categories.filter((category) => !removeIds.has(category.id));
}

function pruneEmptySeedTemplates(categories: Category[], cards: WebCard[]): Category[] {
  const seedTemplateIds = new Set(["cat-work", "cat-ai", "cat-dev", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5"]);
  const seedTemplateNames = new Set(["\u5de5\u4f5c", "AI", "\u5f00\u53d1", "\u5e38\u7528", "AI\u5de5\u5177", "\u8bbe\u8ba1\u7075\u611f", "\u5f00\u53d1\u8005", "\u9605\u8bfb"]);
  const cardCountByCategory = new Map<string, number>();
  for (const card of cards) {
    cardCountByCategory.set(card.categoryId, (cardCountByCategory.get(card.categoryId) || 0) + 1);
  }
  const childCountByCategory = new Map<string, number>();
  for (const category of categories) {
    if (category.parentId) {
      childCountByCategory.set(category.parentId, (childCountByCategory.get(category.parentId) || 0) + 1);
    }
  }

  return categories.filter((category) => {
    const hasCards = (cardCountByCategory.get(category.id) || 0) > 0;
    const hasChildren = (childCountByCategory.get(category.id) || 0) > 0;
    const isSeedTemplate = seedTemplateIds.has(category.id) || seedTemplateNames.has(category.name.trim());
    return !isSeedTemplate || hasCards || hasChildren;
  });
}

export function ensureParentDirectCardsAreVisible(
  categories: Category[],
  cards: WebCard[],
  activeSectionId: string
): { categories: Category[]; cards: WebCard[]; changed: boolean } {
  const nextCategories = categories.map((category) => ({ ...category }));
  const nextCards = cards.map((card) => ({ ...card }));
  let changed = false;
  let createdIndex = 0;
  const now = Date.now();

  for (const parent of nextCategories.filter((category) => !category.parentId)) {
    const directCards = nextCards.filter((card) => card.categoryId === parent.id);
    if (directCards.length === 0) continue;

    const childGroups = nextCategories
      .filter((category) => category.parentId === parent.id)
      .sort((a, b) => a.order - b.order);
    const shouldRenderAsParent = parent.isParent || childGroups.length > 0;
    if (!shouldRenderAsParent) continue;

    let targetGroup = childGroups[0];
    if (!targetGroup) {
      targetGroup = {
        id: `cat-${now}-${createdIndex++}`,
        name: "\u6536\u96c6\u7bb1",
        icon: "inbox",
        color: "#888888",
        order: 0,
        createdAt: now,
        updatedAt: now,
        parentId: parent.id,
        sectionId: parent.sectionId || activeSectionId,
      };
      nextCategories.push(targetGroup);
      changed = true;
    }

    parent.isParent = true;
    parent.updatedAt = now;
    directCards
      .sort((a, b) => a.order - b.order)
      .forEach((card, index) => {
        card.categoryId = targetGroup.id;
        card.order = index;
        card.updatedAt = now;
        changed = true;
      });
  }

  return { categories: nextCategories, cards: nextCards, changed };
}

function ensureInboxForSection(
  categories: Category[],
  sectionId: string,
  now: number
): { categories: Category[]; inboxId: string; changed: boolean } {
  const existing = categories.find(
    (category) =>
      !category.parentId &&
      (category.sectionId || DEFAULT_SECTION_ID) === sectionId &&
      category.name.trim() === "\u6536\u96c6\u7bb1"
  );
  if (existing) {
    return { categories, inboxId: existing.id, changed: false };
  }

  const preferredId = sectionId === DEFAULT_SECTION_ID ? "cat-inbox" : `cat-inbox-${sectionId}`;
  const ids = new Set(categories.map((category) => category.id));
  const inboxId = ids.has(preferredId) ? `cat-inbox-${sectionId}-${now}` : preferredId;
  return {
    categories: [
      ...categories,
      {
        id: inboxId,
        name: "\u6536\u96c6\u7bb1",
        icon: "inbox",
        color: "#888888",
        order: 99,
        createdAt: now,
        updatedAt: now,
        sectionId,
      },
    ],
    inboxId,
    changed: true,
  };
}

function removeRecoveredMainData(
  categories: Category[],
  cards: WebCard[],
  activeSectionId: string
): { categories: Category[]; cards: WebCard[]; changed: boolean } {
  const recoveredIds = new Set(
    categories
      .filter((category) => /^Recovered\s+[0-9a-f-]+$/i.test(category.name.trim()))
      .map((category) => category.id)
  );
  if (recoveredIds.size === 0) {
    return { categories, cards, changed: false };
  }

  const nextCategories = categories.filter((category) => !recoveredIds.has(category.id));
  const now = Date.now();
  const inbox = ensureInboxForSection(nextCategories, activeSectionId, now);
  let nextOrder = cards
    .filter((card) => card.categoryId === inbox.inboxId)
    .reduce((max, card) => Math.max(max, card.order), -1);
  const nextCards = cards.map((card) => {
    if (!recoveredIds.has(card.categoryId)) return card;
    nextOrder += 1;
    return { ...card, categoryId: inbox.inboxId, order: nextOrder, updatedAt: now };
  });

  return { categories: inbox.categories, cards: nextCards, changed: true };
}

export function ensureSectionInboxes(categories: Category[], sections: CollectionSection[]): Category[] {
  const nextCategories = categories.map((category) =>
    category.name.trim() === "\u6536\u96c6\u7bb1" && category.isParent ? { ...category, isParent: false } : category
  );
  for (const section of sections) {
    const hasInbox = nextCategories.some(
      (category) =>
        (category.sectionId || DEFAULT_SECTION_ID) === section.id &&
        category.name.trim() === "\u6536\u96c6\u7bb1"
    );
    if (!hasInbox) {
      const now = Date.now();
      nextCategories.push({
        id: section.id === DEFAULT_SECTION_ID ? "cat-inbox" : `cat-inbox-${section.id}`,
        name: "\u6536\u96c6\u7bb1",
        icon: "inbox",
        color: "#888888",
        order: 99,
        createdAt: now,
        updatedAt: now,
        sectionId: section.id,
      });
    }
  }
  return nextCategories;
}

function repairMainDataVisibility(
  categories: Category[],
  cards: WebCard[],
  sections: CollectionSection[],
  activeSectionId: string
): { categories: Category[]; cards: WebCard[]; changed: boolean } {
  const sectionIds = new Set(sections.map((section) => section.id));
  const fallbackSectionId = sectionIds.has(activeSectionId)
    ? activeSectionId
    : getDefaultSectionId(sections);
  const now = Date.now();

  const categoriesWithInboxes = ensureSectionInboxes(categories, sections);
  let changed =
    categoriesWithInboxes.length !== categories.length ||
    categoriesWithInboxes.some((category, index) => category !== categories[index]);
  let nextCategories = categoriesWithInboxes.map((category) => ({ ...category }));

  const categoryById = () => new Map(nextCategories.map((category) => [category.id, category]));
  let byId = categoryById();

  nextCategories = nextCategories.map((category) => {
    let next = category;
    const sectionId = next.sectionId || DEFAULT_SECTION_ID;
    if (!sectionIds.has(sectionId)) {
      next = { ...next, sectionId: fallbackSectionId, updatedAt: now };
      changed = true;
    }

    if (next.parentId) {
      const parent = byId.get(next.parentId);
      if (!parent) {
        const detached = { ...next, isParent: false, updatedAt: now };
        delete detached.parentId;
        next = detached;
        changed = true;
      } else {
        const rawParentSectionId = parent.sectionId || DEFAULT_SECTION_ID;
        const parentSectionId = sectionIds.has(rawParentSectionId) ? rawParentSectionId : fallbackSectionId;
        if ((next.sectionId || DEFAULT_SECTION_ID) !== parentSectionId) {
          next = { ...next, sectionId: parentSectionId, updatedAt: now };
          changed = true;
        }
      }
    }

    return next;
  });

  byId = categoryById();
  let nextCards = cards.map((card) => ({ ...card }));
  const invalidCards = nextCards.filter((card) => !byId.has(card.categoryId));
  if (invalidCards.length > 0) {
    const inbox = ensureInboxForSection(nextCategories, fallbackSectionId, now);
    nextCategories = inbox.categories;
    const maxOrder = nextCards
      .filter((card) => card.categoryId === inbox.inboxId)
      .reduce((max, card) => Math.max(max, card.order), -1);
    let offset = 1;
    nextCards = nextCards.map((card) => {
      if (byId.has(card.categoryId)) return card;
      changed = true;
      return {
        ...card,
        categoryId: inbox.inboxId,
        order: maxOrder + offset++,
        updatedAt: now,
      };
    });
    changed = true;
  }

  return { categories: nextCategories, cards: nextCards, changed };
}

function fillMissingFavicons(cards: WebCard[]): WebCard[] {
  return cards.map((card) => {
    if (card.imageUrl || !card.url) return card;
    try {
      const hostname = new URL(card.url).hostname;
      return {
        ...card,
        imageUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
      };
    } catch {
      return card;
    }
  });
}

function migrateLegacyParents(categories: Category[]): Category[] {
  const knownParentIds = ["cat-work", "cat-ai", "cat-dev"];
  return categories.map((category) => {
    if (category.parentId || category.isParent) return category;
    if (knownParentIds.includes(category.id) || categories.some((child) => child.parentId === category.id)) {
      return { ...category, isParent: true };
    }
    return category;
  });
}

export async function runLocalMigrations(input: LocalMigrationInput): Promise<LocalMigrationResult> {
  const originalCards = input.cards;
  const originalCategories = input.categories;
  const originalSections = input.sections;
  const originalActiveSectionId = input.activeSectionId;

  let cards = input.workspaceResetAt > 0
    ? input.cards.filter((card) => (card.updatedAt || card.createdAt || 0) >= input.workspaceResetAt)
    : input.cards;
  let categories = input.workspaceResetAt > 0
    ? input.categories.filter((category) => category.id === "cat-inbox" || (category.updatedAt || category.createdAt || 0) >= input.workspaceResetAt)
    : input.categories;
  let sections = input.workspaceResetAt > 0
    ? input.sections.filter((section) =>
      section.id === DEFAULT_SECTION_ID || (section.updatedAt || section.createdAt || 0) >= input.workspaceResetAt
    )
    : input.sections;

  const storedVersion = await getDataSchemaVersion();
  const shouldRunVersionedMigrations = storedVersion < CURRENT_LOCAL_DATA_SCHEMA_VERSION;

  if (shouldRunVersionedMigrations) {
    sections = sections.map(normalizeSectionName);
  }
  if (sections.length === 0) {
    sections = [createDefaultSection()];
  }

  const sectionIds = new Set(sections.map((section) => section.id));
  const fallbackSectionId = getDefaultSectionId(sections);
  const activeSectionId = input.activeSectionId && sectionIds.has(input.activeSectionId)
    ? input.activeSectionId
    : fallbackSectionId;

  if (shouldRunVersionedMigrations) {
    if (categories.some((category) => !category.sectionId || !sectionIds.has(category.sectionId))) {
      categories = categories.map((category) => ({
        ...category,
        sectionId: category.sectionId && sectionIds.has(category.sectionId) ? category.sectionId : fallbackSectionId,
      }));
    }

    const visibilityRepair = repairMainDataVisibility(categories, cards, sections, activeSectionId);
    categories = visibilityRepair.categories;
    cards = visibilityRepair.cards;

    const localizedDescriptions = localizeCardDescriptions(cards);
    cards = localizedDescriptions.cards;

    cards = fillMissingFavicons(cards);
    categories = ensureSectionInboxes(categories, sections);

    const cleanedMainData = removeRecoveredMainData(categories, cards, activeSectionId);
    categories = cleanedMainData.categories;
    cards = cleanedMainData.cards;

    categories = migrateLegacyParents(categories);

    const visibleParentRepair = ensureParentDirectCardsAreVisible(categories, cards, activeSectionId);
    categories = visibleParentRepair.categories;
    cards = visibleParentRepair.cards;

    categories = ensureSectionInboxes(
      pruneEmptySeedTemplates(pruneEmptyDuplicateCategories(categories, cards), cards),
      sections
    );
  }

  const shouldSaveCards = !sameSnapshot(cards, originalCards);
  const shouldSaveCategories = !sameSnapshot(categories, originalCategories);
  const shouldSaveSections = !sameSnapshot(sections, originalSections);
  const shouldSaveActiveSection = activeSectionId !== originalActiveSectionId;

  if (shouldSaveCards || shouldSaveCategories || shouldSaveSections || shouldSaveActiveSection) {
    await withoutLocalChangeEvents(async () => {
      await Promise.all([
        shouldSaveCards ? saveCards(cards) : Promise.resolve(),
        shouldSaveCategories ? saveCategories(categories) : Promise.resolve(),
        shouldSaveSections ? saveSections(sections) : Promise.resolve(),
        shouldSaveActiveSection ? saveActiveSectionId(activeSectionId) : Promise.resolve(),
      ]);
    });
  }

  if (shouldRunVersionedMigrations) {
    await saveDataSchemaVersion(CURRENT_LOCAL_DATA_SCHEMA_VERSION);
  }

  return { cards, categories, sections, activeSectionId };
}

import {
  getCards,
  getCategories,
  getSections,
} from "@/lib/db";
import {
  getLocalDataSnapshots,
  restoreLocalDataSnapshot,
  type LocalSnapshotData,
  type LocalSnapshotEntry,
} from "@/lib/local-snapshots";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const DEFAULT_SECTION_ID = "section-default";

export type EmergencyRestoreResult =
  | { restored: false; shouldPrompt: false; reason: string }
  | {
    restored: false;
    shouldPrompt: true;
    source: "snapshot";
    snapshotId?: string;
    snapshotCreatedAt?: number;
    sections: number;
    categories: number;
    cards: number;
    sectionCardCounts: Record<string, number>;
  };

export type EmergencyRestoreApplyResult = {
  restored: true;
  source: "snapshot";
  snapshotId: string;
  snapshotCreatedAt?: number;
  sections: number;
  categories: number;
  cards: number;
  sectionCardCounts: Record<string, number>;
};

function countCardsBySection(data: Pick<LocalSnapshotData, "cards" | "categories" | "sections">): Record<string, number> {
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const counts: Record<string, number> = {};
  for (const card of data.cards) {
    const category = categoryById.get(card.categoryId);
    const sectionId = category?.sectionId || DEFAULT_SECTION_ID;
    counts[sectionId] = (counts[sectionId] || 0) + 1;
  }
  for (const section of data.sections) {
    counts[section.id] = counts[section.id] || 0;
  }
  return counts;
}

function sectionNameCounts(data: Pick<LocalSnapshotData, "cards" | "categories" | "sections">): Record<string, number> {
  const byId = new Map(data.sections.map((section) => [section.id, section.name]));
  const counts = countCardsBySection(data);
  return Object.fromEntries(
    Object.entries(counts).map(([sectionId, count]) => [byId.get(sectionId) || sectionId, count])
  );
}

function parentLinkCount(categories: Category[]): number {
  return categories.filter((category) => category.parentId).length;
}

function distributionStats(data: Pick<LocalSnapshotData, "cards" | "categories" | "sections">) {
  const counts = countCardsBySection(data);
  const totalCards = Math.max(1, data.cards.length);
  const sectionsWithCards = Object.values(counts).filter((count) => count > 0).length;
  const defaultShare = (counts[DEFAULT_SECTION_ID] || 0) / totalCards;
  const nonDefaultCards = Object.entries(counts)
    .filter(([sectionId]) => sectionId !== DEFAULT_SECTION_ID)
    .reduce((sum, [, count]) => sum + count, 0);
  return { counts, sectionsWithCards, defaultShare, nonDefaultCards };
}

function isHealthySnapshot(snapshot: LocalSnapshotEntry): boolean {
  const data = snapshot.data;
  if (data.cards.length < 40 || data.categories.length < 20 || data.sections.length < 3) return false;
  const stats = distributionStats(data);
  if (stats.sectionsWithCards < 2) return false;
  if (stats.nonDefaultCards < 12) return false;
  if (stats.defaultShare > 0.82) return false;
  return parentLinkCount(data.categories) >= 4;
}

function currentLooksCollapsed(
  cards: WebCard[],
  categories: Category[],
  sections: CollectionSection[]
): boolean {
  if (cards.length < 20 || categories.length < 8) return false;
  const data = {
    cards,
    categories,
    sections,
  };
  const stats = distributionStats(data);
  if (sections.length > 1 && stats.nonDefaultCards === 0) return true;
  return stats.defaultShare > 0.68 && stats.sectionsWithCards <= 2;
}

function snapshotRank(snapshot: LocalSnapshotEntry): number {
  const stats = distributionStats(snapshot.data);
  return (
    stats.sectionsWithCards * 1000
    + parentLinkCount(snapshot.data.categories) * 40
    + snapshot.data.categories.length * 3
    + snapshot.data.cards.length
    - Math.round(stats.defaultShare * 300)
  );
}

function pickLatestHealthySnapshot(snapshots: LocalSnapshotEntry[]): LocalSnapshotEntry | null {
  const healthy = snapshots
    .filter(isHealthySnapshot)
    .sort((a, b) => b.createdAt - a.createdAt || snapshotRank(b) - snapshotRank(a));
  return healthy[0] || null;
}

export async function restoreLatestHealthyWorkspaceIfNeeded(): Promise<EmergencyRestoreResult> {
  const [cards, categories, sections] = await Promise.all([
    getCards(),
    getCategories(),
    getSections(),
  ]);

  if (!currentLooksCollapsed(cards, categories, sections)) {
    return { restored: false, shouldPrompt: false, reason: "current-layout-not-collapsed" };
  }

  const snapshots = await getLocalDataSnapshots();
  const latestHealthy = pickLatestHealthySnapshot(snapshots);
  if (latestHealthy) {
    return {
      restored: false,
      shouldPrompt: true,
      source: "snapshot",
      snapshotId: latestHealthy.id,
      snapshotCreatedAt: latestHealthy.createdAt,
      sections: latestHealthy.data.sections.length,
      categories: latestHealthy.data.categories.length,
      cards: latestHealthy.data.cards.length,
      sectionCardCounts: sectionNameCounts(latestHealthy.data),
    };
  }

  return { restored: false, shouldPrompt: false, reason: "no-healthy-webcollect-snapshot-found" };
}

export async function restoreEmergencyWorkspaceSnapshot(snapshotId: string): Promise<EmergencyRestoreApplyResult> {
  const snapshots = await getLocalDataSnapshots();
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    throw new Error("Emergency restore snapshot not found");
  }

  await restoreLocalDataSnapshot(snapshot.id);
  return {
    restored: true,
    source: "snapshot",
    snapshotId: snapshot.id,
    snapshotCreatedAt: snapshot.createdAt,
    sections: snapshot.data.sections.length,
    categories: snapshot.data.categories.length,
    cards: snapshot.data.cards.length,
    sectionCardCounts: sectionNameCounts(snapshot.data),
  };
}

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
const EMERGENCY_RESTORE_MARKER = "webcollect_emergency_restore_v20260518";
const EMERGENCY_RESTORE_FORCE_VERSION = "snapshot-only-20260518-3";
export const EMERGENCY_RESTORE_PENDING_PUSH_KEY = "webcollect_emergency_restore_pending_push";

export type EmergencyRestoreResult =
  | { restored: false; reason: string }
  | {
    restored: true;
    source: "snapshot";
    snapshotId?: string;
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

function hasKnownCryptoGroupsInHome(categories: Category[]): boolean {
  const suspiciousTerms = [
    "bstocks",
    "rwa",
    "macro & stocks",
    "zksync",
    "zk era",
    "zk official",
    "coin",
    "defi",
    "airdrop",
    "layerzero",
    "stark",
  ];
  return categories.some((category) => {
    if ((category.sectionId || DEFAULT_SECTION_ID) !== DEFAULT_SECTION_ID) return false;
    const name = category.name.trim().toLowerCase();
    return suspiciousTerms.some((term) => name.includes(term));
  });
}

function isHealthySnapshot(snapshot: LocalSnapshotEntry): boolean {
  const data = snapshot.data;
  if (data.cards.length < 40 || data.categories.length < 20 || data.sections.length < 3) return false;
  const stats = distributionStats(data);
  if (stats.sectionsWithCards < 2) return false;
  if (stats.nonDefaultCards < 12) return false;
  if (stats.defaultShare > 0.82) return false;
  if (hasKnownCryptoGroupsInHome(data.categories)) return false;
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
  if (hasKnownCryptoGroupsInHome(categories)) return true;
  if (sections.length > 1 && stats.nonDefaultCards === 0) return true;
  const sectionById = new Map(sections.map((section) => [section.id, section.name.trim().toLowerCase()]));
  const counts = countCardsBySection(data);
  const hodlId = sections.find((section) => section.name.trim().toLowerCase() === "hodl")?.id;
  const fomId = sections.find((section) => section.name.trim().toLowerCase() === "fom")?.id;
  const cryptoInHome = categories.some((category) => {
    const sectionName = sectionById.get(category.sectionId || DEFAULT_SECTION_ID) || "主页";
    const name = category.name.trim().toLowerCase();
    return sectionName !== "hodl" && (
      name.includes("coin") ||
      name.includes("rwa") ||
      name.includes("stock") ||
      name.includes("zk") ||
      name.includes("defi")
    );
  });
  if (cryptoInHome && (counts[hodlId || ""] || 0) < 8) return true;
  if ((counts[hodlId || ""] || 0) === 0 && (counts[fomId || ""] || 0) === 0 && cards.length > 80) return true;
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

  const forceRestore = (() => {
    try {
      return localStorage.getItem(EMERGENCY_RESTORE_MARKER) !== EMERGENCY_RESTORE_FORCE_VERSION;
    } catch {
      return true;
    }
  })();

  if (!forceRestore && !currentLooksCollapsed(cards, categories, sections)) {
    return { restored: false, reason: "current-layout-not-collapsed" };
  }

  const snapshots = await getLocalDataSnapshots();
  const latestHealthy = pickLatestHealthySnapshot(snapshots);
  if (latestHealthy) {
    await restoreLocalDataSnapshot(latestHealthy.id);
    try {
      localStorage.setItem(EMERGENCY_RESTORE_MARKER, EMERGENCY_RESTORE_FORCE_VERSION);
      localStorage.setItem(EMERGENCY_RESTORE_PENDING_PUSH_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    return {
      restored: true,
      source: "snapshot",
      snapshotId: latestHealthy.id,
      snapshotCreatedAt: latestHealthy.createdAt,
      sections: latestHealthy.data.sections.length,
      categories: latestHealthy.data.categories.length,
      cards: latestHealthy.data.cards.length,
      sectionCardCounts: sectionNameCounts(latestHealthy.data),
    };
  }

  return { restored: false, reason: "no-healthy-webcollect-snapshot-found" };
}

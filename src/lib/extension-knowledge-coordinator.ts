import {
  CURRENT_SYNC_METADATA_VERSION,
  getCards,
  getCategories,
  getLocalSnapshotUpdatedAt,
  getSections,
  getSyncMetadataVersion,
} from "./db";
import {
  getExtensionKnowledgeLedger,
  planExtensionKnowledgeLedger,
  saveExtensionKnowledgeLedger,
  type ExtensionKnowledgeEmbeddingState,
  type ExtensionKnowledgeLedger,
} from "./extension-knowledge-ledger";
import {
  indexKnowledge,
  listEmbeddingStates,
  removeKnowledgeEmbedding,
  type KnowledgeIndexItem,
  type KnowledgeIndexResult,
  type KnowledgeRequestOptions,
  type RemoveKnowledgeEmbeddingOptions,
} from "./knowledge-client";
import { withStorageLock } from "./storage-lock";
import type { Category, CollectionSection, WebCard } from "./types";

const MAX_INDEX_BATCH_SIZE = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ExtensionKnowledgeCoordinatorStatus =
  | "aborted"
  | "baseline-created"
  | "idle"
  | "reconciled"
  | "stale-scope"
  | "workspace-changed"
  | "waiting-workspace";

export interface ExtensionKnowledgeCoordinatorResult {
  status: ExtensionKnowledgeCoordinatorStatus;
  indexedCount: number;
  deletedCount: number;
}

export interface ExtensionKnowledgeCoordinatorInput {
  userId: string;
  /** Prevents an obsolete hook generation from advancing a user's ledger. */
  isCurrent: () => boolean;
  /** Must reflect the currently authenticated user at the instant it is called. */
  getCurrentUserId: () => string | null;
  /** Consent timestamp separating zero-write baseline cards from new edits. */
  baselineCutoffAt?: number | null;
  signal?: AbortSignal;
}

export interface ExtensionKnowledgeCoordinatorDependencies {
  withStorageLock: <T>(name: string, operation: () => Promise<T>) => Promise<T>;
  getSyncMetadataVersion: (userId: string) => Promise<number>;
  getCards: () => Promise<WebCard[]>;
  getCategories: () => Promise<Category[]>;
  getSections: () => Promise<CollectionSection[]>;
  getLocalSnapshotUpdatedAt: () => Promise<number>;
  getLedger: (userId: string) => Promise<ExtensionKnowledgeLedger | null>;
  saveLedger: (userId: string, ledger: ExtensionKnowledgeLedger) => Promise<void>;
  listEmbeddingStates: (
    cardIds: readonly string[],
    options?: KnowledgeRequestOptions,
  ) => Promise<ExtensionKnowledgeEmbeddingState[]>;
  indexKnowledge: (
    items: readonly KnowledgeIndexItem[],
    options?: KnowledgeRequestOptions,
  ) => Promise<KnowledgeIndexResult[]>;
  removeKnowledgeEmbedding: (
    cardId: string,
    options?: RemoveKnowledgeEmbeddingOptions,
  ) => Promise<void>;
  currentSyncMetadataVersion: number;
}

const defaultDependencies: ExtensionKnowledgeCoordinatorDependencies = {
  withStorageLock,
  getSyncMetadataVersion,
  getCards,
  getCategories,
  getSections,
  getLocalSnapshotUpdatedAt,
  getLedger: getExtensionKnowledgeLedger,
  saveLedger: saveExtensionKnowledgeLedger,
  listEmbeddingStates,
  indexKnowledge,
  removeKnowledgeEmbedding,
  currentSyncMetadataVersion: CURRENT_SYNC_METADATA_VERSION,
};

function normalizedUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) throw new Error("Extension knowledge coordinator requires a user scope");
  return normalized;
}

function guardStatus(
  input: ExtensionKnowledgeCoordinatorInput,
  userId: string,
): "aborted" | "stale-scope" | null {
  if (input.signal?.aborted) return "aborted";
  try {
    if (!input.isCurrent() || input.getCurrentUserId() !== userId) return "stale-scope";
  } catch {
    return "stale-scope";
  }
  return null;
}

function result(
  status: ExtensionKnowledgeCoordinatorStatus,
  indexedCount = 0,
  deletedCount = 0,
): ExtensionKnowledgeCoordinatorResult {
  return { status, indexedCount, deletedCount };
}

function batches<T>(values: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function reconciliationCardIds(
  cards: readonly WebCard[],
  ledger: ExtensionKnowledgeLedger | null,
): string[] {
  const cardIds = new Set<string>();
  for (const card of cards) {
    if (UUID_PATTERN.test(card.id)) cardIds.add(card.id.toLowerCase());
  }
  for (const entry of ledger?.entries ?? []) cardIds.add(entry.cardId);
  return Array.from(cardIds).sort((left, right) => left.localeCompare(right));
}

function knowledgeWorkspaceSignature(
  cards: readonly WebCard[],
  categories: readonly Category[],
  sections: readonly CollectionSection[],
): string {
  return JSON.stringify([
    cards.map((card) => ({
      id: card.id,
      url: card.url,
      title: card.title,
      shortDesc: card.shortDesc,
      fullDesc: card.fullDesc,
      note: card.note,
      abbreviation: card.abbreviation,
      categoryId: card.categoryId,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId ?? "",
      sectionId: category.sectionId ?? "",
    })).sort((left, right) => left.id.localeCompare(right.id)),
    sections.map((section) => ({
      id: section.id,
      name: section.name,
    })).sort((left, right) => left.id.localeCompare(right.id)),
  ]);
}

function assertCompleteIndexResult(
  requested: readonly KnowledgeIndexItem[],
  indexed: readonly KnowledgeIndexResult[],
): void {
  const indexedKeys = new Set(indexed.map((item) => (
    `${item.cardId}:${item.source}:${item.contentHash}`
  )));
  if (requested.some((item) => !indexedKeys.has(
    `${item.cardId}:${item.source}:${item.contentHash}`,
  ))) {
    throw new Error("Extension knowledge index returned an incomplete result");
  }
}

/**
 * Reconciles only UUID-card saved fields from the extension. All authoritative
 * business reads and the ledger read happen after taking the per-user lock, so
 * a second tab cannot replay an obsolete snapshot. This module never fetches
 * public pages and never writes to the business database. URL changes confirm
 * the replacement saved-fields vector before pruning only public-html, and the
 * ledger advances last so an interrupted prune remains retryable.
 */
export async function reconcileExtensionKnowledge(
  rawInput: ExtensionKnowledgeCoordinatorInput,
  dependencyOverrides: Partial<ExtensionKnowledgeCoordinatorDependencies> = {},
): Promise<ExtensionKnowledgeCoordinatorResult> {
  const userId = normalizedUserId(rawInput.userId);
  const input = { ...rawInput, userId };
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const initialGuard = guardStatus(input, userId);
  if (initialGuard) return result(initialGuard);

  try {
    return await dependencies.withStorageLock(`knowledge-scope:${userId}`, async () => {
      const lockedGuard = guardStatus(input, userId);
      if (lockedGuard) return result(lockedGuard);

      const metadataVersion = await dependencies.getSyncMetadataVersion(userId);
      const metadataGuard = guardStatus(input, userId);
      if (metadataGuard) return result(metadataGuard);
      if (metadataVersion !== dependencies.currentSyncMetadataVersion) {
        return result("waiting-workspace");
      }

      const workspaceRevisionBefore = await dependencies.getLocalSnapshotUpdatedAt();
      const revisionGuard = guardStatus(input, userId);
      if (revisionGuard) return result(revisionGuard);

      // These reads deliberately remain sequential. A scope guard runs after
      // each await so an account switch cannot mix records from two moments.
      const cards = await dependencies.getCards();
      const cardsGuard = guardStatus(input, userId);
      if (cardsGuard) return result(cardsGuard);
      const categories = await dependencies.getCategories();
      const categoriesGuard = guardStatus(input, userId);
      if (categoriesGuard) return result(categoriesGuard);
      const sections = await dependencies.getSections();
      const sectionsGuard = guardStatus(input, userId);
      if (sectionsGuard) return result(sectionsGuard);
      const ledger = await dependencies.getLedger(userId);
      const ledgerGuard = guardStatus(input, userId);
      if (ledgerGuard) return result(ledgerGuard);
      const workspaceRevision = await dependencies.getLocalSnapshotUpdatedAt();
      const workspaceReadGuard = guardStatus(input, userId);
      if (workspaceReadGuard) return result(workspaceReadGuard);
      if (workspaceRevision !== workspaceRevisionBefore) return result("workspace-changed");
      const workspaceSignature = knowledgeWorkspaceSignature(cards, categories, sections);

      const verifyWorkspaceUnchanged = async (): Promise<
        "aborted" | "stale-scope" | "workspace-changed" | null
      > => {
        const beforeReadGuard = guardStatus(input, userId);
        if (beforeReadGuard) return beforeReadGuard;
        const revisionBeforeRead = await dependencies.getLocalSnapshotUpdatedAt();
        const [currentCards, currentCategories, currentSections] = await Promise.all([
          dependencies.getCards(),
          dependencies.getCategories(),
          dependencies.getSections(),
        ]);
        const revisionAfterRead = await dependencies.getLocalSnapshotUpdatedAt();
        const afterReadGuard = guardStatus(input, userId);
        if (afterReadGuard) return afterReadGuard;
        if (
          revisionBeforeRead !== workspaceRevision
          || revisionAfterRead !== workspaceRevision
          || knowledgeWorkspaceSignature(currentCards, currentCategories, currentSections)
            !== workspaceSignature
        ) return "workspace-changed";
        return null;
      };

      const embeddingStates: ExtensionKnowledgeEmbeddingState[] = [];
      for (const cardIdBatch of batches(reconciliationCardIds(cards, ledger), MAX_INDEX_BATCH_SIZE)) {
        const beforeCloudRead = guardStatus(input, userId);
        if (beforeCloudRead) return result(beforeCloudRead);
        embeddingStates.push(...await dependencies.listEmbeddingStates(cardIdBatch, {
          signal: input.signal,
          expectedUserId: userId,
        }));
        const afterCloudRead = guardStatus(input, userId);
        if (afterCloudRead) return result(afterCloudRead);
      }

      const plan = await planExtensionKnowledgeLedger({
        scopeId: userId,
        cards,
        categories,
        sections,
        ledger,
        embeddingStates,
        baselineCutoffAt: input.baselineCutoffAt,
      });
      const planGuard = guardStatus(input, userId);
      if (planGuard) return result(planGuard);

      if (
        plan.isInitialBaseline
        && plan.indexItems.length === 0
        && plan.deletedCardIds.length === 0
        && plan.prunePublicHtmlCardIds.length === 0
      ) {
        const beforeBaselineSave = await verifyWorkspaceUnchanged();
        if (beforeBaselineSave) return result(beforeBaselineSave);
        await dependencies.saveLedger(userId, plan.nextLedger);
        const afterBaselineSave = await verifyWorkspaceUnchanged();
        if (afterBaselineSave) return result(afterBaselineSave);
        return result("baseline-created");
      }

      let deletedCount = 0;
      for (const cardId of plan.deletedCardIds) {
        const beforeDelete = await verifyWorkspaceUnchanged();
        if (beforeDelete) return result(beforeDelete);
        await dependencies.removeKnowledgeEmbedding(cardId, {
          signal: input.signal,
          expectedUserId: userId,
        });
        deletedCount += 1;
        const afterDelete = await verifyWorkspaceUnchanged();
        if (afterDelete) return result(afterDelete);
      }

      let indexedCount = 0;
      const indexItems: KnowledgeIndexItem[] = plan.indexItems.map((item) => ({
        ...item,
        source: "saved-fields",
      }));
      for (const batch of batches(indexItems, MAX_INDEX_BATCH_SIZE)) {
        const beforeIndex = await verifyWorkspaceUnchanged();
        if (beforeIndex) return result(beforeIndex);
        const indexed = await dependencies.indexKnowledge(batch, {
          signal: input.signal,
          expectedUserId: userId,
        });
        assertCompleteIndexResult(batch, indexed);
        indexedCount += batch.length;
        const afterIndex = await verifyWorkspaceUnchanged();
        if (afterIndex) return result(afterIndex);
      }

      let prunedPublicHtmlCount = 0;
      for (const cardId of plan.prunePublicHtmlCardIds) {
        const beforePrune = await verifyWorkspaceUnchanged();
        if (beforePrune) return result(beforePrune);
        await dependencies.removeKnowledgeEmbedding(cardId, {
          source: "public-html",
          signal: input.signal,
          expectedUserId: userId,
        });
        prunedPublicHtmlCount += 1;
        const afterPrune = await verifyWorkspaceUnchanged();
        if (afterPrune) return result(afterPrune);
      }

      const beforeSave = await verifyWorkspaceUnchanged();
      if (beforeSave) return result(beforeSave);
      await dependencies.saveLedger(userId, plan.nextLedger);
      const afterSave = await verifyWorkspaceUnchanged();
      if (afterSave) return result(afterSave);
      return result(
        indexedCount === 0 && deletedCount === 0 && prunedPublicHtmlCount === 0
          ? "idle"
          : "reconciled",
        indexedCount,
        deletedCount,
      );
    });
  } catch (error) {
    if (input.signal?.aborted) return result("aborted");
    throw error;
  }
}

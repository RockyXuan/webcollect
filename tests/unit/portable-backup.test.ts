import localforage from "localforage";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MINDMAP_VIEW_STATE } from "@/components/mindmap/types";
import {
  getCards,
  getOrCreateSyncDeviceId,
  getSavedTabPacks,
  getTabPackOpenMode,
  saveCards,
  saveCategories,
  saveSavedTabPacks,
  saveSections,
  saveTabPackOpenMode,
} from "@/lib/db";
import { sha256Hex } from "@/lib/content-hash";
import { getLocalDataSnapshots } from "@/lib/local-snapshots";
import {
  listMindmapViewStates,
  loadMindmapViewState,
  saveMindmapViewState,
} from "@/lib/mindmap-view-state";
import {
  PORTABLE_BACKUP_LAST_EXPORT_KEY,
  createPortableBackup,
  getPortableBackupReminder,
  markPortableBackupExported,
  parsePortableBackup,
  restorePortableBackup,
  serializePortableBackup,
  validatePortableBackup,
} from "@/lib/portable-backup";
import { readCollectionViewMode, writeCollectionViewMode } from "@/lib/collection-view-mode";
import type { Category, CollectionSection, SavedTabPack, WebCard } from "@/lib/types";
import type { CloudSnapshotRecord } from "@/lib/cloud-sync-types";

const now = 1_777_500_000_000;
const section: CollectionSection = {
  id: "section-default",
  name: "主页",
  order: 0,
  createdAt: now,
  updatedAt: now,
};
const category: Category = {
  id: "category-backup",
  name: "备份分类",
  icon: "folder",
  color: "#4A7C59",
  order: 0,
  createdAt: now,
  updatedAt: now,
  sectionId: section.id,
};
const card: WebCard = {
  id: "card-backup",
  url: "https://example.com/backup",
  title: "备份网页",
  shortDesc: "",
  fullDesc: "",
  note: "",
  abbreviation: "B",
  imageUrl: "",
  categoryId: category.id,
  order: 0,
  createdAt: now,
  updatedAt: now,
};
const tabPack: SavedTabPack = {
  id: "tab-pack-backup",
  name: "工作台",
  icon: "layers",
  color: "#4A6FA5",
  order: 0,
  items: [{
    id: "tab-pack-item-backup",
    sourceCardId: card.id,
    url: card.url,
    title: card.title,
    order: 0,
    addedAt: now,
  }],
  createdAt: now,
  updatedAt: now,
  syncRevision: 3,
  syncDeviceId: "device-backup",
};

beforeEach(async () => {
  window.localStorage.clear();
  await localforage.clear();
  await localforage.createInstance({ name: "WebCollect", storeName: "webcollect_data" }).clear();
  await localforage.createInstance({ name: "WebCollect", storeName: "webcollect_wallpaper" }).clear();
  await saveSections([section]);
  await saveCategories([category]);
  await saveCards([card]);
});

describe("portable backup", () => {
  it("exports a readable, hashed package without credentials or derived knowledge data", async () => {
    writeCollectionViewMode("mindmap");
    await saveMindmapViewState(section.id, {
      ...DEFAULT_MINDMAP_VIEW_STATE,
      layout: "bilateral",
      updatedAt: now,
    });

    const backup = await createPortableBackup({ cloudStatus: "not-connected" });
    const text = serializePortableBackup(backup);
    const validated = await parsePortableBackup(text);

    expect(validated.preview.counts.cards).toBe(1);
    expect(validated.preview.counts.categories).toBe(1);
    expect(validated.preview.counts.mindmapViewStates).toBe(1);
    expect(validated.backup.collectionViewMode).toBe("mindmap");
    expect(text).not.toContain("accessToken");
    expect(text).not.toContain("refreshToken");
    expect(text).not.toContain("knowledge_index");
    expect(text).not.toContain("syncDirtySets");
  });

  it("exports and restores V2 tag packs and their global open mode", async () => {
    await saveSavedTabPacks([tabPack]);
    await saveTabPackOpenMode("first-active");
    const backup = await createPortableBackup({ cloudStatus: "not-connected" });

    expect(backup.schemaVersion).toBe(2);
    expect(backup.counts.tabPacks).toBe(1);
    expect(backup.workspace.savedTabPacks).toHaveLength(1);
    expect(backup.workspace.tabPackOpenMode).toBe("first-active");

    await saveSavedTabPacks([{ ...tabPack, name: "临时修改", updatedAt: now + 1 }]);
    await saveTabPackOpenMode("all-background");
    await restorePortableBackup(backup, { confirmed: true });

    expect((await getSavedTabPacks()).find((item) => item.id === tabPack.id)?.name).toBe("工作台");
    expect(await getTabPackOpenMode()).toBe("first-active");
  });

  it("accepts a valid V1 backup and does not erase tag packs that V1 could not contain", async () => {
    const current = await createPortableBackup({ cloudStatus: "not-connected" });
    const legacyBody = structuredClone(current) as unknown as Record<string, unknown>;
    delete legacyBody.contentHash;
    legacyBody.schemaVersion = 1;
    const workspace = legacyBody.workspace as Record<string, unknown>;
    delete workspace.savedTabPacks;
    delete workspace.tabPackOpenMode;
    const counts = legacyBody.counts as Record<string, unknown>;
    delete counts.tabPacks;
    const legacy = {
      ...legacyBody,
      contentHash: await sha256Hex(legacyBody),
    };

    await saveSavedTabPacks([tabPack]);
    await saveTabPackOpenMode("first-active");
    const validated = await validatePortableBackup(legacy);
    expect(validated.preview.counts.tabPacks).toBe(0);
    await restorePortableBackup(validated.backup, { confirmed: true });

    expect((await getSavedTabPacks()).map((item) => item.id)).toContain(tabPack.id);
    expect(await getTabPackOpenMode()).toBe("first-active");
  });

  it("rejects a modified file before any restore write", async () => {
    const backup = await createPortableBackup({ cloudStatus: "not-connected" });
    const modified = {
      ...backup,
      workspace: {
        ...backup.workspace,
        cards: [{ ...backup.workspace.cards[0], title: "被篡改" }],
      },
    };

    await expect(validatePortableBackup(modified)).rejects.toThrow(/SHA-256/);
    expect((await getCards())[0]?.title).toBe(card.title);
  });

  it("preserves an immutable historical version with legacy reference issues", async () => {
    const base = await createPortableBackup({ cloudStatus: "not-connected" });
    const legacyData = {
      ...base.workspace,
      cards: [{ ...card, categoryId: "missing-legacy-category" }],
    } as Partial<typeof base.workspace>;
    delete legacyData.pinnedBookmarkItems;
    const historicalSnapshot = {
      id: "snapshot-legacy-orphan",
      createdAt: now - 1,
      reason: "legacy-cloud-version",
      label: "旧云端版本",
      counts: {
        sections: 1,
        categories: 1,
        cards: 1,
        recycleBin: 0,
        warehouseCategories: 0,
        warehouseCards: 0,
        warehouseBatches: 0,
      },
      sectionNames: [section.name],
      sampleCategoryNames: [category.name],
      sampleCardTitles: [card.title],
      data: legacyData as typeof base.workspace,
    };
    const driveRecord: CloudSnapshotRecord = {
      snapshot: historicalSnapshot,
      kind: "system",
      source: "supabase-system",
      dayKey: "2026-07-01",
      cloudUpdatedAt: now - 1,
    };

    const backup = await createPortableBackup({
      cloudStatus: "included",
      driveSnapshots: [driveRecord],
    });
    const validated = await validatePortableBackup(backup);

    expect(validated.preview.counts.driveSnapshots).toBe(1);
    expect(validated.backup.driveSnapshots[0]?.snapshot.data.cards[0]?.categoryId)
      .toBe("missing-legacy-category");
  });

  it("still rejects reference issues in the active workspace", async () => {
    await saveCards([{ ...card, categoryId: "missing-current-category" }]);
    const backup = await createPortableBackup({ cloudStatus: "not-connected" });

    await expect(validatePortableBackup(backup)).rejects.toThrow(/不存在的分类/);
  });

  it("rejects an unsupported schema and a restore without explicit confirmation", async () => {
    const backup = await createPortableBackup({ cloudStatus: "not-connected" });
    await expect(validatePortableBackup({ ...backup, schemaVersion: 99 })).rejects.toThrow(/不支持/);

    await saveCards([{ ...card, title: "确认前保持不变", updatedAt: now + 1 }]);
    await expect(restorePortableBackup(backup, {
      confirmed: false as true,
    })).rejects.toThrow(/明确确认/);
    expect((await getCards())[0]?.title).toBe("确认前保持不变");
  });

  it("creates a safety version, restores data, preserves unrelated view keys and rotates device identity", async () => {
    writeCollectionViewMode("mindmap");
    await saveMindmapViewState(section.id, {
      ...DEFAULT_MINDMAP_VIEW_STATE,
      layout: "tree-down",
      updatedAt: now,
    });
    const backup = await createPortableBackup({ cloudStatus: "local-only" });
    const originalDeviceId = await getOrCreateSyncDeviceId();

    await saveCards([{ ...card, title: "恢复前临时修改", updatedAt: now + 1 }]);
    await saveMindmapViewState("unrelated-section", {
      ...DEFAULT_MINDMAP_VIEW_STATE,
      layout: "indent",
      updatedAt: now + 2,
    });
    writeCollectionViewMode("classic");

    const result = await restorePortableBackup(backup, { confirmed: true });

    expect((await getCards())[0]?.title).toBe(card.title);
    expect(await getOrCreateSyncDeviceId()).not.toBe(originalDeviceId);
    expect(result.rotatedDeviceIdentity).toBe(true);
    expect((await getLocalDataSnapshots()).some((item) => item.id === result.preImportSnapshotId)).toBe(true);
    expect((await loadMindmapViewState(section.id)).state.layout).toBe("tree-down");
    expect((await loadMindmapViewState("unrelated-section")).state.layout).toBe("indent");
    expect((await listMindmapViewStates()).map((item) => item.sectionId)).toEqual([
      section.id,
      "unrelated-section",
    ]);
    expect(readCollectionViewMode()).toBe("mindmap");
  });

  it("only marks the 30-day reminder after a successful download timestamp", () => {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(getPortableBackupReminder(now)).toEqual({ lastExportAt: null, due: true });

    markPortableBackupExported(now - thirtyDays + 1);
    expect(getPortableBackupReminder(now).due).toBe(false);

    markPortableBackupExported(now - thirtyDays);
    expect(getPortableBackupReminder(now).due).toBe(true);
    expect(window.localStorage.getItem(PORTABLE_BACKUP_LAST_EXPORT_KEY)).toBe(String(now - thirtyDays));
  });
});

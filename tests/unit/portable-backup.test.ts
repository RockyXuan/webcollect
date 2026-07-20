import localforage from "localforage";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MINDMAP_VIEW_STATE } from "@/components/mindmap/types";
import {
  getCards,
  getOrCreateSyncDeviceId,
  saveCards,
  saveCategories,
  saveSections,
} from "@/lib/db";
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
import type { Category, CollectionSection, WebCard } from "@/lib/types";

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

beforeEach(async () => {
  window.localStorage.clear();
  await localforage.clear();
  await localforage.createInstance({ name: "WebCollect", storeName: "webcollect_data" }).clear();
  await localforage.createInstance({ name: "WebCollect", storeName: "webcollect_wallpaper" }).clear();
  await saveSections([section]);
  await saveCategories([category]);
  await saveCards([card]);
});

describe("PortableBackupV1", () => {
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

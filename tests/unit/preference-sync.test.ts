import localforage from "localforage";
import { beforeEach, describe, expect, it } from "vitest";
import { resolvePreferenceByRevision } from "@/lib/preference-sync";
import {
  getSyncPreferenceRevisions,
  saveHiddenSites,
  savePinnedCategoryIds,
} from "@/lib/db";

beforeEach(async () => {
  await localforage.clear();
});

describe("preference revision conflict resolution", () => {
  it.each([
    ["unpin", [], ["category-a"]],
    ["unhide", [], [{ siteId: "site-a", hiddenAt: 1 }]],
    ["disable wallpaper", false, true],
  ])("preserves an explicit local %s when its revision is newer", (_label, localValue, cloudValue) => {
    const result = resolvePreferenceByRevision({
      localValue,
      localVersion: { syncRevision: 8, syncDeviceId: "device-local" },
      cloud: {
        value: cloudValue,
        syncRevision: 7,
        syncDeviceId: "device-cloud",
        updatedAt: 9_999_999_999_999,
      },
      legacyValue: cloudValue,
    });

    expect(result.value).toEqual(localValue);
    expect(result.source).toBe("local");
    expect(result.shouldPush).toBe(true);
  });

  it("pulls an explicit empty cloud value when the cloud revision is newer", () => {
    const result = resolvePreferenceByRevision({
      localValue: ["category-a"],
      localVersion: { syncRevision: 4, syncDeviceId: "device-local" },
      cloud: {
        value: [],
        syncRevision: 5,
        syncDeviceId: "device-cloud",
        updatedAt: 1,
      },
      legacyValue: ["category-a"],
    });

    expect(result.value).toEqual([]);
    expect(result.source).toBe("cloud");
    expect(result.shouldPush).toBe(false);
  });

  it("uses the existing compatibility merge while neither side has a revision", () => {
    const legacyMerged = ["local", "cloud"];
    const result = resolvePreferenceByRevision({
      localValue: ["local"],
      cloud: { value: ["cloud"], updatedAt: 200 },
      legacyValue: legacyMerged,
    });

    expect(result.value).toEqual(legacyMerged);
    expect(result.source).toBe("legacy");
  });

  it("records explicit empty local values and ignores no-op writes", async () => {
    await savePinnedCategoryIds(["category-a"]);
    const first = (await getSyncPreferenceRevisions()).pinnedCategoryIds;

    await savePinnedCategoryIds([]);
    const cleared = (await getSyncPreferenceRevisions()).pinnedCategoryIds;
    expect(cleared.syncRevision).toBeGreaterThan(first.syncRevision);

    await savePinnedCategoryIds([]);
    const noOp = (await getSyncPreferenceRevisions()).pinnedCategoryIds;
    expect(noOp).toEqual(cleared);

    await saveHiddenSites([]);
    const hidden = (await getSyncPreferenceRevisions()).hiddenSites;
    expect(hidden.syncRevision).toBeGreaterThan(cleared.syncRevision);
    expect(hidden.syncDeviceId).toBe(cleared.syncDeviceId);
  });
});

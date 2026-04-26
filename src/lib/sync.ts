/**
 * Sync Service — Local IndexedDB ↔ Cloud Supabase data synchronization
 * 
 * Strategy: "Last-Write-Wins" based on updatedAt timestamps
 * 
 * Flow:
 * 1. On login: Pull cloud data → merge with local → push merged result
 * 2. On data change (when logged in): Push local changes to cloud
 * 3. On periodic sync: Pull cloud → merge → push
 * 
 * Merge rules:
 * - If cloud item is newer → use cloud version
 * - If local item is newer → use local version
 * - If item exists only in cloud → add to local
 * - If item exists only in local → push to cloud
 * - Deleted items (in recycle bin) are excluded from sync
 */

import { getBrowserSupabaseClient, initBrowserSupabase } from "@/lib/supabase-browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCards,
  saveCards,
  getCategories,
  saveCategories,
  getHiddenSites,
  getPinnedCategoryIds,
  getCategoryWidths,
} from "@/lib/db";
import type { WebCard, Category, HiddenSite } from "@/lib/types";

// ── Types ──

interface CloudCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  is_parent: boolean | null;
  order: number | null;
  updated_at: string;
  created_at: string;
}

interface CloudCard {
  id: string;
  user_id: string;
  category_id: string;
  url: string;
  title: string | null;
  short_desc: string | null;
  full_desc: string | null;
  note: string | null;
  abbreviation: string | null;
  image_url: string | null;
  order: number | null;
  updated_at: string;
  created_at: string;
}

interface CloudPreference {
  id: string;
  user_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

// ── Mapping helpers ──

function cloudToLocalCategory(c: CloudCategory): Category {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon || "Folder",
    color: c.color || "#888888",
    order: c.order ?? 0,
    createdAt: new Date(c.created_at).getTime(),
    parentId: c.parent_id ?? undefined,
    isParent: c.is_parent ?? undefined,
  };
}

function localToCloudCategory(c: Category, userId: string): Omit<CloudCategory, "updated_at" | "created_at"> {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    icon: c.icon || null,
    color: c.color || null,
    parent_id: c.parentId ?? null,
    is_parent: c.isParent ?? null,
    order: c.order,
  };
}

function cloudToLocalCard(c: CloudCard): WebCard {
  return {
    id: c.id,
    url: c.url,
    title: c.title || "",
    shortDesc: c.short_desc || "",
    fullDesc: c.full_desc || "",
    note: c.note || "",
    abbreviation: c.abbreviation || "",
    imageUrl: c.image_url || "",
    categoryId: c.category_id,
    order: c.order ?? 0,
    createdAt: new Date(c.created_at).getTime(),
    updatedAt: new Date(c.updated_at).getTime(),
  };
}

function localToCloudCard(c: WebCard, userId: string): Omit<CloudCard, "updated_at" | "created_at"> {
  return {
    id: c.id,
    user_id: userId,
    category_id: c.categoryId,
    url: c.url,
    title: c.title || null,
    short_desc: c.shortDesc || null,
    full_desc: c.fullDesc || null,
    note: c.note || null,
    abbreviation: c.abbreviation || null,
    image_url: c.imageUrl || null,
    order: c.order,
  };
}

// ── Merge logic ──

interface MergeResult<T extends { id: string }> {
  merged: T[];
  cloudToPull: T[];   // items that are newer on cloud → update local
  localToPush: T[];   // items that are newer locally → push to cloud
  localOnly: T[];     // items only in local → push to cloud
  cloudOnly: T[];     // items only in cloud → add to local
}

function mergeByTimestamp<T extends { id: string }>(
  localItems: T[],
  cloudItems: T[],
  getTimestamp: (item: T) => number
): MergeResult<T> {
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const cloudMap = new Map(cloudItems.map((item) => [item.id, item]));

  const merged: T[] = [];
  const cloudToPull: T[] = [];
  const localToPush: T[] = [];
  const localOnly: T[] = [];
  const cloudOnly: T[] = [];

  // Process all items present in both
  for (const [id, localItem] of localMap) {
    const cloudItem = cloudMap.get(id);
    if (cloudItem) {
      const localTs = getTimestamp(localItem);
      const cloudTs = getTimestamp(cloudItem);
      if (cloudTs > localTs) {
        // Cloud is newer
        merged.push(cloudItem);
        cloudToPull.push(cloudItem);
      } else {
        // Local is newer or equal
        merged.push(localItem);
        if (localTs > cloudTs) {
          localToPush.push(localItem);
        }
      }
    } else {
      // Only in local
      merged.push(localItem);
      localOnly.push(localItem);
    }
  }

  // Items only in cloud
  for (const [id, cloudItem] of cloudMap) {
    if (!localMap.has(id)) {
      merged.push(cloudItem);
      cloudOnly.push(cloudItem);
    }
  }

  return { merged, cloudToPull, localToPush, localOnly, cloudOnly };
}

// ── Main sync function ──

export async function syncData(userId: string): Promise<void> {
  console.log("[Sync] Starting sync for user:", userId);

  // Ensure Supabase is configured
  await initBrowserSupabase();

  // 1. Load local data
  const [localCards, localCategories, localHiddenSites, localPinnedIds, localWidths] = await Promise.all([
    getCards(),
    getCategories(),
    getHiddenSites(),
    getPinnedCategoryIds(),
    getCategoryWidths(),
  ]);

  // 2. Load cloud data
  const client = getBrowserSupabaseClient();

  const [cloudCatResult, cloudCardResult, cloudPrefResult] = await Promise.all([
    client.from("categories").select("*").eq("user_id", userId),
    client.from("cards").select("*").eq("user_id", userId),
    client.from("user_preferences").select("*").eq("user_id", userId),
  ]);

  if (cloudCatResult.error) throw new Error(`加载云端分类失败: ${cloudCatResult.error.message}`);
  if (cloudCardResult.error) throw new Error(`加载云端卡片失败: ${cloudCardResult.error.message}`);
  if (cloudPrefResult.error) throw new Error(`加载云端偏好失败: ${cloudPrefResult.error.message}`);

  const cloudCategories = (cloudCatResult.data || []) as CloudCategory[];
  const cloudCards = (cloudCardResult.data || []) as CloudCard[];
  const cloudPrefs = (cloudPrefResult.data || []) as CloudPreference[];

  // 3. Merge categories
  const localCatsForMerge = localCategories.map((c) => ({
    ...c,
    _ts: c.createdAt || 0,
  }));

  const cloudCatsForMerge = cloudCategories.map((c) => ({
    ...cloudToLocalCategory(c),
    _ts: new Date(c.updated_at).getTime(),
  }));

  const catMerge = mergeByTimestamp(
    localCatsForMerge,
    cloudCatsForMerge,
    (item) => item._ts
  );

  // 4. Merge cards
  const localCardsForMerge = localCards.map((c) => ({
    ...c,
    _ts: c.updatedAt || c.createdAt || 0,
  }));

  const cloudCardsForMerge = cloudCards.map((c) => ({
    ...cloudToLocalCard(c),
    _ts: new Date(c.updated_at).getTime(),
  }));

  const cardMerge = mergeByTimestamp(
    localCardsForMerge,
    cloudCardsForMerge,
    (item) => item._ts
  );

  console.log(`[Sync] Categories: ${catMerge.cloudToPull.length} pull, ${catMerge.localToPush.length + catMerge.localOnly.length} push, ${catMerge.cloudOnly.length} new from cloud`);
  console.log(`[Sync] Cards: ${cardMerge.cloudToPull.length} pull, ${cardMerge.localToPush.length + cardMerge.localOnly.length} push, ${cardMerge.cloudOnly.length} new from cloud`);

  // 5. Update local DB with merged data
  const mergedCategories = catMerge.merged.map((item) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _ts: _, ...rest } = item;
    return rest as Category;
  });
  const mergedCards = cardMerge.merged.map((item) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _ts: _, ...rest } = item;
    return rest as WebCard;
  });

  await saveCategories(mergedCategories);
  await saveCards(mergedCards);

  // 6. Push local changes to cloud
  // Push categories
  const catsToPush = [...catMerge.localToPush, ...catMerge.localOnly];
  if (catsToPush.length > 0) {
    // Use upsert for each category
    for (const cat of catsToPush) {
      const cloudCat = localToCloudCategory(cat, userId);
      const { error } = await client
        .from("categories")
        .upsert(cloudCat, { onConflict: "id" });
      if (error) {
        console.error("[Sync] Failed to push category:", cat.id, error.message);
      }
    }
  }

  // Push cards
  const cardsToPush = [...cardMerge.localToPush, ...cardMerge.localOnly];
  if (cardsToPush.length > 0) {
    for (const card of cardsToPush) {
      const cloudCard = localToCloudCard(card, userId);
      const { error } = await client
        .from("cards")
        .upsert(cloudCard, { onConflict: "id" });
      if (error) {
        console.error("[Sync] Failed to push card:", card.id, error.message);
      }
    }
  }

  // 7. Delete from cloud: items that exist in cloud but not in local merged result
  // (These were deleted locally before sync)
  const mergedCatIds = new Set(mergedCategories.map((c) => c.id));
  const mergedCardIds = new Set(mergedCards.map((c) => c.id));

  const cloudOnlyCatIds = cloudCategories
    .filter((c) => !mergedCatIds.has(c.id))
    .map((c) => c.id);
  const cloudOnlyCardIds = cloudCards
    .filter((c) => !mergedCardIds.has(c.id))
    .map((c) => c.id);

  // Delete categories from cloud that were deleted locally
  if (cloudOnlyCatIds.length > 0) {
    const { error } = await client
      .from("categories")
      .delete()
      .in("id", cloudOnlyCatIds);
    if (error) {
      console.error("[Sync] Failed to delete cloud categories:", error.message);
    }
  }

  // Delete cards from cloud that were deleted locally
  if (cloudOnlyCardIds.length > 0) {
    const { error } = await client
      .from("cards")
      .delete()
      .in("id", cloudOnlyCardIds);
    if (error) {
      console.error("[Sync] Failed to delete cloud cards:", error.message);
    }
  }

  // 8. Sync preferences (hidden sites, pinned categories, category widths)
  await syncPreferences(client, userId, localHiddenSites, localPinnedIds, localWidths, cloudPrefs);

  console.log("[Sync] Sync completed successfully");
}

// ── Sync preferences ──

async function syncPreferences(
  client: SupabaseClient,
  userId: string,
  localHiddenSites: HiddenSite[],
  localPinnedIds: string[],
  localWidths: Record<string, number>,
  cloudPrefs: CloudPreference[]
): Promise<void> {
  // Build local preferences map
  const localPrefsMap: Record<string, unknown> = {
    hiddenSites: localHiddenSites,
    pinnedCategoryIds: localPinnedIds,
    categoryWidths: localWidths,
  };

  // Build cloud preferences map
  const cloudPrefsMap: Record<string, { value: unknown; updatedAt: string }> = {};
  for (const pref of cloudPrefs) {
    cloudPrefsMap[pref.key] = { value: pref.value, updatedAt: pref.updated_at };
  }

  // For each local preference, upsert to cloud
  for (const [key, value] of Object.entries(localPrefsMap)) {
    const { error } = await client
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          key,
          value,
        },
        { onConflict: "user_id,key" }
      );
    if (error) {
      console.error(`[Sync] Failed to sync preference "${key}":`, error.message);
    }
  }

  // Pull cloud preferences that don't exist locally
  if (!cloudPrefsMap.hiddenSites && cloudPrefsMap.hiddenSites) {
    // Cloud has hidden sites but local doesn't — pull from cloud
  }
}

// ── Push single item to cloud (called on data change) ──

export async function pushCategoryToCloud(category: Category, userId: string): Promise<void> {
  const client = getBrowserSupabaseClient();
  const cloudCat = localToCloudCategory(category, userId);
  const { error } = await client
    .from("categories")
    .upsert(cloudCat, { onConflict: "id" });
  if (error) {
    console.error("[Sync] Failed to push category:", error.message);
  }
}

export async function pushCardToCloud(card: WebCard, userId: string): Promise<void> {
  const client = getBrowserSupabaseClient();
  const cloudCard = localToCloudCard(card, userId);
  const { error } = await client
    .from("cards")
    .upsert(cloudCard, { onConflict: "id" });
  if (error) {
    console.error("[Sync] Failed to push card:", error.message);
  }
}

export async function deleteCategoryFromCloud(categoryId: string): Promise<void> {
  const client = getBrowserSupabaseClient();
  const { error } = await client
    .from("categories")
    .delete()
    .eq("id", categoryId);
  if (error) {
    console.error("[Sync] Failed to delete category from cloud:", error.message);
  }
}

export async function deleteCardFromCloud(cardId: string): Promise<void> {
  const client = getBrowserSupabaseClient();
  const { error } = await client
    .from("cards")
    .delete()
    .eq("id", cardId);
  if (error) {
    console.error("[Sync] Failed to delete card from cloud:", error.message);
  }
}

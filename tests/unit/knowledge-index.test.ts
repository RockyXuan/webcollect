import localforage from "localforage";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KnowledgeWorkspaceChangedError,
  runKnowledgeBuild,
  validateKnowledgeIndexReceipts,
  type KnowledgeIndexItem,
} from "../../src/lib/knowledge-builder";
import {
  buildKnowledgeDocument,
  buildKnowledgeSourceDocumentTexts,
  buildPublicHtmlKnowledgeDocument,
  getKnowledgeConsent,
  getKnowledgeBuildState,
  getKnowledgeCacheEntry,
  hashKnowledgeDocument,
  hashKnowledgeSourceDocuments,
  listKnowledgeCacheEntries,
  normalizeKnowledgeBuildState,
  saveKnowledgeBuildState,
  saveKnowledgeCacheEntry,
  saveKnowledgeConsent,
} from "../../src/lib/knowledge-index";
import type { WebCard } from "../../src/lib/types";

const knowledgeDb = localforage.createInstance({ name: "WebCollectSearch", storeName: "knowledge_index" });
const businessDb = localforage.createInstance({ name: "WebCollect", storeName: "webcollect_data" });
const testScope = "unit-knowledge-user";
const now = 1_777_777_777;

function card(id: string, url: string): WebCard {
  return {
    id,
    url,
    title: id === "card-a" ? "GitHub" : "视频下载器",
    shortDesc: "常用工具",
    fullDesc: "用于测试知识库构建",
    note: "个人备注",
    abbreviation: "Tool",
    imageUrl: "",
    categoryId: "cat-tools",
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

afterEach(async () => {
  const keys = await knowledgeDb.keys();
  await Promise.all(keys.filter((key) => key.includes(encodeURIComponent(testScope))).map((key) => knowledgeDb.removeItem(key)));
  await businessDb.removeItem("knowledge-unit-sentinel");
});

describe("knowledge index isolation", () => {
  it("builds a stable document and SHA-256 content hash", async () => {
    const input = {
      card: card("card-a", "https://github.com"),
      pathLabels: ["效率工具", "开发", "代码工具"],
      extractedText: "Host and review source code.",
    };
    const document = buildKnowledgeDocument(input);
    const sources = buildKnowledgeSourceDocumentTexts(input);

    expect(document).toContain("标题: GitHub");
    expect(document).toContain("路径: 效率工具 / 开发 / 代码工具");
    expect(document).not.toContain("Host and review source code.");
    expect(sources).toEqual([
      { source: "saved-fields", text: document },
      { source: "public-html", text: "公开网页正文: Host and review source code." },
    ]);
    expect(sources[1]?.text).not.toContain("GitHub");
    expect(sources[1]?.text).not.toContain("个人备注");
    expect(await hashKnowledgeDocument(document)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashKnowledgeDocument(document)).toBe(await hashKnowledgeDocument(document));
  });

  it("writes only to the separate derived database", async () => {
    await businessDb.setItem("knowledge-unit-sentinel", { cards: 364, dirty: false });
    await saveKnowledgeCacheEntry({
      schemaVersion: 1,
      scopeId: testScope,
      cardId: "card-a",
      sourceUrl: "https://github.com",
      resolvedUrl: "https://github.com",
      contentHash: "a".repeat(64),
      documentText: "derived only",
      extractedText: "",
      extraction: "saved-fields",
      fetchedAt: now,
      indexedAt: null,
    });

    expect(await getKnowledgeCacheEntry(testScope, "card-a")).toMatchObject({ documentText: "derived only" });
    expect(await listKnowledgeCacheEntries(testScope)).toHaveLength(1);
    expect(await businessDb.getItem("knowledge-unit-sentinel")).toEqual({ cards: 364, dirty: false });
  });

  it("caps each public embedding document at 6000 Unicode characters", () => {
    const document = buildPublicHtmlKnowledgeDocument("正文".repeat(4_000));

    expect(Array.from(document)).toHaveLength(6_000);
  });

  it("normalizes interrupted jobs to an explicit paused state", () => {
    const normalized = normalizeKnowledgeBuildState({
      version: 1,
      consentVersion: 1,
      runId: "run-old",
      status: "running",
      jobs: [{ cardId: "card-a", generation: 2, status: "fetching", attempts: 1 }],
      updatedAt: now,
    });

    expect(normalized?.status).toBe("paused");
    expect(normalized?.jobs[0]?.status).toBe("pending");
  });

  it("preserves a completed build that contains failed jobs", () => {
    const normalized = normalizeKnowledgeBuildState({
      version: 1,
      consentVersion: 1,
      runId: "run-with-errors",
      status: "complete-with-errors",
      jobs: [{ cardId: "card-a", generation: 1, status: "failed", attempts: 1 }],
      updatedAt: now,
    });

    expect(normalized?.status).toBe("complete-with-errors");
    expect(normalized?.jobs[0]?.status).toBe("failed");
  });

  it("stores explicit consent only in the derived knowledge database", async () => {
    await businessDb.setItem("knowledge-unit-sentinel", { cards: 364 });
    await saveKnowledgeConsent(testScope, now);

    expect(await getKnowledgeConsent(testScope)).toEqual({ version: 1, consentedAt: now });
    expect(await businessDb.getItem("knowledge-unit-sentinel")).toEqual({ cards: 364 });
  });
});

describe("knowledge build queue", () => {
  it("limits total concurrency to two and serializes the same host", async () => {
    const cards = [
      card("card-a", "https://same.example/a"),
      card("card-c", "https://other.example/c"),
      card("card-b", "https://same.example/b"),
    ];
    let active = 0;
    let maxActive = 0;
    const activeHosts = new Set<string>();
    let releaseFirstWave!: () => void;
    const firstWaveReady = new Promise<void>((resolve) => {
      releaseFirstWave = resolve;
    });

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards,
      pathLabelsByCardId: new Map(cards.map((item) => [item.id, ["主页", "工具"]])),
      fetchPublicPage: async (url) => {
        const host = new URL(url).hostname;
        expect(activeHosts.has(host)).toBe(false);
        activeHosts.add(host);
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (active === 2) releaseFirstWave();
        // Hold the first request long enough for the second worker to reach a
        // different host. A fixed 5 ms sleep was shorter than IndexedDB setup
        // under the full parallel suite and could falsely observe concurrency 1.
        await Promise.race([
          firstWaveReady,
          new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
        ]);
        active -= 1;
        activeHosts.delete(host);
        return { resolvedUrl: url, text: `Public details for ${host}` };
      },
      indexDocuments: async (items) => items.map((item) => ({
        cardId: item.cardId,
        contentHash: item.contentHash,
        indexedAt: now + 1,
        source: item.source,
      })),
    });

    expect(maxActive).toBe(2);
    expect(result.status).toBe("complete");
    expect(result.jobs.every((job) => job.status === "complete")).toBe(true);
    expect((await listKnowledgeCacheEntries(testScope)).every((entry) => entry.indexedAt === now + 1)).toBe(true);
  });

  it("falls back to saved fields when public HTML cannot be fetched", async () => {
    const target = card("card-a", "https://blocked.example");
    let indexedText = "";
    let indexedSource = "";

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "开发"]]]),
      fetchPublicPage: async () => {
        throw new Error("unsafe url policy");
      },
      indexDocuments: async (items: KnowledgeIndexItem[]) => {
        indexedText = items.find((item) => item.source === "saved-fields")?.text ?? "";
        indexedSource = items[0]?.source ?? "";
        return items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 2,
          source: item.source,
        }));
      },
    });

    expect(result.jobs[0]).toMatchObject({ status: "complete", failureCode: "unsafe-url" });
    expect(indexedText).toContain("标题: GitHub");
    expect(indexedSource).toBe("saved-fields");
    expect((await getKnowledgeCacheEntry(testScope, target.id))?.extraction).toBe("saved-fields");
    expect((await getKnowledgeBuildState(testScope))?.status).toBe("complete");
  });

  it("indexes prepared documents in batches of at most 32", async () => {
    const cards = Array.from({ length: 65 }, (_, index) =>
      card(`card-batch-${index}`, `https://batch-${index}.example`)
    );
    const batchSizes: number[] = [];

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards,
      pathLabelsByCardId: new Map(cards.map((item) => [item.id, ["主页", "批量"]])),
      indexDocuments: async (items: KnowledgeIndexItem[]) => {
        batchSizes.push(items.length);
        return items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 4,
          source: item.source,
        }));
      },
    });

    expect(batchSizes).toEqual([32, 32, 1]);
    expect(result.status).toBe("complete");
  });

  it("keeps dual-source Web indexing batches at or below 32 items", async () => {
    const cards = Array.from({ length: 17 }, (_, index) => (
      card(`card-dual-${index}`, `https://dual-${index}.example`)
    ));
    const batchSizes: number[] = [];

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards,
      pathLabelsByCardId: new Map(cards.map((item) => [item.id, ["主页", "双源"]])),
      fetchPublicPage: async (url) => ({ resolvedUrl: url, text: `Public body for ${url}` }),
      indexDocuments: async (items) => {
        batchSizes.push(items.length);
        return items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 4,
          source: item.source,
        }));
      },
    });

    expect(batchSizes).toEqual([32, 2]);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(32);
    expect(result.status).toBe("complete");
  });

  it("validates every returned source and hash without accepting duplicates or extras", () => {
    const requested: KnowledgeIndexItem[] = [
      { cardId: "card-a", source: "saved-fields", contentHash: "a".repeat(64), text: "saved" },
      { cardId: "card-a", source: "public-html", contentHash: "b".repeat(64), text: "public" },
    ];
    const partial = validateKnowledgeIndexReceipts(requested, [{
      cardId: "card-a",
      source: "saved-fields",
      contentHash: "a".repeat(64),
      indexedAt: now,
    }]);

    expect(partial).toEqual(new Map([[`card-a:saved-fields:${"a".repeat(64)}`, now]]));
    expect(() => validateKnowledgeIndexReceipts(requested, [
      {
        cardId: "card-a",
        source: "saved-fields",
        contentHash: "a".repeat(64),
        indexedAt: now,
      },
      {
        cardId: "card-a",
        source: "saved-fields",
        contentHash: "a".repeat(64),
        indexedAt: now,
      },
    ])).toThrow("duplicate-index-receipt");
    expect(() => validateKnowledgeIndexReceipts(requested, [{
      cardId: "card-a",
      source: "public-html",
      contentHash: "c".repeat(64),
      indexedAt: now,
    }])).toThrow("unexpected-index-receipt");
  });

  it("requires every expected source to match authoritative cloud state", async () => {
    const target = card("card-a", "https://cloud-state.example");
    const extractedText = "Authoritative public body.";
    const documents = await hashKnowledgeSourceDocuments(buildKnowledgeSourceDocumentTexts({
      card: target,
      pathLabels: ["主页", "云状态"],
      extractedText,
    }));
    const saved = documents.find((document) => document.source === "saved-fields")!;
    const indexedSources: string[] = [];

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "云状态"]]]),
      existingEmbeddingStates: [{
        cardId: target.id,
        source: saved.source,
        contentHash: saved.contentHash,
      }],
      fetchPublicPage: async (url) => ({ resolvedUrl: url, text: extractedText }),
      indexDocuments: async (items) => {
        indexedSources.push(...items.map((item) => item.source));
        return items.map((item) => ({
          cardId: item.cardId,
          source: item.source,
          contentHash: item.contentHash,
          indexedAt: now + 5,
        }));
      },
    });

    expect(indexedSources).toEqual(["public-html"]);
    expect(result.status).toBe("complete");
  });

  it("passes one normalized workspace guard per card and pauses before rethrowing a stale-workspace error", async () => {
    const target = card("card-a", "https://GUARD.example/path#stale-fragment");
    const indexDocuments = vi.fn(async (
      items: KnowledgeIndexItem[],
      guards: Array<{ cardId: string; sourceUrl: string; savedFieldsHash: string }>,
    ) => {
      expect(items.map((item) => item.source)).toEqual(["saved-fields", "public-html"]);
      expect(guards).toHaveLength(1);
      expect(guards[0]).toEqual({
        cardId: target.id,
        sourceUrl: "https://guard.example/path",
        savedFieldsHash: items.find((item) => item.source === "saved-fields")?.contentHash,
      });
      throw new KnowledgeWorkspaceChangedError();
    });

    await expect(runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "重验"]]]),
      fetchPublicPage: async (url) => ({ resolvedUrl: url, text: "Public guard body." }),
      indexDocuments,
    })).rejects.toBeInstanceOf(KnowledgeWorkspaceChangedError);

    expect(indexDocuments).toHaveBeenCalledTimes(1);
    expect(await getKnowledgeBuildState(testScope)).toMatchObject({
      status: "paused",
      runId: null,
      jobs: [{ cardId: target.id, status: "pending", attempts: 1 }],
    });
  });

  it("keeps saved fields and public HTML independent across extension and Web rebuilds", async () => {
    const initial = card("card-a", "https://alternating.example");
    const indexed: KnowledgeIndexItem[] = [];
    const indexDocuments = async (items: KnowledgeIndexItem[]) => {
      indexed.push(...items);
      return items.map((item) => ({
        cardId: item.cardId,
        source: item.source,
        contentHash: item.contentHash,
        indexedAt: now + indexed.length,
      }));
    };
    const baseOptions = {
      scopeId: testScope,
      cards: [initial],
      pathLabelsByCardId: new Map([[initial.id, ["主页", "工具"]]]),
      indexDocuments,
    };

    await runKnowledgeBuild(baseOptions);
    await runKnowledgeBuild({
      ...baseOptions,
      fetchPublicPage: async (url) => ({ resolvedUrl: url, text: "Public body without private fields." }),
    });
    const changed = { ...initial, note: "NEW PRIVATE NOTE", fullDesc: "NEW SAVED DESCRIPTION" };
    await runKnowledgeBuild({
      ...baseOptions,
      cards: [changed],
    });

    const savedItems = indexed.filter((item) => item.source === "saved-fields");
    const publicItems = indexed.filter((item) => item.source === "public-html");
    expect(savedItems).toHaveLength(2);
    expect(savedItems.at(-1)?.text).toContain("NEW PRIVATE NOTE");
    expect(savedItems.at(-1)?.text).toContain("NEW SAVED DESCRIPTION");
    expect(savedItems.at(-1)?.text).not.toContain("Public body without private fields.");
    expect(publicItems).toHaveLength(1);
    expect(publicItems[0]?.text).toContain("Public body without private fields.");
    expect(publicItems[0]?.text).not.toContain("个人备注");
    expect(publicItems[0]?.text).not.toContain("GitHub");
  });

  it("reports complete-with-errors when an embedding batch fails", async () => {
    const target = card("card-a", "https://index-failure.example");

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "失败测试"]]]),
      indexDocuments: async () => {
        throw new Error("rate-limited");
      },
    });

    expect(result.status).toBe("complete-with-errors");
    expect(result.jobs[0]).toMatchObject({ status: "failed", failureCode: "index-failed" });
    expect((await getKnowledgeBuildState(testScope))?.status).toBe("complete-with-errors");
  });

  it("preserves previously extracted public text when a refresh fetch fails", async () => {
    const target = card("card-a", "https://temporary-failure.example");
    await saveKnowledgeCacheEntry({
      schemaVersion: 1,
      scopeId: testScope,
      cardId: target.id,
      sourceUrl: target.url,
      resolvedUrl: target.url,
      contentHash: "b".repeat(64),
      documentText: "old document",
      extractedText: "Previously extracted public details.",
      extraction: "public-html",
      fetchedAt: now,
      indexedAt: now,
    });

    let indexedText = "";
    await runKnowledgeBuild({
      scopeId: testScope,
      cards: [{ ...target, note: "path or note changed" }],
      pathLabelsByCardId: new Map([[target.id, ["主页", "新路径"]]]),
      fetchPublicPage: async () => {
        throw new Error("network failure");
      },
      indexDocuments: async (items: KnowledgeIndexItem[]) => {
        indexedText = items.find((item) => item.source === "public-html")?.text ?? "";
        return items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 3,
          source: item.source,
        }));
      },
    });

    expect(indexedText).toContain("Previously extracted public details.");
    expect((await getKnowledgeCacheEntry(testScope, target.id))?.extraction).toBe("public-html");
  });

  it("keeps an existing same-URL cloud public vector when a cacheless fetch fails transiently", async () => {
    const target = card("card-a", "https://same-url-transient.example/page");
    const removeEmbedding = vi.fn(async () => undefined);
    const indexDocuments = vi.fn(async (items: KnowledgeIndexItem[]) => items.map((item) => ({
      cardId: item.cardId,
      contentHash: item.contentHash,
      indexedAt: now + 4,
      source: item.source,
    })));

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "临时失败"]]]),
      existingEmbeddingStates: [{
        cardId: target.id,
        source: "public-html",
        contentHash: "f".repeat(64),
      }],
      fetchPublicPage: async () => {
        throw new Error("network failure");
      },
      indexDocuments,
      removeEmbedding,
    });

    expect(result).toMatchObject({
      status: "complete-with-errors",
      jobs: [{ status: "complete", failureCode: "network" }],
    });
    expect(indexDocuments).toHaveBeenCalledTimes(1);
    expect(removeEmbedding).not.toHaveBeenCalled();
  });

  it("prunes an existing same-URL cloud public vector after a successful empty extraction", async () => {
    const target = card("card-a", "https://same-url-empty.example/page");
    const removeEmbedding = vi.fn(async () => undefined);
    const indexDocuments = vi.fn(async (items: KnowledgeIndexItem[]) => items.map((item) => ({
      cardId: item.cardId,
      contentHash: item.contentHash,
      indexedAt: now + 5,
      source: item.source,
    })));

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "空正文"]]]),
      existingEmbeddingStates: [{
        cardId: target.id,
        source: "public-html",
        contentHash: "e".repeat(64),
      }],
      fetchPublicPage: async (url) => ({ resolvedUrl: url, text: "" }),
      indexDocuments,
      removeEmbedding,
    });

    expect(result.status).toBe("complete");
    expect(removeEmbedding).toHaveBeenCalledWith(
      target.id,
      "public-html",
      expect.any(AbortSignal),
    );
  });

  it("never reuses extracted text or a resolved URL after the card URL changes", async () => {
    const previousUrl = "https://old.example/original";
    const current = card("card-a", "https://new.example/current");
    await saveKnowledgeCacheEntry({
      schemaVersion: 1,
      scopeId: testScope,
      cardId: current.id,
      sourceUrl: previousUrl,
      resolvedUrl: "https://old.example/redirected",
      contentHash: "c".repeat(64),
      documentText: "old document",
      extractedText: "Private-to-the-old-URL public details.",
      extraction: "public-html",
      fetchedAt: now,
      indexedAt: now,
    });

    let indexedText = "";
    const removeEmbedding = vi.fn(async () => undefined);
    await runKnowledgeBuild({
      scopeId: testScope,
      cards: [current],
      pathLabelsByCardId: new Map([[current.id, ["主页", "新地址"]]]),
      fetchPublicPage: async () => {
        throw new Error("network failure");
      },
      indexDocuments: async (items: KnowledgeIndexItem[]) => {
        indexedText = items.find((item) => item.source === "saved-fields")?.text ?? "";
        return items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 6,
          source: item.source,
        }));
      },
      removeEmbedding,
    });

    expect(indexedText).not.toContain("Private-to-the-old-URL public details.");
    const cached = await getKnowledgeCacheEntry(testScope, current.id);
    expect(cached).toMatchObject({
      sourceUrl: current.url,
      resolvedUrl: current.url,
      extractedText: "",
      extraction: "saved-fields",
      failureCode: "network",
    });
    expect(removeEmbedding).toHaveBeenCalledWith(
      current.id,
      "public-html",
      expect.any(AbortSignal),
    );
  });

  it("reindexes unchanged local content when the cloud vector was cascade-deleted", async () => {
    const target = card("card-a", "https://restored.example");
    const documentText = buildKnowledgeDocument({
      card: target,
      pathLabels: ["主页", "恢复"],
      extractedText: "",
    });
    const contentHash = await hashKnowledgeDocument(documentText);
    await saveKnowledgeCacheEntry({
      schemaVersion: 1,
      scopeId: testScope,
      cardId: target.id,
      sourceUrl: target.url,
      resolvedUrl: target.url,
      contentHash,
      documentText,
      extractedText: "",
      extraction: "saved-fields",
      fetchedAt: now,
      indexedAt: now,
    });
    const indexDocuments = vi.fn(async (items: KnowledgeIndexItem[]) => (
      items.map((item) => ({
        cardId: item.cardId,
        contentHash: item.contentHash,
        indexedAt: now + 30,
        source: item.source,
      }))
    ));

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "恢复"]]]),
      existingEmbeddingStates: [],
      indexDocuments,
    });

    expect(indexDocuments).toHaveBeenCalledTimes(1);
    expect(result.jobs[0]).toMatchObject({ status: "complete" });
    expect((await getKnowledgeCacheEntry(testScope, target.id))?.indexedAt).toBe(now + 30);
  });

  it("prunes only stale public HTML after a URL-change fallback and retries a failed prune", async () => {
    const current = card("card-a", "https://new-prune.example/current");
    await saveKnowledgeCacheEntry({
      schemaVersion: 1,
      scopeId: testScope,
      cardId: current.id,
      sourceUrl: "https://old-prune.example/original",
      resolvedUrl: "https://old-prune.example/final",
      contentHash: "e".repeat(64),
      documentText: "old public document",
      extractedText: "Old public details",
      extraction: "public-html",
      fetchedAt: now,
      indexedAt: now,
    });
    let pruneAttempts = 0;
    const removeEmbedding = vi.fn(async (_cardId, source: string) => {
      expect(source).toBe("public-html");
      pruneAttempts += 1;
      if (pruneAttempts === 1) throw new Error("temporary delete failure");
    });
    const indexDocuments = vi.fn(async (items: KnowledgeIndexItem[]) => (
      items.map((item) => ({
        cardId: item.cardId,
        contentHash: item.contentHash,
        indexedAt: now + 40 + pruneAttempts,
        source: item.source,
      }))
    ));
    const options = {
      scopeId: testScope,
      cards: [current],
      pathLabelsByCardId: new Map([[current.id, ["主页", "新地址"]]]),
      existingEmbeddingStates: [],
      fetchPublicPage: async () => {
        throw new Error("network failure");
      },
      indexDocuments,
      removeEmbedding,
    };

    const first = await runKnowledgeBuild(options);
    expect(first).toMatchObject({
      status: "complete-with-errors",
      jobs: [{ status: "failed", failureCode: "prune-public-html-failed" }],
    });
    expect((await getKnowledgeCacheEntry(testScope, current.id))?.indexedAt).toBeNull();

    const resumed = await runKnowledgeBuild({ ...options, resume: true });
    expect(resumed).toMatchObject({
      status: "complete-with-errors",
      jobs: [{ status: "complete", failureCode: "network", attempts: 2 }],
    });
    expect(removeEmbedding).toHaveBeenCalledTimes(2);
    expect(removeEmbedding).toHaveBeenLastCalledWith(
      current.id,
      "public-html",
      expect.any(AbortSignal),
    );
    expect((await getKnowledgeCacheEntry(testScope, current.id))?.indexedAt).toBeGreaterThan(now);
  });

  it("reuses extracted text only when normalized source URLs still identify the same page", async () => {
    const current = card("card-a", "https://same.example/path");
    await saveKnowledgeCacheEntry({
      schemaVersion: 1,
      scopeId: testScope,
      cardId: current.id,
      sourceUrl: "https://SAME.example:443/path#old-fragment",
      resolvedUrl: "https://same.example/final",
      contentHash: "d".repeat(64),
      documentText: "old document",
      extractedText: "Reusable details for the same normalized source URL.",
      extraction: "public-html",
      fetchedAt: now,
      indexedAt: now,
    });

    let indexedText = "";
    await runKnowledgeBuild({
      scopeId: testScope,
      cards: [{ ...current, note: "updated note" }],
      pathLabelsByCardId: new Map([[current.id, ["主页", "同一地址"]]]),
      fetchPublicPage: async () => {
        throw new Error("network failure");
      },
      indexDocuments: async (items) => {
        indexedText = items.find((item) => item.source === "public-html")?.text ?? "";
        return items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 7,
          source: item.source,
        }));
      },
    });

    expect(indexedText).toContain("Reusable details for the same normalized source URL.");
    expect((await getKnowledgeCacheEntry(testScope, current.id))?.resolvedUrl).toBe("https://same.example/final");
  });

  it("returns a safe paused state without processing when the signal is already aborted", async () => {
    const target = card("card-a", "https://already-aborted.example");
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");
    const fetchPublicPage = vi.fn();
    const indexDocuments = vi.fn();
    controller.abort();

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "暂停"]]]),
      fetchPublicPage,
      indexDocuments,
      signal: controller.signal,
    });

    expect(result).toMatchObject({
      status: "paused",
      runId: null,
      jobs: [{ cardId: target.id, status: "pending", attempts: 0 }],
    });
    expect(fetchPublicPage).not.toHaveBeenCalled();
    expect(indexDocuments).not.toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("preserves the full 364-card ledger while incrementally rebuilding only two targets", async () => {
    const cards = Array.from({ length: 364 }, (_, index) => (
      card(`card-ledger-${index}`, `https://ledger-${index}.example`)
    ));
    await saveKnowledgeBuildState(testScope, {
      version: 1,
      consentVersion: 1,
      runId: "initial-ledger",
      status: "complete",
      jobs: cards.map((item) => ({
        cardId: item.id,
        generation: 1,
        status: "complete" as const,
        attempts: 1,
      })),
      updatedAt: now,
    });
    const targets = [cards[17]!, cards[222]!];
    const fetchedUrls: string[] = [];

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards,
      targetCardIds: targets.map((item) => item.id),
      pathLabelsByCardId: new Map(cards.map((item) => [item.id, ["主页", "账本"]])),
      fetchPublicPage: async (url: string) => {
        fetchedUrls.push(url);
        return { resolvedUrl: url, text: `Refreshed ${url}` };
      },
      indexDocuments: async (items) => (
        items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 8,
          source: item.source,
        }))
      ),
    });

    expect(fetchedUrls.sort()).toEqual(targets.map((item) => item.url).sort());
    expect(result.jobs).toHaveLength(364);
    expect(new Set(result.jobs.map((job) => job.cardId)).size).toBe(364);
    for (const item of targets) {
      expect(result.jobs.find((job) => job.cardId === item.id)).toMatchObject({
        generation: 2,
        status: "complete",
        attempts: 2,
      });
    }
    expect(result.jobs.find((job) => job.cardId === cards[100]!.id)).toMatchObject({
      generation: 1,
      status: "complete",
      attempts: 1,
    });
  });

  it("adds a live card missing from the old ledger even when it is not an explicit target", async () => {
    const existing = card("card-a", "https://existing.example");
    const added = card("card-b", "https://added.example");
    await saveKnowledgeBuildState(testScope, {
      version: 1,
      consentVersion: 1,
      runId: "old-ledger",
      status: "complete",
      jobs: [
        { cardId: existing.id, generation: 3, status: "complete", attempts: 1 },
        { cardId: "card-no-longer-live", generation: 2, status: "failed", attempts: 2 },
      ],
      updatedAt: now,
    });
    const fetchedUrls: string[] = [];

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [existing, added],
      targetCardIds: [],
      pathLabelsByCardId: new Map([
        [existing.id, ["主页", "已有"]],
        [added.id, ["主页", "新增"]],
      ]),
      fetchPublicPage: async (url) => {
        fetchedUrls.push(url);
        return { resolvedUrl: url, text: "New live card details." };
      },
      indexDocuments: async (items) => items.map((item) => ({
        cardId: item.cardId,
        contentHash: item.contentHash,
        indexedAt: now + 9,
        source: item.source,
      })),
    });

    expect(fetchedUrls).toEqual([added.url]);
    expect(result.jobs).toEqual([
      { cardId: existing.id, generation: 3, status: "complete", attempts: 1 },
      { cardId: added.id, generation: 1, status: "complete", attempts: 1 },
    ]);
  });

  it("resume retries only non-complete jobs and never refetches a successful item", async () => {
    const successful = card("card-a", "https://successful.example");
    const failed = card("card-b", "https://failed.example");
    const cards = [successful, failed];
    const fetchCounts = new Map<string, number>();
    let indexCalls = 0;
    const options = {
      scopeId: testScope,
      cards,
      pathLabelsByCardId: new Map(cards.map((item) => [item.id, ["主页", "重试"]])),
      fetchPublicPage: async (url: string) => {
        fetchCounts.set(url, (fetchCounts.get(url) ?? 0) + 1);
        return { resolvedUrl: url, text: `Public details for ${url}` };
      },
      indexDocuments: async (items: KnowledgeIndexItem[]) => {
        indexCalls += 1;
        const completed = indexCalls === 1
          ? items.filter((item) => item.cardId === successful.id)
          : items;
        return completed.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 10 + indexCalls,
          source: item.source,
        }));
      },
    };

    const first = await runKnowledgeBuild(options);
    expect(first.status).toBe("complete-with-errors");
    expect(first.jobs.find((job) => job.cardId === successful.id)?.status).toBe("complete");
    expect(first.jobs.find((job) => job.cardId === failed.id)).toMatchObject({
      status: "failed",
      failureCode: "index-missing-result",
    });

    const resumed = await runKnowledgeBuild({ ...options, resume: true });
    expect(resumed.status).toBe("complete");
    expect(fetchCounts.get(successful.url)).toBe(1);
    expect(fetchCounts.get(failed.url)).toBe(2);
    expect(resumed.jobs.find((job) => job.cardId === successful.id)).toMatchObject({
      generation: 1,
      status: "complete",
      attempts: 1,
    });
    expect(resumed.jobs.find((job) => job.cardId === failed.id)).toMatchObject({
      generation: 2,
      status: "complete",
      attempts: 2,
    });
  });

  it("resume retries a transient public fetch failure even after saved fields were indexed", async () => {
    const target = card("card-a", "https://transient.example");
    let fetchCalls = 0;
    const indexedSources: string[] = [];
    const options = {
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "临时失败"]]]),
      fetchPublicPage: async (url: string) => {
        fetchCalls += 1;
        if (fetchCalls === 1) throw new Error("network failure");
        return { resolvedUrl: url, text: "Recovered public details." };
      },
      indexDocuments: async (items: KnowledgeIndexItem[]) => {
        indexedSources.push(...items.map((item) => item.source));
        return items.map((item) => ({
          cardId: item.cardId,
          contentHash: item.contentHash,
          indexedAt: now + 20 + fetchCalls,
          source: item.source,
        }));
      },
    };

    const first = await runKnowledgeBuild(options);
    expect(first).toMatchObject({
      status: "complete-with-errors",
      jobs: [{ status: "complete", failureCode: "network", attempts: 1 }],
    });

    const resumed = await runKnowledgeBuild({ ...options, resume: true });
    expect(fetchCalls).toBe(2);
    expect(resumed).toMatchObject({
      status: "complete",
      jobs: [{ status: "complete", attempts: 2 }],
    });
    expect(resumed.jobs[0]).not.toHaveProperty("failureCode");
    expect(indexedSources).toEqual(["saved-fields", "public-html"]);
    expect((await getKnowledgeCacheEntry(testScope, target.id))?.extractedText).toBe("Recovered public details.");
  });
});

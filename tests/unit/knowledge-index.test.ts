import localforage from "localforage";
import { afterEach, describe, expect, it } from "vitest";
import { runKnowledgeBuild } from "../../src/lib/knowledge-builder";
import {
  buildKnowledgeDocument,
  getKnowledgeConsent,
  getKnowledgeBuildState,
  getKnowledgeCacheEntry,
  hashKnowledgeDocument,
  listKnowledgeCacheEntries,
  normalizeKnowledgeBuildState,
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
    const document = buildKnowledgeDocument({
      card: card("card-a", "https://github.com"),
      pathLabels: ["效率工具", "开发", "代码工具"],
      extractedText: "Host and review source code.",
    });

    expect(document).toContain("标题: GitHub");
    expect(document).toContain("路径: 效率工具 / 开发 / 代码工具");
    expect(document).toContain("公开网页正文: Host and review source code.");
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

  it("caps the complete embedding document at 6000 Unicode characters", () => {
    const document = buildKnowledgeDocument({
      card: card("card-a", "https://github.com"),
      pathLabels: ["主页", "开发"],
      extractedText: "正文".repeat(4_000),
    });

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
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        activeHosts.delete(host);
        return { resolvedUrl: url, text: `Public details for ${host}` };
      },
      indexDocuments: async (items) => items.map((item) => ({ cardId: item.cardId, indexedAt: now + 1 })),
    });

    expect(maxActive).toBe(2);
    expect(result.status).toBe("complete");
    expect(result.jobs.every((job) => job.status === "complete")).toBe(true);
    expect((await listKnowledgeCacheEntries(testScope)).every((entry) => entry.indexedAt === now + 1)).toBe(true);
  });

  it("falls back to saved fields when public HTML cannot be fetched", async () => {
    const target = card("card-a", "https://blocked.example");
    let indexedText = "";

    const result = await runKnowledgeBuild({
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "开发"]]]),
      fetchPublicPage: async () => {
        throw new Error("unsafe url policy");
      },
      indexDocuments: async (items) => {
        indexedText = items[0]?.text ?? "";
        return items.map((item) => ({ cardId: item.cardId, indexedAt: now + 2 }));
      },
    });

    expect(result.jobs[0]).toMatchObject({ status: "complete", failureCode: "unsafe-url" });
    expect(indexedText).toContain("标题: GitHub");
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
      indexDocuments: async (items) => {
        batchSizes.push(items.length);
        return items.map((item) => ({ cardId: item.cardId, indexedAt: now + 4 }));
      },
    });

    expect(batchSizes).toEqual([32, 32, 1]);
    expect(result.status).toBe("complete");
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
      indexDocuments: async (items) => {
        indexedText = items[0]?.text ?? "";
        return items.map((item) => ({ cardId: item.cardId, indexedAt: now + 3 }));
      },
    });

    expect(indexedText).toContain("Previously extracted public details.");
    expect((await getKnowledgeCacheEntry(testScope, target.id))?.extraction).toBe("public-html");
  });

  it("does one bounded fetch attempt per run and retries transient failures only when resumed", async () => {
    const target = card("card-a", "https://retry.example");
    let fetchCalls = 0;
    const options = {
      scopeId: testScope,
      cards: [target],
      pathLabelsByCardId: new Map([[target.id, ["主页", "重试"]]]),
      fetchPublicPage: async (url: string) => {
        fetchCalls += 1;
        if (fetchCalls === 1) throw new Error("network failure");
        return { resolvedUrl: url, text: "Recovered public details." };
      },
      indexDocuments: async (items: Array<{ cardId: string }>) => (
        items.map((item) => ({ cardId: item.cardId, indexedAt: now + 5 }))
      ),
    };

    const first = await runKnowledgeBuild(options);
    expect(fetchCalls).toBe(1);
    expect(first.jobs[0]).toMatchObject({ status: "complete", failureCode: "network" });

    const resumed = await runKnowledgeBuild({ ...options, resume: true });
    expect(fetchCalls).toBe(2);
    expect(resumed.jobs[0]).toMatchObject({ status: "complete" });
    expect(resumed.jobs[0]?.failureCode).toBeUndefined();
    expect((await getKnowledgeCacheEntry(testScope, target.id))?.extractedText).toBe("Recovered public details.");
  });
});

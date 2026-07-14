import { describe, expect, it } from "vitest";

import {
  drainCaptureQueueItemsForWorkspace,
  withFloatingCaptureDrainLock,
  type CaptureQueueItem,
} from "@/lib/floating-capture";
import type { Category, CollectionSection, WebCard } from "@/lib/types";

const now = 1_777_100_000_000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("floating capture drain concurrency", () => {
  it("serializes simultaneous queue drains so one create request makes one destination", async () => {
    let queue: CaptureQueueItem[] = [{
      id: "capture-concurrent",
      createdAt: now,
      updatedAt: now,
      status: "pending",
      draft: {
        url: "https://example.com/concurrent-capture",
        title: "Concurrent capture",
        sourceType: "context-menu",
        destination: {
          createSectionName: "Runtime Audit",
          createGroupName: "Runtime Inbox",
        },
      },
    }];
    let workspace: {
      cards: WebCard[];
      categories: Category[];
      sections: CollectionSection[];
      activeSectionId: string;
    } = {
      cards: [],
      categories: [{
        id: "cat-inbox",
        name: "收集箱",
        icon: "inbox",
        color: "#888888",
        order: 99,
        createdAt: now,
        updatedAt: now,
        sectionId: "section-default",
      }],
      sections: [{
        id: "section-default",
        name: "主页",
        order: 0,
        createdAt: now,
        updatedAt: now,
      }],
      activeSectionId: "section-default",
    };
    let timestamp = now;

    const drain = () => withFloatingCaptureDrainLock(async () => {
      const queueAtStart = clone(queue);
      const workspaceAtStart = clone(workspace);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = drainCaptureQueueItemsForWorkspace(queueAtStart, workspaceAtStart, {
        now: () => ++timestamp,
        randomId: () => "fixed",
      });
      workspace = {
        cards: result.cards,
        categories: result.categories,
        sections: result.sections,
        activeSectionId: result.activeSectionId,
      };
      queue = result.queue;
    });

    await Promise.all([drain(), drain()]);

    expect(workspace.sections.filter((section) => section.name === "Runtime Audit")).toHaveLength(1);
    expect(workspace.categories.filter((category) => category.name === "Runtime Inbox")).toHaveLength(1);
    expect(workspace.cards).toHaveLength(1);
    expect(queue[0]?.status).toBe("imported");
  });
});

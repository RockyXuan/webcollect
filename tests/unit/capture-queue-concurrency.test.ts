import { describe, expect, it } from "vitest";
import {
  mergeCaptureQueueReplacement,
  type CaptureQueueItem,
} from "@/lib/floating-capture";

function item(id: string, status: CaptureQueueItem["status"]): CaptureQueueItem {
  return {
    id,
    draft: {
      url: `https://example.com/${id}`,
      title: id,
      description: "",
      sourceType: "context-menu",
    },
    createdAt: 100,
    updatedAt: status === "pending" ? 100 : 200,
    status,
  };
}

describe("floating capture queue replacement", () => {
  it("keeps captures added after the new-tab page read its queue", () => {
    const merged = mergeCaptureQueueReplacement(
      [item("capture-a", "pending"), item("capture-b", "pending")],
      ["capture-a"],
      [item("capture-a", "imported")]
    );

    expect(merged.map((entry) => [entry.id, entry.status])).toEqual([
      ["capture-a", "imported"],
      ["capture-b", "pending"],
    ]);
  });
});

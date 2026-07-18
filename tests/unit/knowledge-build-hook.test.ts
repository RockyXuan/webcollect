import { describe, expect, it } from "vitest";
import { liveCardIdsAreCloudReady } from "@/hooks/use-knowledge-build";
import type { WebCard } from "@/lib/types";

function card(id: string): WebCard {
  return {
    id,
    title: "Example",
    url: "https://example.com",
    shortDesc: "",
    fullDesc: "",
    note: "",
    abbreviation: "EX",
    imageUrl: "",
    categoryId: "cat-tools",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("knowledge build cloud readiness", () => {
  it.each([
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-42d3-a456-426614174000",
    "123E4567-E89B-52D3-B456-426614174000",
  ])("accepts a live card with supported UUID %s", (id) => {
    expect(liveCardIdsAreCloudReady([card(id)])).toBe(true);
  });

  it("requires at least one live card", () => {
    expect(liveCardIdsAreCloudReady([])).toBe(false);
  });

  it.each([
    "card-github",
    "123e4567-e89b-62d3-a456-426614174000",
    "123e4567-e89b-42d3-c456-426614174000",
    "123e4567e89b42d3a456426614174000",
    "",
  ])("rejects non-cloud-ready card ID %j", (id) => {
    expect(liveCardIdsAreCloudReady([card(id)])).toBe(false);
  });

  it("rejects the whole batch when even one card still has a local ID", () => {
    expect(liveCardIdsAreCloudReady([
      card("123e4567-e89b-42d3-a456-426614174000"),
      card("local-only-card"),
    ])).toBe(false);
  });
});

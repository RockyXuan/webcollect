import { describe, expect, it } from "vitest";
import { getCollectionViewportScale } from "@/lib/resolution-layout";

describe("responsive collection layout", () => {
  it.each([
    [2048, 1152],
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [390, 844],
  ])("does not globally zoom or crop the app at %ix%i", (width, height) => {
    expect(getCollectionViewportScale(width, height)).toBe(1);
  });
});

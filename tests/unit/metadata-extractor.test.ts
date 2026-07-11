import { describe, expect, it } from "vitest";
import { extractMetadataFromHtml } from "../../shared/metadata-extractor.js";
import { metadataFixtures } from "../fixtures/metadata-cases";

describe("shared metadata extractor", () => {
  it("keeps at least twenty representative HTML fixtures", () => {
    expect(metadataFixtures.length).toBeGreaterThanOrEqual(20);
  });

  for (const fixture of metadataFixtures) {
    it(fixture.name, () => {
      const result = extractMetadataFromHtml(fixture.html, fixture.url);
      expect(result).toMatchObject(fixture.expected);
    });
  }
});

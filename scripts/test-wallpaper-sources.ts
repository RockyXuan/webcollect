import assert from "node:assert/strict";
import {
  DEFAULT_WALLPAPER_ENABLED_CATEGORIES,
  fetchRemoteWallpapers,
} from "../src/lib/wallpaper-sources";

const requestedUrls: string[] = [];
let pageId = 1000;

function makeWikimediaPage(title: string, categoryIndex: number, itemIndex: number) {
  pageId += 1;
  const fileName = `${title.replace(/[^a-z0-9]+/gi, "_")}_${categoryIndex}_${itemIndex}.jpg`;
  return {
    pageid: pageId,
    title: `File:${fileName}`,
    imageinfo: [{
      url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${fileName}`,
      thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${fileName}/1920px-${fileName}`,
      width: 4200 + itemIndex,
      height: 2400,
      extmetadata: {
        LicenseShortName: { value: "CC BY-SA 4.0" },
        Artist: { value: "Wikimedia Commons" },
        Categories: { value: "Featured pictures on Wikimedia Commons" },
        Assessments: { value: "featured picture" },
      },
    }],
  };
}

async function fetchMock(input: string): Promise<Response> {
  requestedUrls.push(input);
  const url = new URL(input);
  assert.equal(url.hostname, "commons.wikimedia.org");
  assert.equal(url.searchParams.get("gsrlimit"), "30");
  const query = url.searchParams.get("gsrsearch") || "landscape";
  const categoryIndex = requestedUrls.length;
  const pages = Object.fromEntries(
    Array.from({ length: 3 }, (_, index) => {
      const page = makeWikimediaPage(query.split(/\s+/)[0] || "landscape", categoryIndex, index);
      return [String(page.pageid), page];
    })
  );
  return {
    ok: true,
    async json() {
      return { query: { pages } };
    },
  } as Response;
}

async function main(): Promise<void> {
  const remote = await fetchRemoteWallpapers(
    DEFAULT_WALLPAPER_ENABLED_CATEGORIES,
    1_777_200_000_000,
    fetchMock
  );

  assert.equal(
    requestedUrls.length,
    DEFAULT_WALLPAPER_ENABLED_CATEGORIES.length,
    "Wikimedia refresh should request each enabled category independently"
  );
  assert.equal(
    requestedUrls.some((url) => url.includes("images-api.nasa.gov")),
    false,
    "default Auto Mix categories should not call NASA"
  );
  assert.ok(remote.length >= 10, `mocked Wikimedia refresh should yield at least 10 usable remote images, got ${remote.length}`);
  assert.ok(remote.every((item) => item.provider === "wikimedia"));
  assert.ok(remote.every((item) => item.width >= 3000 && item.height >= 1600));

  console.log("wallpaper source tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

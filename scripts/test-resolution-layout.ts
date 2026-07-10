import assert from "node:assert/strict";
import { getCollectionViewportScale } from "../src/lib/resolution-layout";

for (const [width, height] of [[2048, 1152], [1440, 900], [1280, 720], [1024, 768], [390, 844]]) {
  assert.equal(
    getCollectionViewportScale(width, height),
    1,
    `the responsive layout should not globally zoom at ${width}x${height}`
  );
}

console.log("resolution layout tests passed");

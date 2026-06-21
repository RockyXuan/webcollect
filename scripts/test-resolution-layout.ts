import assert from "node:assert/strict";
import {
  COLLECTION_CANVAS_HEIGHT,
  COLLECTION_CANVAS_WIDTH,
  getCollectionViewportScale,
  MAX_COLLECTION_VIEWPORT_SCALE,
  MIN_COLLECTION_VIEWPORT_SCALE,
} from "../src/lib/resolution-layout";

assert.equal(
  getCollectionViewportScale(COLLECTION_CANVAS_WIDTH, COLLECTION_CANVAS_HEIGHT),
  MAX_COLLECTION_VIEWPORT_SCALE,
  "baseline canvas should render at 1x"
);

assert.equal(COLLECTION_CANVAS_WIDTH, 2048, "collection layout should keep a fixed baseline width");
assert.equal(COLLECTION_CANVAS_HEIGHT, 1152, "collection layout should keep a fixed baseline height");

assert.equal(
  getCollectionViewportScale(COLLECTION_CANVAS_WIDTH * 2, COLLECTION_CANVAS_HEIGHT * 2),
  MAX_COLLECTION_VIEWPORT_SCALE,
  "large monitors should not stretch the fixed layout beyond the baseline"
);

assert.equal(
  getCollectionViewportScale(1536, 864),
  0.75,
  "smaller laptop-like viewports should scale the fixed layout down proportionally"
);

assert.equal(
  getCollectionViewportScale(2048, 900),
  0.781,
  "height-constrained screens should keep the same first-view composition"
);

assert.equal(
  getCollectionViewportScale(320, 480),
  MIN_COLLECTION_VIEWPORT_SCALE,
  "very small viewports should stop at the readability floor"
);

assert.equal(
  getCollectionViewportScale(Number.NaN, Number.NaN),
  MAX_COLLECTION_VIEWPORT_SCALE,
  "invalid viewport measurements should fail open at baseline scale"
);

console.log("resolution layout tests passed");

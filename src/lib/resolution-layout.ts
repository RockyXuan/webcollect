export const COLLECTION_CANVAS_WIDTH = 2048;
export const COLLECTION_CANVAS_HEIGHT = 1152;
export const MIN_COLLECTION_VIEWPORT_SCALE = 0.62;
export const MAX_COLLECTION_VIEWPORT_SCALE = 1;

export function getCollectionViewportScale(viewportWidth: number, viewportHeight: number): number {
  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight)) {
    return MAX_COLLECTION_VIEWPORT_SCALE;
  }

  const widthRatio = Math.max(1, viewportWidth) / COLLECTION_CANVAS_WIDTH;
  const heightRatio = Math.max(1, viewportHeight) / COLLECTION_CANVAS_HEIGHT;
  const rawScale = Math.min(widthRatio, heightRatio, MAX_COLLECTION_VIEWPORT_SCALE);
  const clamped = Math.max(MIN_COLLECTION_VIEWPORT_SCALE, Math.min(MAX_COLLECTION_VIEWPORT_SCALE, rawScale));
  return Math.round(clamped * 1000) / 1000;
}

// Parallax background layers (PRD reqs 68, 70): pure functions, so the
// scrolling can be unit-tested. Positions are in tiles, relative to the
// view's left edge.

// Allowance for rounding error when deciding whether a copy is needed.
const EPS = 1e-9;

/**
 * How far a layer has scrolled for a camera at `cameraX` (req 68): the
 * camera's movement times the layer's scroll factor. 0 never moves; 1 moves
 * with the level.
 */
export const layerOffset = (cameraX, scrollFactor) => cameraX * scrollFactor;

/**
 * The size in tiles a layer image is drawn at: scaled to the view's height,
 * keeping its proportions. Layers don't move up or down.
 */
export function layerSize(imagePixelWidth, imagePixelHeight, viewHeight) {
  return { width: viewHeight * (imagePixelWidth / imagePixelHeight), height: viewHeight };
}

/**
 * Where to draw a layer's copies, as x positions relative to the view's left
 * edge. Without `repeat`, one copy, where the level starts, moved by the
 * layer's offset. With `repeat` (req 70), copies side by side, from the one at
 * or just left of the view's left edge to the one reaching past its right edge.
 */
export function layerCopies({ cameraX, scrollFactor, imageWidth, viewWidth, repeat }) {
  if (imageWidth <= 0) return [];
  const origin = -layerOffset(cameraX, scrollFactor);
  if (!repeat) return [origin];
  const first = origin - Math.ceil(origin / imageWidth - EPS) * imageWidth;
  const copies = [];
  for (let x = first; x < viewWidth - EPS; x += imageWidth) copies.push(x);
  return copies;
}

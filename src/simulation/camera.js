// The visible area and the camera (PRD reqs 6, 66-67): pure functions, so the
// scaling and following can be unit-tested.
//
// Sizes are in tiles unless they say pixels.

/**
 * How much of the world a viewport shows (req 6): { scale, width, height }.
 * `height` is the fixed visible height in tiles (display.json), `scale` is
 * pixels per tile (the same both ways, so the world is never stretched), and
 * `width` is the visible width in tiles, which grows with a wider viewport.
 * A viewport with no height (a minimised window) shows nothing.
 */
export function visibleArea(viewportWidth, viewportHeight, visibleHeight) {
  if (viewportHeight <= 0) return { scale: 0, width: 0, height: visibleHeight };
  const scale = viewportHeight / visibleHeight;
  return { scale, width: viewportWidth / scale, height: visibleHeight };
}

/**
 * Where the view starts along one axis: centred on `centre` but kept inside
 * [0, levelSize]; or, if the view is at least as big as the level, with the
 * level centred in it (a negative start: space before and after the level).
 */
function viewStart(centre, viewSize, levelSize) {
  if (viewSize >= levelSize) return (levelSize - viewSize) / 2;
  return Math.min(Math.max(centre - viewSize / 2, 0), levelSize - viewSize);
}

/**
 * The world position of the view's top-left corner, { x, y } (reqs 66-67):
 * it follows the centre of `target` (the player), never shows outside the
 * level, and centres a level smaller than the view (`area`, from visibleArea).
 */
export function cameraFor(level, target, area) {
  return {
    x: viewStart(target.x + target.width / 2, area.width, level.width),
    y: viewStart(target.y + target.height / 2, area.height, level.height),
  };
}

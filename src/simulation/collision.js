// Moving boxes through a level without passing through solid things.
//
// A box is { x, y, width, height } in tiles, (x, y) being its top-left corner,
// with y increasing downwards. Movement is resolved along X first, then Y.
// Each axis is checked over the whole distance moved, so a fast box can't pass
// through a thin wall in one step. Boxes that only touch (share an edge) don't
// overlap, so a box resting on the ground can slide along it without snagging.
//
// Solid: tiles whose type is solid, the level's left and right edges, and any
// extra solid boxes passed in. The top and bottom of the level are open.

// Allowance for floating-point error when deciding whether edges touch or overlap.
const EPS = 1e-9;

function isSolidTile(level, column, row) {
  // Rows above and below the level are reached when a box is partly outside it.
  // moveBox never asks about columns outside the level (the side edges are
  // walls and the loops are clamped); those checks are defensive only.
  if (row < 0 || row >= level.height || column < 0 || column >= level.width) return false;
  return level.tileTypes[level.grid[row][column]]?.solid === true;
}

/** The first and last cell index a span from `start` to `end` overlaps (touching edges don't count). */
function cellRange(start, end) {
  return { first: Math.floor(start + EPS), last: Math.ceil(end - EPS) - 1 };
}

/** True if spans [aStart, aEnd] and [bStart, bEnd] overlap by more than a touch. */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd - EPS && aEnd > bStart + EPS;
}

/**
 * How far a box can move along one axis. `along` names the axis moved
 * ('x' or 'y'); the box's extent on the other axis decides which tiles and
 * boxes are in the way. Returns { position, blocked }.
 */
function sweep(level, box, delta, solidBoxes, along) {
  const isX = along === 'x';
  const pos = isX ? box.x : box.y;
  const size = isX ? box.width : box.height;
  const across = isX ? cellRange(box.y, box.y + box.height) : cellRange(box.x, box.x + box.width);
  const acrossStart = isX ? box.y : box.x;
  const acrossEnd = acrossStart + (isX ? box.height : box.width);
  const cellCount = isX ? level.width : level.height;
  const solidAt = (cell, other) => (isX ? isSolidTile(level, cell, other) : isSolidTile(level, other, cell));
  const lineIsSolid = (cell) => {
    for (let other = across.first; other <= across.last; other++) if (solidAt(cell, other)) return true;
    return false;
  };
  const boxStart = (b) => (isX ? b.x : b.y);
  const boxEnd = (b) => (isX ? b.x + b.width : b.y + b.height);
  const boxAcrossOverlaps = (b) =>
    isX ? overlaps(acrossStart, acrossEnd, b.y, b.y + b.height) : overlaps(acrossStart, acrossEnd, b.x, b.x + b.width);

  if (delta > 0) {
    const front = pos + size;
    const target = front + delta;
    let limit = isX ? Math.min(target, level.width) : target;   // the right edge is a wall
    const lastCell = Math.min(Math.ceil(target - EPS) - 1, cellCount - 1);
    for (let cell = Math.max(Math.ceil(front - EPS), 0); cell <= lastCell; cell++) {
      // `cell` is always nearer than `limit`: it is before the target and inside the level.
      if (lineIsSolid(cell)) { limit = cell; break; }
    }
    for (const b of solidBoxes) {
      if (boxAcrossOverlaps(b) && boxStart(b) >= front - EPS && boxStart(b) < limit) limit = boxStart(b);
    }
    return { position: limit - size, blocked: limit < target - EPS };
  }

  if (delta < 0) {
    const front = pos;
    const target = front + delta;
    let limit = isX ? Math.max(target, 0) : target;   // the left edge is a wall
    const lastCell = Math.max(Math.floor(target + EPS), 0);
    for (let cell = Math.min(Math.floor(front + EPS) - 1, cellCount - 1); cell >= lastCell; cell--) {
      // `cell + 1` is always nearer than `limit`: it is past the target and inside the level.
      if (lineIsSolid(cell)) { limit = cell + 1; break; }
    }
    for (const b of solidBoxes) {
      if (boxAcrossOverlaps(b) && boxEnd(b) <= front + EPS && boxEnd(b) > limit) limit = boxEnd(b);
    }
    return { position: limit, blocked: limit > target + EPS };
  }

  return { position: pos, blocked: false };
}

/**
 * Moves `box` by (dx, dy), stopping at solid tiles, the level's side edges,
 * and `solidBoxes`. Returns { x, y, hitLeft, hitRight, hitCeiling, onGround }.
 * `onGround` is true when downward movement was stopped by something solid.
 * The box passed in is not changed.
 */
export function moveBox(level, box, dx, dy, solidBoxes = []) {
  const alongX = sweep(level, box, dx, solidBoxes, 'x');
  const moved = { ...box, x: alongX.position };
  const alongY = sweep(level, moved, dy, solidBoxes, 'y');
  return {
    x: alongX.position,
    y: alongY.position,
    hitLeft: dx < 0 && alongX.blocked,
    hitRight: dx > 0 && alongX.blocked,
    hitCeiling: dy < 0 && alongY.blocked,
    onGround: dy > 0 && alongY.blocked,
  };
}

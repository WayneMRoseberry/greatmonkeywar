// Tests for tile collision (task 3.5; groundwork for PRD req 23).
//
// moveBox(level, box, dx, dy, solidBoxes) moves a box by (dx, dy), stopping
// at solid tiles, the level's side edges, and any extra solid boxes. Grids
// are drawn in each test; '#' is solid ground, '~' is a non-solid tile.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { moveBox } from '../../src/simulation/collision.js';

const TILE_TYPES = {
  '#': { solid: true, color: '#000000' },
  '~': { solid: false, color: '#0000ff' },
};

function levelFrom(grid) {
  return { width: grid[0].length, height: grid.length, grid, tileTypes: TILE_TYPES };
}

const box = (x, y, width = 1, height = 1) => ({ x, y, width, height });

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

const NO_HITS = { hitLeft: false, hitRight: false, hitCeiling: false, onGround: false };

function hits(result) {
  const { hitLeft, hitRight, hitCeiling, onGround } = result;
  return { hitLeft, hitRight, hitCeiling, onGround };
}

describe('free movement', () => {
  test('in open space a box moves the full distance and hits nothing', () => {
    const level = levelFrom(['......', '......', '......']);
    const start = box(1, 0.5, 0.5, 0.5);
    const dx = 2;
    const dy = 1;
    const result = moveBox(level, start, dx, dy);
    assertNear(result.x, start.x + dx, 'x');
    assertNear(result.y, start.y + dy, 'y');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('non-solid tiles do not block', () => {
    const level = levelFrom(['......', '..~~..', '......']);
    const start = box(0, 1);
    const dx = 4;   // straight through the two '~' tiles
    const result = moveBox(level, start, dx, 0);
    assertNear(result.x, start.x + dx, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });
});

describe('walls, floors, and ceilings', () => {
  test('moving right into a wall stops flush against it', () => {
    const wallColumn = 4;
    const level = levelFrom(['....#.', '....#.', '######']);
    const width = 0.8;
    const result = moveBox(level, box(1, 0, width, 1.5), 3, 0);
    assertNear(result.x, wallColumn - width, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });

  test('moving left into a wall stops flush against it', () => {
    const wallColumn = 1;
    const level = levelFrom(['.#....', '.#....', '######']);
    const result = moveBox(level, box(4, 0, 0.8, 1.5), -3, 0);
    assertNear(result.x, wallColumn + 1, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitLeft: true });
  });

  test('falling onto the ground stops on top of it and is on the ground', () => {
    const groundRow = 3;
    const level = levelFrom(['....', '....', '....', '####']);
    const height = 1.4;
    const result = moveBox(level, box(1, 0, 0.8, height), 0, 2);
    assertNear(result.y, groundRow - height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('jumping into a ceiling stops just below it', () => {
    const ceilingRow = 0;
    const level = levelFrom(['####', '....', '....', '####']);
    const result = moveBox(level, box(1, 1.5, 0.8, 1), 0, -1);
    assertNear(result.y, ceilingRow + 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitCeiling: true });
  });

  test('a box resting on the ground stays put when pulled down, and is on the ground', () => {
    const groundRow = 2;
    const height = 1;
    const level = levelFrom(['....', '....', '####']);
    const resting = box(1, groundRow - height, 0.8, height);
    const result = moveBox(level, resting, 0, 0.01);
    assertNear(result.y, resting.y, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('a box resting on the ground slides sideways without snagging on the floor', () => {
    const groundRow = 2;
    const height = 1;
    const level = levelFrom(['......', '......', '######']);
    const resting = box(1, groundRow - height, 0.8, height);
    const dx = 3;
    const result = moveBox(level, resting, dx, 0);
    assertNear(result.x, resting.x + dx, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a box exactly level with a gap fits through it', () => {
    // A one-tile-high gap at row 1, between ceiling and floor.
    const level = levelFrom(['######', '......', '######']);
    const result = moveBox(level, box(0, 1, 1, 1), 4, 0);
    assertNear(result.x, 4, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });
});

describe('order: X is resolved before Y', () => {
  test('a diagonal move past a corner slides along X first, then lands on the block', () => {
    //   row 0  ....     box starts at column 1, row 0 and moves (+1, +1)
    //   row 1  ..#.
    // X first: moves right to column 2 (row 0 is clear), then falls onto the
    // block at row 1 and stops: ends at (2, 0) on the ground.
    // (Y first would drop to row 1 at column 1, then be blocked moving right.)
    const level = levelFrom(['....', '..#.', '....']);
    const result = moveBox(level, box(1, 0), 1, 1);
    assertNear(result.x, 2, 'x');
    assertNear(result.y, 0, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });
});

describe('level edges', () => {
  test('the left edge acts as a wall', () => {
    const level = levelFrom(['....', '####']);
    const result = moveBox(level, box(0.5, 0), -2, 0);
    assertNear(result.x, 0, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitLeft: true });
  });

  test('the right edge acts as a wall', () => {
    const level = levelFrom(['....', '####']);
    const width = 0.8;
    const result = moveBox(level, box(2, 0, width, 1), 5, 0);
    assertNear(result.x, level.width - width, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });

  test('the top is open: a box can move above row 0', () => {
    const level = levelFrom(['....', '####']);
    const start = box(1, 0);
    const dy = -3;
    const result = moveBox(level, start, 0, dy);
    assertNear(result.y, start.y + dy, 'y');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('the bottom is open: with no ground, a box falls out of the level (a pit)', () => {
    const level = levelFrom(['....', '#..#']);
    const start = box(1.5, 0);   // above the gap in the bottom row
    const dy = 5;
    const result = moveBox(level, start, 0, dy);
    assertNear(result.y, start.y + dy, 'y');
    assert.ok(result.y > level.height);
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a box above the top row still hits walls that reach the top', () => {
    const wallColumn = 2;
    const level = levelFrom(['..#.', '..#.', '####']);
    const result = moveBox(level, box(0, -0.5, 1, 1), 3, 0);   // half above the level
    assertNear(result.x, wallColumn - 1, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });
});

describe('small moves within one cell (as with gravity each frame)', () => {
  test('a small move right that stays within the same cell', () => {
    const level = levelFrom(['....', '####']);
    const start = box(1.2, 0, 0.5, 1);   // right edge at 1.7
    const dx = 0.2;                       // right edge reaches 1.9: still in column 1
    const result = moveBox(level, start, dx, 0);
    assertNear(result.x, start.x + dx, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a small fall in open air that stays within the same cell', () => {
    const level = levelFrom(['....', '....', '####']);
    const start = box(1, 0.2, 1, 0.5);   // bottom edge at 0.7
    const dy = 0.1;                       // bottom edge reaches 0.8: still in row 0
    const result = moveBox(level, start, 0, dy);
    assertNear(result.y, start.y + dy, 'y');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a small fall that just reaches the ground lands on it', () => {
    const groundRow = 3;
    const level = levelFrom(['....', '....', '....', '####']);
    const height = 1;
    const start = box(1, groundRow - height - 0.1, 1, height);   // 0.1 above the ground
    const result = moveBox(level, start, 0, 0.3);
    assertNear(result.y, groundRow - height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('a small move left that stays within the same cell, hitting nothing', () => {
    const level = levelFrom(['....', '####']);
    const start = box(2.5, 0, 1, 1);   // left edge at 2.5
    const dx = -0.3;                    // left edge reaches 2.2: still in column 2
    const result = moveBox(level, start, dx, 0);
    assertNear(result.x, start.x + dx, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });
});

describe('arriving exactly at something is not a hit (nothing stopped the move)', () => {
  test('moving right to exactly touch a wall', () => {
    const wallColumn = 4;
    const level = levelFrom(['....#.', '######']);
    const start = box(1, 0, 1, 1);
    const dx = wallColumn - (start.x + start.width);   // right edge ends exactly at the wall
    const result = moveBox(level, start, dx, 0);
    assertNear(result.x, wallColumn - start.width, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('moving left to exactly reach the left edge of the level', () => {
    const level = levelFrom(['....', '####']);
    const start = box(1, 0, 1, 1);
    const result = moveBox(level, start, -start.x, 0);
    assertNear(result.x, 0, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('falling to exactly touch the ground: not on the ground until the next pull down', () => {
    const groundRow = 3;
    const level = levelFrom(['....', '....', '....', '####']);
    const start = box(1, 0, 1, 1);
    const dy = groundRow - (start.y + start.height);
    const result = moveBox(level, start, 0, dy);
    assertNear(result.y, groundRow - start.height, 'y');
    assert.deepEqual(hits(result), NO_HITS);
  });
});

describe('rounding error in positions', () => {
  // Twenty steps of 0.1 add up to 2.0000000000000004, a hair past the edge at 2,
  // the kind of drift that builds up over many frames of movement.
  const DRIFTED = Array(20).fill(0.1).reduce((sum, v) => sum + v, 0);
  test('the drifted value really is just past 2', () => assert.ok(DRIFTED > 2 && DRIFTED - 2 < 1e-12));

  test('a box drifted a hair into the ground stays on it when pulled down', () => {
    const groundRow = 3;
    const height = 1;
    const level = levelFrom(['....', '....', '....', '####']);
    const start = box(1, DRIFTED, 1, height);   // bottom edge a hair below the ground's top
    const result = moveBox(level, start, 0, 0.5);
    assertNear(result.y, groundRow - height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('a box drifted a hair into the ground slides along it without snagging', () => {
    const level = levelFrom(['......', '......', '......', '######']);
    const start = box(1, DRIFTED, 1, 1);
    const dx = 2;
    const result = moveBox(level, start, dx, 0);
    assertNear(result.x, start.x + dx, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a box drifted a hair into a wall is still stopped by it', () => {
    const wallColumn = 3;
    const level = levelFrom(['...#..', '######']);
    const start = box(DRIFTED, 0, 1, 1);   // right edge a hair past the wall's left side
    const result = moveBox(level, start, 1, 0);
    assertNear(result.x, wallColumn - start.width, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });

  test('a box whose top edge is a hair into the ceiling row still fits through a one-tile gap', () => {
    // Three steps of 0.1 added to 0.7 give 0.9999999999999999, a hair short of 1.
    const justBelowOne = [0.1, 0.1, 0.1].reduce((sum, v) => sum + v, 0.7);
    assert.ok(justBelowOne < 1 && 1 - justBelowOne < 1e-12);
    const level = levelFrom(['######', '......', '######']);
    const start = box(0, justBelowOne, 1, 1);   // top edge a hair inside row 0, the ceiling
    const dx = 4;
    const result = moveBox(level, start, dx, 0);
    assertNear(result.x, start.x + dx, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a box drifted a hair into the side of a solid box can still fall past it', () => {
    const groundRow = 4;
    const level = levelFrom(['....', '....', '....', '....', '####']);
    const crate = box(2, 2, 1, 1);
    const start = box(DRIFTED - 1, 0, 1, 1);   // right edge a hair past the crate's left side
    const result = moveBox(level, start, 0, 5, [crate]);
    assertNear(result.y, groundRow - start.height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });
});

describe('blocked on both axes in one move', () => {
  test('moving diagonally into a corner hits the wall and lands on the ground', () => {
    const wallColumn = 5;
    const groundRow = 2;
    const level = levelFrom(['.....#', '.....#', '######']);
    const start = box(1, 0, 1, 1);
    const result = moveBox(level, start, 6, 3);
    assertNear(result.x, wallColumn - start.width, 'x');
    assertNear(result.y, groundRow - start.height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true, onGround: true });
  });

  test('moving diagonally up-left into a corner hits the wall and the ceiling', () => {
    const wallColumn = 0;
    const ceilingRow = 0;
    const level = levelFrom(['######', '#.....', '#.....', '######']);
    const start = box(3, 2, 1, 1);
    const result = moveBox(level, start, -5, -5);
    assertNear(result.x, wallColumn + 1, 'x');
    assertNear(result.y, ceilingRow + 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitLeft: true, hitCeiling: true });
  });
});

describe('above, below, and beside the level', () => {
  test('falling from entirely above the level lands on the ground', () => {
    const groundRow = 2;
    const level = levelFrom(['...', '...', '###']);
    const start = box(1, -3, 1, 1);   // bottom edge at -2: entirely above row 0
    const result = moveBox(level, start, 0, 5);
    assertNear(result.y, groundRow - start.height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('falling from just above the level (bottom edge between -1 and 0) lands on the ground', () => {
    const groundRow = 2;
    const level = levelFrom(['...', '...', '###']);
    const start = box(1, -1.5, 1, 1);   // bottom edge at -0.5
    const result = moveBox(level, start, 0, 4);
    assertNear(result.y, groundRow - start.height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('moving up from exactly below the level hits the underside of the bottom row at once', () => {
    const level = levelFrom(['....', '####']);
    const start = box(1, level.height, 1, 1);   // top edge exactly at the bottom of the level
    const result = moveBox(level, start, 0, -1);
    assertNear(result.y, start.y, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitCeiling: true });
  });

  test('moving up from entirely below the level hits the underside of the bottom row', () => {
    const bottomRow = 1;
    const level = levelFrom(['....', '####']);
    const start = box(1, 3, 1, 1);   // top edge at 3: below the level, which is 2 rows high
    const result = moveBox(level, start, 0, -2.5);
    assertNear(result.y, bottomRow + 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitCeiling: true });
  });

  test('jumping up through several open rows stops at the ceiling', () => {
    const ceilingRow = 0;
    const level = levelFrom(['####', '....', '....', '....']);
    const start = box(1, 3, 1, 1);
    const result = moveBox(level, start, 0, -3);
    assertNear(result.y, ceilingRow + 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitCeiling: true });
  });

  test('a wide box hits a ceiling tile that is only above part of it', () => {
    const ceilingRow = 0;
    const level = levelFrom(['.#..', '....', '....']);
    const start = box(0, 1, 2, 1);   // spans columns 0 and 1; only column 1 has a ceiling
    const result = moveBox(level, start, 0, -1);
    assertNear(result.y, ceilingRow + 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitCeiling: true });
  });

  test('a box partly below the bottom of the level still hits walls in the bottom row', () => {
    const wallColumn = 3;
    const level = levelFrom(['....', '#..#']);
    const start = box(1, 1.5, 1, 1);   // spans row 1 and the space below the level
    const result = moveBox(level, start, 1.5, 0);
    assertNear(result.x, wallColumn - start.width, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });
});

describe('fast movement', () => {
  test('a big move right does not pass through a one-tile wall', () => {
    const wallColumn = 3;
    const level = levelFrom(['...#......', '##########']);
    const result = moveBox(level, box(0, 0), 8, 0);
    assertNear(result.x, wallColumn - 1, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });

  test('a big fall does not pass through a one-tile floor', () => {
    const floorRow = 3;
    const level = levelFrom(['....', '....', '....', '####', '....', '....']);
    const result = moveBox(level, box(1, 0), 0, 5);
    assertNear(result.y, floorRow - 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });
});

describe('extra solid boxes (for stacking later)', () => {
  test('a box lands on top of a solid box', () => {
    const level = levelFrom(['....', '....', '....', '####']);
    const crate = box(1, 2, 1, 1);
    const result = moveBox(level, box(1.1, 0, 0.8, 1), 0, 2, [crate]);
    assertNear(result.y, crate.y - 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('a box moving sideways is stopped by a solid box', () => {
    const level = levelFrom(['......', '######']);
    const crate = box(4, 0, 1, 1);
    const width = 0.8;
    const result = moveBox(level, box(0, 0, width, 1), 5, 0, [crate]);
    assertNear(result.x, crate.x - width, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });

  test('a solid box that is only touched at a corner does not block', () => {
    const level = levelFrom(['......', '......', '######']);
    const crate = box(3, 1, 1, 1);   // its top-left corner touches the moving box's bottom-right
    const start = box(2, 0, 1, 1);
    const result = moveBox(level, start, 2, 0, [crate]);
    assertNear(result.x, start.x + 2, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('with several boxes in the way, the nearest one stops a sideways move, whatever their order', () => {
    const level = levelFrom(['........', '########']);
    const near = box(3, 0, 1, 1);
    const far = box(5, 0, 1, 1);
    const width = 0.8;
    for (const boxes of [[near, far], [far, near]]) {
      const result = moveBox(level, box(0, 0, width, 1), 7, 0, boxes);
      assertNear(result.x, near.x - width, 'x');
      assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
    }
  });

  test('falling onto a stack, the box lands on the top one, whatever their order', () => {
    const level = levelFrom(['...', '...', '...', '...', '###']);
    const bottom = box(1, 3, 1, 1);
    const top = box(1, 2, 1, 1);
    const height = 1;
    for (const boxes of [[bottom, top], [top, bottom]]) {
      const result = moveBox(level, box(1, 0, 1, height), 0, 3, boxes);
      assertNear(result.y, top.y - height, 'y');
      assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
    }
  });

  test('moving left into a solid box stops flush against it', () => {
    const level = levelFrom(['......', '######']);
    const crate = box(1, 0, 1, 1);
    const result = moveBox(level, box(4, 0, 0.8, 1), -4, 0, [crate]);
    assertNear(result.x, crate.x + crate.width, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitLeft: true });
  });

  test('jumping up into the underside of a solid box stops below it', () => {
    const level = levelFrom(['....', '....', '....', '####']);
    const crate = box(1, 0, 1, 1);
    const result = moveBox(level, box(1, 2, 1, 1), 0, -2, [crate]);
    assertNear(result.y, crate.y + crate.height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitCeiling: true });
  });

  test('a box behind the mover is ignored', () => {
    const level = levelFrom(['........', '########']);
    const behind = box(0, 0, 1, 1);
    const start = box(3, 0, 1, 1);
    const dx = 2;
    const result = moveBox(level, start, dx, 0, [behind]);
    assertNear(result.x, start.x + dx, 'x');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a box beyond a nearer wall is ignored: the wall stops the move', () => {
    const wallColumn = 3;
    const level = levelFrom(['...#....', '########']);
    const beyond = box(5, 0, 1, 1);
    const width = 0.8;
    const result = moveBox(level, box(0, 0, width, 1), 7, 0, [beyond]);
    assertNear(result.x, wallColumn - width, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });

  test('pushing against a box already touching the mover\'s front doesn\'t move it', () => {
    const level = levelFrom(['......', '######']);
    const start = box(1, 0, 1, 1);
    const crate = box(start.x + start.width, 0, 1, 1);   // touching
    const result = moveBox(level, start, 1, 0, [crate]);
    assertNear(result.x, start.x, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitRight: true });
  });

  test('falling past boxes to the left and right of the mover is not blocked by them', () => {
    const groundRow = 4;
    const level = levelFrom(['.....', '.....', '.....', '.....', '#####']);
    const start = box(2, 0, 1, 1);
    const leftOfMover = box(0, 2, 1, 1);    // ends before the mover starts: no overlap
    const rightOfMover = box(4, 2, 1, 1);   // starts after the mover ends: no overlap
    const result = moveBox(level, start, 0, 5, [leftOfMover, rightOfMover]);
    assertNear(result.y, groundRow - start.height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('a box above the mover is ignored when falling, and a box below the ground is ignored', () => {
    const groundRow = 2;
    const level = levelFrom(['...', '...', '###', '...']);
    const above = box(1, -2, 1, 1);
    const belowGround = box(1, 3, 1, 1);
    const start = box(1, 0, 1, 1);
    const result = moveBox(level, start, 0, 3, [above, belowGround]);
    assertNear(result.y, groundRow - start.height, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('moving left and up, boxes beside or behind the mover are ignored', () => {
    const level = levelFrom(['......', '......', '......', '######']);
    const start = box(3, 2, 1, 1);
    const rightOfMover = box(5, 2, 1, 1);   // behind, when moving left
    const belowMover = box(3, 3, 1, 1);     // behind, when moving up
    const leftAndAbove = box(0, 0, 1, 1);   // not in the path of either move
    const dx = -2;
    const dy = -1;
    const result = moveBox(level, start, dx, dy, [rightOfMover, belowMover, leftAndAbove]);
    assertNear(result.x, start.x + dx, 'x');
    assertNear(result.y, start.y + dy, 'y');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('a box standing on a solid box stays on it when pulled down', () => {
    const level = levelFrom(['...', '...', '...', '###']);
    const crate = box(1, 2, 1, 1);
    const height = 1;
    const standing = box(1, crate.y - height, 1, height);   // feet exactly on the crate's top
    const result = moveBox(level, standing, 0, 0.01, [crate]);
    assertNear(result.y, standing.y, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, onGround: true });
  });

  test('jumping up, a box below the mover is ignored', () => {
    const level = levelFrom(['....', '....', '....', '....', '####']);
    const start = box(1, 2, 1, 1);
    const below = box(1, 3, 1, 1);   // under the mover's feet
    const dy = -1.5;
    const result = moveBox(level, start, 0, dy, [below]);
    assertNear(result.y, start.y + dy, 'y');
    assert.deepEqual(hits(result), NO_HITS);
  });

  test('jumping up, a box above a nearer ceiling is ignored: the ceiling stops the jump', () => {
    const ceilingRow = 1;
    const level = levelFrom(['....', '.#..', '....', '....', '####']);
    const aboveCeiling = box(1, -2, 1, 1);
    const result = moveBox(level, box(1, 3, 1, 1), 0, -6, [aboveCeiling]);
    assertNear(result.y, ceilingRow + 1, 'y');
    assert.deepEqual(hits(result), { ...NO_HITS, hitCeiling: true });
  });

  test('moving left, a box beyond a nearer wall is ignored', () => {
    const wallColumn = 2;
    const level = levelFrom(['..#.....', '########']);
    const beyond = box(0, 0, 1, 1);
    const result = moveBox(level, box(6, 0, 1, 1), -6, 0, [beyond]);
    assertNear(result.x, wallColumn + 1, 'x');
    assert.deepEqual(hits(result), { ...NO_HITS, hitLeft: true });
  });

  test('the box passed in is not changed', () => {
    const level = levelFrom(['....', '####']);
    const start = box(1, 0);
    const before = { ...start };
    moveBox(level, start, 1, 1);
    assert.deepEqual(start, before);
  });
});

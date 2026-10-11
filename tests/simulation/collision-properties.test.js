// Randomised checks of moveBox: thousands of random boxes and moves, each
// checked against rules that must hold for every move. This covers combinations
// of position, size, and speed nobody would think to write by hand.
// Repeatable: a fixed seed, and a failure names the case to reproduce it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveBox, overlapsSolid } from '../../src/simulation/collision.js';
import { seededRandom } from '../helpers/random.js';

// Fixed so every run checks the same cases. To explore more, run with another
// seed, e.g. COLLISION_SEED=123 node --test tests/simulation/collision-properties.test.js
const SEED = Number(process.env.COLLISION_SEED) || 20261010;
const CASES = 5000;
const TOLERANCE = 1e-9;

// Platforms, walls, gaps, a non-solid tile type (~), and a pit in the bottom row.
const GRID = [
  '............',
  '...##.......',
  '.......#....',
  '..~~...#....',
  '#...###.....',
  '.........#..',
  '##.####.####',
];
const LEVEL = {
  width: GRID[0].length,
  height: GRID.length,
  grid: GRID,
  tileTypes: { '#': { solid: true, color: '#000000' }, '~': { solid: false, color: '#0000ff' } },
};

const isSolid = (column, row) =>
  row >= 0 && row < LEVEL.height && column >= 0 && column < LEVEL.width && GRID[row][column] === '#';
const isWhole = (v) => Math.abs(v - Math.round(v)) < TOLERANCE;
/** Whole cells a span from start to end overlaps (touching edges don't count). */
const cellsOf = (start, end) => {
  const cells = [];
  for (let c = Math.floor(start + TOLERANCE); c < end - TOLERANCE; c++) cells.push(c);
  return cells;
};

/** A move distance: sometimes tiny, sometimes several tiles, either direction, sometimes zero. */
function randomDistance(random) {
  if (random() < 0.1) return 0;
  const magnitude = 10 ** random.between(-4, Math.log10(12));
  return random() < 0.5 ? -magnitude : magnitude;
}

/** A random box that starts clear of every solid tile. */
function randomClearBox(random) {
  for (;;) {
    const width = random.between(0.1, 2.5);
    const height = random.between(0.1, 2.5);
    const box = { x: random.between(0, LEVEL.width - width), y: random.between(-3, LEVEL.height + 1), width, height };
    if (!overlapsSolid(LEVEL, box)) return box;
  }
}

/** Every rule a single move must obey; returns the broken ones. */
function brokenRules(start, dx, dy, r) {
  const broken = [];
  const moved = { ...start, x: r.x, y: r.y };
  const right = r.x + start.width;
  const bottom = r.y + start.height;
  // Moves are resolved X first (at the starting height), then Y (at the new x).
  // So a sideways hit is checked against the rows the box covered at the start,
  // and a vertical hit against the columns it covers at the end.
  const columns = cellsOf(r.x, right);
  const rowsDuringXMove = cellsOf(start.y, start.y + start.height);

  // 1. Never ends inside a solid tile.
  if (overlapsSolid(LEVEL, moved)) broken.push('ends inside a solid tile');
  // 2. Stays within the level's side edges.
  if (r.x < -TOLERANCE || right > LEVEL.width + TOLERANCE) broken.push('ends outside the side edges');
  // 3. Moves only the way it was asked to, and never further than asked.
  if (Math.sign(r.x - start.x) * Math.sign(dx) < 0 || Math.abs(r.x - start.x) > Math.abs(dx) + TOLERANCE) broken.push('x moved the wrong way or too far');
  if (Math.sign(r.y - start.y) * Math.sign(dy) < 0 || Math.abs(r.y - start.y) > Math.abs(dy) + TOLERANCE) broken.push('y moved the wrong way or too far');
  // 4. When nothing stopped it, it moved the full distance.
  if (!r.hitLeft && !r.hitRight && Math.abs(r.x - (start.x + dx)) > TOLERANCE) broken.push('x not blocked but moved short');
  if (!r.onGround && !r.hitCeiling && Math.abs(r.y - (start.y + dy)) > TOLERANCE) broken.push('y not blocked but moved short');
  // 5. A reported hit means it is touching what stopped it.
  if (r.onGround && !(isWhole(bottom) && columns.some((c) => isSolid(c, Math.round(bottom))))) broken.push('onGround but not standing on a solid tile');
  if (r.hitCeiling && !(isWhole(r.y) && columns.some((c) => isSolid(c, Math.round(r.y) - 1)))) broken.push('hitCeiling but no solid tile just above');
  if (r.hitRight && !(isWhole(right) && (Math.round(right) === LEVEL.width || rowsDuringXMove.some((row) => isSolid(Math.round(right), row))))) broken.push('hitRight but nothing solid just to the right');
  if (r.hitLeft && !(isWhole(r.x) && (Math.round(r.x) === 0 || rowsDuringXMove.some((row) => isSolid(Math.round(r.x) - 1, row))))) broken.push('hitLeft but nothing solid just to the left');
  // 6. Hits only in the direction of movement.
  if ((r.hitLeft && dx >= 0) || (r.hitRight && dx <= 0) || (r.onGround && dy <= 0) || (r.hitCeiling && dy >= 0)) broken.push('a hit reported against the direction of movement');
  return broken;
}

test(`${CASES} random moves from clear positions all obey the collision rules (seed ${SEED})`, () => {
  const random = seededRandom(SEED);
  const failures = [];
  for (let i = 0; i < CASES; i++) {
    const start = randomClearBox(random);
    const dx = randomDistance(random);
    const dy = randomDistance(random);
    const result = moveBox(LEVEL, start, dx, dy);
    const broken = brokenRules(start, dx, dy, result);
    if (broken.length > 0) failures.push({ case: i, start, dx, dy, result, broken });
  }
  const describe = ({ case: i, start, dx, dy, result: r, broken }) =>
    `case ${i}: box at (${start.x}, ${start.y}) size ${start.width} × ${start.height}, move (${dx}, ${dy}) ` +
    `→ (${r.x}, ${r.y}) hits ${JSON.stringify({ L: r.hitLeft, R: r.hitRight, C: r.hitCeiling, G: r.onGround })}: ${broken.join('; ')}`;
  assert.equal(failures.length, 0,
    `${failures.length} of ${CASES} cases broke a rule. First 5:\n${failures.slice(0, 5).map(describe).join('\n')}`);
});

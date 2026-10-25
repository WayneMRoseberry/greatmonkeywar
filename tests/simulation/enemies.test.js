// Tests for enemies: patrolling (task 5.2; PRD reqs 49-50).
//
// Grids use the standard legend (level-builder.js): e is a "beetle" enemy,
// c a stackable crate. Unless a test says otherwise the enemy is 1 × 1 tile,
// so its edges line up with the tiles. By default an enemy starts walking left.
//
// Decided for patrolling:
//  - an enemy on the ground walks at its patrol speed (character definition)
//    in the direction it faces;
//  - it turns around when it walks into a wall: a solid tile, the level's
//    side edge, or a resting stackable object;
//  - it turns around at the edge of a platform or stack: a step that would
//    take its front edge past the end of the ground under it isn't taken, so
//    it never hangs over the edge;
//  - in the air it doesn't move sideways: it falls straight down under gravity
//    (tuning, as for the player) and patrols again once it lands;
//  - an enemy entirely below the level (in a pit) is removed;
//  - enemies pass through each other and through the player (touching the
//    player is contact damage, task 5.3), and a resting crate they already
//    overlap isn't solid to them, so they can walk out of it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { CarriableObject } from '../../src/simulation/objects.js';
import { FIXED_DT, STEPS_PER_SECOND, Facing } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { Input, NO_INPUT, holding } from '../../src/simulation/input.js';

const ONE_TILE = { width: 1, height: 1 };
const SPEED = 2;
const TUNING = { gravity: 30, maxFallSpeed: 12 };

/** A state from `grid` with a 1 × 1 player and enemy, the enemy's patrol speed SPEED, and TUNING. */
function enemyState(grid, { enemy = {}, legend = {} } = {}) {
  return createLevelState(buildData(grid, {
    player: { size: ONE_TILE }, enemy: { size: ONE_TILE, speed: SPEED, ...enemy }, tuning: TUNING, legend,
  }), TEST_LEVEL);
}

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

const bottom = (box) => box.y + box.height;
const right = (box) => box.x + box.width;

/** Steps `count` times with no input, calling `check(state, i)` after each step; returns the last state. */
function stepWatching(state, count, check) {
  let current = state;
  for (let i = 0; i < count; i++) {
    current = step(current, NO_INPUT, FIXED_DT);
    check(current, i);
  }
  return current;
}

/** Steps with no input until `done(state)`, and returns that state; fails after `maxSteps`. */
function stepUntil(state, done, maxSteps = 10 * STEPS_PER_SECOND) {
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    current = step(current, NO_INPUT, FIXED_DT);
    if (done(current)) return current;
  }
  assert.fail(`not done after ${maxSteps} steps`);
}

describe('patrol (reqs 49-50)', () => {
  describe('walking', () => {
    test('an enemy on the ground walks left at its patrol speed', () => {
      const state = enemyState(['P.......G', '....e....', '#########']);
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, before.x - SPEED * FIXED_DT, 'x');
      assert.equal(after.vx, -SPEED);
      assert.equal(after.facing, Facing.LEFT);
    });

    test('an enemy placed facing right walks right at its patrol speed', () => {
      const state = enemyState(['P.......G', '....r....', '#########'], { legend: { r: { enemy: 'beetle', facing: Facing.RIGHT } } });
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, before.x + SPEED * FIXED_DT, 'x');
      assert.equal(after.vx, SPEED);
    });

    test('the patrol speed comes from the enemy\'s character definition', () => {
      const speed = 5;
      const state = enemyState(['P.......G', '....e....', '#########'], { enemy: { speed } });
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, before.x - speed * FIXED_DT, 'x');
    });

    test('an enemy walking on the ground stays on it: it doesn\'t sink or rise', () => {
      const state = enemyState(['P.......G', '....e....', '#########']);
      const startY = state.enemies[0].y;
      stepWatching(state, 30, (s, i) => assertNear(s.enemies[0].y, startY, `y at step ${i}`));
    });
  });

  describe('turning at walls', () => {
    test('walking into a solid tile, it stops flush against it and turns around', () => {
      const wallRight = 3;   // the wall is column 2
      const state = enemyState(['P.......G', '..#.e....', '#########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      const [enemy] = turned.enemies;
      assertNear(enemy.x, wallRight, 'flush against the wall');
      assert.equal(enemy.vx, SPEED);
    });

    test('after turning at a wall it walks the other way', () => {
      const state = enemyState(['P.......G', '..#.e....', '#########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      const after = step(turned, NO_INPUT, FIXED_DT);
      assertNear(after.enemies[0].x, turned.enemies[0].x + SPEED * FIXED_DT, 'x');
    });

    test('the level\'s left and right edges are walls it turns at', () => {
      const levelWidth = 6;
      const state = enemyState(['.....G', '..e..P', '######']);
      const atLeft = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      assertNear(atLeft.enemies[0].x, 0, 'flush against the left edge');
      const atRight = stepUntil(atLeft, (s) => s.enemies[0].facing === Facing.LEFT);
      assertNear(right(atRight.enemies[0]), levelWidth, 'flush against the right edge');
    });

    test('a crate resting on the ground is a wall it turns at', () => {
      const crateRight = 3;   // the crate is column 2
      const state = enemyState(['P.......G', '..c.e....', '#########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      assertNear(turned.enemies[0].x, crateRight, 'flush against the crate');
    });
  });

  describe('turning at edges', () => {
    test('on a platform it walks to each edge and turns, never hanging over either edge', () => {
      // The platform is columns 3-5 of row 2; the enemy stands on it in column 4.
      const platformLeft = 3;
      const platformRight = 6;
      const state = enemyState(['P........G', '....e.....', '...###....', '..........', '##########']);
      const startY = state.enemies[0].y;
      const facings = new Set();
      stepWatching(state, 4 * STEPS_PER_SECOND, (s, i) => {
        const [enemy] = s.enemies;
        assert.ok(enemy.x >= platformLeft - 1e-9, `left edge past the platform at step ${i}: ${enemy.x}`);
        assert.ok(right(enemy) <= platformRight + 1e-9, `right edge past the platform at step ${i}: ${right(enemy)}`);
        assertNear(enemy.y, startY, `y at step ${i}`);
        facings.add(enemy.facing);
      });
      assert.deepEqual([...facings].sort(), [Facing.LEFT, Facing.RIGHT].sort(), 'it turned both ways');
    });

    test('it turns within one step of the edge', () => {
      const platformLeft = 3;
      const state = enemyState(['P........G', '....e.....', '...###....', '..........', '##########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      const gap = turned.enemies[0].x - platformLeft;
      assert.ok(gap >= -1e-9 && gap <= SPEED * FIXED_DT + 1e-9, `turned ${gap} from the edge`);
    });

    test('on a single crate it turns at both edges and never falls off', () => {
      const crateTop = 2;
      const state = enemyState(['P.......G', '....e....', '....c....', '#########']);
      const facings = new Set();
      stepWatching(state, 2 * STEPS_PER_SECOND, (s, i) => {
        assertNear(bottom(s.enemies[0]), crateTop, `bottom at step ${i}`);
        facings.add(s.enemies[0].facing);
      });
      assert.equal(facings.size, 2, 'it turned both ways');
    });

    test('on top of a row of crates it walks across them without snagging, and turns at the stack\'s ends', () => {
      // Crates in columns 2-4 of row 2; the enemy starts on the middle one.
      const stackLeft = 2;
      const stackRight = 5;
      const state = enemyState(['P.......G', '...e.....', '..ccc....', '#########']);
      const startY = state.enemies[0].y;
      let walked = 0;
      let previousX = state.enemies[0].x;
      stepWatching(state, 4 * STEPS_PER_SECOND, (s, i) => {
        const [enemy] = s.enemies;
        assert.ok(enemy.x >= stackLeft - 1e-9 && right(enemy) <= stackRight + 1e-9, `off the stack at step ${i}`);
        assertNear(enemy.y, startY, `y at step ${i}`);
        walked += Math.abs(enemy.x - previousX);
        previousX = enemy.x;
      });
      assert.ok(walked > stackRight - stackLeft, `it walked ${walked} tiles in all`);
    });
  });

  describe('falling', () => {
    test('an enemy with nothing under it falls straight down under gravity, not moving sideways', () => {
      const state = enemyState(['P.......G', '....e....', '.........', '.........', '#########']);
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.vy, TUNING.gravity * FIXED_DT, 'vy');
      assertNear(after.y, before.y + TUNING.gravity * FIXED_DT * FIXED_DT, 'y');
      assertNear(after.x, before.x, 'x');
      assert.equal(after.vx, 0);
    });

    test('falling speeds up to maxFallSpeed and no faster', () => {
      const grid = ['P...G', '..e..', ...Array.from({ length: 40 }, () => '.....'), '#####'];
      let reachedMax = false;
      stepWatching(enemyState(grid), STEPS_PER_SECOND, (s, i) => {
        const expected = Math.min((i + 1) * TUNING.gravity * FIXED_DT, TUNING.maxFallSpeed);
        assertNear(s.enemies[0].vy, expected, `vy at step ${i}`);
        reachedMax ||= expected === TUNING.maxFallSpeed;
      });
      assert.ok(reachedMax, 'the test should reach maxFallSpeed');
    });

    test('it lands on the ground, then patrols again in the direction it faces', () => {
      const groundTop = 4;
      const state = enemyState(['P.......G', '....e....', '.........', '.........', '#########']);
      const startX = state.enemies[0].x;
      const landed = stepUntil(state, (s) => s.enemies[0].vy === 0 && bottom(s.enemies[0]) > state.enemies[0].y + 1);
      assertNear(bottom(landed.enemies[0]), groundTop, 'landed on the ground');
      assertNear(landed.enemies[0].x, startX, 'it fell straight down');
      const walking = step(landed, NO_INPUT, FIXED_DT);
      assert.ok(walking.enemies[0].x < landed.enemies[0].x, 'it walks left again');
    });

    test('it lands on a crate', () => {
      const crateTop = 3;
      const state = enemyState(['P.......G', '....e....', '.........', '....c....', '#########']);
      const landed = stepUntil(state, (s) => s.enemies[0].vy === 0 && s.enemies[0].y > state.enemies[0].y);
      assertNear(bottom(landed.enemies[0]), crateTop, 'on the crate');
    });

    test('when the crate under it is picked up, it falls', () => {
      // The enemy stands on the crate in column 2; the player, in column 1, picks the crate up.
      const groundTop = 3;
      const state = enemyState(['.....G', '..e...', '.Pc...', '######']);
      const picked = step(state, holding(Input.ACTION), FIXED_DT);
      assert.ok(picked.objects[0].held, 'the player picked up the crate');
      const landed = stepUntil(picked, (s) => bottom(s.enemies[0]) > groundTop - 1e-9);
      assertNear(bottom(landed.enemies[0]), groundTop, 'it fell to the ground');
    });

    test('an enemy that falls into a pit is removed from the level', () => {
      const state = enemyState(['P.e..G', '##.###']);
      const after = stepUntil(state, (s) => s.enemies.length === 0);
      assert.deepEqual(after.enemies, []);
    });
  });

  describe('what enemies don\'t collide with', () => {
    test('enemies pass through each other', () => {
      // Two enemies walking towards each other, then past each other.
      const state = enemyState(['P.........G', '..r....e...', '###########'], { legend: { r: { enemy: 'beetle', facing: Facing.RIGHT } } });
      const passed = stepUntil(state, (s) => s.enemies[0].x > s.enemies[1].x + 1);
      assert.equal(passed.enemies[0].facing, Facing.RIGHT);
      assert.equal(passed.enemies[1].facing, Facing.LEFT);
    });

    test('an enemy walks through the player without turning', () => {
      const state = enemyState(['.........G', '..P..e....', '##########']);
      const passed = stepUntil(state, (s) => right(s.enemies[0]) < s.player.x);
      assert.equal(passed.enemies[0].facing, Facing.LEFT);
    });

    test('a coconut doesn\'t stop an enemy', () => {
      const state = enemyState(['P.......G', '..o.e....', '#########']);
      const coconutLeft = state.objects[0].x;
      const passed = stepUntil(state, (s) => right(s.enemies[0]) < coconutLeft);
      assert.equal(passed.enemies[0].facing, Facing.LEFT);
    });

    test('a crate resting where the enemy stands isn\'t solid to it: it walks out', () => {
      const state = enemyState(['P.......G', '....e....', '#########']);
      const [enemy] = state.enemies;
      const crate = new CarriableObject({ type: 'crate', ...ONE_TILE, x: enemy.x, y: enemy.y, resting: true });
      const [after] = step({ ...state, objects: [crate] }, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, enemy.x - SPEED * FIXED_DT, 'x');
      assert.equal(after.facing, Facing.LEFT);
    });
  });
});
